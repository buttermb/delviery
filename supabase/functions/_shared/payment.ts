// supabase/functions/_shared/payment.ts

// ============================================================================
// WARNING: MOCK PAYMENT PROCESSOR
// This file contains a SIMULATED payment processor for development/testing.
// It MUST NEVER process real transactions. A runtime guard below ensures
// this mock cannot activate in production environments.
// ============================================================================

export interface PaymentResult {
    success: boolean;
    transaction_id?: string;
    error?: string;
}

export interface RefundResult {
    success: boolean;
    refund_id?: string;
    error?: string;
}

/**
 * Returns true if the current environment is production.
 * In production, real payment processing (e.g. Stripe/Square) must be used.
 */
function isProduction(): boolean {
    const env = Deno.env.get('ENVIRONMENT') || Deno.env.get('DENO_ENV') || '';
    return env === 'production';
}

export async function processPayment(
    amount: number,
    paymentMethod: string,
    metadata: Record<string, unknown>
): Promise<PaymentResult> {
    // SECURITY: Block mock payments in production
    if (isProduction()) {
        throw new Error(
            'Mock payment processor cannot be used in production. ' +
            'Configure a real payment provider (Stripe/Square).'
        );
    }

    console.error(`[MOCK] Processing payment of $${amount} via ${paymentMethod}`, metadata);

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate 95% success rate
    const isSuccess = Math.random() > 0.05;

    if (isSuccess) {
        return {
            success: true,
            transaction_id: `mock_tx_${crypto.randomUUID().replace(/-/g, '')}`,
        };
    } else {
        return {
            success: false,
            error: 'Payment declined (Mock - development only)',
        };
    }
}

export async function refundPayment(
    transactionId: string,
    reason: string
): Promise<RefundResult> {
    // SECURITY: Block mock refunds in production
    if (isProduction()) {
        throw new Error(
            'Mock refund processor cannot be used in production. ' +
            'Configure a real payment provider (Stripe/Square).'
        );
    }

    console.error(`[MOCK] Refunding transaction ${transactionId}. Reason: ${reason}`);

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
        success: true,
        refund_id: `mock_re_${crypto.randomUUID().replace(/-/g, '')}`
    };
}
