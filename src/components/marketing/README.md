# Marketing Components

This directory contains all marketing site components for the DevPanel marketing homepage.

## Component Overview

### Core Components

#### **HeroSection.tsx**
Main hero section with animated background mesh, typewriter effect, and floating UI elements.
- Features: 3D parallax, animated mesh gradient, floating dashboard cards
- Dependencies: BackgroundMesh, FloatingUIElements, TypewriterHeadline, ScrollIndicator

#### **LiveActivitySection.tsx**
Real-time activity feed showing anonymized user actions and live stats.
- Features: Auto-updating ticker, live stats counter, activity feed
- Dependencies: LiveStatsTicker

#### **InteractiveDashboardShowcase.tsx**
Interactive dashboard preview with auto-tour and feature spotlights.
- Features: Auto-tour through features, animated stats, feature spotlights
- Dependencies: useInView from react-intersection-observer

#### **PlatformCapabilities.tsx**
Split-screen design with auto-scrolling feature highlights.
- Features: Sticky preview panel, auto-scrolling (4s intervals), parallax effects
- Dependencies: useInView, useScroll from framer-motion

#### **FeatureExplorer.tsx**
Tabbed interface for exploring platform features.
- Features: Tabbed navigation, visual previews, benefit metrics
- Dependencies: AnimatedIcon

#### **AnimatedHowItWorks.tsx**
Interactive step-by-step guide with progress bar.
- Features: Clickable steps, progress bar, time estimates, animated transitions
- Dependencies: AnimatedIcon

### Supporting Components

#### **TrustBadgesCluster.tsx**
Security and compliance badges (SOC 2, encryption, 2FA, etc.)
- Features: Animated icons, hover effects, glassmorphism cards

#### **CustomerSuccessTimeline.tsx**
Timeline visualization of customer success journey.
- Features: Animated timeline, metrics display, milestone tracking

#### **ProblemSolutionSection.tsx**
Before/after comparison of pain points vs solutions.
- Features: Side-by-side comparison, animated reveals

#### **ComparisonSection.tsx**
Feature comparison table (DevPanel vs Competitors vs Spreadsheets).
- Features: Desktop table, mobile cards, interactive toggles

#### **IntegrationEcosystem.tsx**
Integration showcase with connection diagram.
- Features: Logo grid, animated connection lines, hover effects

#### **ROICalculator.tsx**
Interactive ROI calculator widget.
- Features: Real-time calculations, animated results, savings breakdown

#### **FloatingChatButton.tsx**
Mobile-optimized floating chat button.
- Features: Bottom sheet chat interface, safe area support, mobile positioning

#### **MobileBottomSheet.tsx**
Reusable bottom sheet component for mobile navigation/modals.
- Features: Spring animations, drag handle, backdrop, safe area support

## Design System

All components use the unified design system defined in `src/index.css`:

- **Spacing Scale**: `--spacing-1` through `--spacing-16`
- **Border Radius**: `--radius-sm` through `--radius-xl`
- **Gradients**: `--gradient-primary`, `--gradient-secondary`, `--gradient-glass`
- **Shadows**: `--shadow-glass`, `--shadow-glow`, `--shadow-depth`
- **Glassmorphism**: `.glass-card`, `.glass-nav` utility classes

## Performance

All heavy components are lazy-loaded in `MarketingHome.tsx`:

```typescript
const LiveActivitySection = lazy(() => import("@/components/marketing/LiveActivitySection").then(m => ({ default: m.LiveActivitySection })));
```

Components are wrapped with `Suspense` and `SectionTransition` for smooth loading and animations.

## Mobile Optimization

All components include mobile-first enhancements:

- **Touch Targets**: Minimum 44x44px (48px for `.touch-target`)
- **Safe Area Insets**: Support for notched devices
- **Progressive Disclosure**: `.mobile-collapsible` utility
- **Responsive Breakpoints**: `md:` prefix for desktop styles

## Usage

Components are integrated in `src/pages/MarketingHome.tsx`:

```typescript
import { HeroSection } from "@/components/marketing/HeroSection";
import { SectionTransition } from "@/components/marketing/SectionTransition";

<SectionTransition variant="fade">
  <Suspense fallback={<SectionLoader />}>
    <LiveActivitySection />
  </Suspense>
</SectionTransition>
```

## Dependencies

- **framer-motion**: Animations and transitions
- **react-intersection-observer**: Scroll-triggered animations
- **@phosphor-icons/react**: Premium icon system
- **lucide-react**: Standard icons

## Animation Variants

- `fade`: Fade in with slight vertical movement
- `slide`: Slide in from left
- `scale`: Scale up from 0.95
- `stagger`: Sequential fade in for children

## Best Practices

1. Always wrap lazy-loaded components with `Suspense`
2. Use `SectionTransition` for smooth section animations
3. Include mobile-specific styles for touch devices
4. Use `AnimatedIcon` for premium icon animations
5. Follow the design system spacing and color variables
6. Test on mobile devices for touch interactions

