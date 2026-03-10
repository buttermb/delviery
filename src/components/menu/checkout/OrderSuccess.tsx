import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Loader2, Phone, Check,
  CheckCircle, Copy, Clock, Share2, MessageCircle, Calendar,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

export function OrderSuccess({
  orderId,
  formData,
  onClose,
  menuId
}: {
  orderId: string;
  formData: { deliveryMethod: string; firstName: string; phone: string };
  onClose: () => void;
  menuId: string;
}) {
  const [copied, setCopied] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsConfirmed, setSmsConfirmed] = useState(false);

  useEffect(() => {
    // Trigger confetti
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#10b981', '#34d399', '#6ee7b7']
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#10b981', '#34d399', '#6ee7b7']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  const copyOrderId = () => {
    navigator.clipboard.writeText(orderId.slice(0, 8).toUpperCase());
    setCopied(true);
    toast.success('Order ID copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOrder = () => {
    if (navigator.share) {
      navigator.share({
        title: 'My Order',
        text: `Order #${orderId.slice(0, 8).toUpperCase()} placed successfully!`,
      });
    } else {
      copyOrderId();
    }
  };

  const handleSmsOptIn = async () => {
    setSmsLoading(true);
    try {
      await supabase.functions.invoke('menu-order-sms-subscribe', {
        body: {
          order_id: orderId,
          menu_id: menuId,
          phone: formData.phone.replace(/\D/g, ''),
        }
      });
      setSmsConfirmed(true);
      toast.success('You will receive SMS updates for your order');
    } catch (error) {
      toast.error('Could not enable SMS notifications', { description: humanizeError(error) });
    } finally {
      setSmsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center overflow-y-auto">
      {/* Success animation */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
        <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
          <CheckCircle className="h-14 w-14 text-white" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-emerald-600 mb-2">Order Placed!</h2>
      <p className="text-muted-foreground mb-6">
        Thanks {formData.firstName}! Your order is being prepared.
      </p>

      {/* Order ID */}
      <Card className="w-full max-w-xs bg-muted/50 mb-4">
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Order Reference</div>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-xl font-bold">{orderId.slice(0, 8).toUpperCase()}</span>
            <Button size="icon" variant="ghost" className="h-11 w-11 sm:h-8 sm:w-8" onClick={copyOrderId} aria-label="Copy order ID">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ETA */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Clock className="h-4 w-4" />
        <span>
          {formData.deliveryMethod === 'delivery'
            ? 'Estimated delivery: 30-60 minutes'
            : 'Ready for pickup: 15-20 minutes'}
        </span>
      </div>

      {/* SMS Notifications Opt-in */}
      {formData.phone && !smsConfirmed && (
        <Card className="w-full max-w-xs mb-4 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">Get SMS Updates</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Receive order status notifications via text message
                </p>
                <Button
                  size="sm"
                  className="mt-2 gap-1.5"
                  onClick={handleSmsOptIn}
                  disabled={smsLoading}
                >
                  {smsLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MessageCircle className="h-3.5 w-3.5" />
                  )}
                  Enable SMS Alerts
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {smsConfirmed && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 mb-4 w-full max-w-xs justify-center">
          <CheckCircle className="h-4 w-4" />
          <span>SMS notifications enabled</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-6">
        <Button variant="outline" className="gap-2" onClick={shareOrder}>
          <Share2 className="h-4 w-4" />
          Share
        </Button>
        <Button variant="outline" className="gap-2">
          <Calendar className="h-4 w-4" />
          Calendar
        </Button>
      </div>

      {/* Done button */}
      <Button onClick={onClose} className="w-full max-w-xs h-12 text-lg" size="lg">
        Done
      </Button>

      {/* Support link */}
      <button className="mt-4 text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
        <MessageCircle className="h-4 w-4" />
        Need help? Contact support
      </button>
    </div>
  );
}
