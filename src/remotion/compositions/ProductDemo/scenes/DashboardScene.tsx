import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { interpolate } from 'remotion';
import { DashboardMockup } from '../components/DashboardMockup';
import { StatCard } from '../components/StatCard';
import { FeatureCallout } from '../components/FeatureCallout';
import { TransitionOverlay } from '../components/TransitionOverlay';

export function DashboardScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const STATS = [
    { label: 'Total Revenue', value: '$24,592', trend: '+12.5%', color: 'purple', delay: 10 },
    { label: 'Active Orders', value: '148', trend: '+4.2%', color: 'emerald', delay: 16 },
    { label: 'Pending Delivery', value: '32', trend: '-1.1%', color: 'amber', delay: 22 },
    { label: 'Avg Order Value', value: '$165.20', trend: '+8.4%', color: 'blue', delay: 28 },
  ] as const;

  const chartHeight = start => interpolate(frame, [start, start + 30], [0, 100], { extrapolateRight: 'clamp' });

  return (
    <div style={{ flex: 1, height: '100%', backgroundColor: 'white' }}>
      <DashboardMockup title="floraiq.com/admin/dashboard">
        <div className="flex flex-col gap-8 h-full">
          <div className="grid grid-cols-4 gap-6">
            {STATS.map((stat, i) => (
              <StatCard
                key={i}
                {...stat}
              />
            ))}
          </div>

          <div
            className="flex-1 bg-white rounded-2xl border flex flex-col relative overflow-hidden"
            style={{
              borderColor: 'rgba(226, 232, 240, 0.8)',
              boxShadow: '0 20px 60px -10px rgba(46, 22, 121, 0.05)' // Subtle Indigo shadow
            }}
          >
            <div className="flex justify-between items-center p-6 border-b border-indigo-50/50">
              <div className="flex flex-col">
                <div className="text-xl font-bold text-slate-800">Revenue Overview</div>
                <div className="text-sm text-slate-400">Monthly Recurring Revenue via Subscriptions</div>
              </div>
              <div className="flex gap-2">
                <div className="px-4 py-1.5 rounded-full text-slate-500 text-xs font-medium hover:bg-slate-50 cursor-pointer transition-colors">Weekly</div>
                <div className="px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 shadow-sm">Monthly</div>
              </div>
            </div>

            {/* Animated Chart */}
            <div className="flex items-end justify-between flex-1 px-8 pb-0 pt-8 gap-4">
              {[45, 60, 35, 78, 52, 65, 85, 48, 56, 72, 90, 65, 88].map((val, i) => (
                <div key={i} className="w-full bg-slate-50 rounded-t-lg relative group h-full overflow-hidden">
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t-lg opacity-90"
                    style={{
                      height: `${chartHeight(40 + (i * 3)) * (val / 100)}%`,
                      background: 'linear-gradient(180deg, #F3A73D 0%, #2E1679 120%)', // Gold to Indigo
                      transition: 'height 0.2s',
                    }}
                  />
                  {/* Glass highlight on bar */}
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-white/50" />
                </div>
              ))}
            </div>

            {/* Chart X-Axis Labels */}
            <div className="flex justify-between px-8 py-4 border-t border-slate-50 text-xs text-slate-400 font-medium">
              <div>Jan 01</div>
              <div>Jan 08</div>
              <div>Jan 15</div>
              <div>Jan 22</div>
              <div>Jan 29</div>
            </div>
          </div>
        </div>

        <FeatureCallout
          text="Real-time Revenue Analytics"
          x={240} y={160}
          delay={120}
        />
      </DashboardMockup>
      <TransitionOverlay startFrame={165} />
    </div>
  );
}
