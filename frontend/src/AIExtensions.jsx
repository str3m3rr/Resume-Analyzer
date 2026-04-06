import { useState, useEffect, useRef } from 'react';
import { Terminal, Activity, Crosshair, Download, Link as LinkIcon, Share2, Layers } from 'lucide-react';

/* ───────────────────────────────────────────────
   1. ATS Parser Visualizer 
   ─────────────────────────────────────────────── */
export function ATSVisualizer({ isAnalyzing }) {
  const [logs, setLogs] = useState([]);
  const dummyLogs = [
    "[SYS] Connecting to AI Parsing Engine...",
    "[NLP] Extracting Named Entities...",
    "[NLP] Tokenizing chronological experience...",
    "[VEC] Generating embeddings (2,408 tokens)",
    "[VEC] Querying Cosine Similarity DB...",
    "[SYS] Correlating skills to Job Description",
    "[AI] Running Bias Detection Models...",
    "[AI] Formatting Cyber-Purple output...",
    "[SYS] Done."
  ];

  useEffect(() => {
    if (isAnalyzing) {
      setLogs([]);
      let i = 0;
      const interval = setInterval(() => {
        if (i < dummyLogs.length) {
          setLogs(prev => [...prev, dummyLogs[i]]);
          i++;
        } else {
          clearInterval(interval);
        }
      }, 300 + Math.random() * 400);
      return () => clearInterval(interval);
    } else {
      setLogs([]);
    }
  }, [isAnalyzing]);

  if (!isAnalyzing && logs.length === 0) return null;

  return (
    <div className="cyber-card p-4 mt-5 font-mono text-[10px]" style={{ background: 'var(--card-bg)' }}>
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
        <Terminal className="w-3.5 h-3.5 text-[#00E5FF]" />
        <span className="text-[#00E5FF] font-bold tracking-widest uppercase">Live ATS Parser</span>
      </div>
      <div className="space-y-1.5 h-[120px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'none' }}>
        {logs.map((log, i) => (
          <div key={i} className="text-[#00FF88] animate-fade-in">
            <span className="opacity-50 mr-2">{'>'}</span> {log}
          </div>
        ))}
        {isAnalyzing && logs.length < dummyLogs.length && (
          <div className="w-2 h-3 bg-[#00FF88] animate-pulse mt-1" />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────
   2. AI Strictness Slider
   ─────────────────────────────────────────────── */
export function AIStrictnessSlider({ strictness, setStrictness }) {
  const getLabel = () => {
    if (strictness < 33) return "Hype Man (Lenient)";
    if (strictness < 66) return "Standard Review";
    return "MAANG Level (Brutal)";
  };

  const getColor = () => {
    if (strictness < 33) return "text-[#00FF88]";
    if (strictness < 66) return "text-[#00E5FF]";
    return "text-[#FF4D6A]";
  };

  return (
    <div className="cyber-card p-4 mt-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#B829FF]" />
          <span className="text-xs font-bold text-theme">AI Strictness</span>
        </div>
        <span className={`text-[10px] font-black uppercase ${getColor()}`}>{getLabel()}</span>
      </div>
      <input 
        type="range" 
        min="0" max="100" 
        value={strictness} 
        onChange={(e) => setStrictness(parseInt(e.target.value))}
        className="cyber-slider w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer outline-none"
      />
      <div className="flex justify-between mt-2 text-[9px] text-[#64748B] font-bold uppercase tracking-wider">
        <span>Lenient</span>
        <span>Brutal</span>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────
   3. Server Telemetry
   ─────────────────────────────────────────────── */
export function ServerTelemetry() {
  return (
    <div className="flex items-center justify-between px-2 mt-4 opacity-60 hover:opacity-100 transition-opacity">
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse shadow-[0_0_8px_#00FF88]" />
        <span className="text-[10px] font-mono text-[#94A3B8]">SYS.ONLINE</span>
      </div>
      <div className="flex gap-4 font-mono text-[9px] text-[#64748B]">
        <span>PING: 14ms</span>
        <span>MODELS: 3/3</span>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────
   4. Job Market Radar
   ─────────────────────────────────────────────── */
export function JobMarketRadar() {
  const trends = [
    { skill: "Next.js", trend: "+14%", color: "text-[#00E5FF]" },
    { skill: "GenAI", trend: "+32%", color: "text-[#B829FF]" },
    { skill: "TypeScript", trend: "+8%", color: "text-[#00FF88]" },
    { skill: "Python", trend: "+12%", color: "text-[#00E5FF]" }
  ];

  return (
    <div className="cyber-card p-5 relative overflow-hidden group">
      {/* Radar Sweep Background */}
      <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] border border-[#00E5FF]/5 rounded-full bg-[conic-gradient(from_0deg,transparent_70%,rgba(0,229,255,0.1)_100%)] animate-[radar-spin_4s_linear_infinite] group-hover:animate-[radar-spin_2s_linear_infinite]" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Crosshair className="w-4 h-4 text-[#00E5FF] group-hover:animate-ping" />
          <h3 className="text-sm font-black text-theme">Live Tech Radar</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {trends.map((t, i) => (
            <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-white/[0.02] border border-white/5 backdrop-blur-sm">
              <span className="text-xs text-[#94A3B8] font-bold tracking-wide">{t.skill}</span>
              <span className={`text-[10px] font-black ${t.color}`}>{t.trend}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────
   5. Floating Action Dock / Minimap
   ─────────────────────────────────────────────── */
export function FloatingActionDock() {
  const sections = ['score', 'skills', 'network', 'hunt'];
  
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 shadow-lg" style={{ background: 'rgba(var(--bg-app-rgb), 0.8)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-[#64748B]">Quick Navigation:</span>
        {/* Minimap Dots - Now acting as horizontal quick links */}
        <div className="flex items-center gap-2.5">
          {sections.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 cursor-pointer group">
              <div className="w-2 h-2 rounded-full bg-[#64748B] group-hover:bg-[#00E5FF] transition-all shadow-[0_0_10px_rgba(0,229,255,0)] group-hover:shadow-[0_0_10px_rgba(0,229,255,1)]" />
              <span className="text-[10px] font-bold text-[#94A3B8] group-hover:text-theme uppercase hidden sm:block">{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 text-[#94A3B8] hover:text-[#00FF88] hover:bg-[#00FF88]/10 transition-all">
          <Download className="w-3.5 h-3.5" />
          <span className="text-xs font-bold hidden sm:block">Export PDF</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 text-[#94A3B8] hover:text-[#B829FF] hover:bg-[#B829FF]/10 transition-all">
          <LinkIcon className="w-3.5 h-3.5" />
          <span className="text-xs font-bold hidden sm:block">Copy Link</span>
        </button>
      </div>
    </div>
  );
}
