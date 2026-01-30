/**
 * OrderSMSButton - Send order status updates via SMS
 * Uses Twilio integration through the send-sms edge function
 */

import { useState } from 'react';
import { MessageSquare, Send, X, Loader2, Phone, AlertCircle } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getSMSCharInfo } from '@/lib/utils/smsValidation';
import {
  useSendOrderSMS,
  OrderForSMS,
  getOrderCustomerName,
  getOrderPhoneNumber,
  generateOrderSMSMessage,
  ORDER_SMS_TEMPLATES,
  SMSTemplateKey,
} from '@/hooks/useSendOrderSMS';

interface OrderSMSButtonProps {
  order: OrderForSMS;
  tenantId?: string;
  variant?: 'icon' | 'button';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  disabled?: boolean;
}

const TEMPLATE_OPTIONS: { id: SMSTemplateKey; label: string }[] = [
  { id: 'status_update', label: 'Current Status Update' },
  { id: 'confirmed', label: 'Order Confirmed' },
  { id: 'preparing', label: 'Being Prepared' },
  { id: 'ready', label: 'Ready for Pickup' },
  { id: 'in_transit', label: 'Out for Delivery' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'custom', label: 'Custom Message' },
];

export function OrderSMSButton({
  order,
  tenantId,
  variant = 'icon',
  size = 'sm',
  className,
  disabled = false,
}: OrderSMSButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SMSTemplateKey>('status_update');
  const [message, setMessage] = useState('');

  const customerName = getOrderCustomerName(order);
  const phoneNumber = getOrderPhoneNumber(order);
  const orderNumber = order.order_number || order.id.slice(0, 8);
  const hasPhone = !!phoneNumber;

  const sendSMS = useSendOrderSMS({
    onSuccess: () => {
      toast.success(`SMS sent to ${customerName}`, {
        description: `Order #${orderNumber} status update delivered`,
      });
      setOpen(false);
      setMessage('');
      setSelectedTemplate('status_update');
    },
    onError: (error) => {
      toast.error('Failed to send SMS', {
        description: error.message,
      });
    },
  });

  const handleTemplateChange = (templateId: string) => {
    const template = templateId as SMSTemplateKey;
    setSelectedTemplate(template);

    if (template === 'custom') {
      setMessage('');
    } else {
      setMessage(generateOrderSMSMessage(order, template));
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (!phoneNumber) {
      toast.error('No phone number available for this order');
      return;
    }

    sendSMS.mutate({
      to: phoneNumber,
      message: message.trim(),
      customerId: order.user?.full_name ? undefined : order.id,
      accountId: tenantId,
    });
  };

  // Initialize message on open
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setMessage(generateOrderSMSMessage(order, 'status_update'));
      setSelectedTemplate('status_update');
    }
  };

  const charInfo = getSMSCharInfo(message);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant={variant === 'icon' ? 'ghost' : 'outline'}
          size={size}
          className={cn(
            variant === 'icon' && 'p-2 h-8 w-8',
            'hover:text-primary transition-colors',
            className
          )}
          disabled={disabled || !hasPhone}
          title={
            !hasPhone
              ? 'No phone number available for this order'
              : `Send SMS to ${customerName}`
          }
          onClick={(e) => e.stopPropagation()}
        >
          <MessageSquare
            className={cn(variant === 'icon' ? 'h-4 w-4' : 'h-4 w-4 mr-2')}
          />
          {variant === 'button' && 'Send SMS'}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-4"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Send Order Update</h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Order Info */}
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
            <Badge variant="outline" className="text-xs">
              #{orderNumber}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {order.status}
            </span>
          </div>

          {/* Recipient */}
          <div className="text-sm">
            <span className="text-muted-foreground">To: </span>
            <span className="font-medium">{customerName}</span>
            {phoneNumber && (
              <span className="ml-2 text-xs text-muted-foreground flex items-center gap-1 inline-flex">
                <Phone className="h-3 w-3" />
                {phoneNumber}
              </span>
            )}
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label className="text-xs">Message Template</Label>
            <Select
              value={selectedTemplate}
              onValueChange={handleTemplateChange}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Choose template..." />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_OPTIONS.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message Textarea */}
          <div className="space-y-2">
            <Label className="text-xs">Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[100px] text-sm resize-none"
            />
            <div className="flex items-center justify-between">
              <div className={cn('text-xs', charInfo.colorClass)}>
                {charInfo.current}/{charInfo.limit} characters
                {charInfo.partCount > 1 && (
                  <span className="ml-1">({charInfo.partCount} messages)</span>
                )}
              </div>
              {charInfo.isOverLimit && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Long message
                </span>
              )}
            </div>
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={sendSMS.isPending || !message.trim() || !hasPhone}
            className="w-full"
            size="sm"
          >
            {sendSMS.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send SMS
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
