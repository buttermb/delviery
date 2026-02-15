// @ts-nocheck
/**
 * Shared Remotion animation helpers.
 * All animations are frame-driven — no CSS transitions.
 */

import { interpolate, spring, useCurrentFrame, useVideoConfig, type SpringConfig } from 'remotion';
import { SPRING_PRESETS } from '../config';

const CLAMP = { extrapolateRight: 'clamp' as const, extrapolateLeft: 'clamp' as const };

/** Fade from 0 → 1 over `duration` frames starting at `startFrame` */
export function fadeIn(
  frame: number,
  startFrame: number,
  duration: number,
): number {
  return interpolate(frame, [startFrame, startFrame + duration], [0, 1], CLAMP);
}

/** Fade from 1 → 0 over `duration` frames starting at `startFrame` */
export function fadeOut(
  frame: number,
  startFrame: number,
  duration: number,
): number {
  return interpolate(frame, [startFrame, startFrame + duration], [1, 0], CLAMP);
}

/** Slide up from `distance` px to 0 over `duration` frames */
export function slideUp(
  frame: number,
  startFrame: number,
  duration: number,
  distance = 40,
): number {
  return interpolate(frame, [startFrame, startFrame + duration], [distance, 0], CLAMP);
}

/** Slide in from the left */
export function slideInLeft(
  frame: number,
  startFrame: number,
  duration: number,
  distance = 60,
): number {
  return interpolate(frame, [startFrame, startFrame + duration], [-distance, 0], CLAMP);
}

/** Slide in from the right */
export function slideInRight(
  frame: number,
  startFrame: number,
  duration: number,
  distance = 60,
): number {
  return interpolate(frame, [startFrame, startFrame + duration], [distance, 0], CLAMP);
}

/** Spring-driven scale (0 → 1) */
export function springScale(
  frame: number,
  fps: number,
  delay = 0,
  config: SpringConfig = SPRING_PRESETS.snappy,
): number {
  return spring({ frame: frame - delay, fps, config, durationInFrames: 30 });
}

/** Stagger helper — returns delay for item at `index` */
export function staggerDelay(index: number, perItem = 5): number {
  return index * perItem;
}

/** Typewriter effect — returns how many characters to show */
export function typewriter(
  frame: number,
  startFrame: number,
  totalChars: number,
  charsPerFrame = 0.8,
): number {
  const elapsed = Math.max(0, frame - startFrame);
  return Math.min(Math.floor(elapsed * charsPerFrame), totalChars);
}

/** Scale interpolation with clamp */
export function scaleIn(
  frame: number,
  startFrame: number,
  duration: number,
  from = 0.8,
): number {
  return interpolate(frame, [startFrame, startFrame + duration], [from, 1], CLAMP);
}

/** Progress bar — 0 to 1 */
export function progress(
  frame: number,
  startFrame: number,
  duration: number,
): number {
  return interpolate(frame, [startFrame, startFrame + duration], [0, 1], CLAMP);
}

// ─── Hook-based helpers (used by ProductDemo scenes) ────────────────

export function useSlideIn(
  delay = 0,
  direction: 'left' | 'right' | 'up' | 'down' = 'up',
  preset: keyof typeof SPRING_PRESETS = 'snappy'
) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const prog = spring({
    frame: frame - delay,
    fps,
    config: SPRING_PRESETS[preset],
  });

  const offsets: Record<string, { x: number; y: number }> = {
    left: { x: -80, y: 0 },
    right: { x: 80, y: 0 },
    up: { x: 0, y: 60 },
    down: { x: 0, y: -60 },
  };

  const { x, y } = offsets[direction];

  return {
    opacity: prog,
    transform: `translate(${interpolate(prog, [0, 1], [x, 0])}px, ${interpolate(prog, [0, 1], [y, 0])}px)`,
  };
}

export function useFadeIn(delay = 0, preset: keyof typeof SPRING_PRESETS = 'smooth') {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({
    frame: frame - delay,
    fps,
    config: SPRING_PRESETS[preset],
  });

  return { opacity };
}

export function useScale(delay = 0, preset: keyof typeof SPRING_PRESETS = 'bouncy') {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const prog = spring({
    frame: frame - delay,
    fps,
    config: SPRING_PRESETS[preset],
  });

  return {
    opacity: prog,
    transform: `scale(${interpolate(prog, [0, 1], [0.8, 1])})`,
  };
}

export function useCountUp(target: number, delay = 0, duration = 60) {
  const frame = useCurrentFrame();
  const clamped = Math.min(Math.max(frame - delay, 0), duration);
  const prog = interpolate(clamped, [0, duration], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const eased = 1 - Math.pow(1 - prog, 3);
  return Math.round(target * eased);
}

export function useTypewriter(text: string, delay = 0, charsPerFrame = 0.5) {
  const frame = useCurrentFrame();
  const elapsed = Math.max(frame - delay, 0);
  const chars = Math.floor(elapsed * charsPerFrame);
  return text.slice(0, Math.min(chars, text.length));
}

export function useProgress(startFrame: number, durationFrames: number) {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}
