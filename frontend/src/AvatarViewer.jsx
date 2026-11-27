import { useEffect, useRef } from 'react';

/**
 * Animated AI Interviewer Avatar — pure CSS/Canvas, no 3D model needed.
 * Renders a sleek, dark-themed interviewer silhouette with:
 *  - Animated sound-wave bars when speaking
 *  - Subtle idle breathing / floating animation
 *  - Glowing accent ring
 */
export default function AvatarViewer({ speaking }) {
  const barsRef = useRef(null);
  const frameRef = useRef(null);

  // Animate sound-wave bars when speaking
  useEffect(() => {
    if (!speaking) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      return;
    }
    const bars = barsRef.current?.children;
    if (!bars) return;

    let t = 0;
    const animate = () => {
      t += 0.12;
      for (let i = 0; i < bars.length; i++) {
        const phase = i * 0.7;
        const h = 12 + Math.sin(t + phase) * 10 + Math.sin(t * 1.7 + phase * 0.5) * 6;
        bars[i].style.height = `${Math.max(4, h)}px`;
      }
      frameRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [speaking]);

  return (
    <div className="interviewer-avatar-container">
      {/* Glow ring behind the avatar */}
      <div className={`avatar-glow-ring ${speaking ? 'is-speaking' : ''}`} />

      {/* Main avatar figure */}
      <div className={`avatar-figure ${speaking ? 'is-speaking' : ''}`}>
        {/* Head */}
        <div className="avatar-head">
          {/* Face */}
          <div className="avatar-face">
            {/* Eyes */}
            <div className="avatar-eyes">
              <div className="avatar-eye">
                <div className="avatar-pupil" />
              </div>
              <div className="avatar-eye">
                <div className="avatar-pupil" />
              </div>
            </div>
            {/* Mouth — morphs when speaking */}
            <div className={`avatar-mouth ${speaking ? 'is-speaking' : ''}`} />
          </div>
        </div>

        {/* Body / shoulders */}
        <div className="avatar-body" />
      </div>

      {/* Sound wave visualizer */}
      <div
        ref={barsRef}
        className={`avatar-soundwave ${speaking ? 'visible' : ''}`}
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className="soundwave-bar" />
        ))}
      </div>

      {/* Status label */}
      <div className={`avatar-label ${speaking ? 'is-speaking' : ''}`}>
        {speaking ? 'Speaking…' : 'Listening'}
      </div>
    </div>
  );
}
