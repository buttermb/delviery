import { lazy, ComponentType, Suspense, ReactNode } from 'react';

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

// All lazy-loaded recharts components use 'any' cast to avoid complex generic type issues
// with React.lazy() and class component type inference

// Lazy load chart containers
export const ResponsiveContainer = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ResponsiveContainer,
    }))
  )
) as any;

// Lazy load chart types
export const BarChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.BarChart,
    }))
  )
) as any;

export const LineChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.LineChart,
    }))
  )
) as any;

export const PieChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.PieChart,
    }))
  )
) as any;

export const AreaChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.AreaChart,
    }))
  )
) as any;

export const ComposedChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ComposedChart,
    }))
  )
) as any;

export const RadarChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.RadarChart,
    }))
  )
) as any;

export const ScatterChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ScatterChart,
    }))
  )
) as any;

export const FunnelChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.FunnelChart,
    }))
  )
) as any;

export const RadialBarChart = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.RadialBarChart,
    }))
  )
) as any;

export const Treemap = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Treemap,
    }))
  )
) as any;

export const Sankey = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Sankey,
    }))
  )
) as any;

// Lazy load chart components
export const Bar = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Bar,
    }))
  )
) as any;

export const Line = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Line,
    }))
  )
) as any;

export const Area = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Area,
    }))
  )
) as any;

export const Pie = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Pie,
    }))
  )
) as any;

export const Radar = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Radar,
    }))
  )
) as any;

export const Scatter = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Scatter,
    }))
  )
) as any;

export const Funnel = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Funnel,
    }))
  )
) as any;

export const RadialBar = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.RadialBar,
    }))
  )
) as any;

// Lazy load axes
export const XAxis = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.XAxis,
    }))
  )
) as any;

export const YAxis = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.YAxis,
    }))
  )
) as any;

export const ZAxis = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ZAxis,
    }))
  )
) as any;

// Lazy load grid and other components
export const CartesianGrid = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.CartesianGrid,
    }))
  )
) as any;

export const PolarGrid = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.PolarGrid,
    }))
  )
) as any;

export const PolarAngleAxis = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.PolarAngleAxis,
    }))
  )
) as any;

export const PolarRadiusAxis = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.PolarRadiusAxis,
    }))
  )
) as any;

export const Tooltip = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Tooltip,
    }))
  )
) as any;

export const Legend = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Legend,
    }))
  )
) as any;

export const Cell = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Cell,
    }))
  )
) as any;

export const Label = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Label,
    }))
  )
) as any;

export const LabelList = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.LabelList,
    }))
  )
) as any;

export const ReferenceLine = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ReferenceLine,
    }))
  )
) as any;

export const ReferenceArea = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ReferenceArea,
    }))
  )
) as any;

export const ReferenceDot = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ReferenceDot,
    }))
  )
) as any;

export const Brush = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.Brush,
    }))
  )
) as any;

export const ErrorBar = withSuspense(
  lazy(() =>
    import('recharts').then((module) => ({
      default: module.ErrorBar,
    }))
  )
) as any;

// Re-export types for convenience - only export types that exist in recharts
export type {
  ResponsiveContainerProps,
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
