import { supabase } from "@/integrations/supabase/client";

export interface CreditStatus {
  available: number;
  used: number;
  limit: number;
  percentage: number;
  status: 'safe' | 'warning' | 'over_limit';
}

export async function calculateCreditAvailable(clientId: string): Promise<CreditStatus> {
  const { data: client } = await supabase
    .from('wholesale_clients')
    .select('credit_limit, outstanding_balance')
    .eq('id', clientId)
    .single();

  if (!client) {
    throw new Error('Client not found');
  }

  const available = client.credit_limit - client.outstanding_balance;
  const percentage = (client.outstanding_balance / client.credit_limit) * 100;

  let status: 'safe' | 'warning' | 'over_limit' = 'safe';
  if (percentage >= 100) status = 'over_limit';
  else if (percentage >= 80) status = 'warning';

  return {
    available,
    used: client.outstanding_balance,
    limit: client.credit_limit,
    percentage,
    status
  };
}

export async function checkCreditLimit(clientId: string, orderAmount: number): Promise<boolean> {
  const creditStatus = await calculateCreditAvailable(clientId);
  return creditStatus.available >= orderAmount;
}

export async function recordCreditTransaction(
  clientId: string,
  amount: number,
  type: 'credit_given' | 'payment_received',
  orderId?: string,
  notes?: string
) {
  const { data, error } = await supabase
    .from('credit_transactions')
    .insert({
      client_id: clientId,
      amount,
      transaction_type: type,
      order_id: orderId,
      notes
    })
    .select()
    .single();

  if (error) throw error;

  // Update client balance
  if (type === 'credit_given') {
    await supabase.rpc('update_client_balance', {
      p_client_id: clientId,
      p_amount: amount,
      p_operation: 'add'
    });
  } else {
    await supabase.rpc('update_client_balance', {
      p_client_id: clientId,
      p_amount: amount,
      p_operation: 'subtract'
    });
  }

  return data;
}

export async function calculateOverdueAmount(clientId: string): Promise<number> {
  const { data } = await supabase
    .from('credit_transactions')
    .select('amount, due_date')
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .lt('due_date', new Date().toISOString());

  if (!data) return 0;

  return data.reduce((sum, transaction) => sum + transaction.amount, 0);
}

export async function generateCollectionReminders() {
  const { data: overdueTransactions } = await supabase
    .from('credit_transactions')
    .select(`
      *,
      wholesale_clients (
        business_name,
        contact_name,
        phone
      )
    `)
    .eq('status', 'pending')
    .lt('due_date', new Date().toISOString());

  return overdueTransactions || [];
}

export async function updateReliabilityScore(clientId: string) {
  // Get payment history
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('created_at, due_date, paid_at, status')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!transactions || transactions.length === 0) return;

  // Calculate on-time payment rate
  const paidTransactions = transactions.filter(t => t.status === 'paid');
  const onTimePayments = paidTransactions.filter(t => {
    if (!t.paid_at || !t.due_date) return false;
    return new Date(t.paid_at) <= new Date(t.due_date);
  });

  const reliabilityScore = paidTransactions.length > 0
    ? Math.round((onTimePayments.length / paidTransactions.length) * 100)
    : 50;

  // Update client
  await supabase
    .from('wholesale_clients')
    .update({ reliability_score: reliabilityScore })
    .eq('id', clientId);

  return reliabilityScore;
}
