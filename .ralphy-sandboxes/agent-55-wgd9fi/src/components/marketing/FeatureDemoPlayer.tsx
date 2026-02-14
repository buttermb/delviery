/**
 * FeatureDemoPlayer — Wrapper for feature demo Remotion compositions.
 * Each feature section on the Features page uses this to display its demo.
 */

import type { ComponentType } from 'react';
import { RemotionPlayer } from '@/components/remotion/RemotionPlayer';
import { SCENE_DURATIONS } from '@/remotion/config';

interface FeatureDemoPlayerProps {
  component: ComponentType<Record<string, unknown>>;
  className?: string;
}

export function FeatureDemoPlayer({ component, className = '' }: FeatureDemoPlayerProps) {
  return (
    <div className={`aspect-video rounded-2xl overflow-hidden shadow-lg ${className}`}>
      <RemotionPlayer
        component={component}
        durationInFrames={SCENE_DURATIONS.featureDemo}
        loop
        autoPlay
        controls={false}
        clickToPlay={false}
      />
    </div>
  );
}
