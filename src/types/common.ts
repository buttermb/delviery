/**
 * Common Type Definitions
 * Shared types to reduce 'any' usage across the codebase
 */

// Generic API Response
export interface ApiResponse<T = unknown> {
  data: T | null;
  error: Error | null;
}

// Generic Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Generic Table/List Item
export interface TableItem {
  id: string;
  [key: string]: unknown;
}

// Generic Form Data
export interface FormData {
  [key: string]: unknown;
}

// Generic Error Response
export interface ErrorResponse {
  message: string;
  code?: string;
  details?: unknown;
}

// Generic Success Response
export interface SuccessResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

// Generic Filter/Sort
export interface FilterParams {
  [key: string]: string | number | boolean | null | undefined;
}

export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

// Tenant Context Types
export interface TenantContext {
  id: string;
  slug: string;
  business_name: string;
  [key: string]: unknown;
}

// User Context Types
export interface UserContext {
  id: string;
  email: string;
  [key: string]: unknown;
}

// Generic Component Props
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// Generic Event Handlers
export type EventHandler<T = unknown> = (event: T) => void | Promise<void>;
export type AsyncEventHandler<T = unknown> = (event: T) => Promise<void>;






