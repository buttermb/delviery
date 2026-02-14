/**
 * RemotionHeroBackground — Replaces AnimatedMeshBackground with a looping Remotion composition.
 * Absolute positioned behind hero content.
 */

import { RemotionPlayer } from '@/components/remotion/RemotionPlayer';
import { HeroBackground } from '@/remotion/compositions/HeroBackground/index';
import { SCENE_DURATIONS } from '@/remotion/config';

export function RemotionHeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <RemotionPlayer
        component={HeroBackground as React.ComponentType<Record<string, unknown>>}
        durationInFrames={SCENE_DURATIONS.heroBackground}
        loop
        autoPlay
        controls={false}
        className="w-full h-full"
      />
    </div>
  );
}
