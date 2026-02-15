// @ts-nocheck
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { interpolate } from 'remotion';

// Floating badge that highlights key feature
interface Props {
  text: string;
  x: number;
  y: number;
  delay: number;
}

export function FeatureCallout({ text, x, y, delay }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, mass: 0.8, stiffness: 200 }
  });

  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
    extrapolateRight: 'clamp'
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `scale(${scale})`,
        opacity,
        zIndex: 50,
        boxShadow: '0 20px 50px -10px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.6)'
      }}
      className="px-6 py-3 bg-white/95 backdrop-blur-md rounded-full border border-indigo-100 flex items-center gap-3"
    >
      <div className="relative flex items-center justify-center w-3 h-3">
        <div className="absolute w-full h-full rounded-full bg-amber-400 animate-ping opacity-75" />
        <div className="relative w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
      </div>
      <span className="text-base font-bold text-slate-800 tracking-wide font-sans">{text}</span>
    </div>
  );
}
