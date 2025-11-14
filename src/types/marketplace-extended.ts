/**
 * Temporary type extensions for marketplace tables
 * These will be replaced when types.ts regenerates
 */

export interface MarketplaceProfile {
  id: string;
  tenant_id: string;
  business_name: string | null;
  license_number: string | null;
  license_type: string | null;
  license_state: string | null;
  license_expiry_date: string | null;
  license_verified: boolean;
  marketplace_status: string;
  can_sell: boolean;
  license_document_url: string | null;
  license_verification_notes: string | null;
  license_verified_at: string | null;
  business_description: string | null;
  [key: string]: any;
}

export interface MarketplaceCart {
  id: string;
  buyer_tenant_id: string;
  listing_id: string;
  quantity: number;
  unit_price: number;
  [key: string]: any;
}

export interface MarketplaceOrder {
  id: string;
  order_number: string;
  buyer_tenant_id: string;
  seller_tenant_id: string;
  status: string;
  payment_status: string;
  created_at: string;
  shipping_method: string | null;
  tracking_number: string | null;
  shipping_address: any;
  marketplace_order_items: any[];
  marketplace_profiles: any;
  [key: string]: any;
}

export interface MarketplaceListing {
  id: string;
  seller_tenant_id: string;
  product_name: string;
  [key: string]: any;
}
