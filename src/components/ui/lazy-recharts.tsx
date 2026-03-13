/**
 * Lazy-loaded Recharts wrappers
 *
 * Provides code-split versions of every recharts component used in the
 * project so the ~1.2 MB vendor-charts chunk is only fetched on pages
 * that actually render a chart.
 *
 * Usage: replace `from 'recharts'` with `from '@/components/ui/lazy-recharts'`.
 * The named exports mirror recharts exactly, so no call-site changes are needed
 * beyond the import path.
 */

import { lazy, Suspense } from 'react';

import type * as RechartsTypes from 'recharts';

// ---------------------------------------------------------------------------
// Lazy module loader (single dynamic import shared by every wrapper)
// ---------------------------------------------------------------------------
const lazyRecharts = () => import('recharts');

// ---------------------------------------------------------------------------
// Factory – creates a Suspense-wrapped lazy component.
// Uses `any` internally because recharts exports a mix of components and
// non-component values (e.g. `Global`), which makes strict generic
// constraints on ComponentProps impossible.  Call-sites are correctly typed
// since they only pass known component names.
// ---------------------------------------------------------------------------
type RechartsExports = typeof RechartsTypes;

/* eslint-disable @typescript-eslint/no-explicit-any */
function createLazy<K extends keyof RechartsExports>(name: K) {
  const LazyComp = lazy(() =>
    lazyRecharts().then((mod) => ({
      default: mod[name] as any,
    })),
  );

  const Wrapped = (props: any) => (
    <Suspense fallback={null}>
      <LazyComp {...props} />
    </Suspense>
  );
  Wrapped.displayName = `Lazy${String(name)}`;
  return Wrapped as any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Lazy-wrapped exports – one per recharts component used in the codebase
// ---------------------------------------------------------------------------

// Containers
export const ResponsiveContainer = createLazy('ResponsiveContainer');

// Chart types
export const LineChart = createLazy('LineChart');
export const BarChart = createLazy('BarChart');
export const AreaChart = createLazy('AreaChart');
export const PieChart = createLazy('PieChart');
export const ComposedChart = createLazy('ComposedChart');

// Series / marks
export const Line = createLazy('Line');
export const Bar = createLazy('Bar');
export const Area = createLazy('Area');
export const Pie = createLazy('Pie');
export const Cell = createLazy('Cell');
export const Scatter = createLazy('Scatter');

// Axes
export const XAxis = createLazy('XAxis');
export const YAxis = createLazy('YAxis');

// Grid & decorations
export const CartesianGrid = createLazy('CartesianGrid');
export const Tooltip = createLazy('Tooltip');
export const Legend = createLazy('Legend');

// Funnel charts
export const FunnelChart = createLazy('FunnelChart');
export const Funnel = createLazy('Funnel');

// Labels
export const LabelList = createLazy('LabelList');

// Radar / Radial
export const RadarChart = createLazy('RadarChart');
export const Radar = createLazy('Radar');
export const PolarGrid = createLazy('PolarGrid');
export const PolarAngleAxis = createLazy('PolarAngleAxis');
export const PolarRadiusAxis = createLazy('PolarRadiusAxis');
export const RadialBarChart = createLazy('RadialBarChart');
export const RadialBar = createLazy('RadialBar');

// Reference lines
export const ReferenceLine = createLazy('ReferenceLine');
