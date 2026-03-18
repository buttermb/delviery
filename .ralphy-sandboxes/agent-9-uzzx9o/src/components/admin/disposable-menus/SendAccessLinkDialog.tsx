import { logger } from '@/lib/logger';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, MessageSquare, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { CreditCostBadge, CreditCostIndicator } from '@/components/credits';
import { useCredits } from '@/hooks/useCredits';

interface SendAccessLinkDialogProps {
  open: boolean;
  onClose: () => void;
  whitelistEntry: {
    id: string;
    customer_name: string;
    customer_email: string | null;
    customer_phone: string | null;
    unique_access_token: string;
  };
  menuTitle: string;
}

export function SendAccessLinkDialog({
  open,
  onClose,
  whitelistEntry,
  menuTitle: _menuTitle,
}: SendAccessLinkDialogProps) {
  const [method, setMethod] = useState<'email' | 'sms'>('email');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ message?: string; [key: string]: unknown } | null>(null);
  const [copied, setCopied] = useState(false);
  const { isFreeTier, performAction } = useCredits();

  const accessUrl = `${window.location.origin}/menu/${whitelistEntry.unique_access_token}`;

  const handleSend = async () => {
    setLoading(true);
    try {
      // Consume credits for the action
      const actionKey = method === 'email' ? 'send_email' : 'send_sms';
      if (isFreeTier) {
        const creditResult = await performAction(actionKey, whitelistEntry.id, 'menu_access');
        if (!creditResult.success) {
          toast.error("Insufficient Credits");
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke('send-menu-access-link', {
        body: {
          whitelistId: whitelistEntry.id,
          method,
        },
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to send access link';
        throw new Error(errorMessage);
      }

      setPreview(data.preview);
      
      toast.success("Link sent via ${method} to ${whitelistEntry.customer_name}");
    } catch (error: unknown) {
      logger.error('Error sending access link', error, { component: 'SendAccessLinkDialog' });
      const _errorMessage = error instanceof Error ? error.message : 'Could not send access link';
      toast.error("Failed to Send");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(accessUrl);
    setCopied(true);
    toast.success("Access link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const canSendEmail = !!whitelistEntry.customer_email;
  const canSendSMS = !!whitelistEntry.customer_phone;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Access Link</DialogTitle>
          <DialogDescription>
            Send menu access link to {whitelistEntry.customer_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Access URL Display */}
          <div className="space-y-2">
            <Label htmlFor="access-link">Access Link</Label>
            <div className="flex gap-2">
              <input
                id="access-link"
                type="text"
                value={accessUrl}
                readOnly
                aria-label="Menu access link"
                className="flex-1 px-3 py-2 border rounded-md bg-muted text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                aria-label="Copy"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Send Method Selection */}
          <div className="space-y-3">
            <Label>Send Via</Label>
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as 'email' | 'sms')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="email" id="email" disabled={!canSendEmail} />
                <Label htmlFor="email" className="flex items-center gap-2 flex-wrap">
                  <Mail className="h-4 w-4" />
                  Email {whitelistEntry.customer_email && `(${whitelistEntry.customer_email})`}
                  {!canSendEmail && <span className="text-xs text-muted-foreground">(No email on file)</span>}
                  {isFreeTier && canSendEmail && <CreditCostBadge actionKey="send_email" compact />}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sms" id="sms" disabled={!canSendSMS} />
                <Label htmlFor="sms" className="flex items-center gap-2 flex-wrap">
                  <MessageSquare className="h-4 w-4" />
                  SMS {whitelistEntry.customer_phone && `(${whitelistEntry.customer_phone})`}
                  {!canSendSMS && <span className="text-xs text-muted-foreground">(No phone on file)</span>}
                  {isFreeTier && canSendSMS && <CreditCostBadge actionKey="send_sms" compact />}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-2">
              <Label>Message Preview</Label>
              <Textarea
                value={preview.message || preview.subject + '\n\n' + preview.message}
                readOnly
                rows={10}
                className="font-mono text-xs"
              />
            </div>
          )}

          {/* Warning for missing contact info */}
          {!canSendEmail && !canSendSMS && (
            <Alert variant="destructive">
              <AlertDescription>
                No contact information available. Please copy the link manually and send it to the customer.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          {/* Credit cost indicator */}
          {isFreeTier && (canSendEmail || canSendSMS) && (
            <div className="flex-1">
              <CreditCostIndicator actionKey={method === 'email' ? 'send_email' : 'send_sms'} />
            </div>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {(canSendEmail || canSendSMS) && (
            <Button onClick={handleSend} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  Send via {method === 'email' ? 'Email' : 'SMS'}
                  {isFreeTier && (
                    <CreditCostBadge 
                      actionKey={method === 'email' ? 'send_email' : 'send_sms'} 
                      className="ml-2" 
                      showTooltip={false}
                    />
                  )}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
