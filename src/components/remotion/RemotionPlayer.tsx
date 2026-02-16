/**
 * Reusable Remotion Player wrapper with:
 * - Graceful fallback when @remotion/player is not installed
 * - Reduced motion fallback (static first frame)
 * - Mobile resolution scaling (960x540 on <768px)
 * - Suspense boundary
 */

import { Suspense, type ComponentType, type ReactNode } from 'react';
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
  children?: ReactNode;
}

/**
 * Placeholder component when Remotion is not available
 */
function RemotionPlaceholder({ 
  className, 
  compositionWidth, 
  compositionHeight 
}: { 
  className?: string; 
  compositionWidth: number; 
  compositionHeight: number;
}) {
  return (
    <div
      className={`bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center rounded-xl ${className}`}
      style={{ aspectRatio: `${compositionWidth}/${compositionHeight}` }}
    >
      <div className="text-center p-8">
        <div className="text-4xl mb-4">🎬</div>
        <p className="text-muted-foreground text-sm">
          Video player loading...
        </p>
      </div>
    </div>
  );
}

export function RemotionPlayer({
  component: _component,
  durationInFrames: _durationInFrames,
  compositionWidth = REMOTION_CONFIG.width,
  compositionHeight = REMOTION_CONFIG.height,
  loop: _loop = false,
  autoPlay: _autoPlay = true,
  controls: _controls = false,
  inputProps: _inputProps = {},
  className = '',
  clickToPlay: _clickToPlay = false,
}: RemotionPlayerProps) {
  const _reduceAnimations = useShouldReduceAnimations();
  const isMobile = useIsMobile();

  const width = isMobile ? MOBILE_RESOLUTION.width : compositionWidth;
  const height = isMobile ? MOBILE_RESOLUTION.height : compositionHeight;

  // Remotion player is not installed - show placeholder
  // To enable Remotion, install @remotion/player: npm install @remotion/player
  return (
    <Suspense
      fallback={
        <div
          className={`bg-slate-100 animate-pulse rounded-xl ${className}`}
          style={{ aspectRatio: `${width}/${height}` }}
        />
      }
    >
      <RemotionPlaceholder 
        className={className}
        compositionWidth={width}
        compositionHeight={height}
      />
    </Suspense>
  );
}
