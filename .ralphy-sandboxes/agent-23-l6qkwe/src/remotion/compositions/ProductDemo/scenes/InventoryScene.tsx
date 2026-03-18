import { useCurrentFrame, useVideoConfig } from 'remotion';
import { interpolate } from 'remotion';
import { DashboardMockup } from '../components/DashboardMockup';
import { FeatureCallout } from '../components/FeatureCallout';
import { TransitionOverlay } from '../components/TransitionOverlay';
import { AlertTriangle, Check, TrendingUp, Package } from 'lucide-react';

export function InventoryScene() {
  const frame = useCurrentFrame();
  useVideoConfig();

  const INVENTORY = [
    { name: 'Blue Dream', stock: 142, status: 'Ideal', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
    { name: 'OG Kush', stock: 85, status: 'Good', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
    { name: 'Sour Diesel', stock: 12, status: 'Low Stock', color: 'text-amber-600 bg-amber-50 border-amber-100', warn: true },
    { name: 'Gummies', stock: 340, status: 'Overstock', color: 'text-purple-600 bg-purple-50 border-purple-100' },
    { name: 'Vape Pen', stock: 0, status: 'Out of Stock', color: 'text-rose-600 bg-rose-50 border-rose-100' },
  ];

  const rowOpacity = (i: number) => interpolate(frame, [i * 5, i * 5 + 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{ flex: 1, height: '100%', backgroundColor: 'white' }}>
      <DashboardMockup title="floraiq.com/admin/inventory">
        <div className="flex gap-8 h-full">
          {/* Table - Premium List View */}
          <div className="flex-1 bg-white rounded-2xl border border-indigo-50 overflow-hidden shadow-sm flex flex-col">
            <div className="p-6 border-b border-indigo-50/50 flex justify-between items-center bg-slate-50/50">
              <div className="flex flex-col">
                <div className="font-bold text-slate-800 text-lg">Inventory Status</div>
                <div className="text-xs text-slate-400 font-medium">Synced with Metrc & POS</div>
              </div>
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-lg bg-white border border-indigo-50 flex items-center justify-center shadow-sm text-slate-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-3">
              {INVENTORY.map((item, i) => (
                <div
                  key={i}
                  style={{ opacity: rowOpacity(i) }}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${item.warn && frame > 120 ? 'border-amber-300 bg-amber-50 shadow-md transform scale-[1.02]' : 'border-slate-100 bg-white hover:border-indigo-100 hover:shadow-sm'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.warn ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-700">{item.name}</div>
                      <div className="text-xs text-slate-400">SKU: 8392-A{i}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-slate-600 font-mono font-medium">{item.stock} units</div>
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border ${item.color}`}>
                      {item.warn ? <AlertTriangle className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                      {item.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Forecast Panel - Dark Premium Card */}
          <div className="w-1/3 flex flex-col gap-6">
            <div
              className="rounded-2xl p-6 text-white flex-1 relative overflow-hidden flex flex-col shadow-2xl"
              style={{
                background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
                opacity: interpolate(frame, [60, 80], [0, 1])
              }}
            >
              {/* Background Glows */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 blur-[60px] rounded-full translate-y-1/2 -translate-x-1/2" />

              <div className="font-bold text-xl mb-1 flex items-center gap-3 relative z-10">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                AI Forecast
              </div>
              <p className="text-slate-400 text-sm mb-8 relative z-10 ml-1">Demand prediction for next 30 days</p>

              <div className="flex items-end gap-1.5 h-40 mb-4 relative z-10">
                {[30, 45, 38, 52, 48, 60, 75, 55, 68, 85, 95, 80, 70, 88].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm relative group bg-emerald-500/30 overflow-hidden"
                    style={{
                      height: `${interpolate(frame, [80 + i * 2, 100 + i * 2], [0, h])}%`,
                    }}
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400/50" />
                  </div>
                ))}
              </div>

              {frame > 150 && (
                <div
                  className="rounded-xl p-4 flex items-center gap-4 animate-pulse relative z-10 mt-auto border border-amber-500/30"
                  style={{ background: 'rgba(245, 158, 11, 0.1)' }}
                >
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-amber-400">Stockout Risk Detected</div>
                    <div className="text-xs text-amber-200/70">Sour Diesel depleted in 3 days</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <FeatureCallout
          text="AI-Powered Stock Predictions"
          x={800} y={150}
          delay={160}
        />
      </DashboardMockup>
      <TransitionOverlay startFrame={165} />
    </div>
  );
}
