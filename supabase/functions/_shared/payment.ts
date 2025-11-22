// supabase/functions/_shared/payment.ts

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

export async function processPayment(
    amount: number,
    paymentMethod: string,
    metadata: any
): Promise<PaymentResult> {
    console.log(`Processing payment of $${amount} via ${paymentMethod}`, metadata);

    // MOCK IMPLEMENTATION
    // In production, this would call Stripe/Square API

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate 95% success rate
    const isSuccess = Math.random() > 0.05;

    if (isSuccess) {
        return {
            success: true,
            transaction_id: `tx_${crypto.randomUUID().replace(/-/g, '')}`,
        };
    } else {
        return {
            success: false,
            error: 'Payment declined (Simulated)',
        };
    }
}

export async function refundPayment(
    transactionId: string,
    reason: string
): Promise<RefundResult> {
    console.log(`Refunding transaction ${transactionId}. Reason: ${reason}`);

    // MOCK IMPLEMENTATION
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
        success: true,
        refund_id: `re_${crypto.randomUUID().replace(/-/g, '')}`
    };
}
