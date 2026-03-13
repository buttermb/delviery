import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Send } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ErrorReportSubmissionProps {
  error: Error;
  errorInfo?: React.ErrorInfo;
  isOpen: boolean;
  onClose: () => void;
}

export function ErrorReportSubmission({ error, errorInfo, isOpen, onClose }: ErrorReportSubmissionProps) {
  const { tenantId, userId } = useTenantContext();
  const [additionalInfo, setAdditionalInfo] = useState('');

  const submitErrorReportMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !userId) {
        throw new Error('Tenant ID and User ID required');
      }

      logger.info('[ErrorReport] Submitting error report');

      const errorReport = {
        tenant_id: tenantId,
        user_id: userId,
        error_message: error.message,
        error_stack: error.stack ?? null,
        component_stack: errorInfo?.componentStack ?? null,
        additional_info: additionalInfo.trim() || null,
        user_agent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      };

      const { error: submitError } = await supabase.from('error_reports').insert(errorReport);

      if (submitError) {
        logger.error('[ErrorReport] Failed to submit error report', { error: submitError });
        throw submitError;
      }

      logger.info('[ErrorReport] Error report submitted successfully');
    },
    onSuccess: () => {
      toast.success('Error report submitted', {
        description: 'Thank you for helping us improve FloraIQ.',
      });
      setAdditionalInfo('');
      onClose();
    },
    onError: (error) => {
      toast.error('Failed to submit error report', {
        description: error instanceof Error ? error.message : 'Please try again later',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitErrorReportMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle>Report Error</DialogTitle>
            </div>
            <DialogDescription>
              Help us fix this issue by providing additional details about what happened.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <AlertDescription>
                <p className="text-sm font-semibold mb-1">Error Details:</p>
                <p className="text-xs font-mono text-red-800 break-all">{error.message}</p>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label htmlFor="additional-info" className="text-sm font-medium">
                What were you doing when this error occurred?
              </label>
              <Textarea
                id="additional-info"
                placeholder="Describe the steps you took before the error appeared..."
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitErrorReportMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitErrorReportMutation.isPending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {submitErrorReportMutation.isPending ? 'Submitting...' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
