/**
 * Color Conversion Utilities
 * Convert CSS variables to inline style-safe formats
 * For use in inline styles, Mapbox, charts, PDF generation, etc.
 */

/**
 * Convert CSS variable to inline style-safe HSL format
 * For use in inline styles, Mapbox, charts, etc.
 */
export function getCSSVarColor(variable: string): string {
  if (typeof window === 'undefined') return '';
  
  const root = document.documentElement;
  const hslValues = getComputedStyle(root)
    .getPropertyValue(variable)
    .trim();
  
  return hslValues ? `hsl(${hslValues})` : '';
}

/**
 * Predefined theme colors for common use cases
 * These dynamically retrieve colors from CSS variables
 */
export const themeColors = {
  // Core colors
  primary: () => getCSSVarColor('--primary'),
  secondary: () => getCSSVarColor('--secondary'),
  background: () => getCSSVarColor('--background'),
  foreground: () => getCSSVarColor('--foreground'),
  
  // Status colors
  success: () => getCSSVarColor('--success'),
  warning: () => getCSSVarColor('--warning'),
  destructive: () => getCSSVarColor('--destructive'),
  info: () => getCSSVarColor('--info'),
  
  // Muted colors
  muted: () => getCSSVarColor('--muted'),
  mutedForeground: () => getCSSVarColor('--muted-foreground'),
  
  // Border & accent
  border: () => getCSSVarColor('--border'),
  accent: () => getCSSVarColor('--accent'),
  accentForeground: () => getCSSVarColor('--accent-foreground'),
  
  // Marketing colors
  marketingPrimary: () => getCSSVarColor('--marketing-primary'),
  marketingSecondary: () => getCSSVarColor('--marketing-secondary'),
  marketingAccent: () => getCSSVarColor('--marketing-accent'),
  marketingBg: () => getCSSVarColor('--marketing-bg'),
  marketingText: () => getCSSVarColor('--marketing-text'),
};

/**
 * Get status color based on order/delivery status
 */
export function getStatusColorInline(status: string): string {
  const statusMap: Record<string, () => string> = {
    'pending': themeColors.mutedForeground,
    'confirmed': themeColors.marketingSecondary,
    'preparing': themeColors.warning,
    'out_for_delivery': themeColors.info,
    'delivered': themeColors.success,
    'cancelled': themeColors.destructive,
    'assigned': themeColors.info,
    'in_transit': themeColors.info,
    'picked_up': themeColors.marketingSecondary,
  };
  
  const colorFn = statusMap[status.toLowerCase()];
  return colorFn ? colorFn() : themeColors.mutedForeground();
}
