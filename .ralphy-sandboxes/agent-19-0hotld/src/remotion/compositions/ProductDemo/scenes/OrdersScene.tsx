import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { interpolate } from 'remotion';
import { DashboardMockup } from '../components/DashboardMockup';
import { FeatureCallout } from '../components/FeatureCallout';
import { TransitionOverlay } from '../components/TransitionOverlay';
import { CheckCircle2, Clock, Package } from 'lucide-react';

export function OrdersScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const _moveCard = (startFrame: number, startX: number, endX: number) => {
    return spring({
      frame: frame - startFrame,
      fps,
      from: startX,
      to: endX,
      config: { damping: 20, stiffness: 100 }
    });
  };

  const colOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const toastY = spring({ frame: frame - 120, fps, from: -100, to: 20, config: { damping: 15 } });
  const toastOpacity = interpolate(frame, [120, 130, 170, 180], [0, 1, 1, 0]);

  // Simulated card movement logic
  // New -> Prep (Starts f=30)
  const card1Opacity = interpolate(frame, [30, 40], [1, 0], { extrapolateRight: 'clamp' }); // Fade out in col 1
  const card1Appear = interpolate(frame, [30, 40], [0, 1], { extrapolateRight: 'clamp' }); // Appear in col 2

  // Prep -> Quality (Starts f=60)
  const card2Opacity = interpolate(frame, [60, 70], [1, 0], { extrapolateRight: 'clamp' });
  const card2Appear = interpolate(frame, [60, 70], [0, 1], { extrapolateRight: 'clamp' });

  // Quality -> Ready (Starts f=90)
  const card3Opacity = interpolate(frame, [90, 100], [1, 0], { extrapolateRight: 'clamp' });
  const card3Appear = interpolate(frame, [90, 100], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{ flex: 1, height: '100%', backgroundColor: 'white' }}>
      <DashboardMockup title="floraiq.com/admin/orders">
        <div style={{ opacity: colOpacity }} className="grid grid-cols-4 gap-6 h-full">
          {/* Columns */}
          {['New', 'Prep', 'Quality', 'Ready'].map((status, i) => (
            <div key={status} className="bg-slate-50/50 rounded-2xl p-4 flex flex-col gap-4 border border-slate-100 shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-slate-700 flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{
                      backgroundColor: i === 0 ? '#3B82F6' : i === 1 ? '#F59E0B' : i === 2 ? '#7C3AED' : '#10B981',
                      boxShadow: i === 1 ? '0 0 10px rgba(245, 158, 11, 0.4)' : undefined
                    }}
                  />
                  {status}
                </div>
                <div className="bg-white px-2.5 py-1 rounded-md text-xs font-bold text-slate-400 border border-slate-100 shadow-sm">
                  {i === 3 ? 12 + (frame > 90 ? 1 : 0) : 4}
                </div>
              </div>

              {/* Render dummy cards */}
              <div className="flex flex-col gap-3">
                {/* Static cards */}
                <OrderCard id={`#49${40 + i}`} client="Dispensary A" items={8} color={i} />

                {/* Moving Card Logic - Simplified for demo visual */}
                {i === 0 && <div style={{ opacity: card1Opacity }}><OrderCard id="#4932" client="Green Leaf" items={12} color={0} /></div>}

                {i === 1 && <div style={{ opacity: card1Appear }}><OrderCard id="#4932" client="Green Leaf" items={12} color={1} /></div>}
                {i === 1 && <div style={{ opacity: card2Opacity }}><OrderCard id="#4928" client="Urban Well" items={8} color={1} /></div>}

                {i === 2 && <div style={{ opacity: card2Appear }}><OrderCard id="#4928" client="Urban Well" items={8} color={2} /></div>}
                {i === 2 && <div style={{ opacity: card3Opacity }}><OrderCard id="#4926" client="Coastal Co" items={24} color={2} /></div>}

                {i === 3 && <div style={{ opacity: card3Appear }}><OrderCard id="#4926" client="Coastal Co" items={24} color={3} /></div>}
                {i === 3 && <OrderCard id="#4925" client="Med Leaf" items={6} color={3} />}

              </div>
            </div>
          ))}
        </div>

        {/* Toast Notification */}
        <div
          style={{
            position: 'absolute',
            right: 40,
            top: toastY,
            opacity: toastOpacity,
            zIndex: 100,
            boxShadow: '0 20px 60px -10px rgba(46, 22, 121, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.8)'
          }}
          className="bg-white/95 backdrop-blur-md rounded-xl p-4 flex items-center gap-4 w-96 border border-emerald-50"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center border border-emerald-200 shadow-sm">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-lg">Order #4926 Ready</div>
            <div className="text-sm text-slate-500">Scheduled for pickup at 2:00 PM</div>
          </div>
        </div>

        <FeatureCallout
          text="Automated Pipeline"
          x={600} y={400}
          delay={140}
        />
      </DashboardMockup>
      <TransitionOverlay startFrame={165} />
    </div>
  );
}

function OrderCard({ id, client, items, color }: { id: string, client: string, items: number, color: number }) {
  const styles = [
    { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600', dot: 'bg-blue-500' },
    { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', dot: 'bg-amber-500' },
    { bg: 'bg-purple-50 border-purple-100', text: 'text-purple-600', dot: 'bg-purple-500' },
    { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  ];

  const style = styles[color];

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-2 relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer">
      <div className={`absolute top-0 left-0 w-1 h-full ${style.dot}`} />
      <div className="flex justify-between items-start pl-2">
        <span className="font-mono text-xs font-bold text-slate-400">{id}</span>
        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
          {color === 0 ? 'New' : color === 1 ? 'Prep' : color === 2 ? 'QA' : 'Ready'}
        </span>
      </div>
      <div className="font-bold text-slate-800 pl-2 text-sm">{client}</div>
      <div className="text-xs text-slate-400 pl-2 flex items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded text-slate-500">
          <Package className="w-3 h-3" /> {items}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> 2m
        </div>
      </div>
    </div>
  )
}
