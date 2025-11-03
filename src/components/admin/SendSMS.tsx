/**
 * Send SMS Component
 * Allows sending SMS messages to customers with templates
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageSquare } from 'lucide-react';

interface SendSMSProps {
  customerId?: string;
  customerPhone?: string;
  customerName?: string;
  onSent?: () => void;
}

const MESSAGE_TEMPLATES = [
  { 
    label: 'On the way', 
    text: 'Hey! Your driver is on the way, ETA 15 minutes. Track your order in the app.' 
  },
  { 
    label: 'Running late', 
    text: 'Running about 10 minutes late, sorry for the delay! Your order is still on the way.' 
  },
  { 
    label: 'Payment reminder', 
    text: 'Friendly reminder: payment for your last order is due today. Please settle your balance when convenient.' 
  },
  { 
    label: 'New product', 
    text: 'Got some fire new product in. Want to check it out? Reply YES to see the menu.' 
  },
  { 
    label: 'Order confirmed', 
    text: 'Your order has been confirmed and is being prepared. We\'ll notify you when it\'s ready for pickup/delivery.' 
  },
];

export function SendSMS({ 
  customerId, 
  customerPhone: initialPhone,
  customerName,
  onSent 
}: SendSMSProps) {
  const { account } = useAccount();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [customerPhone, setCustomerPhone] = useState(initialPhone || '');

  const sendSMSMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!customerPhone || !text.trim()) {
        throw new Error('Phone number and message are required');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('send-sms', {
        body: {
          to: customerPhone,
          message: text,
          customerId: customerId,
          accountId: account?.id,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send SMS');
      }

      const result = await response.data;
      
      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to send SMS');
      }

      return result;
    },
    onSuccess: async (result, variables) => {
      // Log message to history (if table exists)
      try {
        const { error: logError } = await supabase
          .from('message_history')
          .insert({
            tenant_id: account?.id,
            customer_id: customerId,
            phone_number: customerPhone,
            message: variables,
            direction: 'outbound',
            method: 'sms',
            status: 'sent',
            created_at: new Date().toISOString(),
          })
          .catch(() => {
            // Table might not exist yet, ignore error
            return { error: null };
          });

        if (logError && logError.code !== '42P01') {
          console.error('Error logging message:', logError);
        }
      } catch (err) {
        // Ignore logging errors
        console.warn('Could not log message to history:', err);
      }

      toast({
        title: 'Message sent!',
        description: `SMS sent to ${customerPhone}`,
      });

      setMessage('');
      onSent?.();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send SMS. Please ensure Twilio is configured.',
        variant: 'destructive',
      });
    },
  });

  const handleTemplateClick = (templateText: string) => {
    setMessage(templateText);
  };

  const handleSend = () => {
    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    if (!customerPhone.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a phone number',
        variant: 'destructive',
      });
      return;
    }

    sendSMSMutation.mutate(message);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Send SMS
        </CardTitle>
        {customerName && (
          <CardDescription>Send message to {customerName}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phone Number Input (if not provided) */}
        {!initialPhone && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Phone Number</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+1234567890"
              className="w-full px-3 py-2 border border-border rounded-md"
              required
            />
          </div>
        )}

        {/* Templates */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Quick Templates</label>
          <div className="flex flex-wrap gap-2">
            {MESSAGE_TEMPLATES.map((template) => (
              <Button
                key={template.label}
                variant="outline"
                size="sm"
                onClick={() => handleTemplateClick(template.text)}
                className="text-xs"
              >
                {template.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Message Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Message</label>
          <Textarea
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={1600}
            className="resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {message.length}/1600 characters
              {message.length > 160 && (
                <Badge variant="outline" className="ml-2">
                  {Math.ceil(message.length / 160)} SMS
                </Badge>
              )}
            </span>
          </div>
        </div>

        {/* Send Button */}
        <Button 
          onClick={handleSend} 
          disabled={!message.trim() || !customerPhone.trim() || sendSMSMutation.isPending}
          className="w-full"
        >
          {sendSMSMutation.isPending ? (
            <>
              <Send className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send SMS
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

