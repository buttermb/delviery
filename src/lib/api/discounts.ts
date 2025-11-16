import { supabase } from '@/integrations/supabase/client';

export async function getUserWelcomeDiscount(userId: string) {
  const { data, error } = await supabase
    .from('user_welcome_discounts')
    .select('*')
    .eq('user_id', userId)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .single();

  if (error) return null;
  return data;
}

export async function applyWelcomeDiscount(userId: string, orderId: string) {
  const { data, error } = await supabase
    .from('user_welcome_discounts')
    .update({
      used: true,
      used_at: new Date().toISOString(),
      order_id: orderId
    })
    .eq('user_id', userId)
    .eq('used', false)
    .select()
    .single();

  if (error) throw error;
  return data;
}