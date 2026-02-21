/**
 * Remotion CLI entry point for rendering videos.
 *
 * Usage:
 *   npx remotion render src/remotion/render-entry.ts FloraIQHeroLoop out.mp4
 *   npx remotion render src/remotion/render-entry.ts FloraIQPromo out.mp4
 *   npx remotion studio src/remotion/render-entry.ts
 *
 * This file uses relative imports (no @/ aliases) so the Remotion bundler
 * can resolve everything without extra webpack config.
 */
import { registerRoot } from "remotion";
import { Composition } from "remotion";
import { FloraIQHeroLoop } from "./compositions/FloraIQHeroLoop";
import { FloraIQPromo } from "./compositions/FloraIQPromo";

const FPS = 30;

function RenderRoot() {
  return (
    <>
      <Composition
        id="FloraIQHeroLoop"
        component={FloraIQHeroLoop}
        durationInFrames={10 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="FloraIQPromo"
        component={FloraIQPromo}
        durationInFrames={30 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
}

registerRoot(RenderRoot);
