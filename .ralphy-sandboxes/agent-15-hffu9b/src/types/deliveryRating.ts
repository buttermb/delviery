/**
 * Delivery Rating Types
 *
 * Types for customer delivery experience ratings (1-5 stars + comment).
 * Ratings are linked to delivery, order, runner, and customer records.
 */

export interface DeliveryRating {
  id: string;
  tenant_id: string;
  order_id: string;
  delivery_id: string | null;
  runner_id: string | null;
  customer_id: string | null;
  tracking_token: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryRatingWithRunner extends DeliveryRating {
  runner_name?: string;
  customer_name?: string;
  order_number?: string;
}

export interface CreateDeliveryRatingInput {
  tenant_id: string;
  order_id: string;
  delivery_id?: string;
  runner_id?: string;
  customer_id?: string;
  tracking_token?: string;
  rating: number;
  comment?: string;
}

export interface RunnerRatingAggregate {
  runner_id: string;
  runner_name: string;
  average_rating: number;
  total_ratings: number;
  rating_distribution: Record<number, number>;
}
