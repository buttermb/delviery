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
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

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
  menuTitle,
}: SendAccessLinkDialogProps) {
  const [method, setMethod] = useState<'email' | 'sms'>('email');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const accessUrl = `${window.location.origin}/menu/${whitelistEntry.unique_access_token}`;

  const handleSend = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-menu-access-link', {
        body: {
          whitelistId: whitelistEntry.id,
          method,
        },
      });

      if (error) throw error;

      setPreview(data.preview);
      
      toast({
        title: 'Access Link Sent',
        description: `Link sent via ${method} to ${whitelistEntry.customer_name}`,
      });
    } catch (error: any) {
      console.error('Error sending access link:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to Send',
        description: error.message || 'Could not send access link',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(accessUrl);
    setCopied(true);
    toast({
      title: 'Link Copied',
      description: 'Access link copied to clipboard',
    });
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
            <Label>Access Link</Label>
            <div className="flex gap-2">
              <input
                type="text"
                value={accessUrl}
                readOnly
                className="flex-1 px-3 py-2 border rounded-md bg-muted text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
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
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email {whitelistEntry.customer_email && `(${whitelistEntry.customer_email})`}
                  {!canSendEmail && <span className="text-xs text-muted-foreground">(No email on file)</span>}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sms" id="sms" disabled={!canSendSMS} />
                <Label htmlFor="sms" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  SMS {whitelistEntry.customer_phone && `(${whitelistEntry.customer_phone})`}
                  {!canSendSMS && <span className="text-xs text-muted-foreground">(No phone on file)</span>}
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
                `Send via ${method === 'email' ? 'Email' : 'SMS'}`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
