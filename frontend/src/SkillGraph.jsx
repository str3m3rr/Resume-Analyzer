import { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function SkillGraph({ data }) {
  const containerRef = useRef(null);
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 350 });

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: 350
      });
    }
  }, []);

  // Zoom to fit all nodes after the graph renders
  useEffect(() => {
    if (fgRef.current) {
      setTimeout(() => {
        fgRef.current.zoomToFit(400, 40);
      }, 500);
    }
  }, [data]);

  const formattedData = {
    nodes: data.nodes.map(node => ({
      ...node,
      color: node.group === 'have' ? '#10b981' : '#ec4899',
      val: node.group === 'have' ? 3 : 2.5
    })),
    links: data.links.map(link => ({
      ...link,
    }))
  };

  // Custom node painter: circle + text label
  const nodeCanvasObj = useCallback((node, ctx, globalScale) => {
    const label = node.id;
    const fontSize = 12 / globalScale;
    const nodeR = Math.sqrt(node.val) * 2.5;
    const isHave = node.group === 'have';

    // Outer glow
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeR + 2, 0, 2 * Math.PI, false);
    ctx.fillStyle = isHave
      ? 'rgba(16, 185, 129, 0.2)'
      : 'rgba(236, 72, 153, 0.2)';
    ctx.fill();

    // Main circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeR, 0, 2 * Math.PI, false);
    ctx.fillStyle = isHave ? '#10b981' : '#ec4899';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();

    // Text label
    ctx.font = `600 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text background pill
    const textWidth = ctx.measureText(label).width;
    const bgHeight = fontSize + 4 / globalScale;
    const bgWidth = textWidth + 6 / globalScale;
    const bgY = node.y + nodeR + fontSize / 2 + 4 / globalScale;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(
      node.x - bgWidth / 2,
      bgY - bgHeight / 2,
      bgWidth,
      bgHeight
    );

    // Text
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(label, node.x, bgY);
  }, []);

  // Hit area for pointer events
  const nodePointerArea = useCallback((node, color, ctx) => {
    const nodeR = Math.sqrt(node.val) * 2.5 + 5;
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeR, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-[350px] bg-slate-900 rounded-2xl overflow-hidden shadow-inner relative border border-slate-700">
      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 border border-white/10 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
          <span>Your Skills</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-pink-500 inline-block"></span>
          <span>Missing Skills</span>
        </div>
        <div className="flex items-center gap-2 pt-1.5 border-t border-white/10 mt-0.5">
          <span className="text-[10px] text-slate-400">Line thickness = similarity</span>
        </div>
      </div>

      {dimensions.width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={formattedData}
          nodeCanvasObject={nodeCanvasObj}
          nodePointerAreaPaint={nodePointerArea}
          linkWidth={link => Math.max((link.value || 0.3) * 4, 0.5)}
          linkColor={link => {
            const v = link.value || 0.3;
            if (v > 0.6) return 'rgba(168, 85, 247, 0.6)';
            if (v > 0.4) return 'rgba(129, 140, 248, 0.4)';
            return 'rgba(148, 163, 184, 0.25)';
          }}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={link => Math.max((link.value || 0.3) * 3, 1)}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleColor={() => '#a855f7'}
          d3VelocityDecay={0.2}
          d3AlphaDecay={0.02}
          cooldownTicks={150}
          backgroundColor="transparent"
          enableNodeDrag={true}
        />
      )}
    </div>
  );
}