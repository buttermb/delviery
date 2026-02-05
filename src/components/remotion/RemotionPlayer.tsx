/**
 * Reusable Remotion Player wrapper with:
 * - Reduced motion fallback (static first frame)
 * - Mobile resolution scaling (960x540 on <768px)
 * - Suspense boundary
 */

import { Suspense, type ComponentType } from 'react';
import { Player } from '@remotion/player';
import { useShouldReduceAnimations, useIsMobile } from '@/hooks/useReducedMotion';
import { REMOTION_CONFIG, MOBILE_RESOLUTION } from '@/remotion/config';

interface RemotionPlayerProps {
  component: ComponentType<Record<string, unknown>>;
  durationInFrames: number;
  compositionWidth?: number;
  compositionHeight?: number;
  loop?: boolean;
  autoPlay?: boolean;
  controls?: boolean;
  inputProps?: Record<string, unknown>;
  className?: string;
  clickToPlay?: boolean;
}

export function RemotionPlayer({
  component,
  durationInFrames,
  compositionWidth = REMOTION_CONFIG.width,
  compositionHeight = REMOTION_CONFIG.height,
  loop = false,
  autoPlay = true,
  controls = false,
  inputProps = {},
  className = '',
  clickToPlay = false,
}: RemotionPlayerProps) {
  const reduceAnimations = useShouldReduceAnimations();
  const isMobile = useIsMobile();

  const width = isMobile ? MOBILE_RESOLUTION.width : compositionWidth;
  const height = isMobile ? MOBILE_RESOLUTION.height : compositionHeight;

  return (
    <Suspense
      fallback={
        <div
          className={`bg-slate-100 animate-pulse rounded-xl ${className}`}
          style={{ aspectRatio: `${compositionWidth}/${compositionHeight}` }}
        />
      }
    >
      <div className={className} style={{ width: '100%', height: '100%' }}>
        <Player
          component={component}
          durationInFrames={durationInFrames}
          compositionWidth={width}
          compositionHeight={height}
          fps={REMOTION_CONFIG.fps}
          loop={loop}
          autoPlay={reduceAnimations ? false : autoPlay}
          controls={controls}
          inputProps={inputProps}
          clickToPlay={clickToPlay}
          style={{
            width: '100%',
            height: '100%',
          }}
          initialFrame={reduceAnimations ? 0 : undefined}
        />
      </div>
    </Suspense>
  );
}
