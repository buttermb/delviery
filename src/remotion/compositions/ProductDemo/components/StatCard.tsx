// @ts-nocheck
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { interpolate } from 'remotion';

interface StatCardProps {
  label: string;
  value: string;
  trend: string;
  color: 'emerald' | 'blue' | 'amber' | 'purple';
  delay: number;
}

export function StatCard({ label, value, trend, color, delay }: StatCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, mass: 0.8, stiffness: 200 }
  });

  const opacity = interpolate(frame, [delay, delay + 5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const isPositive = trend.startsWith('+');

  // Dynamic color map based on premium palette
  const getColorStyles = (c: string) => {
    switch (c) {
      case 'emerald': return { text: '#059669', bg: '#D1FAE5', bar: '#10B981' };
      case 'blue': return { text: '#2563EB', bg: '#DBEAFE', bar: '#3B82F6' };
      case 'amber': return { text: '#D97706', bg: '#FEF3C7', bar: '#F59E0B' };
      case 'purple': return { text: '#7C3AED', bg: '#EDE9FE', bar: '#8B5CF6' };
      default: return { text: '#475569', bg: '#F1F5F9', bar: '#94A3B8' };
    }
  };

  const theme = getColorStyles(color);

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
        boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 4px 10px -2px rgba(0, 0, 0, 0.02)',
        borderColor: 'rgba(226, 232, 240, 0.8)'
      }}
      className="bg-white p-6 rounded-2xl border flex flex-col gap-3 relative overflow-hidden group"
    >
      {/* Hover/Active Effect Highlight */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-50" />

      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</div>

      <div className="flex items-end justify-between">
        <div className="text-3xl font-bold text-slate-800 tracking-tight">{value}</div>
        <div
          className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
          style={{
            backgroundColor: isPositive ? '#ECFDF5' : '#FFF1F2',
            color: isPositive ? '#059669' : '#BE123C'
          }}
        >
          {isPositive ? '↑' : '↓'} {trend}
        </div>
      </div>

      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: '70%',
            backgroundColor: theme.bar,
            boxShadow: `0 2px 10px ${theme.bg}`
          }}
        />
      </div>
    </div>
  );
}
