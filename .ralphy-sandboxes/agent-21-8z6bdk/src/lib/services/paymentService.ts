/**
 * Centralized Payment Service
 * 
 * Provides consistent payment processing across the application.
 * Uses atomic RPC functions when available, with legacy fallbacks.
 * 
 * This service handles:
 * - Direct client payments (general AR collection)
 * - Fronted inventory payments
 * - Delivery collection (runner cash pickup)
 * - Balance adjustments
 * 
 * Usage:
 *   import { paymentService } from '@/lib/services/paymentService';
 *   
 *   // Record a payment
 *   const result = await paymentService.recordPayment({
 *     tenantId: '...',
 *     clientId: '...',
 *     amount: 500,
 *     paymentMethod: 'cash',
 *     context: 'collection'
 *   });
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';

// ============================================================================
// TYPES
// ============================================================================

export type PaymentMethod = 
  | 'cash' 
  | 'check' 
  | 'venmo' 
  | 'zelle' 
  | 'bank_transfer' 
  | 'card' 
  | 'other';

export type PaymentContext = 
  | 'collection'       // General AR collection
  | 'fronted'          // Payment for fronted inventory
  | 'delivery'         // Runner collecting payment on delivery
  | 'pos'              // Point of sale transaction
  | 'wholesale_order'; // Payment for wholesale order

export interface RecordPaymentParams {
  tenantId: string;
  clientId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  reference?: string;
  context: PaymentContext;
  // Optional context-specific IDs
  frontedInventoryId?: string;
  deliveryId?: string;
  orderId?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  newBalance: number;
  previousBalance: number;
  message?: string;
  error?: string;
}

export interface AdjustBalanceParams {
  clientId: string;
  amount: number;
  operation: 'add' | 'subtract';
}

export interface AdjustBalanceResult {
  success: boolean;
  newBalance: number;
  error?: string;
}

export interface RecordFrontedPaymentParams {
  tenantId: string;
  frontedId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  reference?: string;
}

export interface FrontedPaymentResult {
  success: boolean;
  newStatus: string;
  paymentReceived: number;
  remaining: number;
  clientName?: string;
  error?: string;
}

export interface DeliveryCollectionParams {
  deliveryId: string;
  amountCollected: number;
  proofPhotoUrl?: string;
}

export interface DeliveryCollectionResult {
  success: boolean;
  message?: string;
  error?: string;
}

// ============================================================================
// PAYMENT SERVICE
// ============================================================================

class PaymentService {
  /**
   * Atomically adjust a client's outstanding balance
   * Uses row-level locking to prevent race conditions
   */
  async adjustClientBalance(params: AdjustBalanceParams): Promise<AdjustBalanceResult> {
    const { clientId, amount, operation } = params;

    try {
      // Try atomic RPC first
      const { data, error } = await supabase.rpc('adjust_client_balance', {
        p_client_id: clientId,
        p_amount: amount,
        p_operation: operation
      });

      if (error) {
        // Check if RPC doesn't exist
        if (this.isRpcNotFoundError(error)) {
          logger.warn('adjust_client_balance RPC not available, using legacy method', { clientId });
          return this.adjustClientBalanceLegacy(params);
        }
        throw error;
      }

      return {
        success: true,
        newBalance: Number(data)
      };
    } catch (error) {
      logger.error('Failed to adjust client balance', error, { clientId, amount, operation });
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Legacy balance adjustment (fallback when RPC not available)
   * WARNING: Has potential race condition risk
   */
  private async adjustClientBalanceLegacy(params: AdjustBalanceParams): Promise<AdjustBalanceResult> {
    const { clientId, amount, operation } = params;

    try {
      // Get current balance
      const { data: client, error: fetchError } = await supabase
        .from('wholesale_clients')
        .select('outstanding_balance')
        .eq('id', clientId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!client) throw new Error('Client not found');

      const currentBalance = Number(client.outstanding_balance ?? 0);
      let newBalance: number;

      if (operation === 'add') {
        newBalance = currentBalance + amount;
      } else {
        newBalance = Math.max(0, currentBalance - amount);
      }

      // Update balance
      const { error: updateError } = await supabase
        .from('wholesale_clients')
        .update({ 
          outstanding_balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId);

      if (updateError) throw updateError;

      return {
        success: true,
        newBalance
      };
    } catch (error) {
      logger.error('Legacy balance adjustment failed', error, { clientId });
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Record a payment and update client balance
   * This is the main entry point for all payment recording
   */
  async recordPayment(params: RecordPaymentParams): Promise<PaymentResult> {
    const { 
      tenantId, 
      clientId, 
      amount, 
      paymentMethod, 
      notes, 
      reference,
      context,
      frontedInventoryId,
      deliveryId,
      orderId
    } = params;

    if (amount <= 0) {
      return {
        success: false,
        newBalance: 0,
        previousBalance: 0,
        error: 'Payment amount must be greater than zero'
      };
    }

    try {
      // Get current balance first
      const { data: client, error: clientError } = await supabase
        .from('wholesale_clients')
        .select('outstanding_balance, business_name')
        .eq('id', clientId)
        .maybeSingle();

      if (clientError) throw clientError;
      if (!client) throw new Error('Client not found');

      const previousBalance = Number(client.outstanding_balance ?? 0);

      // Create payment record in wholesale_payments
      const { data: payment, error: paymentError } = await supabase
        .from('wholesale_payments')
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          amount,
          payment_method: paymentMethod,
          reference_number: reference || null,
          notes: notes || `Payment recorded via ${context}`,
          status: 'completed',
          fronted_inventory_id: frontedInventoryId || null,
          delivery_id: deliveryId || null,
          order_id: orderId || null
        })
        .select('id')
        .maybeSingle();

      if (paymentError) {
        // If table doesn't exist or insert fails, continue with balance update
        logger.warn('Failed to create payment record, continuing with balance update', paymentError);
      }

      // Update client balance atomically
      const balanceResult = await this.adjustClientBalance({
        clientId,
        amount,
        operation: 'subtract'
      });

      if (!balanceResult.success) {
        // Try to rollback payment record if balance update failed
        if (payment?.id) {
          const { error: rollbackError } = await supabase.from('wholesale_payments').delete().eq('id', payment.id);
          if (rollbackError) {
            logger.error('Failed to rollback payment record', rollbackError, { paymentId: payment.id });
          }
        }
        throw new Error(balanceResult.error || 'Failed to update balance');
      }

      // Update last_payment_date on client
      const { error: dateError } = await supabase
        .from('wholesale_clients')
        .update({
          last_payment_date: new Date().toISOString()
        })
        .eq('id', clientId);
      if (dateError) {
        logger.warn('Failed to update last_payment_date', dateError, { clientId });
      }

      logger.info('Payment recorded successfully', {
        clientId,
        amount,
        newBalance: balanceResult.newBalance,
        context
      });

      return {
        success: true,
        paymentId: payment?.id,
        newBalance: balanceResult.newBalance,
        previousBalance,
        message: `Payment of ${formatCurrency(amount)} recorded for ${client.business_name}`
      };
    } catch (error) {
      logger.error('Failed to record payment', error, { clientId, amount, context });
      return {
        success: false,
        newBalance: 0,
        previousBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Record payment specifically for fronted inventory
   * Uses atomic RPC when available
   */
  async recordFrontedPayment(params: RecordFrontedPaymentParams): Promise<FrontedPaymentResult> {
    const { tenantId, frontedId, amount, paymentMethod, notes, reference } = params;

    try {
      // Try atomic RPC first
      const { data: rpcResult, error: rpcError } = await supabase.rpc('record_fronted_payment_atomic', {
        p_fronted_id: frontedId,
        p_payment_amount: amount,
        p_payment_method: paymentMethod,
        p_notes: notes || null
      });

      if (rpcError) {
        if (this.isRpcNotFoundError(rpcError)) {
          logger.warn('record_fronted_payment_atomic RPC not available, using legacy method', { frontedId });
          return this.recordFrontedPaymentLegacy(params);
        }
        throw rpcError;
      }

      // Type the result properly
      const result = rpcResult as { 
        success: boolean; 
        new_status: string; 
        payment_received: number; 
        remaining: number; 
        client_name: string 
      };

      // Also create detailed payment record
      await supabase.from('fronted_payments').insert({
        account_id: tenantId,
        fronted_inventory_id: frontedId,
        amount,
        payment_method: paymentMethod,
        payment_reference: reference || null,
        notes
      });

      return {
        success: true,
        newStatus: result.new_status,
        paymentReceived: result.payment_received,
        remaining: result.remaining,
        clientName: result.client_name
      };
    } catch (error) {
      logger.error('Failed to record fronted payment', error, { frontedId, amount });
      return {
        success: false,
        newStatus: 'error',
        paymentReceived: 0,
        remaining: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Legacy fronted payment recording (fallback)
   */
  private async recordFrontedPaymentLegacy(params: RecordFrontedPaymentParams): Promise<FrontedPaymentResult> {
    const { tenantId, frontedId, amount, paymentMethod, notes, reference } = params;

    try {
      // Get fronted inventory record
      const { data: frontedItem, error: fetchError } = await supabase
        .from('fronted_inventory')
        .select('id, client_id, expected_revenue, payment_received, payment_status, status, completed_at, created_at, client:wholesale_clients(id, business_name, outstanding_balance)')
        .eq('id', frontedId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!frontedItem) throw new Error('Fronted inventory record not found');

      // Calculate new payment status
      const newTotalReceived = (frontedItem.payment_received ?? 0) + amount;
      const expectedRevenue = frontedItem.expected_revenue ?? 0;
      const remaining = expectedRevenue - newTotalReceived;

      let newStatus = 'pending';
      if (newTotalReceived >= expectedRevenue) {
        newStatus = 'paid';
      } else if (newTotalReceived > 0) {
        newStatus = 'partial';
      }

      // Create payment record
      await supabase.from('fronted_payments').insert({
        account_id: tenantId,
        fronted_inventory_id: frontedId,
        amount,
        payment_method: paymentMethod,
        payment_reference: reference || null,
        notes
      });

      // Update fronted inventory
      await supabase
        .from('fronted_inventory')
        .update({
          payment_received: newTotalReceived,
          payment_status: newStatus,
          status: newStatus === 'paid' ? 'completed' : 'active',
          completed_at: newStatus === 'paid' ? new Date().toISOString() : null
        })
        .eq('id', frontedId);

      // Update client balance
      const frontedRecord = frontedItem as Record<string, unknown>;
      const clientData = frontedRecord.client as { business_name?: string } | null;
      if (frontedRecord.client_id) {
        await this.adjustClientBalance({
          clientId: frontedRecord.client_id as string,
          amount,
          operation: 'subtract'
        });
      }

      return {
        success: true,
        newStatus,
        paymentReceived: newTotalReceived,
        remaining: Math.max(0, remaining),
        clientName: clientData?.business_name
      };
    } catch (error) {
      logger.error('Legacy fronted payment failed', error, { frontedId });
      return {
        success: false,
        newStatus: 'error',
        paymentReceived: 0,
        remaining: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Complete a delivery and collect payment
   * Used by runners to mark deliveries as complete with cash collection
   */
  async completeDeliveryWithCollection(params: DeliveryCollectionParams): Promise<DeliveryCollectionResult> {
    const { deliveryId, amountCollected, proofPhotoUrl } = params;

    try {
      // Try atomic RPC first
      const { data: rpcResult, error: rpcError } = await supabase.rpc('complete_delivery_with_collection', {
        p_delivery_id: deliveryId,
        p_amount_collected: amountCollected,
        p_proof_photo_url: proofPhotoUrl || null
      });

      if (rpcError) {
        if (this.isRpcNotFoundError(rpcError)) {
          logger.warn('complete_delivery_with_collection RPC not available, using legacy method', { deliveryId });
          return this.completeDeliveryLegacy(params);
        }
        throw rpcError;
      }

      const result = rpcResult as { success: boolean; message?: string };
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to complete delivery');
      }

      return {
        success: true,
        message: 'Delivery completed successfully'
      };
    } catch (error) {
      logger.error('Failed to complete delivery with collection', error, { deliveryId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Legacy delivery completion (fallback)
   */
  private async completeDeliveryLegacy(params: DeliveryCollectionParams): Promise<DeliveryCollectionResult> {
    const { deliveryId, amountCollected, proofPhotoUrl } = params;

    try {
      // Update delivery status
      const { error: deliveryError } = await supabase
        .from('wholesale_deliveries')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          collection_amount: amountCollected,
          proof_photo_url: proofPhotoUrl || null
        })
        .eq('id', deliveryId);

      if (deliveryError) throw deliveryError;

      // Get associated order
      const { data: delivery } = await supabase
        .from('wholesale_deliveries')
        .select('order_id')
        .eq('id', deliveryId)
        .maybeSingle();

      if (delivery?.order_id) {
        // Update order status
        await supabase
          .from('wholesale_orders')
          .update({ 
            status: 'delivered', 
            delivered_at: new Date().toISOString() 
          })
          .eq('id', delivery.order_id);

        // If cash was collected, update client balance
        if (amountCollected > 0) {
          const { data: order } = await supabase
            .from('wholesale_orders')
            .select('client_id')
            .eq('id', delivery.order_id)
            .maybeSingle();

          if (order?.client_id) {
            await this.adjustClientBalance({
              clientId: order.client_id,
              amount: amountCollected,
              operation: 'subtract'
            });
          }
        }
      }

      return {
        success: true,
        message: 'Delivery completed successfully'
      };
    } catch (error) {
      logger.error('Legacy delivery completion failed', error, { deliveryId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get payment history for a client
   */
  async getClientPaymentHistory(clientId: string, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('wholesale_payments')
        .select('id, tenant_id, client_id, amount, payment_method, reference_number, notes, status, fronted_inventory_id, delivery_id, order_id, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, payments: data ?? [] };
    } catch (error) {
      logger.error('Failed to fetch payment history', error, { clientId });
      return { success: false, payments: [], error: (error as Error).message };
    }
  }

  /**
   * Calculate client's aging receivables
   */
  async getClientAgingReport(clientId: string) {
    try {
      // Get all unpaid fronted inventory for the client
      const { data: frontedItems } = await supabase
        .from('fronted_inventory')
        .select('id, expected_revenue, payment_received, payment_due_date, created_at')
        .eq('client_id', clientId)
        .in('status', ['active', 'partial'])
        .order('payment_due_date', { ascending: true });

      if (!frontedItems) {
        return { success: true, aging: null };
      }

      const now = new Date();
      const aging = {
        current: 0,    // Not yet due
        days30: 0,     // 1-30 days overdue
        days60: 0,     // 31-60 days overdue
        days90: 0,     // 61-90 days overdue
        over90: 0,     // 90+ days overdue
        total: 0
      };

      for (const item of frontedItems) {
        const remaining = (item.expected_revenue ?? 0) - (item.payment_received ?? 0);
        if (remaining <= 0) continue;

        const dueDate = item.payment_due_date ? new Date(item.payment_due_date) : new Date(item.created_at);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOverdue <= 0) {
          aging.current += remaining;
        } else if (daysOverdue <= 30) {
          aging.days30 += remaining;
        } else if (daysOverdue <= 60) {
          aging.days60 += remaining;
        } else if (daysOverdue <= 90) {
          aging.days90 += remaining;
        } else {
          aging.over90 += remaining;
        }
        
        aging.total += remaining;
      }

      return { success: true, aging };
    } catch (error) {
      logger.error('Failed to calculate aging report', error, { clientId });
      return { success: false, aging: null, error: (error as Error).message };
    }
  }

  /**
   * Check if error is "RPC function not found"
   */
  private isRpcNotFoundError(error: { code?: string; message?: string }): boolean {
    return (
      error.code === 'PGRST202' ||
      error.message?.includes('function') ||
      error.message?.includes('does not exist')
    );
  }
}

// Export singleton instance
export const paymentService = new PaymentService();



