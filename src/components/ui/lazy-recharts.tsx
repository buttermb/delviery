import { lazy, ComponentType, Suspense, ReactNode } from 'react';
import type * as RechartsTypes from 'recharts';

// Skeleton loader for charts
const ChartSkeleton = () => (
  <div className="w-full h-full animate-pulse bg-muted/20 rounded" />
);

// Higher-order component to wrap lazy components with Suspense
function withSuspense<P extends object>(
  LazyComponent: ComponentType<P>,
  fallback: ReactNode = <ChartSkeleton />
) {
  return (props: P) => (
    <Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </Suspense>
  );
}

// Lazy load chart containers
export const ResponsiveContainer = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ResponsiveContainer,
    }))
  )
) as typeof RechartsTypes.ResponsiveContainer;

// Lazy load chart types
export const BarChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.BarChart,
    }))
  )
) as typeof RechartsTypes.BarChart;

export const LineChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.LineChart,
    }))
  )
) as typeof RechartsTypes.LineChart;

export const PieChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.PieChart,
    }))
  )
) as typeof RechartsTypes.PieChart;

export const AreaChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.AreaChart,
    }))
  )
) as typeof RechartsTypes.AreaChart;

export const ComposedChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ComposedChart,
    }))
  )
) as typeof RechartsTypes.ComposedChart;

export const RadarChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.RadarChart,
    }))
  )
) as typeof RechartsTypes.RadarChart;

export const ScatterChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ScatterChart,
    }))
  )
) as typeof RechartsTypes.ScatterChart;

export const FunnelChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.FunnelChart,
    }))
  )
) as typeof RechartsTypes.FunnelChart;

export const RadialBarChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.RadialBarChart,
    }))
  )
) as typeof RechartsTypes.RadialBarChart;

export const Treemap = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Treemap,
    }))
  )
) as typeof RechartsTypes.Treemap;

export const Sankey = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Sankey,
    }))
  )
) as typeof RechartsTypes.Sankey;

// Lazy load chart components
export const Bar = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Bar,
    }))
  )
) as typeof RechartsTypes.Bar;

export const Line = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Line,
    }))
  )
) as typeof RechartsTypes.Line;

export const Area = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Area,
    }))
  )
) as typeof RechartsTypes.Area;

export const Pie = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Pie,
    }))
  )
) as typeof RechartsTypes.Pie;

export const Radar = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Radar,
    }))
  )
) as typeof RechartsTypes.Radar;

export const Scatter = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Scatter,
    }))
  )
) as typeof RechartsTypes.Scatter;

export const Funnel = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Funnel,
    }))
  )
) as typeof RechartsTypes.Funnel;

export const RadialBar = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.RadialBar,
    }))
  )
) as typeof RechartsTypes.RadialBar;

// Lazy load axes
export const XAxis = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.XAxis,
    }))
  )
) as typeof RechartsTypes.XAxis;

export const YAxis = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.YAxis,
    }))
  )
) as typeof RechartsTypes.YAxis;

export const ZAxis = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ZAxis,
    }))
  )
) as typeof RechartsTypes.ZAxis;

// Lazy load grid and other components
export const CartesianGrid = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.CartesianGrid,
    }))
  )
) as typeof RechartsTypes.CartesianGrid;

export const PolarGrid = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.PolarGrid,
    }))
  )
) as typeof RechartsTypes.PolarGrid;

export const PolarAngleAxis = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.PolarAngleAxis,
    }))
  )
) as typeof RechartsTypes.PolarAngleAxis;

export const PolarRadiusAxis = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.PolarRadiusAxis,
    }))
  )
) as typeof RechartsTypes.PolarRadiusAxis;

export const Tooltip = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Tooltip,
    }))
  )
) as typeof RechartsTypes.Tooltip;

export const Legend = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Legend,
    }))
  )
) as typeof RechartsTypes.Legend;

export const Cell = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Cell,
    }))
  )
) as typeof RechartsTypes.Cell;

export const Label = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Label,
    }))
  )
) as typeof RechartsTypes.Label;

export const LabelList = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.LabelList,
    }))
  )
) as typeof RechartsTypes.LabelList;

export const ReferenceLine = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ReferenceLine,
    }))
  )
) as typeof RechartsTypes.ReferenceLine;

export const ReferenceArea = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ReferenceArea,
    }))
  )
) as typeof RechartsTypes.ReferenceArea;

export const ReferenceDot = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ReferenceDot,
    }))
  )
) as typeof RechartsTypes.ReferenceDot;

export const Brush = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Brush,
    }))
  )
) as typeof RechartsTypes.Brush;

export const ErrorBar = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ErrorBar,
    }))
  )
) as typeof RechartsTypes.ErrorBar;

// Re-export types for convenience
export type {
  ResponsiveContainerProps,
  BarChartProps,
  LineChartProps,
  PieChartProps,
  AreaChartProps,
  ComposedChartProps,
  XAxisProps,
  YAxisProps,
  TooltipProps,
  LegendProps,
  CartesianGridProps,
  BarProps,
  LineProps,
  AreaProps,
  PieProps,
  CellProps,
} from 'recharts';
