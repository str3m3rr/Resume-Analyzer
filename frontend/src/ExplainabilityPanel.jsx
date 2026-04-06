import { useState } from 'react';
import { Eye, ChevronDown, ChevronUp, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

export default function ExplainabilityPanel({ data }) {
  const [activeTab, setActiveTab] = useState('matches');
  const [expanded, setExpanded] = useState(true);

  if (!data || !data.summary) return null;

  const { top_matches, resume_contributions, jd_coverage, summary } = data;

  const getBarColor = (strength) => {
    switch (strength) {
      case 'strong': return 'bg-[#00FF88]';
      case 'moderate': return 'bg-[#00E5FF]';
      case 'weak': return 'bg-amber-400';
      case 'gap': return 'bg-[#FF4D6A]';
      default: return 'bg-[#64748B]';
    }
  };

  const getStrengthBadge = (strength) => {
    const styles = {
      strong: 'bg-[#00FF88]/10 text-[#00FF88] border-[#00FF88]/20',
      moderate: 'bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/20',
      weak: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      gap: 'bg-[#FF4D6A]/10 text-[#FF4D6A] border-[#FF4D6A]/20',
    };
    return styles[strength] || 'bg-white/5 text-[#94A3B8] border-white/10';
  };

  const getStrengthLabel = (strength) => {
    switch (strength) {
      case 'strong': return '🟢 Strong';
      case 'moderate': return '🔵 Moderate';
      case 'weak': return '🟡 Weak';
      case 'gap': return '🔴 Gap';
      default: return strength;
    }
  };

  const truncate = (text, maxLen = 120) => {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
  };

  // Coverage color based on percentage
  const getCoverageColor = (pct) => {
    if (pct >= 75) return '#00FF88';
    if (pct >= 50) return '#00E5FF';
    if (pct >= 25) return '#FFB800';
    return '#FF4D6A';
  };

  const coverageColor = getCoverageColor(summary.jd_coverage_percent);

  return (
    <div className="cyber-card overflow-hidden transition-all duration-300">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
      >
        <h3 className="text-sm font-black flex items-center text-theme gap-2">
          <span className="p-1.5 bg-[#B829FF]/15 rounded-lg">
            <Eye className="w-4 h-4 text-[#B829FF]" />
          </span>
          XAI: Why This Score?
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold px-3 py-1 rounded-full border" style={{ 
            color: coverageColor, 
            backgroundColor: `${coverageColor}15`, 
            borderColor: `${coverageColor}30` 
          }}>
            {summary.jd_coverage_percent}% JD Covered
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-5">
          {/* Coverage Bar with dynamic color */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-tighter">Overall JD Alignment</span>
              <span className="text-xl font-black" style={{ color: coverageColor }}>{summary.jd_coverage_percent}%</span>
            </div>
            <div className="h-3 w-full bg-white/[0.03] rounded-full overflow-hidden border border-white/5 relative">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-out relative"
                style={{ 
                  width: `${summary.jd_coverage_percent}%`,
                  background: `linear-gradient(90deg, ${coverageColor}CC, ${coverageColor})` 
                }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" style={{ animationDuration: '3s' }} />
              </div>
            </div>
            <div className="flex justify-between text-[9px] text-[#64748B] font-bold">
              <span>0% — Needs Work</span>
              <span>100% — Fully Aligned</span>
            </div>
          </div>

          {/* Stats Row — cleaner 4-column grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { value: summary.total_resume_sentences, label: 'Resume Sentences', color: '#B829FF', icon: '📄' },
              { value: summary.relevant_jd_sentences || summary.total_jd_sentences, label: 'JD Requirements', color: '#00E5FF', icon: '📋' },
              { value: summary.strong_match_count, label: 'Strong Matches', color: '#00FF88', icon: '✅' },
              { value: summary.weak_areas_count, label: 'Uncovered Gaps', color: '#FF4D6A', icon: '❌' },
            ].map((stat, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/5 p-3 rounded-xl text-center hover:border-white/10 transition-colors">
                <div className="text-lg mb-0.5">{stat.icon}</div>
                <div className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-[9px] text-[#64748B] font-bold mt-0.5 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/5">
            {[
              { id: 'matches', label: '🎯 Top Matches', count: top_matches?.length },
              { id: 'gaps', label: '🔍 JD Coverage', count: jd_coverage?.length },
              { id: 'ranking', label: '📊 Ranking', count: resume_contributions?.length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 text-xs font-bold py-2.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-[#B829FF]/15 text-[#B829FF] shadow-sm'
                    : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-[#B829FF]/20' : 'bg-white/5'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            
            {/* Top Matches — improved with arrow connector */}
            {activeTab === 'matches' && top_matches?.map((match, i) => (
              <div key={i} className="bg-white/[0.02] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#B829FF]/15 flex items-center justify-center text-xs font-black text-[#B829FF]">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Resume sentence */}
                    <div className="bg-[#B829FF]/5 rounded-lg p-3 border border-[#B829FF]/10">
                      <div className="text-[9px] font-black text-[#B829FF] uppercase tracking-widest mb-1.5">📄 Your Resume Says</div>
                      <p className="text-xs text-[#C8D0DA] leading-relaxed" title={match.resume_sentence}>
                        "{truncate(match.resume_sentence)}"
                      </p>
                    </div>
                    
                    {/* Connector arrow */}
                    <div className="flex items-center gap-2 px-3">
                      <div className="flex-1 h-px bg-gradient-to-r from-[#B829FF]/30 to-[#00E5FF]/30"></div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStrengthBadge(match.strength)}`}>
                        {match.similarity}% {getStrengthLabel(match.strength)}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />
                      <div className="flex-1 h-px bg-gradient-to-r from-[#00E5FF]/30 to-[#B829FF]/30"></div>
                    </div>
                    
                    {/* JD sentence */}
                    <div className="bg-[#00E5FF]/5 rounded-lg p-3 border border-[#00E5FF]/10">
                      <div className="text-[9px] font-black text-[#00E5FF] uppercase tracking-widest mb-1.5">📋 JD Requires</div>
                      <p className="text-xs text-[#C8D0DA] leading-relaxed" title={match.jd_sentence}>
                        "{truncate(match.jd_sentence)}"
                      </p>
                    </div>
                    
                    {/* Score bar */}
                    <div className="flex items-center gap-3 pt-1">
                      <div className="flex-1 bg-white/[0.04] rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${getBarColor(match.strength)}`}
                          style={{ width: `${match.similarity}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* JD Coverage — cleaner layout with covered/uncovered grouping */}
            {activeTab === 'gaps' && (
              <>
                {/* Legend */}
                <div className="flex items-center gap-4 px-2 pb-1 text-[10px] font-bold text-[#64748B]">
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[#00FF88]" /> Covered</span>
                  <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-[#FF4D6A]" /> Not Covered</span>
                  <span className="ml-auto">Sorted by priority</span>
                </div>
                
                {jd_coverage?.filter(item => item.is_relevant !== false).map((item, i) => (
                  <div key={i} className={`p-3.5 rounded-xl border transition-all ${
                    item.covered
                      ? 'bg-[#00FF88]/[0.03] border-[#00FF88]/10 hover:border-[#00FF88]/20'
                      : 'bg-[#FF4D6A]/[0.04] border-[#FF4D6A]/15 hover:border-[#FF4D6A]/25'
                  }`}>
                    <div className="flex items-start gap-3">
                      {item.covered ? (
                        <CheckCircle2 className="w-5 h-5 text-[#00FF88] flex-shrink-0 mt-0.5" />
                      ) : (
                        <div className="relative">
                          <XCircle className="w-5 h-5 text-[#FF4D6A] flex-shrink-0 mt-0.5 relative z-10" />
                          <div className="absolute inset-0 bg-[#FF4D6A] rounded-full animate-ping opacity-15" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-theme leading-relaxed" title={item.sentence}>
                          {truncate(item.sentence, 110)}
                        </p>
                        {item.covered ? (
                          <div className="mt-2 bg-[#00FF88]/[0.08] rounded-lg px-3 py-2 flex items-center gap-2">
                            <span className="text-[10px] text-[#00FF88] font-bold">✅ Matched</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStrengthBadge(item.strength)}`}>
                              {item.best_match_score}%
                            </span>
                            <p className="text-[10px] text-[#94A3B8] truncate italic ml-1" title={item.best_match_resume}>
                              → "{truncate(item.best_match_resume, 60)}"
                            </p>
                          </div>
                        ) : (
                          <div className="mt-2 bg-[#FF4D6A]/[0.08] rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[#FF4D6A] font-bold">❌ Not covered</span>
                              <span className="text-[10px] text-[#64748B]">Best match: {item.best_match_score}%</span>
                            </div>
                            <p className="text-[10px] text-[#FF4D6A]/70 mt-1">
                              ⚡ Add experience or keywords that address this requirement
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Sentence Ranking — cleaner with medal icons */}
            {activeTab === 'ranking' && resume_contributions?.map((item, i) => (
              <div key={i} className={`p-3.5 rounded-xl border transition-colors ${
                i < 3 ? 'bg-[#B829FF]/[0.04] border-[#B829FF]/10' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0 ${
                    i === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                    i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                    i === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                    'bg-[#64748B]/50'
                  }`}>
                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : item.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#C8D0DA] leading-relaxed" title={item.sentence}>
                      {truncate(item.sentence)}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 bg-white/[0.04] rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${getBarColor(item.strength)}`}
                          style={{ width: `${item.max_score}%` }} />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStrengthBadge(item.strength)}`}>
                        {item.max_score}% {getStrengthLabel(item.strength)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
