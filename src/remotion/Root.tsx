/**
 * Remotion Composition Registry
 * All compositions are registered here for the Remotion Studio / CLI.
 */

import { Composition } from 'remotion';
import { REMOTION_CONFIG, SCENE_DURATIONS } from '@/remotion/config';
import { ProductDemo } from '@/remotion/compositions/ProductDemo/index';
import { HeroBackground } from '@/remotion/compositions/HeroBackground/index';
import { HowItWorks } from '@/remotion/compositions/HowItWorks/index';
import { SecurityExplainer } from '@/remotion/compositions/SecurityExplainer/index';
import { ROIAnimation } from '@/remotion/compositions/ROIAnimation/index';
import { TestimonialCard, testimonialCardSchema } from '@/remotion/compositions/TestimonialCard/index';
import { DisposableMenusDemo } from '@/remotion/compositions/features/DisposableMenusDemo';
import { InventoryDemo } from '@/remotion/compositions/features/InventoryDemo';
import { OrderManagementDemo } from '@/remotion/compositions/features/OrderManagementDemo';
import { CustomerPortalDemo } from '@/remotion/compositions/features/CustomerPortalDemo';
import { AnalyticsDemo } from '@/remotion/compositions/features/AnalyticsDemo';
import { FloraIQPromo } from '@/remotion/compositions/FloraIQPromo';
import { FloraIQHeroLoop } from '@/remotion/compositions/FloraIQHeroLoop';

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="ProductDemo"
        component={ProductDemo}
        durationInFrames={SCENE_DURATIONS.productDemo}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />
      <Composition
        id="HeroBackground"
        component={HeroBackground}
        durationInFrames={SCENE_DURATIONS.heroBackground}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />
      <Composition
        id="HowItWorks"
        component={HowItWorks}
        durationInFrames={SCENE_DURATIONS.howItWorks}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />
      <Composition
        id="SecurityExplainer"
        component={SecurityExplainer}
        durationInFrames={SCENE_DURATIONS.securityExplainer}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />
      <Composition
        id="ROIAnimation"
        component={ROIAnimation}
        durationInFrames={SCENE_DURATIONS.roiAnimation}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />
      <Composition
        id="TestimonialCard"
        component={TestimonialCard}
        durationInFrames={SCENE_DURATIONS.testimonialCard}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
        schema={testimonialCardSchema}
        defaultProps={{
          text: 'Sample testimonial text',
          author: 'John D.',
          company: 'Acme Corp',
          rating: 5,
          role: 'CEO',
          avatar: 'JD',
        }}
      />
      <Composition
        id="DisposableMenusDemo"
        component={DisposableMenusDemo}
        durationInFrames={SCENE_DURATIONS.featureDemo}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />
      <Composition
        id="InventoryDemo"
        component={InventoryDemo}
        durationInFrames={SCENE_DURATIONS.featureDemo}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />
      <Composition
        id="OrderManagementDemo"
        component={OrderManagementDemo}
        durationInFrames={SCENE_DURATIONS.featureDemo}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />
      <Composition
        id="CustomerPortalDemo"
        component={CustomerPortalDemo}
        durationInFrames={SCENE_DURATIONS.featureDemo}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />
      <Composition
        id="AnalyticsDemo"
        component={AnalyticsDemo}
        durationInFrames={SCENE_DURATIONS.featureDemo}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />
      <Composition
        id="FloraIQPromo"
        component={FloraIQPromo}
        durationInFrames={SCENE_DURATIONS.floraIQPromo}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />
      <Composition
        id="FloraIQHeroLoop"
        component={FloraIQHeroLoop}
        durationInFrames={SCENE_DURATIONS.floraIQHeroLoop}
        fps={REMOTION_CONFIG.fps}
        width={REMOTION_CONFIG.width}
        height={REMOTION_CONFIG.height}
      />
    </>
  );
}
