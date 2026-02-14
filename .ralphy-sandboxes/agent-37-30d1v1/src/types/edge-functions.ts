/**
 * Type definitions for Edge Function responses
 * Provides type safety when calling Supabase Edge Functions
 */

// Base response interface
export interface EdgeFunctionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Menu Generation
export interface MenuGenerateData {
  menu_id: string;
  token: string;
  url: string;
  expires_at?: string;
}

export type MenuGenerateResponse = EdgeFunctionResponse<MenuGenerateData>;

// Order Creation
export interface OrderCreateData {
  order_id: string;
  order_number: string;
  total: number;
  status: string;
}

export type OrderCreateResponse = EdgeFunctionResponse<OrderCreateData>;

// Wholesale Order
export interface WholesaleOrderCreateData {
  order_id: string;
  order_number: string;
  client_id: string;
  total_amount: number;
  payment_status: string;
}

export type WholesaleOrderCreateResponse = EdgeFunctionResponse<WholesaleOrderCreateData>;

// Payment Processing
export interface PaymentProcessData {
  payment_id: string;
  amount: number;
  status: string;
  transaction_id?: string;
}

export type PaymentProcessResponse = EdgeFunctionResponse<PaymentProcessData>;

// Courier Assignment
export interface CourierAssignData {
  delivery_id: string;
  courier_id: string;
  estimated_time: string;
}

export type CourierAssignResponse = EdgeFunctionResponse<CourierAssignData>;

// ETA Calculation
export interface ETACalculateData {
  estimated_arrival: string;
  distance_miles: number;
  duration_minutes: number;
}

export type ETACalculateResponse = EdgeFunctionResponse<ETACalculateData>;

// Authentication
export interface AuthResponseData {
  user: {
    id: string;
    email: string;
    role: string;
  };
  token: string;
  tenant_id?: string;
}

export type AuthResponse = EdgeFunctionResponse<AuthResponseData>;

// Analytics
export interface AnalyticsData {
  metrics: Record<string, number>;
  charts: Array<{
    label: string;
    value: number;
  }>;
  period: string;
}

export type AnalyticsResponse = EdgeFunctionResponse<AnalyticsData>;

// Inventory Update
export interface InventoryUpdateData {
  inventory_id: string;
  quantity_before: number;
  quantity_after: number;
  movement_id?: string;
}

export type InventoryUpdateResponse = EdgeFunctionResponse<InventoryUpdateData>;

// Risk Assessment
export interface RiskAssessmentData {
  risk_score: number;
  factors: Array<{
    type: string;
    weight: number;
    description: string;
  }>;
  recommendation: 'approve' | 'review' | 'deny';
}

export type RiskAssessmentResponse = EdgeFunctionResponse<RiskAssessmentData>;

// Fraud Detection
export interface FraudDetectionData {
  is_fraud: boolean;
  confidence: number;
  flags: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
}

export type FraudDetectionResponse = EdgeFunctionResponse<FraudDetectionData>;
