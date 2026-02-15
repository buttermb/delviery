// @ts-nocheck
import { Composition } from 'remotion';
import { ProductDemo } from './compositions/ProductDemo';
import { REMOTION_CONFIG, SCENE_DURATIONS } from './config';
import './style.css';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ProductDemo"
        component={ProductDemo}
        durationInFrames={SCENE_DURATIONS.total}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />
    </>
  );
};
