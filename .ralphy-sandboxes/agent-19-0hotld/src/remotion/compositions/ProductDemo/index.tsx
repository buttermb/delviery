import { Sequence } from 'remotion';
import { DashboardScene } from './scenes/DashboardScene';
import { OrdersScene } from './scenes/OrdersScene';
import { InventoryScene } from './scenes/InventoryScene';
import { FleetScene } from './scenes/FleetScene';
import { MenusScene } from './scenes/MenusScene';
import { SCENE_DURATIONS } from '../../config';

export const ProductDemo = () => {
  return (
    <div style={{ flex: 1, backgroundColor: 'white' }}>
      <Sequence from={0} durationInFrames={SCENE_DURATIONS.dashboard}>
        <DashboardScene />
      </Sequence>

      <Sequence from={SCENE_DURATIONS.dashboard} durationInFrames={SCENE_DURATIONS.orders}>
        <OrdersScene />
      </Sequence>

      <Sequence
        from={SCENE_DURATIONS.dashboard + SCENE_DURATIONS.orders}
        durationInFrames={SCENE_DURATIONS.inventory}
      >
        <InventoryScene />
      </Sequence>

      <Sequence
        from={SCENE_DURATIONS.dashboard + SCENE_DURATIONS.orders + SCENE_DURATIONS.inventory}
        durationInFrames={SCENE_DURATIONS.fleet}
      >
        <FleetScene />
      </Sequence>

      <Sequence
        from={SCENE_DURATIONS.dashboard + SCENE_DURATIONS.orders + SCENE_DURATIONS.inventory + SCENE_DURATIONS.fleet}
        durationInFrames={SCENE_DURATIONS.menus}
      >
        <MenusScene />
      </Sequence>
    </div>
  );
};
