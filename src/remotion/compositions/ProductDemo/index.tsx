import React from 'react';
import { Sequence, useCurrentFrame } from 'remotion';
import { SCENE_DURATIONS } from '../../config';
import { DashboardScene } from './scenes/DashboardScene';
import { OrdersScene } from './scenes/OrdersScene';
import { InventoryScene } from './scenes/InventoryScene';
import { FleetScene } from './scenes/FleetScene';
import { MenusScene } from './scenes/MenusScene';
import { TransitionOverlay } from './components/TransitionOverlay';

export function ProductDemo() {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#0f172a',
        overflow: 'hidden',
      }}
    >
      {/* Scene 1: Dashboard Overview (0-180) */}
      <Sequence from={0} durationInFrames={SCENE_DURATIONS.dashboard}>
        <DashboardScene />
        <TransitionOverlay startFrame={165} direction="diagonal" />
      </Sequence>

      {/* Scene 2: Order Pipeline (180-360) */}
      <Sequence from={180} durationInFrames={SCENE_DURATIONS.orders}>
        <OrdersScene />
        <TransitionOverlay startFrame={165} direction="right" />
      </Sequence>

      {/* Scene 3: Inventory Intelligence (360-540) */}
      <Sequence from={360} durationInFrames={SCENE_DURATIONS.inventory}>
        <InventoryScene />
        <TransitionOverlay startFrame={165} direction="diagonal" />
      </Sequence>

      {/* Scene 4: Fleet Tracking (540-720) */}
      <Sequence from={540} durationInFrames={SCENE_DURATIONS.fleet}>
        <FleetScene />
        <TransitionOverlay startFrame={165} direction="left" />
      </Sequence>

      {/* Scene 5: Secure Menus + CTA (720-900) */}
      <Sequence from={720} durationInFrames={SCENE_DURATIONS.menus}>
        <MenusScene />
      </Sequence>

      {/* Global progress bar at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: 'rgba(255,255,255,0.05)',
          zIndex: 9999,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${(frame / SCENE_DURATIONS.total) * 100}%`,
            background: `linear-gradient(90deg, #10B981, #06B6D4)`,
            borderRadius: '0 2px 2px 0',
          }}
        />
      </div>
    </div>
  );
}
