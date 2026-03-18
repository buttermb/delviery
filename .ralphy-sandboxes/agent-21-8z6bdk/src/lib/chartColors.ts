/**
 * Centralized chart color palette
 *
 * All chart/visualization components should import colors from here
 * instead of hardcoding hex values. Uses CSS custom properties so
 * colors respect the active theme (light/dark mode).
 *
 * For Recharts fill/stroke props, use the `CHART_COLORS` array or
 * the semantic named exports below.
 */

/** Primary chart palette — use for pie charts, bar charts, and multi-series */
export const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
  'hsl(var(--chart-7))',
  'hsl(var(--chart-8))',
  'hsl(var(--chart-9))',
  'hsl(var(--chart-10))',
] as const;

/** Semantic chart colors for specific data types */
export const chartSemanticColors = {
  /** Revenue / positive trends / growth */
  revenue: 'hsl(var(--chart-6))',
  /** Costs / expenses */
  cost: 'hsl(var(--chart-8))',
  /** Primary metric / main series */
  primary: 'hsl(var(--chart-1))',
  /** Secondary metric */
  secondary: 'hsl(var(--chart-4))',
  /** Tertiary metric */
  tertiary: 'hsl(var(--chart-5))',
  /** Success / positive values */
  success: 'hsl(var(--chart-6))',
  /** Warning / caution values */
  warning: 'hsl(var(--chart-8))',
  /** Error / negative values / loss */
  danger: 'hsl(var(--chart-7))',
  /** Info / neutral data */
  info: 'hsl(var(--chart-4))',
  /** Muted / background reference lines */
  muted: 'hsl(var(--muted-foreground))',
  /** Predicted / forecast data */
  forecast: 'hsl(var(--chart-6))',
  /** Actual / historical data */
  actual: 'hsl(var(--chart-4))',
} as const;

/** Category-specific colors for credit usage, vendor breakdown, etc. */
export const CATEGORY_CHART_COLORS: Record<string, string> = {
  orders: 'hsl(var(--chart-4))',
  inventory: 'hsl(var(--chart-6))',
  customers: 'hsl(var(--chart-5))',
  invoices: 'hsl(var(--chart-8))',
  crm: 'hsl(var(--chart-9))',
  reports: 'hsl(var(--chart-3))',
  exports: 'hsl(var(--chart-6))',
  ai: 'hsl(var(--chart-2))',
  api: 'hsl(var(--muted-foreground))',
  menus: 'hsl(var(--chart-4))',
  marketplace: 'hsl(var(--chart-5))',
  pos: 'hsl(var(--chart-4))',
  operations: 'hsl(var(--chart-10))',
  other: 'hsl(var(--muted-foreground))',
};
