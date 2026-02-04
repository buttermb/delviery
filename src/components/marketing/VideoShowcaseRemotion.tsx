/**
 * VideoShowcaseRemotion — Wraps the Remotion ProductDemo player
 * with section heading and feature pills.
 */

import { RemotionPlayer } from '@/components/remotion/RemotionPlayer';
import { ProductDemo } from '@/remotion/compositions/ProductDemo/index';
import { SCENE_DURATIONS } from '@/remotion/config';

const FEATURE_PILLS = [
  'Dashboard Analytics',
  'Order Pipeline',
  'Inventory AI',
  'Fleet GPS',
  'Encrypted Menus',
];

export function VideoShowcaseRemotion() {
  return (
    <section
      id="video-showcase-section"
      className="py-20 md:py-32 bg-[hsl(var(--marketing-bg))] relative overflow-x-hidden"
    >
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--marketing-primary))]/5 border border-[hsl(var(--marketing-primary))]/10 text-[10px] font-bold text-[hsl(var(--marketing-primary))] mb-6 backdrop-blur-sm uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live Platform Demo
          </div>
          <h2 className="text-4xl md:text-6xl font-bold mb-4 text-[hsl(var(--marketing-text))] tracking-tight">
            Enterprise{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))]">
              Grade
            </span>
          </h2>
          <p className="text-lg text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto font-light">
            Watch a 30-second cinematic walkthrough of the full platform.
          </p>
        </div>

        {/* Remotion Player */}
        <div className="max-w-[1200px] mx-auto rounded-3xl border border-slate-200 shadow-2xl overflow-hidden bg-white">
          <RemotionPlayer
            component={ProductDemo as React.ComponentType<Record<string, unknown>>}
            durationInFrames={SCENE_DURATIONS.productDemo}
            controls
            loop
            clickToPlay
          />
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-10">
          {FEATURE_PILLS.map((pill) => (
            <span
              key={pill}
              className="px-4 py-2 rounded-full bg-[hsl(var(--marketing-bg-subtle))] border border-[hsl(var(--marketing-border))] text-sm font-medium text-[hsl(var(--marketing-text))]"
            >
              {pill}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
