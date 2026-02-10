import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Mail, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import type { Database } from '@/integrations/supabase/types';

type WholesaleClient = Database['public']['Tables']['wholesale_clients']['Row'];

export interface SendPortalLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: WholesaleClient;
}

export function SendPortalLinkDialog({ open, onOpenChange, client }: SendPortalLinkDialogProps) {
  const [copied, setCopied] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const portalUrl = `${window.location.origin}/p/${client.portal_token}`;
  const message = `Your client portal is ready! View your invoices and order history: ${portalUrl}`;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      showSuccessToast('Portal link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logger.error('Failed to copy portal link', error, { component: 'SendPortalLinkDialog' });
      showErrorToast('Failed to copy link');
    }
  }, [portalUrl]);

  const handleSendSMS = useCallback(async () => {
    if (!client.phone) {
      showErrorToast('Client phone number is required');
      return;
    }

    try {
      setSendingSMS(true);

      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: client.phone,
          message: message,
        },
      });

      if (error) {
        logger.error('Failed to send SMS', error, { component: 'SendPortalLinkDialog', clientId: client.id });
        showErrorToast(error.message || 'Failed to send SMS. Twilio may not be configured.');
        return;
      }

      if (data && typeof data === 'object' && 'error' in data) {
        showErrorToast(data.error as string || 'Failed to send SMS');
        return;
      }

      showSuccessToast('SMS sent successfully', 'Portal link sent to client via SMS');
    } catch (error: unknown) {
      logger.error('Error sending SMS', error, { component: 'SendPortalLinkDialog', clientId: client.id });
      showErrorToast('An unexpected error occurred');
    } finally {
      setSendingSMS(false);
    }
  }, [client.phone, message, client.id]);

  const handleSendEmail = useCallback(async () => {
    if (!client.email) {
      showErrorToast('Client email is required');
      return;
    }

    try {
      setSendingEmail(true);

      // Use send-verification-email or similar email function
      // For now, we'll use a generic approach
      const { data: _data, error } = await supabase.functions.invoke('send-verification-email', {
        body: {
          email: client.email,
          subject: 'Your Client Portal Access',
          message: message,
        },
      });

      if (error) {
        logger.error('Failed to send email', error, { component: 'SendPortalLinkDialog', clientId: client.id });
        showErrorToast('Email service may not be configured');
        return;
      }

      showSuccessToast('Email sent successfully', 'Portal link sent to client via email');
    } catch (error: unknown) {
      logger.error('Error sending email', error, { component: 'SendPortalLinkDialog', clientId: client.id });
      showErrorToast('An unexpected error occurred');
    } finally {
      setSendingEmail(false);
    }
  }, [client.email, message, client.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Portal Link</DialogTitle>
          <DialogDescription>
            Share the client portal link with {client.business_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Portal Link Display */}
          <div className="space-y-2">
            <Label>Portal Link</Label>
            <div className="flex items-center gap-2">
              <Input
                value={portalUrl}
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyLink}
                className="h-10 w-10 p-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Client Info */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="font-medium">{client.business_name}</div>
            <div className="text-sm text-muted-foreground space-y-1">
              {client.contact_name && <div>Contact: {client.contact_name}</div>}
              {client.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3 w-3" />
                  <span>{client.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {client.phone && (
              <Button
                onClick={handleSendSMS}
                disabled={sendingSMS}
                variant="outline"
                className="w-full"
              >
                {sendingSMS ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send via SMS
                  </>
                )}
              </Button>
            )}
            {client.email && (
              <Button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                variant="outline"
                className="w-full"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send via Email
                  </>
                )}
              </Button>
            )}
            {!client.phone && !client.email && (
              <Badge variant="outline" className="w-full justify-center py-2">
                No contact information available
              </Badge>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

