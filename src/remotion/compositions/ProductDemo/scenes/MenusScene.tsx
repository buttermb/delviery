import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { interpolate } from 'remotion';
import { TransitionOverlay } from '../components/TransitionOverlay';
import { Lock, ShieldCheck, ArrowRight, Smartphone } from 'lucide-react';

export function MenusScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneRotate = interpolate(frame, [0, 60], [0, 360], { extrapolateRight: 'clamp' });
  const lockOpacity = interpolate(frame, [0, 50], [1, 1]);
  const decryptOpacity = interpolate(frame, [60, 90], [0, 1]);
  const menuOpacity = interpolate(frame, [90, 120], [0, 1]);
  const ctaScale = spring({ frame: frame - 150, fps, config: { damping: 12 } });

  return (
    <div className="flex-1 h-full bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Grid - Dark Premium */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1e1b4b] to-[#0f172a]" />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }}
      />
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      {/* Floating Phone Mockup */}
      <div className="relative z-10 transform scale-110">
        <div className="w-[300px] h-[600px] bg-[#0f172a] rounded-[3rem] border-[8px] border-slate-800 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden ring-1 ring-white/10">
          {/* Dynamic Island */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-7 w-24 bg-black rounded-b-2xl z-20" />

          {/* Screen Content Switcher */}
          <div className="w-full h-full bg-slate-50 relative font-sans">

            {/* Phase 1: Lock Screen - Premium Dark */}
            {frame < 80 && (
              <div className="absolute inset-0 bg-[#0f172a] flex flex-col items-center justify-center text-white p-6 bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-8 border border-white/20 shadow-lg">
                    <Lock className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-xl font-medium mb-8 tracking-wide">Enter Passcode</div>
                  <div className="flex gap-6">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-full border border-white/50 transition-all duration-300 ${frame > 20 + i * 10 ? 'bg-white border-white scale-125' : 'bg-transparent'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Phase 2: Decrypting */}
            {frame >= 80 && frame < 110 && (
              <div className="absolute inset-0 bg-[#2E1679] flex flex-col items-center justify-center text-white">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-50 animate-pulse" />
                  <ShieldCheck className="w-20 h-20 mb-6 relative z-10" />
                </div>
                <div className="font-mono text-xs tracking-[0.2em] font-bold text-indigo-200">AUTHENTICATING SECURE TOKEN...</div>
              </div>
            )}

            {/* Phase 3: Menu (Success) */}
            {frame >= 110 && (
              <div className="absolute inset-0 bg-[#F8FAFC] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-500">
                {/* Header */}
                <div className="pt-14 pb-4 px-6 bg-white border-b border-slate-100 flex justify-between items-end shadow-sm">
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Wholesale Menu</div>
                    <div className="font-bold text-2xl text-slate-900 leading-tight">Secret Selection</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-[10px] font-bold text-slate-400">EXPIRES IN</div>
                    <div className="text-xs font-mono font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded">09:59</div>
                  </div>
                </div>

                {/* Product Scroll */}
                <div className="flex-1 p-4 grid grid-cols-2 gap-3 overflow-hidden align-content-start">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2 animate-in slide-in-from-bottom-4 fade-in duration-700" style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}>
                      <div className="aspect-[4/3] bg-slate-100 rounded-lg relative overflow-hidden">
                        {/* Gradient Placeholder for Product Image */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${i % 2 === 0 ? 'from-emerald-100 to-emerald-50' : 'from-indigo-100 to-indigo-50'}`} />
                      </div>
                      <div>
                        <div className="h-3 w-3/4 bg-slate-200 rounded-full mb-1.5" />
                        <div className="h-3 w-1/2 bg-slate-100 rounded-full" />
                      </div>
                      <div className="mt-auto flex justify-between items-center pt-1">
                        <div className="font-bold text-sm text-slate-900">$45</div>
                        <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-white">
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Blur Fade */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#F8FAFC] to-transparent pointer-events-none" />

                {/* Floating Cart Button */}
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="w-full py-4 bg-[#2E1679] text-white rounded-2xl font-bold shadow-xl shadow-indigo-900/20 flex items-center justify-center gap-2">
                    Start Order
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Final CTA - Premium Branding */}
      {frame > 140 && (
        <div
          style={{ transform: `scale(${ctaScale})` }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center text-white"
        >
          {/* Glass Overlay of background */}
          <div className="absolute inset-0 bg-[#2E1679]/90 backdrop-blur-xl" />

          <div className="relative z-10 flex flex-col items-center">
            <h1 className="text-7xl font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/70 drop-shadow-sm">FloraIQ</h1>
            <p className="text-2xl text-indigo-200 mb-10 font-light tracking-wide">Wholesale Reimagined</p>

            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
              <div className="relative bg-white text-[#2E1679] px-10 py-5 rounded-full text-2xl font-bold flex items-center gap-3 shadow-2xl">
                floraiq.com
                <ArrowRight className="w-6 h-6 text-amber-500" />
              </div>
            </div>

            <div className="mt-8 text-sm text-indigo-200/80 font-medium tracking-wide uppercase">Try Free Forever • No Credit Card</div>
          </div>
        </div>
      )}

      <TransitionOverlay startFrame={175} />
    </div>
  );
}
