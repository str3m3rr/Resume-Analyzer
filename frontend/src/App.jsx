import SkillGraph from './SkillGraph';
import ExplainabilityPanel from './ExplainabilityPanel';
import FairnessReport from './FairnessReport';
import { ATSVisualizer, AIStrictnessSlider, ServerTelemetry, JobMarketRadar, FloatingActionDock } from './AIExtensions';
import { useState, useEffect, useRef } from 'react';
import { analyzeResume } from './api';
import { jsPDF } from 'jspdf';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut, Radar } from 'react-chartjs-2';
import {
  CheckCircle2, XCircle, Sparkles, UploadCloud,
  FileText, Loader2, Target, Zap, HeartHandshake, BarChart3,
  Brain, Search, ShieldCheck, ArrowRight, Sun, Moon, Bell, User, Clock, Download, TrendingUp
} from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler);

/* ─── Skeleton Components ─── */
const Skeleton = ({ className = '' }) => (
  <div className={`skeleton ${className}`}>&nbsp;</div>
);

const SkeletonLoading = () => (
  <div className="space-y-4">
    <div className="cyber-card p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-28 h-28 !rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      {[1, 2].map(i => (
        <div key={i} className="cyber-card p-5 space-y-3">
          <Skeleton className="h-5 w-1/2" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-16 !rounded-full" />
            <Skeleton className="h-7 w-20 !rounded-full" />
            <Skeleton className="h-7 w-14 !rounded-full" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ─── Main App ─── */
function App() {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [results, setResults] = useState(null);
  const [strictness, setStrictness] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rewriteTarget, setRewriteTarget] = useState(null);
  const [originalBullet, setOriginalBullet] = useState("");
  const [rewrittenBullet, setRewrittenBullet] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [huntLoading, setHuntLoading] = useState(false);
  const [huntResults, setHuntResults] = useState(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const [historyItems, setHistoryItems] = useState(() => {
    const saved = localStorage.getItem('historyItems');
    return saved ? JSON.parse(saved) : [];
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const confettiFired = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // ─── Persistence Sync ───
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('historyItems', JSON.stringify(historyItems));
  }, [historyItems]);

  const addNotification = (text, type = 'info') => {
    const newNote = { id: Date.now(), text, time: "Just now", type };
    setNotifications(prev => [newNote, ...prev].slice(0, 10)); // Keep last 10
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // ─── Animated Score Counter ───
  useEffect(() => {
    if (!results) { setDisplayScore(0); confettiFired.current = false; return; }
    const target = results.match_score;
    const duration = 1500;
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * target));
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayScore(target);
        if (target >= 80 && !confettiFired.current && window.confetti) {
          confettiFired.current = true;
          window.confetti({
            particleCount: 120, spread: 80,
            origin: { y: 0.6, x: 0.5 },
            colors: ['#B829FF', '#00E5FF', '#00FF88', '#FF4D6A'],
          });
        }
      }
    };
    requestAnimationFrame(animate);
  }, [results]);

  const getScoreEmoji = (score) => {
    if (score >= 90) return { emoji: '🔥', label: 'On Fire!' };
    if (score >= 75) return { emoji: '🎉', label: 'Amazing!' };
    if (score >= 40) return { emoji: '💪', label: 'Solid Start!' };
    return { emoji: '🎯', label: 'Keep Going!' };
  };

  // ─── Top 3 Improvements Generator ───
  const getTop3Improvements = () => {
    if (!results) return [];
    const improvements = [];
    
    // 1. Missing skills (highest priority)
    if (results.missing_skills?.length > 0) {
      const top = results.missing_skills.slice(0, 3).join(', ');
      improvements.push({
        priority: 1,
        label: `Add missing skills: ${top}`,
        impact: 'high',
        detail: `These ${Math.min(3, results.missing_skills.length)} skills appear in the JD but not your resume`
      });
    }
    
    // 2. JD Coverage gaps
    const coverage = results.explainability?.summary?.jd_coverage_percent || 0;
    if (coverage < 70) {
      improvements.push({
        priority: 2,
        label: `Improve JD coverage (currently ${coverage}%)`,
        impact: coverage < 40 ? 'high' : 'medium',
        detail: 'Mirror the JD\'s exact language in your experience bullets'
      });
    }
    
    // 3. Verb quality
    const weakVerbs = results.verb_analysis?.weak_verbs?.length || 0;
    const strongVerbs = results.verb_analysis?.strong_verbs?.length || 0;
    if (weakVerbs > strongVerbs) {
      improvements.push({
        priority: 3,
        label: 'Replace weak action verbs with power verbs',
        impact: 'medium',
        detail: 'Use words like Spearheaded, Architected, Optimized instead of Helped, Worked, Did'
      });
    }
    
    // 4. Low skill count
    if (results.detected_skills?.length < 5) {
      improvements.push({
        priority: 4,
        label: 'Add a dedicated Technical Skills section',
        impact: 'high',
        detail: `Only ${results.detected_skills.length} skills detected — list all relevant technologies`
      });
    }
    
    // 5. Quantifiable achievements
    if (results.match_score < 75) {
      improvements.push({
        priority: 5,
        label: 'Add measurable achievements with numbers',
        impact: 'medium',
        detail: 'e.g., "Reduced load time by 40%" instead of "Improved performance"'
      });
    }
    
    return improvements.slice(0, 3);
  };

  // ─── PDF Report Generator ───
  const downloadReport = () => {
    if (!results) return;
    
    const doc = new jsPDF();
    const margin = 20;
    let y = margin;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - margin * 2;
    
    const addLine = (text, size = 10, style = 'normal', color = [30, 30, 30]) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', style);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, maxWidth);
      if (y + lines.length * size * 0.5 > 275) {
        doc.addPage();
        y = margin;
      }
      doc.text(lines, margin, y);
      y += lines.length * size * 0.45 + 2;
    };
    
    const addSpacer = (h = 6) => { y += h; };
    const addDivider = () => {
      doc.setDrawColor(180, 180, 220);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
    };
    
    // Title
    addLine('RESUME ANALYSIS REPORT', 18, 'bold', [90, 20, 200]);
    addLine(`Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 9, 'normal', [120, 120, 120]);
    addSpacer(8);
    addDivider();
    
    // Score
    addLine(`MATCH SCORE: ${results.match_score}%`, 16, 'bold', results.match_score >= 75 ? [0, 150, 80] : results.match_score >= 40 ? [0, 100, 200] : [200, 50, 70]);
    addLine(results.match_score > 75 ? 'Excellent match — strong candidate.' : results.match_score > 40 ? 'Moderate match — some gaps to address.' : 'Significant gaps — needs improvement.', 10, 'normal', [80, 80, 80]);
    addSpacer();
    addDivider();
    
    // Top 3 Improvements
    addLine('TOP 3 IMPROVEMENTS', 13, 'bold', [90, 20, 200]);
    addSpacer(3);
    const improvements = getTop3Improvements();
    improvements.forEach((imp, i) => {
      addLine(`${i + 1}. ${imp.label}`, 10, 'bold');
      addLine(`   ${imp.detail}`, 9, 'normal', [100, 100, 100]);
      addSpacer(2);
    });
    addSpacer();
    addDivider();
    
    // Skills
    addLine('DETECTED SKILLS (Superpowers)', 13, 'bold', [0, 150, 80]);
    addSpacer(3);
    addLine(results.detected_skills.join(', ') || 'None detected', 10);
    addSpacer();
    
    addLine('MISSING SKILLS (Gaps)', 13, 'bold', [200, 50, 70]);
    addSpacer(3);
    addLine(results.missing_skills.join(', ') || 'No gaps — great coverage!', 10);
    addSpacer();
    addDivider();
    
    // JD Coverage
    const coverage = results.explainability?.summary;
    if (coverage) {
      addLine('JD COVERAGE ANALYSIS', 13, 'bold', [90, 20, 200]);
      addSpacer(3);
      addLine(`Overall Coverage: ${coverage.jd_coverage_percent}%`, 11, 'bold');
      addLine(`Resume Sentences Analyzed: ${coverage.total_resume_sentences}`, 10);
      addLine(`JD Requirements Found: ${coverage.total_jd_sentences}`, 10);
      addLine(`Strong Matches: ${coverage.strong_match_count}`, 10);
      addLine(`Uncovered Gaps: ${coverage.weak_areas_count}`, 10);
      addSpacer();
      addDivider();
    }
    
    // Advice
    addLine('AI RECOMMENDATIONS', 13, 'bold', [90, 20, 200]);
    addSpacer(3);
    results.recommendations.forEach((rec, i) => {
      const title = typeof rec === 'object' ? rec.title : `Recommendation ${i + 1}`;
      const text = typeof rec === 'object' ? rec.text : rec;
      addLine(`${title}`, 10, 'bold');
      addLine(text, 9, 'normal', [80, 80, 80]);
      addSpacer(3);
    });
    
    // Footer
    addSpacer(8);
    addLine('— Generated by Cyber-Purple AI Resume Analyzer v2.4', 8, 'italic', [150, 150, 150]);
    
    doc.save(`resume-analysis-${Date.now()}.pdf`);
  };

  // ─── Handlers ───
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !jobDescription) {
      setError("We need both your resume and the job description.");
      return;
    }
    if (historyItems.length >= 50) {
      setError("Scan budget exhausted! You've used all 50 scans.");
      return;
    }
    setLoading(true); setError(null); setResults(null);
    try {
      const data = await analyzeResume(file, jobDescription, false, strictness);
      setResults(data);
      
      // Save to History (capped at 50)
      const scanName = jobDescription.substring(0, 25) + "...";
      const newHistory = { 
        id: Date.now(), 
        name: scanName, 
        score: data.match_score, 
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      };
      setHistoryItems(prev => [newHistory, ...prev].slice(0, 50));
      addNotification(`Analysis Complete: ${data.match_score}% match score`, 'success');

    } catch (err) {
      setError("Something went wrong connecting to the server.");
    } finally {
      setLoading(false);
    }
  };

  const handleRewrite = async () => {
    if (!originalBullet) return;
    setIsRewriting(true); setRewrittenBullet("");
    try {
      const response = await fetch("http://localhost:8000/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_bullet: originalBullet,
          target_skill: rewriteTarget,
          job_role: jobDescription.substring(0, 50)
        }),
      });
      const data = await response.json();
      setRewrittenBullet(data.status === "success" ? data.rewritten_text : "AI hit a snag.");
    } catch (err) {
      setRewrittenBullet("Connection error.");
    } finally {
      setIsRewriting(false);
    }
  };

  const handleHuntMode = async () => {
    setHuntLoading(true); setHuntResults(null);
    try {
      const response = await fetch("http://localhost:8000/api/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: results.extracted_text }),
      });
      const { task_id } = await response.json();
      const poll = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/hunt-results/${task_id}`);
          const data = await res.json();
          if (data.status === "complete") { 
            clearInterval(poll); 
            setHuntResults(data.data); 
            setHuntLoading(false); 
            addNotification(`Hunt Mode: ${data.data.total_matched} matches found`, 'info');
          }
          else if (data.status === "failed") { 
            clearInterval(poll); 
            setHuntResults({ error: data.message }); 
            setHuntLoading(false); 
          }
        } catch (err) { clearInterval(poll); setHuntResults({ error: "Lost connection." }); setHuntLoading(false); }
      }, 3000);
    } catch (err) {
      setHuntResults({ error: "Could not start hunt." }); setHuntLoading(false);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.[0]?.type === "application/pdf") {
      setFile(e.dataTransfer.files[0]); setError(null);
    } else { setError("Please upload a PDF file."); }
  };

  // ─── Chart Data ───
  const getChartData = (score) => ({
    labels: ['Match', 'Gap'],
    datasets: [{
      data: [score, 100 - score],
      backgroundColor: ['#B829FF', 'rgba(255,255,255,0.06)'],
      hoverBackgroundColor: ['#A020E0', 'rgba(255,255,255,0.08)'],
      borderWidth: 0, cutout: '80%', borderRadius: [20, 0]
    }],
  });

  const getRadarData = () => {
    if (!results) return null;
    const d = results.detected_skills?.length || 0;
    const m = results.missing_skills?.length || 0;
    const kw = d + m > 0 ? Math.round((d / (d + m)) * 100) : 0;
    const jd = results.explainability?.summary?.jd_coverage_percent || 0;
    const sm = results.explainability?.summary?.strong_match_count || 0;
    const tj = results.explainability?.summary?.total_jd_sentences || 1;
    const md = Math.min(100, Math.round((sm / tj) * 100));
    const rq = Math.max(20, 100 - (results.recommendations?.length || 0) * 15);
    return {
      labels: ['Skill Match', 'Keywords', 'JD Coverage', 'Match Depth', 'Quality'],
      datasets: [{
        label: 'Profile',
        data: [results.match_score, kw, jd, md, rq],
        backgroundColor: 'rgba(0, 229, 255, 0.12)',
        borderColor: '#00E5FF',
        borderWidth: 2,
        pointBackgroundColor: '#00E5FF',
        pointBorderColor: '#0B0F19',
        pointBorderWidth: 2,
        pointRadius: 4,
      }],
    };
  };

  const radarOpts = {
    responsive: true, maintainAspectRatio: true,
    scales: {
      r: {
        beginAtZero: true, max: 100,
        ticks: { stepSize: 25, color: '#64748B', backdropColor: 'transparent', font: { size: 9 } },
        grid: { color: 'rgba(255,255,255,0.06)' },
        angleLines: { color: 'rgba(255,255,255,0.06)' },
        pointLabels: { color: '#94A3B8', font: { size: 10, weight: 700, family: 'Plus Jakarta Sans' } },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#1A1F2E', titleColor: '#fff', bodyColor: '#94A3B8', borderColor: 'rgba(184,41,255,0.3)', borderWidth: 1, padding: 8, cornerRadius: 8 },
    },
  };

  // ─── Progress Steps ───
  const steps = [
    { icon: UploadCloud, label: 'Upload', done: !!file },
    { icon: Brain, label: 'Analyze', done: !!results },
    { icon: BarChart3, label: 'Results', done: !!results },
    { icon: Search, label: 'Hunt', done: !!huntResults },
  ];

  /* ─────────────────────────────────────────────
     RENDER
     ───────────────────────────────────────────── */
  return (
    <div className="app-root cyber-bg">
      <div className="mesh-blob-3"></div>

      {/* ═══════ NAVBAR ═══════ */}
      <nav className="cyber-nav px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-[#B829FF] to-[#8B1FD4] rounded-xl shadow-lg shadow-[#B829FF]/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-extrabold bg-gradient-to-r from-[#B829FF] to-[#00E5FF] bg-clip-text text-transparent leading-tight">
                Resume Analyzer
              </span>
              <span className="text-[10px] font-bold text-[#64748B] tracking-widest uppercase">Enterprise AI v2.4</span>
            </div>
            {/* Usage Meter */}
            <div className="hidden xl:flex flex-col w-32 gap-1 px-4 border-l border-white/10">
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter">
                <span className="text-[#94A3B8]">Scan Budget</span>
                <span className={historyItems.length >= 45 ? 'text-[#FF4D6A]' : 'text-[#00FF88]'}>{50 - historyItems.length} left</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div 
                  className={`h-full transition-all duration-700 ${historyItems.length >= 45 ? 'bg-gradient-to-r from-[#FF4D6A] to-[#FF6B81] shadow-[0_0_8px_rgba(255,77,106,0.4)]' : 'bg-gradient-to-r from-[#B829FF] to-[#00E5FF] shadow-[0_0_8px_rgba(184,41,255,0.4)]'}`}
                  style={{ width: `${Math.min((historyItems.length / 50) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Stepper */}
          <div className="hidden md:flex items-center gap-1">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
                  step.done
                    ? 'bg-[#B829FF]/15 text-[#B829FF]'
                    : 'text-[#64748B]'
                }`}>
                  {step.label}
                </div>
                {i < 3 && (
                  <ArrowRight className={`w-3 h-3 mx-1 ${step.done ? 'text-[#B829FF]/50' : 'text-[#64748B]/30'}`} />
                )}
              </div>
            ))}
          </div>



          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#94A3B8] hover:text-[#00E5FF] transition-all border border-white/5 relative"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#FF4D6A] rounded-full animate-ping" />
                )}
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#FF4D6A] rounded-full" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-72 cyber-card p-4 animate-fade-in z-[60] shadow-2xl" style={{ background: 'rgba(var(--bg-app-rgb), 0.95)', backdropFilter: 'blur(20px)' }}>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                    <h4 className="text-xs font-black text-theme uppercase tracking-widest">Alert Hub</h4>
                    <button onClick={() => setNotifications([])} className="text-[10px] font-bold text-[#FF4D6A] hover:opacity-80 transition-opacity">Clear All</button>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {notifications.length > 0 ? notifications.map(n => (
                      <div key={n.id} className="flex flex-col gap-1 p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                        <p className="text-xs text-theme leading-tight">{n.text}</p>
                        <span className="text-[9px] text-[#64748B] font-bold">{n.time}</span>
                      </div>
                    )) : (
                      <p className="text-xs text-[#64748B] text-center py-4 italic">No new alerts</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* History Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#94A3B8] hover:text-[#B829FF] transition-all border border-white/5"
                title="Recent Scans"
              >
                <Clock className="w-4 h-4" />
              </button>

              {showHistory && (
                <div className="absolute right-0 mt-3 w-64 cyber-card p-4 animate-fade-in z-[60] shadow-2xl" style={{ background: 'rgba(var(--bg-app-rgb), 0.95)', backdropFilter: 'blur(20px)' }}>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                    <h4 className="text-xs font-black text-theme uppercase tracking-widest">Recent History</h4>
                    <button onClick={() => setHistoryItems([])} className="text-[10px] font-bold text-[#FF4D6A] hover:opacity-80 transition-opacity">Reset Budget</button>
                  </div>
                  <div className="space-y-2">
                    {historyItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#B829FF]/10 transition-colors border border-transparent hover:border-[#B829FF]/20 cursor-pointer group">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-theme truncate">{item.name}</p>
                          <span className="text-[9px] text-[#64748B] font-bold">{item.date}</span>
                        </div>
                        <div className="flex-shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-md bg-[#B829FF]/20 text-[#B829FF]">
                          {item.score}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#94A3B8] hover:text-[#B829FF] transition-all border border-white/5"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-3 pl-2 border-l border-white/10 px-4">
              <div className="relative group cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#B829FF] to-[#00E5FF] p-[1.5px] rotate-3 hover:rotate-0 transition-transform duration-300">
                  <div className="w-full h-full rounded-[10px] bg-[#1A1F2E] flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="main-scroll-area">
        <div className="cyber-content p-4 md:p-6 pb-20">
          <div className="max-w-[1400px] mx-auto">

          {/* Header */}
          <div className="text-center mb-8 pt-4">
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-[#B829FF] via-[#D463FF] to-[#00E5FF] bg-clip-text text-transparent tracking-tight mb-2">
              Resume Analyzer
            </h1>
            <p className="text-[#94A3B8] text-base max-w-xl mx-auto font-medium">
              Drop your resume and job description below. Our AI will analyze the match, find gaps, and help you win the interview.
            </p>
          </div>

          {/* ═══════ STICKY SIDEBAR GRID ═══════ */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

            {/* ─── LEFT COLUMN: Sticky Input Sidebar ─── */}
            <div className="md:col-span-4 space-y-5 md:sticky md:top-24 h-fit">
              <div className="cyber-card p-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[#94A3B8] mb-2 ml-1">Your Resume (PDF)</label>
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative group flex flex-col items-center justify-center px-5 py-8 border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer ${
                        isDragging ? 'border-[#B829FF] bg-[#B829FF]/5 scale-[1.02]' : file ? 'border-[#00E5FF]/40 bg-[#00E5FF]/5' : 'border-white/10 hover:border-[#B829FF]/40 hover:bg-white/[0.02]'
                      }`}
                    >
                      <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".pdf" onChange={(e) => { setFile(e.target.files[0]); setError(null); }} />
                      {file ? (
                        <div className="flex flex-col items-center">
                          <div className="p-3 rounded-full bg-[#00E5FF]/10 mb-2">
                            <FileText className="h-6 w-6 text-[#00E5FF]" />
                          </div>
                          <span className="text-[#00E5FF] font-bold text-sm text-center">{file.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center">
                          <div className={`p-3 rounded-full mb-2 ${isDragging ? 'bg-[#B829FF]/10' : 'bg-white/5 group-hover:bg-[#B829FF]/10'}`}>
                            <UploadCloud className={`h-6 w-6 ${isDragging ? 'text-[#B829FF]' : 'text-[#94A3B8]'}`} />
                          </div>
                          <span className="font-bold text-theme text-sm">Drop your resume here</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#94A3B8] mb-2 ml-1">The Job Description</label>
                    <textarea
                      rows="6"
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Paste the job requirements here..."
                      className="cyber-input w-full rounded-xl p-4 text-sm resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !file || !jobDescription}
                    className="btn-glow w-full py-3.5 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing...</> : <><Zap className="w-5 h-5" /> Find My Match</>}
                  </button>
                </form>
                {error && <div className="mt-4 p-3 bg-[#FF4D6A]/10 rounded-xl border border-[#FF4D6A]/20 flex items-center text-[#FF4D6A] text-sm font-bold"><XCircle className="w-4 h-4 mr-2" />{error}</div>}
              </div>

              <ATSVisualizer isAnalyzing={loading} />
              {!loading && <AIStrictnessSlider strictness={strictness} setStrictness={setStrictness} />}
              <ServerTelemetry />

              {rewriteTarget && (
                <div className="cyber-card p-5 stagger-item stagger-1">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-[#B829FF] text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> AI Rewrite: "{rewriteTarget}"
                    </h3>
                    <button onClick={() => setRewriteTarget(null)} className="text-[#64748B] hover:text-[#B829FF] text-lg">✕</button>
                  </div>
                  <textarea value={originalBullet} onChange={(e) => setOriginalBullet(e.target.value)} className="cyber-input w-full p-3 rounded-lg text-sm" rows="3" placeholder="e.g., Developed a secure data wiping system..." />
                  <button onClick={handleRewrite} disabled={isRewriting || !originalBullet} className="mt-3 bg-[#B829FF]/20 text-[#B829FF] px-4 py-2 rounded-lg hover:bg-[#B829FF]/30 font-bold text-sm">
                    {isRewriting ? "Consulting AI..." : "Rewrite"}
                  </button>
                  {rewrittenBullet && (
                    <div className="mt-3 p-3 bg-white/[0.03] border-l-3 border-[#00E5FF] rounded-r-lg">
                      <p className="text-theme text-sm">{rewrittenBullet}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ─── RIGHT COLUMN: Results ─── */}
            <div className="md:col-span-8 flex flex-col gap-5">
              <FloatingActionDock />

              {loading && <div className="space-y-4"><div className="flex flex-col items-center py-5"><div className="w-14 h-14 border-3 border-[#B829FF]/20 border-t-[#B829FF] rounded-full animate-spin"></div><p className="text-[#B829FF] font-bold text-sm mt-3 animate-pulse">Running AI analysis...</p></div><SkeletonLoading /></div>}

              {!loading && results && (
                <div className="space-y-4">
                  <div className="cyber-card p-5 score-reveal stagger-item stagger-1">
                    <div className="flex flex-col md:flex-row items-center gap-5">
                      <div className="flex items-center gap-5 flex-1 min-w-0">
                        <div className="w-32 h-32 relative flex-shrink-0">
                          <Doughnut data={getChartData(results.match_score)} options={{ plugins: { tooltip: { enabled: false }, legend: { display: false } }, animation: { duration: 2000, easing: 'easeOutQuart' } }} />
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-theme">{displayScore}%</span>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg font-black text-theme flex items-center gap-1.5 mb-1"><Target className="w-4 h-4 text-[#B829FF]" /> Alignment Score {getScoreEmoji(results.match_score).emoji}</h2>
                          <p className="text-[#94A3B8] text-sm mb-3">{results.match_score > 75 ? "Excellent match!" : results.match_score > 40 ? "Solid base." : "Significant gap."}</p>
                          <button
                            onClick={downloadReport}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#B829FF]/15 text-[#B829FF] border border-[#B829FF]/20 hover:bg-[#B829FF]/25 transition-all hover:scale-105"
                          >
                            <Download className="w-3.5 h-3.5" /> Download Report
                          </button>
                        </div>
                      </div>
                      {getRadarData() && <div className="w-full md:w-52 flex-shrink-0 cyan-glow rounded-xl p-2"><Radar data={getRadarData()} options={radarOpts} /></div>}
                    </div>
                  </div>

                  {/* ─── Top 3 Improvements ─── */}
                  {getTop3Improvements().length > 0 && (
                    <div className="cyber-card p-5 stagger-item stagger-2" style={{ borderLeft: '3px solid #B829FF' }}>
                      <h3 className="text-sm font-black text-theme flex items-center gap-2 mb-4">
                        <TrendingUp className="w-4 h-4 text-[#B829FF]" /> Top 3 Improvements
                      </h3>
                      <div className="space-y-3">
                        {getTop3Improvements().map((imp, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0 ${
                              imp.impact === 'high' ? 'bg-[#FF4D6A]' : 'bg-[#FFB800]'
                            }`}>{i + 1}</div>
                            <div>
                              <p className="text-sm font-bold text-theme">{imp.label}</p>
                              <p className="text-xs text-[#64748B] mt-0.5">{imp.detail}</p>
                            </div>
                            <span className={`ml-auto flex-shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                              imp.impact === 'high' 
                                ? 'bg-[#FF4D6A]/10 text-[#FF4D6A] border border-[#FF4D6A]/20' 
                                : 'bg-[#FFB800]/10 text-[#FFB800] border border-[#FFB800]/20'
                            }`}>{imp.impact} impact</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-item stagger-2">
                    <div className="cyber-card p-5">
                      <h3 className="text-sm font-black text-theme flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4 text-[#00FF88]" /> Superpowers</h3>
                      <div className="flex flex-wrap gap-1.5">{results.detected_skills.map((s, i) => <span key={i} className="px-3 py-1 rounded-full text-xs font-bold bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/20">{s}</span>)}</div>
                    </div>
                    <div className="cyber-card p-5">
                      <h3 className="text-sm font-black text-theme flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-[#FF4D6A]" /> Gaps</h3>
                      <div className="flex flex-wrap gap-1.5">{results.missing_skills.map((s, i) => <button key={i} onClick={() => setRewriteTarget(s)} className="px-3 py-1 rounded-full text-xs font-bold bg-[#FF4D6A]/10 text-[#FF4D6A] border border-[#FF4D6A]/20 transition-transform hover:scale-105">{s}</button>)}</div>
                    </div>
                  </div>

                  {results.explainability && <ExplainabilityPanel data={results.explainability} />}
                  {results.proximity_graph?.nodes?.length > 0 && <div className="cyber-card p-5"><SkillGraph data={results.proximity_graph} /></div>}
                  <FairnessReport jobDescription={jobDescription} resumeText={results.extracted_text} />

                  {!huntResults && (
                    <button onClick={handleHuntMode} disabled={huntLoading} className="w-full py-4 rounded-xl font-bold border-2 border-[#00E5FF]/30 text-[#00E5FF] hover:bg-[#00E5FF]/10 transition-all">
                      {huntLoading ? "Hunting..." : "Activate Hunt Mode"}
                    </button>
                  )}

                  {huntResults && !huntResults.error && (
                    <div className="cyber-card p-5">
                      <h3 className="text-sm font-black text-theme flex items-center gap-2 mb-3"><Target className="w-4 h-4 text-[#00E5FF]" /> Hunt Results</h3>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {huntResults.matched_jobs.map((j, i) => (
                          <a key={i} href={j.link} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-xl border border-white/5 hover:border-[#00E5FF]/20 transition-all">
                            <div className="flex justify-between items-center">
                              <div><h4 className="font-bold text-theme text-sm">{j.title}</h4><p className="text-[10px] text-[#64748B]">{j.company}</p></div>
                              <div className="text-sm font-black text-[#00FF88]">{j.score}%</div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <JobMarketRadar />

                  <div className="cyber-card p-5 border-[#B829FF]/20" style={{ background: 'linear-gradient(135deg, rgba(184, 41, 255, 0.1), var(--card-bg))' }}>
                    <h3 className="text-sm font-black text-theme flex items-center gap-2 mb-4"><HeartHandshake className="w-4 h-4 text-[#B829FF]" /> AI Advice</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {results.recommendations.map((rec, i) => {
                        // Support both new object format and legacy string format
                        const isObject = typeof rec === 'object' && rec !== null;
                        const type = isObject ? rec.type : 'info';
                        const title = isObject ? rec.title : null;
                        const text = isObject ? rec.text : rec;
                        
                        const typeStyles = {
                          success:  { border: '#00FF88', bg: 'rgba(0, 255, 136, 0.06)', icon: '✅', accent: '#00FF88' },
                          info:     { border: '#00E5FF', bg: 'rgba(0, 229, 255, 0.06)', icon: '💡', accent: '#00E5FF' },
                          warning:  { border: '#FFB800', bg: 'rgba(255, 184, 0, 0.06)', icon: '⚠️', accent: '#FFB800' },
                          critical: { border: '#FF4D6A', bg: 'rgba(255, 77, 106, 0.06)', icon: '🚨', accent: '#FF4D6A' },
                          tip:      { border: '#B829FF', bg: 'rgba(184, 41, 255, 0.06)', icon: '🎯', accent: '#B829FF' },
                          action:   { border: '#00E5FF', bg: 'rgba(0, 229, 255, 0.06)', icon: '🔧', accent: '#00E5FF' },
                        };
                        const style = typeStyles[type] || typeStyles.info;
                        
                        return (
                          <div key={i} className="p-4 rounded-xl transition-all hover:scale-[1.01]" style={{ background: style.bg, borderLeft: `3px solid ${style.border}` }}>
                            <div className="flex items-start gap-3">
                              <span className="text-lg flex-shrink-0 mt-0.5">{style.icon}</span>
                              <div>
                                {title && <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: style.accent }}>{title}</p>}
                                <p className="text-sm text-[#94A3B8] leading-relaxed">{text}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {!loading && !results && (
                <div className="cyber-card h-full min-h-[400px] flex flex-col items-center justify-center p-10 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#B829FF]/20 to-[#00E5FF]/10 flex items-center justify-center mb-5"><Target className="w-10 h-10 text-[#B829FF]" /></div>
                  <h3 className="text-xl font-black text-theme mb-2">Ready to level up?</h3>
                  <p className="text-[#94A3B8] text-sm">Upload your resume and the job description to start the AI analysis.</p>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;