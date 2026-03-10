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

import { lazy, Suspense, type ComponentProps } from 'react';
import type { FC } from 'react';

import * as RechartsTypes from 'recharts';

// ---------------------------------------------------------------------------
// Lazy module loader (single dynamic import shared by every wrapper)
// ---------------------------------------------------------------------------
const lazyRecharts = () => import('recharts');

// ---------------------------------------------------------------------------
// Factory – creates a Suspense-wrapped lazy component that preserves the
// original recharts component's prop types.
// ---------------------------------------------------------------------------
type RechartsExports = typeof RechartsTypes;

function createLazy<K extends keyof RechartsExports>(
  name: K,
): FC<ComponentProps<RechartsExports[K]>> {
  const LazyComp = lazy(() =>
    lazyRecharts().then((mod) => ({
      default: mod[name] as React.ComponentType<ComponentProps<RechartsExports[K]>>,
    })),
  );

  const Wrapped: FC<ComponentProps<RechartsExports[K]>> = (props) => (
    <Suspense fallback={null}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- props are correctly typed at call-site */}
      <LazyComp {...(props as Record<string, unknown>)} />
    </Suspense>
  );
  Wrapped.displayName = `Lazy${String(name)}`;
  return Wrapped;
}

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
