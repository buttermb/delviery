/**
 * ProductDemo — 30-second composition orchestrating 5 scenes with transition overlaps.
 * Total: 900 frames at 30fps.
 */

import { Sequence, useCurrentFrame } from 'remotion';
import { SCENE_DURATIONS } from '@/remotion/config';
import { DashboardScene } from '@/remotion/compositions/ProductDemo/scenes/DashboardScene';
import { OrdersScene } from '@/remotion/compositions/ProductDemo/scenes/OrdersScene';
import { InventoryScene } from '@/remotion/compositions/ProductDemo/scenes/InventoryScene';
import { FleetScene } from '@/remotion/compositions/ProductDemo/scenes/FleetScene';
import { MenusScene } from '@/remotion/compositions/ProductDemo/scenes/MenusScene';
import { TransitionOverlay } from '@/remotion/compositions/ProductDemo/components/TransitionOverlay';

const SCENE = SCENE_DURATIONS.productDemoScene; // 180 frames = 6s each
const OVERLAP = 15; // transition overlap in frames

/**
 * Wrapper for TransitionOverlay that reads the parent composition's frame
 * and passes it as the startFrame context.
 */
function TransitionAt({ at }: { at: number }) {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + OVERLAP) return null;
  return <TransitionOverlay startFrame={at} />;
}

export function ProductDemo() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#f8fafc' }}>
      {/* Scene 1: Dashboard (0–180) */}
      <Sequence from={0} durationInFrames={SCENE}>
        <DashboardScene />
      </Sequence>

      {/* Scene 2: Orders (180–360) */}
      <Sequence from={SCENE} durationInFrames={SCENE}>
        <OrdersScene />
      </Sequence>

      {/* Scene 3: Inventory (360–540) */}
      <Sequence from={SCENE * 2} durationInFrames={SCENE}>
        <InventoryScene />
      </Sequence>

      {/* Scene 4: Fleet (540–720) */}
      <Sequence from={SCENE * 3} durationInFrames={SCENE}>
        <FleetScene />
      </Sequence>

      {/* Scene 5: Menus (720–900) */}
      <Sequence from={SCENE * 4} durationInFrames={SCENE}>
        <MenusScene />
      </Sequence>

      {/* Transition overlays — rendered at composition level for correct z-index */}
      <TransitionAt at={SCENE - OVERLAP} />
      <TransitionAt at={SCENE * 2 - OVERLAP} />
      <TransitionAt at={SCENE * 3 - OVERLAP} />
      <TransitionAt at={SCENE * 4 - OVERLAP} />
    </div>
  );
}
