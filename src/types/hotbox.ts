/**
 * Hotbox Type Definitions
 * Centralized types for the Hotbox Dashboard system
 */

import LucideIcon from "lucide-react/dist/esm/icons/lucide-icon";

// ==========================================
// Metric Types
// ==========================================

export interface TenantMetrics {
  tenantId: string;
  revenue: number;
  monthlyRevenue: number;
  averageOrderValue: number;
  avgOrderValue: number; // Alias for backward compatibility
  totalOrders: number;
  activeCustomers: number;
  customerCount: number; // Alias
  locationCount: number;
  locations: number; // Alias
  employeeCount: number;
  teamSize: number; // Alias
  inventoryValue: number;
  wholesaleRevenue: number;
  deliveryCount: number;
  posTransactions: number;
  activeOrders: number;
  pendingOrders: number;
  lowStockItems: number;
  retentionRate?: number;
}

export interface LocationMetrics {
  id: string;
  name: string;
  revenue: number;
  margin: number;
  orders: number;
  status: 'active' | 'offline' | 'warning';
  issues: number;
}

export interface TeamMemberStatus {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'busy' | 'offline';
  currentTask?: string;
  metrics?: {
    ordersHandled: number;
    avgTime: string;
  };
}

// ==========================================
// Alert & Attention Types
// ==========================================

export type AlertCategory =
  | 'orders'
  | 'inventory'
  | 'delivery'
  | 'customers'
  | 'compliance'
  | 'team'
  | 'financial'
  | 'system';

export type AlertPriority = 'critical' | 'important' | 'info';

export interface AttentionItem {
  id: string;
  priority: AlertPriority;
  category: AlertCategory;
  title: string;
  description?: string;
  value?: string;
  timestamp: string; // ISO date string
  score?: number; // Calculated weighted score
  actionUrl: string;
  actionLabel: string;
  metadata?: Record<string, any>;
}

export interface AttentionQueue {
  items: AttentionItem[];
  totalCount: number;
  criticalCount: number;
  lastUpdated: string;
}

// ==========================================
// Dashboard Component Types
// ==========================================

export interface PulseMetric {
  id: string;
  label: string;
  value: string;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
  subtext?: string;
  trend?: number[]; // Array of values for sparkline
  format?: 'currency' | 'number' | 'percent';
  alert?: boolean;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode | string; // Can be component or icon name
  path: string;
  route?: string;
  shortcut?: string;
  priority?: number;
  isPersonalized?: boolean;
  category?: string;
}

// ==========================================
// Tier System Types
// ==========================================

export interface TierThresholds {
  revenue: {
    empire: number;
    hood: number;
    block: number;
    trap: number;
  };
  locations: {
    empire: number;
    hood: number;
    block: number;
    trap: number;
  };
  team: {
    empire: number;
    hood: number;
    block: number;
    trap: number;
  };
  score: {
    empire: number;
    hood: number;
    block: number;
    trap: number;
  };
}

export interface TierScore {
  total: number;
  breakdown: {
    revenue: number;
    locations: number;
    team: number;
  };
}
