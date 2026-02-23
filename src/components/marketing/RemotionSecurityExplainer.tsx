/**
 * RemotionSecurityExplainer — Section wrapper for the Security Explainer composition.
 */

import { RemotionPlayer } from '@/components/remotion/RemotionPlayer';
import { SecurityExplainer } from '@/remotion/compositions/SecurityExplainer/index';
import { SCENE_DURATIONS } from '@/remotion/config';

export function RemotionSecurityExplainer() {
  return (
    <section className="py-20 bg-[hsl(var(--marketing-bg))]">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              Built for Security
            </h2>
            <p className="text-xl text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto">
              Enterprise-grade encryption with access controls and audit trails
            </p>
          </div>

          <div className="rounded-2xl border border-[hsl(var(--marketing-border))] shadow-lg overflow-hidden">
            <RemotionPlayer
              component={SecurityExplainer as React.ComponentType<Record<string, unknown>>}
              durationInFrames={SCENE_DURATIONS.securityExplainer}
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
