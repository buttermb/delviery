import { logger } from '@/lib/logger';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";

interface NotifyRecallParams {
  recall_id: string;
  notification_method?: 'email' | 'sms' | 'phone' | 'in_person';
}

export function useRecallActions() {
  const queryClient = useQueryClient();

  const notifyRecall = useMutation({
    mutationFn: async (params: NotifyRecallParams) => {
      const { data, error } = await supabase.functions.invoke('notify-recall', {
        body: params
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recall.lists() });
      toast.success(`Recall notifications sent to ${data.customers_notified} customers`);
    },
    onError: (error: any) => {
      logger.error('Failed to send recall notifications', error, { component: 'useRecallActions' });
      toast.error(error.message || 'Failed to send recall notifications');
    },
  });

  return {
    notifyRecall,
  };
}
