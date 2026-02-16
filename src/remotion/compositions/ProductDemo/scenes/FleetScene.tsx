// @ts-nocheck
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { interpolate } from 'remotion';
import { DashboardMockup } from '../components/DashboardMockup';
import { FeatureCallout } from '../components/FeatureCallout';
import { TransitionOverlay } from '../components/TransitionOverlay';
import { Truck, Navigation, AlertCircle } from 'lucide-react';

export function FleetScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Route drawing
  const _pathLength = interpolate(frame, [30, 90], [0, 1], { extrapolateRight: 'clamp' });
  const rerouteLength = interpolate(frame, [120, 150], [0, 1], { extrapolateRight: 'clamp' });

  // Driver Pos
  const driverProgress = interpolate(frame, [30, 90], [0, 0.6], { extrapolateRight: 'clamp' });

  const alertY = spring({ frame: frame - 90, fps, from: -100, to: 24, config: { damping: 15 } });
  const alertOpacity = interpolate(frame, [90, 100, 170, 180], [0, 1, 1, 0]);

  return (
    <div style={{ flex: 1, height: '100%', backgroundColor: 'white' }}>
      <DashboardMockup title="floraiq.com/admin/fleet">
        <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 shadow-inner group">
          {/* Map Grid Background - Architectural */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(#2E1679 1px, transparent 1px), linear-gradient(90deg, #2E1679 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />
          {/* Vignette Map Effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent pointer-events-none" />

          {/* Map UI Elements - Floating Premium Card */}
          <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.1)] border border-slate-100 z-10 w-64">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Fleet Status
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 text-indigo-600">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-lg">4 Active</div>
                <div className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                  <Navigation className="w-3 h-3" /> 98% On Time
                </div>
              </div>
            </div>
          </div>

          {/* Map Content Container */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="800" height="400" className="opacity-90">
              {/* Primary Route Phantom */}
              <path
                d="M 100 200 Q 300 200 400 100 T 700 150"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="8"
                strokeLinecap="round"
              />
              {/* Active Route */}
              <path
                d="M 100 200 Q 300 200 400 100 T 700 150"
                fill="none"
                stroke="#3b82f6" // Keep Blue for route, readable
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="8 8"
                className="animate-[dash_1s_linear_infinite]"
              />

              {/* Traffic Blockage (Animated) */}
              {frame > 90 && (
                <g>
                  <circle cx="400" cy="100" r="20" fill="rgba(239, 68, 68, 0.1)" className="animate-ping" />
                  <circle cx="400" cy="100" r="12" fill="#ef4444" className="animate-pulse" />
                  <path transform="translate(394, 94) scale(0.5)" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" fill="white" />
                </g>
              )}

              {/* Reroute (Green) */}
              {frame > 110 && (
                <path
                  d="M 300 180 Q 400 250 550 180 T 700 150"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4"
                  strokeLinecap="round"
                  pathLength={rerouteLength}
                  strokeDasharray="4 4"
                />
              )}
            </svg>

            {/* Driver Marker */}
            <div
              className="absolute"
              style={{
                left: '40%',
                top: '40%',
                transform: `translate(${driverProgress * 200}px, ${frame > 120 ? 50 : 0}px)`,
                transition: 'transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
                zIndex: 20
              }}
            >
              <div className="relative group/pin">
                <div className="bg-slate-900 text-white pl-2 pr-4 py-2 rounded-full shadow-2xl flex items-center gap-3 text-sm font-bold whitespace-nowrap border-2 border-white cursor-pointer hover:scale-105 transition-transform">
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center border border-indigo-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  </div>
                  Driver #4
                </div>
                {/* Pin Tail */}
                <div className="absolute left-6 h-4 w-[2px] bg-slate-900 bottom-[-14px]" />
                <div className="absolute left-4 bottom-[-18px] w-4 h-1 bg-black/20 blur-[2px] rounded-full" />
              </div>
            </div>
          </div>

          {/* Traffic Alert Banner - Premium Glass */}
          <div
            style={{
              position: 'absolute',
              top: alertY,
              right: 24,
              opacity: alertOpacity,
              backdropFilter: 'blur(12px)',
              boxShadow: '0 20px 40px -10px rgba(220, 38, 38, 0.3)'
            }}
            className="bg-white/90 pr-6 pl-4 py-3 rounded-xl border border-rose-100 flex items-center gap-4 z-30 max-w-sm"
          >
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <div className="text-slate-800 font-bold text-sm">Traffic Alert Detected</div>
              <div className="text-rose-500 text-xs font-semibold">Rerouting Driver #4 (+2m)</div>
            </div>
          </div>

        </div>

        <FeatureCallout
          text="Live GPS Optimization"
          x={150} y={450}
          delay={150}
        />
      </DashboardMockup>
      <TransitionOverlay startFrame={165} />
    </div>
  );
}
