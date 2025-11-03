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
import { cn } from '@/lib/utils';

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
  
  const { toast } = useToast();
  const { account } = useAccount();

  const [customerPhone, setCustomerPhone] = useState(initialPhone || '');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

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
        await (supabase.from('message_history') as any).insert({
          tenant_id: account?.id,
          customer_id: customerId,
          message: variables,
          direction: 'outbound',
          method: 'sms',
          status: 'sent',
        });
      } catch (error: any) {
        // Gracefully handle missing table
        if (error.code !== '42P01') {
          console.warn('Failed to log message history:', error);
        }
      }

      toast({
        title: 'SMS sent successfully',
        description: `Message sent to ${customerPhone}`,
      });

      setMessage('');
      setSelectedTemplate(null);
      onSent?.();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send SMS',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const handleTemplateSelect = (template: typeof MESSAGE_TEMPLATES[0]) => {
    setSelectedTemplate(template.label);
    setMessage(template.text);
  };

  const handleSend = () => {
    if (!message.trim()) {
      toast({
        title: 'Message required',
        description: 'Please enter a message or select a template',
        variant: 'destructive',
      });
      return;
    }

    sendSMSMutation.mutate(message);
  };

  const characterCount = message.length;
  const isOverLimit = characterCount > 160;

  return (
    <div className="space-y-4">
      {customerName && (
        <div className="text-sm text-muted-foreground">
          Sending to: <span className="font-medium text-foreground">{customerName}</span>
        </div>
      )}

      <div>
        <label className="text-sm font-medium mb-2 block">Phone Number</label>
        <input
          type="tel"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="+1234567890"
          className="w-full px-3 py-2 border rounded-md"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Message Templates</label>
        <div className="grid grid-cols-1 gap-2">
          {MESSAGE_TEMPLATES.map((template) => (
            <Button
              key={template.label}
              variant={selectedTemplate === template.label ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTemplateSelect(template)}
              className="justify-start text-left h-auto py-2"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              <div className="flex-1">
                <div className="font-medium">{template.label}</div>
                <div className="text-xs text-muted-foreground truncate">{template.text}</div>
              </div>
            </Button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Message</label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message here..."
          rows={4}
          className={isOverLimit ? 'border-destructive' : ''}
        />
        <div className="flex items-center justify-between mt-1">
          <div className={cn('text-xs', isOverLimit ? 'text-destructive' : 'text-muted-foreground')}>
            {characterCount} / 160 characters
          </div>
          {isOverLimit && (
            <Badge variant="destructive" className="text-xs">
              Message too long
            </Badge>
          )}
        </div>
      </div>

      <Button
        onClick={handleSend}
        disabled={sendSMSMutation.isPending || !message.trim() || !customerPhone || isOverLimit}
        className="w-full"
      >
        {sendSMSMutation.isPending ? (
          <>Sending...</>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Send SMS
          </>
        )}
      </Button>
    </div>
  );
}

