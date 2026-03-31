// Low Stock Email Digest — Shared Types

export interface CreditDeductionResult {
  success: boolean;
  newBalance: number;
  creditsCost: number;
  errorMessage: string | null;
}

export interface LowStockProduct {
  id: string;
  product_name: string;
  sku: string | null;
  current_quantity: number;
  reorder_point: number;
  avg_daily_usage: number;
  days_until_stockout: number | null;
  last_movement_date: string | null;
}

export interface TenantDigestData {
  tenant_id: string;
  tenant_slug: string;
  admin_email: string;
  business_name: string;
  low_stock_products: LowStockProduct[];
}

export interface DigestResult {
  tenant_id: string;
  tenant_slug: string;
  products_count: number;
  email_sent: boolean;
  error?: string;
}

export interface AlertSettings {
  email_digest_enabled?: boolean;
  digest_recipients?: string[];
  low_stock_threshold_override?: number;
}
