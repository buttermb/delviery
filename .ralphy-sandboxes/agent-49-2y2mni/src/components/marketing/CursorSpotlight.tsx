/**
 * CursorSpotlight - Disabled for performance
 * Mouse tracking animations cause significant scroll lag
 */

import { RefObject } from 'react';

interface CursorSpotlightProps {
    containerRef: RefObject<HTMLElement>;
}

export function CursorSpotlight({ containerRef: _containerRef }: CursorSpotlightProps) {
  // Disabled for performance - cursor tracking causes scroll jank
  return null;
}
