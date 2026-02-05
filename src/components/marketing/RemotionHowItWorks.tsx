/**
 * RemotionHowItWorks — Section wrapper with Remotion player
 * for the How It Works explainer composition.
 */

import { RemotionPlayer } from '@/components/remotion/RemotionPlayer';
import { HowItWorks } from '@/remotion/compositions/HowItWorks/index';
import { SCENE_DURATIONS } from '@/remotion/config';

export function RemotionHowItWorks() {
  return (
    <section className="py-20 md:py-28 bg-[hsl(var(--marketing-bg))]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
            Get Started in Minutes
          </h2>
          <p className="text-xl text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto">
            Three simple steps to transform your operations
          </p>
        </div>
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl border border-[hsl(var(--marketing-border))] shadow-lg overflow-hidden bg-white">
            <RemotionPlayer
              component={HowItWorks as React.ComponentType<Record<string, unknown>>}
              durationInFrames={SCENE_DURATIONS.howItWorks}
              controls
              loop
              clickToPlay
            />
          </div>
        </div>
      </div>
    </section>
  );
}
