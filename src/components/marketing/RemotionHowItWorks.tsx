/**
 * RemotionHowItWorks — Section wrapper with Remotion player
 * for the How It Works explainer composition.
 */

import { RemotionPlayer } from '@/components/remotion/RemotionPlayer';
import { HowItWorks } from '@/remotion/compositions/HowItWorks/index';
import { SCENE_DURATIONS } from '@/remotion/config';

export function RemotionHowItWorks() {
  return (
    <section className="py-20 bg-[hsl(var(--marketing-bg))]">
      <div className="container mx-auto px-4">
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
