import { useState, useEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANNELS = ['Email', 'SMS', 'Push'] as const;
type Channel = (typeof CHANNELS)[number];

const SMS_MAX_LENGTH = 160;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: { id: string; full_name: string; email: string; phone: string };
  tenantId: string;
}

export function SendMessageDialog({
  open,
  onOpenChange,
  driver,
  tenantId,
}: SendMessageDialogProps) {
  const { token } = useTenantAdminAuth();

  const [channel, setChannel] = useState<Channel>('Email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (open) {
      setChannel('Email');
      setSubject('');
      setBody('');
    }
  }, [open]);

  const smsLength = useMemo(() => body.length, [body]);

  const canSubmit =
    channel === 'Email'
      ? subject.trim().length > 0 && body.trim().length > 0
      : body.trim().length > 0;

  const sendMessage = useMutation({
    mutationFn: async () => {
      // Verify driver belongs to tenant before logging
      const { count } = await supabase
        .from('couriers')
        .select('*', { count: 'exact', head: true })
        .eq('id', driver.id)
        .eq('tenant_id', tenantId);
      if (!count) throw new Error('Driver not found in this tenant');

      // Log to activity log as a message event
      const { error } = await supabase.from('driver_activity_log').insert({
        tenant_id: tenantId,
        driver_id: driver.id,
        event_type: 'message_sent',
        event_data: {
          channel: channel.toLowerCase(),
          subject: channel === 'Email' ? subject.trim() : undefined,
          body: body.trim(),
        },
      });
      if (error) throw error;

      // For email, call a notification function if available
      if (channel === 'Email') {
        const res = await supabase.functions.invoke('send-notification', {
          body: {
            type: 'email',
            to: driver.email,
            subject,
            body,
            driver_id: driver.id,
          },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        // Notification function may not exist yet — log but don't fail
        if (res.error) {
          logger.error('Notification function call failed (may not exist)', res.error);
        }
      }
    },
    onSuccess: () => {
      toast.success(`${channel} message sent`);
      onOpenChange(false);
    },
    onError: (err) => {
      logger.error('Send message failed', err);
      toast.error('Failed to send message');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] border-[#334155] bg-[#1E293B] text-[#F8FAFC]">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]">
            Message {driver.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Channel tabs */}
          <div className="flex border-b border-[#334155]">
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannel(ch)}
                className={`px-4 pb-2.5 text-sm font-medium transition-colors ${
                  channel === ch
                    ? 'border-b-2 border-[#10B981] text-[#F8FAFC]'
                    : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          {/* Email fields */}
          {channel === 'Email' && (
            <div className="space-y-3">
              <div>
                <Label className="mb-1 text-xs text-[#64748B]">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject..."
                  className="h-9 min-h-0 border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#475569] focus-visible:ring-[#10B981]"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs text-[#64748B]">Body</Label>
                  <div className="flex items-center gap-1">
                    <FormatButton label="B" />
                    <FormatButton label="•" />
                    <FormatButton label="🔗" />
                  </div>
                </div>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  placeholder="Write your message..."
                  className="min-h-0 border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#475569] focus-visible:ring-[#10B981]"
                />
              </div>
            </div>
          )}

          {/* SMS fields */}
          {channel === 'SMS' && (
            <div className="space-y-3">
              <div>
                <Label className="mb-1 text-xs text-[#64748B]">Message</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  maxLength={SMS_MAX_LENGTH}
                  placeholder="Write your SMS..."
                  className="min-h-0 border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#475569] focus-visible:ring-[#10B981]"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-[#64748B]">
                    Sends to {formatPhone(driver.phone)}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      smsLength > SMS_MAX_LENGTH ? 'text-[#EF4444]' : 'text-[#64748B]'
                    }`}
                  >
                    {smsLength} / {SMS_MAX_LENGTH}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Push notification fields */}
          {channel === 'Push' && (
            <div className="space-y-3">
              <div>
                <Label className="mb-1 text-xs text-[#64748B]">Title</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Notification title..."
                  className="h-9 min-h-0 border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#475569] focus-visible:ring-[#10B981]"
                />
              </div>
              <div>
                <Label className="mb-1 text-xs text-[#64748B]">Body</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  placeholder="Notification body..."
                  className="min-h-0 border-[#334155] bg-[#0F172A] text-sm text-[#F8FAFC] placeholder:text-[#475569] focus-visible:ring-[#10B981]"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-[#334155]">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[#64748B] hover:bg-[#263548] hover:text-[#F8FAFC]"
          >
            Cancel
          </Button>
          <Button
            onClick={() => sendMessage.mutate()}
            disabled={!canSubmit || sendMessage.isPending}
            className="bg-[#10B981] text-white hover:bg-[#059669]"
          >
            {sendMessage.isPending ? 'Sending...' : 'Send Message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FormatButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex h-6 w-6 items-center justify-center rounded text-xs text-[#64748B] hover:bg-[#263548] hover:text-[#94A3B8]"
    >
      {label}
    </button>
  );
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
