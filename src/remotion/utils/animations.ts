/**
 * Shared Remotion animation helpers.
 * All animations are frame-driven — no CSS transitions.
 */

import { interpolate, spring, type SpringConfig } from 'remotion';
import { SPRING_PRESETS } from '@/remotion/config';

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
