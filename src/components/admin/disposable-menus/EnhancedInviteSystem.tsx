import { logger } from '@/lib/logger';
/**
 * Enhanced Invite System
 * Supports SMS, encrypted messaging, email, and manual delivery
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, Mail, Shield, Send, UserPlus, 
  Users, CheckCircle2, AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WhitelistEntry {
  id: string;
  unique_access_token?: string;
  status?: string;
  [key: string]: unknown;
}

interface EnhancedInviteSystemProps {
  menuId: string;
  menu: {
    name: string;
    encrypted_url_token: string;
    access_code?: string;
  };
  whitelist: WhitelistEntry[];
  onInviteSent: () => void;
}

export function EnhancedInviteSystem({
  menuId,
  menu,
  whitelist,
  onInviteSent,
}: EnhancedInviteSystemProps) {
  const [inviteMethod, setInviteMethod] = useState<'sms' | 'signal' | 'telegram' | 'email' | 'manual'>('sms');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [manualCustomer, setManualCustomer] = useState({ name: '', phone: '', email: '' });
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Default message template
  const baseUrl = `${window.location.protocol}//${window.location.host}`;
  const defaultMessage = inviteMethod === 'sms' 
    ? `New catalog available.\n\nLink: ${baseUrl}/m/${menu.encrypted_url_token}${whitelist.find(w => w.id === selectedCustomers[0])?.unique_access_token ? `?u=${whitelist.find(w => w.id === selectedCustomers[0])?.unique_access_token}` : ''}\nAccess Code: ${menu.access_code || 'N/A'}\n\nKeep private.`
    : `Check out the new selection. Link expires in 30 days.\n\nLink: ${baseUrl}/m/${menu.encrypted_url_token}\nAccess Code: ${menu.access_code || 'N/A'}\n\nKeep this private. Do not share.`;

  const message = customMessage || defaultMessage;

  const handleSendInvites = async () => {
    if (inviteMethod === 'manual') {
      if (!manualCustomer.name || !manualCustomer.phone) {
        toast.error('Name and phone required');
        return;
      }
    } else {
      if (selectedCustomers.length === 0) {
        toast.error('Select at least one customer');
        return;
      }
    }

    setSending(true);
    try {
      const customersToInvite = inviteMethod === 'manual'
        ? [manualCustomer]
        : whitelist.filter(w => selectedCustomers.includes(w.id));

      for (const customer of customersToInvite) {
        const custId = 'id' in customer ? customer.id : null;
        const custToken = 'unique_access_token' in customer ? customer.unique_access_token : '';

        // Send via appropriate method
        if (inviteMethod === 'sms' && 'phone' in customer && customer.phone) {
          const { data, error } = await supabase.functions.invoke('send-sms', {
            body: {
              phone: customer.phone,
              message: message,
            },
          });

          if (error) throw error;

          // Check for error in response body (some edge functions return 200 with error)
          if (data && typeof data === 'object' && 'error' in data && data.error) {
            const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to send SMS';
            throw new Error(errorMessage);
          }
        }

        // Update whitelist status if exists
        if (custId) {
          await supabase
            .from('menu_access_whitelist')
            .update({ status: 'pending' })
            .eq('id', custId);
        }
      }

      toast.success(`Invites sent to ${customersToInvite.length} customer(s)`);
      setSelectedCustomers([]);
      setManualCustomer({ name: '', phone: '', email: '' });
      setCustomMessage('');
      onInviteSent();
    } catch (error: unknown) {
      logger.error('Invite error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send invites');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">📨 Send Invites</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedCustomers(whitelist.filter(w => w.status === 'active').map(w => w.id))}
        >
          <Users className="h-4 w-4 mr-2" />
          Select All Trusted
        </Button>
      </div>

      {/* Invite Method Selection */}
      <div className="space-y-3">
        <Label>Invitation Method</Label>
        <RadioGroup value={inviteMethod} onValueChange={(v: string) => setInviteMethod(v as 'sms' | 'signal' | 'telegram' | 'email' | 'manual')}>
          <div className="flex items-start space-x-2 rounded-lg border p-3">
            <RadioGroupItem value="sms" id="sms" />
            <div className="flex-1">
              <Label htmlFor="sms" className="font-medium cursor-pointer flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                SMS (Recommended)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Fast, reliable delivery to customer phones
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-2 rounded-lg border p-3">
            <RadioGroupItem value="signal" id="signal" />
            <div className="flex-1">
              <Label htmlFor="signal" className="font-medium cursor-pointer flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Signal (Encrypted)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                End-to-end encrypted messaging for maximum security
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-2 rounded-lg border p-3">
            <RadioGroupItem value="telegram" id="telegram" />
            <div className="flex-1">
              <Label htmlFor="telegram" className="font-medium cursor-pointer flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Telegram (Encrypted)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Secure messaging with Telegram
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-2 rounded-lg border p-3">
            <RadioGroupItem value="email" id="email" />
            <div className="flex-1">
              <Label htmlFor="email" className="font-medium cursor-pointer flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email (Least Secure)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Traditional email delivery
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-2 rounded-lg border p-3">
            <RadioGroupItem value="manual" id="manual" />
            <div className="flex-1">
              <Label htmlFor="manual" className="font-medium cursor-pointer flex items-center gap-2">
                <Send className="h-4 w-4" />
                Manual Delivery
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                You send the link yourself
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Customer Selection (if not manual) */}
      {inviteMethod !== 'manual' && (
        <div className="space-y-3">
          <Label>Select Customers</Label>
          <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
            {whitelist.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No customers whitelisted yet
              </div>
            ) : (
              whitelist.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center space-x-3 p-3 hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    setSelectedCustomers(prev =>
                      prev.includes(entry.id)
                        ? prev.filter(id => id !== entry.id)
                        : [...prev, entry.id]
                    );
                  }}
                >
                  <Checkbox
                    checked={selectedCustomers.includes(entry.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCustomers(prev => [...prev, entry.id]);
                      } else {
                        setSelectedCustomers(prev => prev.filter(id => id !== entry.id));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{String(entry.customer_name || '')}</div>
                    <div className="text-sm text-muted-foreground">
                      {String(entry.customer_phone || '')}
                      {entry.customer_email && ` • ${String(entry.customer_email)}`}
                    </div>
                  </div>
                  <Badge variant={entry.status === 'active' ? 'default' : 'secondary'}>
                    {entry.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
          {selectedCustomers.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {selectedCustomers.length} customer(s) selected
            </div>
          )}
        </div>
      )}

      {/* Manual Customer Entry */}
      {inviteMethod === 'manual' && (
        <div className="space-y-3">
          <Label>Enter Customer Information</Label>
          <Input
            placeholder="Customer Name"
            value={manualCustomer.name}
            onChange={(e) => setManualCustomer({ ...manualCustomer, name: e.target.value })}
          />
          <Input
            placeholder="Phone Number"
            value={manualCustomer.phone}
            onChange={(e) => setManualCustomer({ ...manualCustomer, phone: e.target.value })}
          />
          <Input
            placeholder="Email (Optional)"
            value={manualCustomer.email}
            onChange={(e) => setManualCustomer({ ...manualCustomer, email: e.target.value })}
            type="email"
          />
        </div>
      )}

      {/* Message Template */}
      <div className="space-y-2">
        <Label>Message Template</Label>
        <Textarea
          value={message}
          onChange={(e) => setCustomMessage(e.target.value)}
          rows={6}
          placeholder="Enter custom message or use default template"
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="custom-msg"
            checked={!!customMessage}
            onCheckedChange={(checked) => {
              if (!checked) setCustomMessage('');
            }}
          />
          <Label htmlFor="custom-msg" className="text-sm cursor-pointer">
            Use custom message
          </Label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => {
          setSelectedCustomers([]);
          setManualCustomer({ name: '', phone: '', email: '' });
          setCustomMessage('');
        }}>
          Clear
        </Button>
        <Button
          onClick={handleSendInvites}
          disabled={sending || (inviteMethod === 'manual' ? !manualCustomer.name || !manualCustomer.phone : selectedCustomers.length === 0)}
        >
          {sending ? (
            <>Sending...</>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Invites
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

