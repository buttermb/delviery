import { logger } from '@/lib/logger';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";

interface SendScheduledReportParams {
  schedule_id: string;
}

export function useScheduledReportActions() {
  const queryClient = useQueryClient();

  const sendScheduledReport = useMutation({
    mutationFn: async (params: SendScheduledReportParams) => {
      const { data, error } = await supabase.functions.invoke('send-scheduled-report', {
        body: params
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      toast.success(`Report "${data.report_name}" generated and sent to ${data.recipients.length} recipients`);
    },
    onError: (error: any) => {
      logger.error('Failed to send scheduled report', error, { component: 'useScheduledReportActions' });
      toast.error(error.message || 'Failed to send scheduled report');
    },
  });

  return {
    sendScheduledReport,
  };
}
