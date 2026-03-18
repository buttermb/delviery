# FloraIQ Promo Video — Remotion

A 30-second cinematic marketing video for [FloraIQ](https://floraiqcrm.com) built with [Remotion](https://www.remotion.dev).

## 🎬 Video Structure (30s @ 30fps = 900 frames)

| Scene | Time | Frames | Feature |
|-------|------|--------|---------|
| 1. Dashboard Overview | 0-6s | 0-180 | Revenue analytics, stats cards, activity feed |
| 2. Order Pipeline | 6-12s | 180-360 | Kanban board, order flow, toast notifications |
| 3. Inventory Intelligence | 12-18s | 360-540 | Stock management, demand forecasting, AI alerts |
| 4. Fleet Tracking | 18-24s | 540-720 | GPS map, route optimization, traffic rerouting |
| 5. Secure Menus | 24-30s | 720-900 | Encrypted menus, passphrase entry, CTA |

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Open Remotion Studio (preview + edit in browser)
npx remotion studio

# Render to MP4
npx remotion render ProductDemo out/floraiq-promo.mp4

# Render to WebM
npx remotion render ProductDemo out/floraiq-promo.webm --codec=vp8
```

## 📁 File Structure

```
src/remotion/
├── Root.tsx                          # Composition registry
├── config.ts                         # Colors, timing, spring presets
├── compositions/
│   └── ProductDemo/
│       ├── index.tsx                 # Main 30s composition (sequences all scenes)
│       ├── scenes/
│       │   ├── DashboardScene.tsx    # Scene 1: Stats + Revenue chart
│       │   ├── OrdersScene.tsx       # Scene 2: Kanban pipeline
│       │   ├── InventoryScene.tsx    # Scene 3: Stock + AI forecasting
│       │   ├── FleetScene.tsx        # Scene 4: GPS map + rerouting
│       │   └── MenusScene.tsx        # Scene 5: Encrypted menus + CTA
│       └── components/
│           ├── DashboardMockup.tsx   # Browser frame wrapper
│           ├── FeatureCallout.tsx    # Floating feature badge
│           ├── TransitionOverlay.tsx # Scene transition wipe
│           ├── StatCard.tsx          # Animated stat with trend
│           ├── OrderCard.tsx         # Order card for kanban
│           └── BarChart.tsx          # Animated revenue bars
└── utils/
    └── animations.ts                 # Shared animation helpers
```

## 🎨 Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary | `#10B981` | CTA buttons, highlights |
| Primary Dark | `#059669` | Hover states |
| Accent | `#06B6D4` | Links, charts |
| Text | `#0f172a` | Headings |
| Background | `#f8fafc` | Dashboard bg |

## 🎥 Preview Individual Scenes

Each scene is registered as a separate composition in Remotion Studio:

- `ProductDemo` — Full 30s video
- `DashboardScene` — Scene 1 only
- `OrdersScene` — Scene 2 only
- `InventoryScene` — Scene 3 only
- `FleetScene` — Scene 4 only
- `MenusScene` — Scene 5 only

## 🔧 Customization

**Change timing:** Edit `SCENE_DURATIONS` in `src/remotion/config.ts`

**Change colors:** Edit `COLORS` in `src/remotion/config.ts`

**Adjust animations:** Modify `SPRING_PRESETS` or individual spring configs in each scene

**Add/remove scenes:** Update `ProductDemo/index.tsx` and adjust `Sequence` offsets

## 📦 Embedding Options

### Option A: Pre-rendered video
Render to MP4/WebM and embed as `<video>` tag on floraiqcrm.com.

### Option B: Remotion Player (interactive)
```tsx
import { Player } from '@remotion/player';
import { ProductDemo } from './remotion/compositions/ProductDemo';

<Player
  component={ProductDemo}
  durationInFrames={900}
  fps={30}
  compositionWidth={1920}
  compositionHeight={1080}
  style={{ width: '100%' }}
  controls
  autoPlay
  loop
/>
```
