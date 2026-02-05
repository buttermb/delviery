import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { ProductDemo } from './compositions/ProductDemo';
import { DashboardScene } from './compositions/ProductDemo/scenes/DashboardScene';
import { OrdersScene } from './compositions/ProductDemo/scenes/OrdersScene';
import { InventoryScene } from './compositions/ProductDemo/scenes/InventoryScene';
import { FleetScene } from './compositions/ProductDemo/scenes/FleetScene';
import { MenusScene } from './compositions/ProductDemo/scenes/MenusScene';
import { REMOTION_CONFIG, SCENE_DURATIONS } from './config';

export function RemotionRoot() {
  return (
    <>
      {/* Full 30-second promo video */}
      <Composition
        id="ProductDemo"
        component={ProductDemo}
        durationInFrames={SCENE_DURATIONS.total}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />

      {/* Individual scenes for preview */}
      <Composition
        id="DashboardScene"
        component={DashboardScene}
        durationInFrames={SCENE_DURATIONS.dashboard}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />

      <Composition
        id="OrdersScene"
        component={OrdersScene}
        durationInFrames={SCENE_DURATIONS.orders}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />

      <Composition
        id="InventoryScene"
        component={InventoryScene}
        durationInFrames={SCENE_DURATIONS.inventory}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />

      <Composition
        id="FleetScene"
        component={FleetScene}
        durationInFrames={SCENE_DURATIONS.fleet}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />

      <Composition
        id="MenusScene"
        component={MenusScene}
        durationInFrames={SCENE_DURATIONS.menus}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />
    </>
  );
}

registerRoot(RemotionRoot);
