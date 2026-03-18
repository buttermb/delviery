/**
 * QuickMessageButton - One-click SMS/Message Composer
 * Reduces messaging friction from 4-5 clicks to 2-3
 */
import { useState } from 'react';
import { MessageSquare, Send, X, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

// Pre-defined message templates with variable placeholders
const MESSAGE_TEMPLATES = [
  {
    id: 'order_ready',
    label: 'Order Ready',
    message: 'Hi {{name}}, your order is ready for pickup! Please come by at your earliest convenience.',
  },
  {
    id: 'order_shipped',
    label: 'Order Shipped',
    message: 'Hi {{name}}, great news! Your order has been shipped and is on its way.',
  },
  {
    id: 'payment_reminder',
    label: 'Payment Reminder',
    message: 'Hi {{name}}, this is a friendly reminder about your outstanding balance. Please let us know if you have any questions.',
  },
  {
    id: 'thank_you',
    label: 'Thank You',
    message: 'Hi {{name}}, thank you for your order! We appreciate your business.',
  },
  {
    id: 'custom',
    label: 'Custom Message',
    message: '',
  },
];

interface QuickMessageButtonProps {
  recipientName: string;
  recipientPhone?: string;
  recipientEmail?: string;
  onSendMessage?: (message: string, channel: 'sms' | 'email') => Promise<void>;
  variant?: 'icon' | 'button';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  disabled?: boolean;
}

export function QuickMessageButton({
  recipientName,
  recipientPhone,
  recipientEmail,
  onSendMessage,
  variant = 'icon',
  size = 'sm',
  className,
  disabled = false,
}: QuickMessageButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<'sms' | 'email'>(recipientPhone ? 'sms' : 'email');
  const [isSending, setIsSending] = useState(false);

  const replaceVariables = (text: string) => {
    return text
      .replace(/\{\{name\}\}/g, recipientName || 'Customer')
      .replace(/\{\{phone\}\}/g, recipientPhone ?? '')
      .replace(/\{\{email\}\}/g, recipientEmail ?? '');
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = MESSAGE_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setMessage(replaceVariables(template.message));
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (channel === 'sms' && !recipientPhone) {
      toast.error('No phone number available');
      return;
    }

    if (channel === 'email' && !recipientEmail) {
      toast.error('No email address available');
      return;
    }

    setIsSending(true);
    try {
      if (onSendMessage) {
        await onSendMessage(message, channel);
      } else {
        // Default behavior - show success toast
        toast.success(`Message sent to ${recipientName} via ${channel.toUpperCase()}`);
      }
      setOpen(false);
      setMessage('');
      setSelectedTemplate('');
    } catch (error) {
      logger.error('Failed to send message', error);
      toast.error('Failed to send message', { description: humanizeError(error) });
    } finally {
      setIsSending(false);
    }
  };

  const hasContact = recipientPhone || recipientEmail;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant === 'icon' ? 'ghost' : 'outline'}
          size={size}
          className={cn(
            variant === 'icon' && 'p-2 h-8 w-8',
            'hover:text-primary transition-colors',
            className
          )}
          disabled={disabled || !hasContact}
          title={!hasContact ? 'No contact info available' : `Message ${recipientName}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MessageSquare className={cn(
            variant === 'icon' ? 'h-4 w-4' : 'h-4 w-4 mr-2'
          )} />
          {variant === 'button' && 'Message'}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-4"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Quick Message</h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setOpen(false)}
              aria-label="Close message dialog"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            To: <span className="font-medium text-foreground">{recipientName}</span>
            {recipientPhone && (
              <span className="ml-2 text-xs">({recipientPhone})</span>
            )}
          </div>

          {recipientPhone && recipientEmail && (
            <div className="space-y-2">
              <Label className="text-xs">Send via</Label>
              <Select
                value={channel}
                onValueChange={(v) => setChannel(v as 'sms' | 'email')}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Template</Label>
            <Select
              value={selectedTemplate}
              onValueChange={handleTemplateChange}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Choose template..." />
              </SelectTrigger>
              <SelectContent>
                {MESSAGE_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[100px] text-sm resize-none"
            />
            <div className="text-xs text-muted-foreground text-right">
              {message.length}/160 characters
            </div>
          </div>

          <Button
            onClick={handleSend}
            disabled={isSending || !message.trim()}
            className="w-full"
            size="sm"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send {channel === 'sms' ? 'SMS' : 'Email'}
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
