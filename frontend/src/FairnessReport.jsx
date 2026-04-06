import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, Scale, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

export default function FairnessReport({ jobDescription, resumeText, onAuditComplete }) {
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState(null);

  const runAudit = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch("http://localhost:8000/api/bias-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_description: jobDescription, resume_text: resumeText || null }),
      });
      const data = await response.json();
      if (data.status === "success") {
        setAuditData(data);
        if (onAuditComplete) onAuditComplete(data);
      } else { setError("Audit failed."); }
    } catch (err) { setError("Connection error."); }
    finally { setLoading(false); }
  };

  const gradeColors = {
    'A+': 'from-[#00FF88] to-emerald-500', 'A': 'from-[#00FF88] to-emerald-500',
    'A-': 'from-emerald-400 to-teal-500', 'B+': 'from-teal-400 to-[#00E5FF]',
    'B': 'from-[#00E5FF] to-blue-500', 'B-': 'from-blue-400 to-indigo-500',
    'C+': 'from-amber-400 to-orange-500', 'C': 'from-orange-400 to-red-400',
    'D': 'from-[#FF4D6A] to-red-600', 'F': 'from-red-600 to-red-800',
  };

  // Trigger Button
  if (!auditData && !loading) {
    return (
      <div className="cyber-card p-6 text-center">
        <div className="inline-flex items-center justify-center p-3 bg-[#B829FF]/10 rounded-xl mb-3">
          <Shield className="w-8 h-8 text-[#B829FF]" />
        </div>
        <h3 className="text-lg font-black text-theme mb-1">Fairness & Bias Audit</h3>
        <p className="text-[#94A3B8] text-xs mb-5 max-w-sm mx-auto">
          Test the job description for gendered language, age bias, and model fairness across demographics.
        </p>
        <button onClick={runAudit}
          className="btn-glow px-6 py-2.5 rounded-xl text-white font-bold text-sm inline-flex items-center gap-2">
          <Shield className="w-4 h-4" /> Run Fairness Audit
        </button>
        {error && <p className="mt-3 text-xs text-[#FF4D6A] font-bold">{error}</p>}
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="cyber-card p-6 text-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="relative">
            <div className="w-14 h-14 border-3 border-[#B829FF]/20 border-t-[#B829FF] rounded-full animate-spin"></div>
            <Shield className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#B829FF] h-4 w-4" />
          </div>
          <p className="text-[#B829FF] font-bold text-sm animate-pulse">Running adversarial tests...</p>
          <p className="text-[#64748B] text-xs">Testing 4 demographic groups</p>
        </div>
      </div>
    );
  }

  const report = auditData?.jd_bias_report;
  const fairness = auditData?.model_fairness;
  if (!report) return null;

  const grade = report.overall_fairness_grade;
  const gradeGradient = gradeColors[grade] || 'from-[#64748B] to-slate-500';
  const totalWords = report.masculine_coded_count + report.feminine_coded_count;
  const meterPosition = totalWords === 0 ? 50 : (report.feminine_coded_count / totalWords) * 100;

  return (
    <div className="cyber-card overflow-hidden">
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
        <h3 className="text-sm font-black text-theme flex items-center gap-2">
          <span className="p-1.5 bg-[#B829FF]/15 rounded-lg">
            <Shield className="w-4 h-4 text-[#B829FF]" />
          </span>
          Fairness & Bias Report
        </h3>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-black text-white px-3 py-1 rounded-full bg-gradient-to-r ${gradeGradient}`}>
            {grade}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">

          {/* Grade + Gender Meter Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Grade Circle */}
            <div className="flex flex-col items-center p-3 bg-white/[0.03] rounded-xl border border-white/5">
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradeGradient} flex items-center justify-center shadow-lg mb-2`}>
                <span className="text-3xl font-black text-white drop-shadow">{grade}</span>
              </div>
              <div className="text-xs font-bold text-theme">Fairness Score</div>
              <div className="text-[10px] text-[#64748B]">{report.fairness_score}/100</div>
            </div>

            {/* Gender Meter */}
            <div className="flex flex-col justify-center p-3 bg-white/[0.03] rounded-xl border border-white/5">
              <div className="text-xs font-bold text-theme mb-3 text-center">Gender Language Meter</div>
              <div className="relative h-3 bg-gradient-to-r from-blue-500/30 via-white/10 to-pink-500/30 rounded-full overflow-visible">
                <div className="absolute left-1/2 top-0 w-0.5 h-full bg-[#64748B]/50 z-10"></div>
                <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[#B829FF] rounded-full shadow-md z-20 transition-all duration-500"
                  style={{ left: `calc(${meterPosition}% - 8px)` }}></div>
              </div>
              <div className="flex justify-between mt-2 text-[10px] font-bold">
                <span className="text-blue-400">♂ Masc ({report.masculine_coded_count})</span>
                <span className="text-[#64748B]">Neutral</span>
                <span className="text-pink-400">♀ Fem ({report.feminine_coded_count})</span>
              </div>
            </div>
          </div>

          {/* Flagged Words */}
          {report.flagged_words?.length > 0 && (
            <div>
              <h4 className="text-xs font-black text-theme mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Flagged Language ({report.flagged_words.length})
              </h4>
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                {report.flagged_words.map((flag, i) => (
                  <div key={i} className={`p-2.5 rounded-lg border text-xs ${
                    flag.category === 'masculine'
                      ? 'bg-blue-500/5 border-blue-500/10'
                      : 'bg-pink-500/5 border-pink-500/10'
                  }`}>
                    <span className={`font-black ${flag.category === 'masculine' ? 'text-blue-400' : 'text-pink-400'}`}>
                      "{flag.word}"
                    </span>
                    <span className="text-[#64748B] ml-2 italic">{flag.context}</span>
                    {flag.replacement && (
                      <p className="text-[#00FF88] font-bold mt-1">💡 Suggested: "{flag.replacement}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Age Bias */}
          {report.age_bias_flags?.length > 0 && (
            <div>
              <h4 className="text-xs font-black text-theme mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#FF4D6A]" />
                Age Bias ({report.age_bias_flags.length})
              </h4>
              <div className="space-y-1.5">
                {report.age_bias_flags.map((flag, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-[#FF4D6A]/5 border border-[#FF4D6A]/10 text-xs">
                    <span className="font-black text-[#FF4D6A]">"{flag.phrase}"</span>
                    <span className="text-[#64748B] ml-2 italic">{flag.context}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adversarial Test */}
          {fairness && (
            <div className={`p-3 rounded-xl border ${
              fairness.is_fair ? 'bg-[#00FF88]/5 border-[#00FF88]/10' : 'bg-[#FF4D6A]/5 border-[#FF4D6A]/10'
            }`}>
              <h4 className="text-xs font-black text-theme mb-2 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5" />
                Adversarial Fairness Test
              </h4>
              <p className={`text-xs font-bold mb-3 ${fairness.is_fair ? 'text-[#00FF88]' : 'text-[#FF4D6A]'}`}>
                {fairness.verdict}
              </p>
              <div className="space-y-1.5">
                {fairness.test_results?.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#94A3B8] w-14">{r.name_group}</span>
                    <div className="flex-1 bg-white/[0.04] rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full ${fairness.is_fair ? 'bg-[#00FF88]' : 'bg-[#FF4D6A]'}`}
                        style={{ width: `${r.score}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-theme w-10 text-right">{r.score}%</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-[#64748B]">
                <span>Variance: {fairness.score_variance}%</span>
                <span>Avg: {fairness.average_score}%</span>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations?.length > 0 && (
            <div>
              <h4 className="text-xs font-black text-theme mb-2">💡 Recommendations</h4>
              <div className="space-y-1.5">
                {report.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 bg-[#B829FF]/5 rounded-lg border border-[#B829FF]/10">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#B829FF] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[#94A3B8] leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center pt-1">
            <button onClick={runAudit} disabled={loading}
              className="text-[10px] font-bold text-[#B829FF] hover:text-[#B829FF]/70">
              ↻ Re-run Audit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
