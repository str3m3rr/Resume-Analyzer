import { useEffect, useRef, useState, useCallback } from 'react';
import { Download, Mic, MicOff, X, Volume2, Send, AlertTriangle, RotateCcw, Sparkles, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { jsPDF } from 'jspdf';
import AvatarViewer from './AvatarViewer';
import { createInterview, submitInterviewTurn, transcribeAudio } from './api';

/* ────────── TTS helper ────────── */
function speak(text, onEnd) {
  if (!window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.98;
  utterance.pitch = 1;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

/* ────────── Progress ring (SVG) ────────── */
function ProgressRing({ completed, total }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - progress);

  return (
    <div className="interview-progress-ring">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(148,163,184,.15)" strokeWidth="3" />
        <circle
          cx="28" cy="28" r={radius} fill="none"
          stroke="url(#progress-grad)" strokeWidth="3"
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .6s ease', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
        <defs>
          <linearGradient id="progress-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#B829FF" />
            <stop offset="100%" stopColor="#00E5FF" />
          </linearGradient>
        </defs>
      </svg>
      <span className="progress-ring-label">{completed}/{total}</span>
    </div>
  );
}

/* ────────── Score badge ────────── */
function ScoreBadge({ rating }) {
  const num = typeof rating === 'number' ? rating : parseFloat(rating) || 5;
  const color = num >= 7 ? '#00FF88' : num >= 4 ? '#FFB800' : '#FF4D6A';
  return (
    <span className="interview-score-badge" style={{ '--badge-color': color }}>
      {num}/10
    </span>
  );
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function AIInterviewModal({
  resume,
  jd,
  initialDifficulty = 'medium',
  initialQuestionCount = 5,
  preloadedPool = null,
  onClose,
}) {
  /* ── state ── */
  const [session, setSession] = useState(null);
  const [answer, setAnswer] = useState('');
  const [phase, setPhase] = useState('loading');   // loading | speaking | ready | evaluating | complete | error
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [lastEvaluation, setLastEvaluation] = useState(null);
  const [difficulty, setDifficulty] = useState(initialDifficulty || 'medium');
  const [questionCount, setQuestionCount] = useState(initialQuestionCount || 5);
  const [retryCount, setRetryCount] = useState(0);
  const [showPromptDetails, setShowPromptDetails] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  /* ── derived ── */
  const busy = phase === 'loading' || phase === 'evaluating' || transcribing;
  const report = session?.report ?? null;

  /* ── cleanup ── */
  const stopMicrophone = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach(t => t.stop()); } catch (_) {}
      streamRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) {}
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const cleanup = useCallback(() => {
    window.speechSynthesis?.cancel();
    stopMicrophone();
  }, [stopMicrophone]);

  /* ── start interview ── */
  useEffect(() => {
    let active = true;

    const effectiveJd = (jd && jd.trim().length >= 10)
      ? jd.trim()
      : (resume && resume.trim().length >= 20
          ? `Role matching candidate background: ${resume.trim().slice(0, 150)}`
          : 'Software Engineering and Technical Systems Role');

    setPhase('loading');
    setError('');

    // If preloaded questions exist for chosen difficulty, select from pool
    const poolQuestions = preloadedPool && Array.isArray(preloadedPool[difficulty])
      ? preloadedPool[difficulty].slice(0, questionCount)
      : null;

    createInterview(resume || '', effectiveJd, {
      difficulty,
      questionCount,
      questions: poolQuestions,
    })
      .then(data => {
        if (!active) return;
        setSession(data);
        setPhase('speaking');
        setSpeaking(true);
        speak(data.question.text, () => {
          if (!active) return;
          setSpeaking(false);
          setPhase('ready');
          textareaRef.current?.focus();
        });
      })
      .catch(err => {
        if (!active) return;
        const detail = err?.response?.data?.detail;
        const msg = Array.isArray(detail)
          ? detail.map(d => d.msg).join('; ')
          : (typeof detail === 'string' ? detail : 'Unable to start the interview. Check that the backend is running.');
        setError(msg);
        setPhase('error');
      });

    return () => { active = false; cleanup(); };
  }, [resume, jd, difficulty, questionCount, preloadedPool, retryCount, cleanup]);

  /* ── Native MediaRecorder + Groq Whisper Speech-to-Text ── */
  const toggleListening = useCallback(async () => {
    if (listening) {
      stopMicrophone();
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Audio recording is not supported in this browser. Please type your answer.');
      return;
    }

    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        setListening(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }

        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (audioBlob.size < 300) return;

        setTranscribing(true);
        try {
          const res = await transcribeAudio(audioBlob);
          if (res && res.text && res.text.trim()) {
            setAnswer(res.text.trim());
          }
        } catch (err) {
          console.error('Groq Whisper transcribe error:', err);
          setError('Speech-to-text error: ' + (err?.message || 'Failed to transcribe audio.'));
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setListening(true);

      // Web Speech API for real-time live typing preview while speaking
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const speechInstance = new SpeechRec();
          speechInstance.continuous = true;
          speechInstance.interimResults = true;
          speechInstance.lang = 'en-US';
          speechInstance.onresult = (evt) => {
            let currentTranscript = '';
            for (let i = 0; i < evt.results.length; i++) {
              currentTranscript += evt.results[i][0].transcript + ' ';
            }
            if (currentTranscript.trim()) {
              setAnswer(currentTranscript.trim());
            }
          };
          speechInstance.onerror = (e) => {
            console.warn('Web Speech API note (will fallback to Groq Whisper):', e?.error);
          };
          speechInstance.start();
          recognitionRef.current = speechInstance;
        } catch (err) {
          console.warn('SpeechRecognition preview unavailable:', err);
        }
      }
    } catch (err) {
      console.error('Microphone access failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access blocked. Click the lock/settings icon in your browser URL bar to allow microphone access.');
      } else {
        setError('Could not access microphone: ' + err.message);
      }
      setListening(false);
    }
  }, [listening, stopMicrophone]);

  /* ── submit answer ── */
  const submit = useCallback(async () => {
    if (!answer.trim() || busy || !session) return;
    stopMicrophone();
    setPhase('evaluating');

    try {
      const payload = {
        session_id: session.session_id,
        resume: resume || '',
        jd,
        agenda: session.agenda,
        current_index: session.current_index,
        history: session.history,
        candidate_answer: answer,
      };
      const data = await submitInterviewTurn(payload);
      setSession(data);
      setLastEvaluation(data.evaluation ?? null);
      setAnswer('');

      if (data.complete) {
        setPhase('complete');
        return;
      }

      /* Speak transition + next question */
      setPhase('speaking');
      setSpeaking(true);
      const transition = data.transition || '';
      const question = data.question?.text || '';
      speak(transition, () => {
        speak(question, () => {
          setSpeaking(false);
          setPhase('ready');
          textareaRef.current?.focus();
        });
      });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'The evaluation service could not process this answer. Please try again.');
      setPhase('ready');
    }
  }, [answer, busy, session, resume, jd, stopMicrophone]);

  /* ── keyboard shortcut: Ctrl+Enter to submit ── */
  const handleKeyDown = useCallback(e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }, [submit]);

  /* ── export report ── */
  const exportReport = useCallback((format) => {
    if (!report) return;
    const body = JSON.stringify(report, null, 2);
    if (format === 'json') {
      const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
      Object.assign(document.createElement('a'), { href: url, download: 'ai-interview-report.json' }).click();
      URL.revokeObjectURL(url);
    } else {
      const doc = new jsPDF();
      const lines = doc.splitTextToSize(body, 170);
      let y = 16;
      lines.forEach(line => {
        if (y > 280) { doc.addPage(); y = 16; }
        doc.text(line, 20, y);
        y += 6;
      });
      doc.save('ai-interview-report.pdf');
    }
  }, [report]);

  /* ════════════════════════════════════
     RENDER: Loading / Error state
     ════════════════════════════════════ */
  if (!session) {
    return (
      <div className="interview-overlay" onClick={onClose}>
        <div className="interview-panel interview-panel--narrow" onClick={e => e.stopPropagation()}>
          <button onClick={onClose} className="interview-close" aria-label="Close"><X size={18} /></button>
          <div className="interview-empty-state">
            {phase === 'error' ? (
              <>
                <div className="interview-error-icon"><AlertTriangle size={32} /></div>
                <p className="interview-error-msg">{error}</p>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button onClick={() => setRetryCount(c => c + 1)} className="interview-submit" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
                    <RotateCcw size={14} style={{ marginRight: '6px' }} /> Retry
                  </button>
                  <button onClick={onClose} className="interview-secondary">Close</button>
                </div>
              </>
            ) : (
              <>
                <div className="interview-loader">
                  <span /><span /><span />
                </div>
                <p className="interview-loading-text">
                  Preparing your {difficulty.toUpperCase()} interview ({questionCount} questions)…
                </p>
                <p style={{ color: '#64748B', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  Analyzed by Groq LLM · Tailored to your resume and job description
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════
     RENDER: Interview complete (report)
     ════════════════════════════════════ */
  if (report) {
    const readiness = typeof report.readiness_score === 'number' ? report.readiness_score : parseInt(report.readiness_score, 10) || 75;
    const jdMatch = typeof report.jd_match_percent === 'number' ? report.jd_match_percent : parseInt(report.jd_match_percent, 10) || 80;

    return (
      <div className="interview-overlay" onClick={onClose}>
        <section className="interview-panel" onClick={e => e.stopPropagation()}>
          <button onClick={onClose} className="interview-close" aria-label="Close"><X size={18} /></button>

          {/* Header */}
          <header className="interview-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <p className="eyebrow" style={{ margin: 0 }}>INTERVIEW COMPLETE</p>
                <span className={`interview-tag-badge tag-${session.difficulty || difficulty}`}>
                  {(session.difficulty || difficulty).toUpperCase()} LEVEL
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#B829FF]/15 text-[#B829FF] border border-[#B829FF]/30">
                  Evaluated by Groq AI
                </span>
              </div>
              <h2 className="interview-title">Your Performance Report</h2>
            </div>
          </header>

          {/* Score card */}
          <div className="interview-report-score">
            <div className="report-score-main">
              <strong>{readiness}</strong>
              <span>/ 100 Readiness Score</span>
            </div>
            <div className="report-score-jd">
              <b>{jdMatch}%</b>
              <span>JD Match Alignment</span>
            </div>
          </div>

          {/* Coaching */}
          <div className="interview-coaching">
            <h4>Groq AI Coaching Advice</h4>
            <p>{report.coaching_advice}</p>
          </div>

          {/* Priority gaps */}
          {report.gap_summary?.length > 0 && (
            <div className="interview-gap-summary">
              <b>Identified Key Gaps to Address:</b>
              <ul>
                {report.gap_summary.map((gap, i) => <li key={i}>{gap}</li>)}
              </ul>
            </div>
          )}

          {/* Key Strengths */}
          {report.key_strengths?.length > 0 && (
            <div style={{ padding: '0.9rem 1rem', marginBottom: '0.75rem', borderLeft: '3px solid #00FF88', borderRadius: '0 0.75rem 0.75rem 0', background: 'rgba(0,255,136,0.04)', color: '#CBD5E1', fontSize: '0.85rem' }}>
              <b style={{ color: '#00FF88', display: 'block', marginBottom: '0.4rem' }}>Demonstrated Strengths:</b>
              <ul style={{ margin: '0 0 0 1.1rem', padding: 0, color: '#94A3B8' }}>
                {report.key_strengths.map((str, i) => <li key={i}>{str}</li>)}
              </ul>
            </div>
          )}

          {/* Breakdown */}
          {report.breakdown?.map((item, index) => (
            <article className="interview-breakdown" key={index}>
              <div className="breakdown-header">
                <b>Q{index + 1}. {item.question}</b>
                <ScoreBadge rating={item.rating} />
              </div>
              <p className="breakdown-answer"><strong>Your Answer:</strong> {item.answer}</p>
              {item.gaps && (
                <div style={{ fontSize: '0.82rem', color: '#FFB800', background: 'rgba(255,184,0,0.08)', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', borderLeft: '3px solid #FFB800', marginTop: '0.45rem' }}>
                  <strong style={{ color: '#FFD700', display: 'block', marginBottom: '0.2rem' }}>⚠️ Identified Gap:</strong>
                  <span>{Array.isArray(item.gaps) ? item.gaps.join('; ') : item.gaps}</span>
                </div>
              )}
            </article>
          ))}

          {/* AI Prompt Transparency Inspector */}
          <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
            <button
              onClick={() => setShowPromptDetails(!showPromptDetails)}
              className="text-xs text-[#00E5FF] hover:underline flex items-center gap-1 font-bold"
            >
              <Terminal size={13} />
              {showPromptDetails ? 'Hide AI Prompt & Debug Details' : 'Show AI Prompt Given to Groq (Transparency)'}
              {showPromptDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showPromptDetails && (
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(0,0,0,0.4)', borderRadius: '0.5rem', border: '1px solid rgba(0,229,255,0.2)', fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
                <p style={{ color: '#00FF88', margin: '0 0 4px 0' }}>// Evaluator: Groq (qwen/qwen3.8-27b)</p>
                {report.ai_prompt || (session.history?.[0]?.ai_prompt) || 'Prompt executed via Groq chat completion API.'}
              </div>
            )}
          </div>

          {/* Export buttons */}
          <div className="interview-export-row">
            <button className="interview-secondary" onClick={() => exportReport('json')}>
              <Download size={14} /> Export JSON
            </button>
            <button className="interview-secondary" onClick={() => exportReport('pdf')}>
              <Download size={14} /> Export PDF
            </button>
          </div>
        </section>
      </div>
    );
  }

  /* ════════════════════════════════════
     RENDER: Active interview session
     ════════════════════════════════════ */
  const statusText =
    phase === 'speaking'   ? 'Interviewer is speaking…' :
    phase === 'evaluating' ? 'Evaluating your answer via Groq AI…' :
    transcribing           ? 'Transcribing your audio with Groq Whisper…' :
    listening              ? 'Listening to you… speak now (Click to stop)' :
                             'Ready for your answer';

  const currentDiff = session.question?.difficulty || session.difficulty || difficulty;

  return (
    <div className="interview-overlay" onClick={onClose}>
      <section className="interview-panel" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="interview-close" aria-label="Close"><X size={18} /></button>

        {/* ── Header ── */}
        <header className="interview-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <p className="eyebrow" style={{ margin: 0 }}>AI MOCK INTERVIEWER</p>
              <span className={`interview-tag-badge tag-${currentDiff}`}>
                {currentDiff.toUpperCase()} MODE
              </span>
              <span className="text-[10px] font-bold text-[#94A3B8]">
                Groq AI Powered
              </span>
            </div>
            <h2 className="interview-title">Practice Under Pressure</h2>
          </div>
          <ProgressRing completed={session.completed} total={session.total} />
        </header>

        {/* ── Two-column layout ── */}
        <div className="interview-grid">

          {/* Left column: avatar + status */}
          <div className="interview-left">
            <AvatarViewer speaking={speaking} />
            <div className={`interview-status ${speaking ? 'is-speaking' : ''} ${listening ? 'is-listening' : ''}`}>
              {speaking ? <Volume2 size={14} /> : listening ? <Mic size={14} className="text-[#FF4D6A] animate-pulse" /> : null}
              {statusText}
            </div>

            {/* Quick Difficulty Switch */}
            <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>
                SWITCH DIFFICULTY
              </span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {['easy', 'medium', 'hard'].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      if (d !== difficulty) {
                        setDifficulty(d);
                        setRetryCount(c => c + 1);
                      }
                    }}
                    className={`diff-pill ${difficulty === d ? `active-${d}` : ''}`}
                    style={{ flex: 1, padding: '0.25rem 0.4rem', textAlign: 'center' }}
                  >
                    {d.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: question + answer */}
          <div className="interview-right">

            {/* Question card */}
            <div className="interview-question">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                <span className="interview-question-label">Question {session.completed + 1} of {session.total}</span>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <span className={`interview-tag-badge tag-${currentDiff}`}>
                    {currentDiff.toUpperCase()}
                  </span>
                  {session.question?.focus && (
                    <span className="interview-tag-badge tag-focus">
                      {session.question.focus}
                    </span>
                  )}
                </div>
              </div>
              <p className="interview-question-text">{session.question.text}</p>
            </div>

            {/* Last evaluation feedback */}
            {lastEvaluation && (
              <div className="interview-evaluation">
                <div className="eval-scores">
                  <ScoreBadge rating={lastEvaluation.rating} />
                  <small>Technical {lastEvaluation.technical_correctness}/10</small>
                  <small>Clarity {lastEvaluation.clarity}/10</small>
                  <small>Depth {lastEvaluation.depth}/10</small>
                  <span className="text-[10px] text-[#B829FF] ml-auto font-bold">Groq Evaluated</span>
                </div>
                {lastEvaluation.gaps && (
                  <p className="eval-gaps">
                    {Array.isArray(lastEvaluation.gaps) ? lastEvaluation.gaps.join(' ') : lastEvaluation.gaps}
                  </p>
                )}
                {lastEvaluation.ai_prompt && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowPromptDetails(!showPromptDetails)}
                      className="text-[11px] text-[#00E5FF] hover:underline flex items-center gap-1 font-bold"
                    >
                      <Terminal size={11} /> {showPromptDetails ? 'Hide prompt' : 'Show AI prompt given to Groq'}
                    </button>
                    {showPromptDetails && (
                      <div style={{ marginTop: '0.4rem', padding: '0.5rem', background: 'rgba(0,0,0,0.5)', borderRadius: '0.4rem', border: '1px solid rgba(0,229,255,0.2)', fontSize: '0.7rem', color: '#CBD5E1', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto' }}>
                        {lastEvaluation.ai_prompt}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error toast */}
            {error && phase !== 'error' && (
              <div className="interview-toast">
                <AlertTriangle size={14} />
                <span>{error}</span>
                <button onClick={() => setError('')}><X size={12} /></button>
              </div>
            )}

            {/* Live microphone recording indicator */}
            {listening && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.95rem',
                borderRadius: '0.5rem',
                background: 'rgba(255, 77, 106, 0.12)',
                border: '1px solid rgba(255, 77, 106, 0.4)',
                color: '#FF4D6A',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: '0.6rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF4D6A', display: 'inline-block', boxShadow: '0 0 8px #FF4D6A' }} />
                  <span>🎙️ Microphone Active — Speak your answer now!</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#CBD5E1', opacity: 0.9 }}>
                  Click &ldquo;Stop &amp; Transcribe&rdquo; when finished
                </span>
              </div>
            )}

            {transcribing && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 0.95rem',
                borderRadius: '0.5rem',
                background: 'rgba(0, 229, 255, 0.12)',
                border: '1px solid rgba(0, 229, 255, 0.4)',
                color: '#00E5FF',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: '0.6rem'
              }}>
                <RotateCcw size={14} className="spin-icon" />
                <span>Transcribing your speech with Groq Whisper AI…</span>
              </div>
            )}

            {/* Answer textarea */}
            <textarea
              ref={textareaRef}
              className="interview-textarea"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Click 'Use microphone' to speak your answer, or type directly… (Ctrl+Enter to submit)"
              rows={6}
              disabled={busy}
            />

            {/* Action buttons */}
            <div className="interview-actions">
              <button
                type="button"
                className={`interview-secondary ${listening ? 'active mic-recording-pulse' : ''}`}
                onClick={toggleListening}
                disabled={busy && !listening}
                title={listening ? 'Click to stop recording and transcribe' : 'Click to start recording voice'}
                style={listening ? { background: '#FF4D6A', color: '#fff', borderColor: '#FF4D6A', fontWeight: 700 } : {}}
              >
                {listening ? <MicOff size={15} /> : <Mic size={15} />}
                {transcribing ? 'Transcribing with Whisper…' : listening ? 'Stop & Transcribe (Done speaking)' : 'Use microphone'}
              </button>

              <button
                className="interview-submit"
                disabled={busy || !answer.trim()}
                onClick={submit}
              >
                {phase === 'evaluating' ? (
                  <><RotateCcw size={15} className="spin-icon" /> Evaluating via Groq…</>
                ) : (
                  <><Send size={15} /> Submit answer</>
                )}
              </button>
            </div>

            <p className="interview-privacy">
              Audio recorded via your microphone is transcribed in sub-seconds by Groq Whisper and evaluated by Groq AI.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
