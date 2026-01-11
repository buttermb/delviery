/**
 * Order Confirmation Page
 * Success page after placing an order
 */

import { useEffect, useState } from 'react';
import { Link, useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useShop } from './ShopLayout';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Package, Clock, Mail, MapPin, Copy, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { useToast } from '@/hooks/use-toast';
import { useShopCart } from '@/hooks/useShopCart';

import confetti from 'canvas-confetti';

export default function OrderConfirmationPage() {
  const { storeSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { store } = useShop();
  const { isLuxuryTheme, accentColor, cardBg, cardBorder } = useLuxuryTheme();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [cartCleared, setCartCleared] = useState(false);

  // Get cart clearing function
  const { clearCart } = useShopCart({ storeId: store?.id || '' });

  // Read from location.state first, fall back to URL query params (for Stripe redirects and page refreshes)
  const stateData = (location.state || {}) as {
    orderNumber?: string;
    trackingToken?: string;
    total?: number;
  };

  const orderNumber = stateData.orderNumber || searchParams.get('order') || null;
  const trackingToken = stateData.trackingToken || searchParams.get('token') || null;
  const total = stateData.total || (searchParams.get('total') ? parseFloat(searchParams.get('total')!) : undefined);

  // Redirect if no order data
  useEffect(() => {
    if (!orderNumber) {
      navigate(`/shop/${storeSlug}`);
    }
  }, [orderNumber, navigate, storeSlug]);

  // Clear cart ONCE after successful order confirmation
  useEffect(() => {
    if (orderNumber && !cartCleared) {
      clearCart();
      setCartCleared(true);

      // Fire confetti
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);
    }
  }, [orderNumber, cartCleared, clearCart]);

  if (!store || !orderNumber) return null;

  const trackingUrl = `${window.location.origin}/shop/${storeSlug}/track/${trackingToken}`;

  return (
    <div className="container mx-auto px-4 py-8 md:py-16 max-w-2xl">
      <div className="text-center mb-8">
        <div
          className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: `${store.primary_color}20` }}
        >
          <CheckCircle
            className="w-12 h-12"
            style={{ color: store.primary_color }}
          />
        </div>
        <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
        <p className="text-muted-foreground">
          Thank you for your order. We'll send you updates on your delivery.
        </p>
      </div>

      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground">Order Number</p>
            <p className="text-2xl font-bold" style={{ color: store.primary_color }}>
              {orderNumber}
            </p>
            {total && (
              <p className="text-lg mt-2">
                Total: <strong>{formatCurrency(total)}</strong>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 border-t border-b">
            <div className="flex flex-col items-center text-center">
              <Mail className="w-8 h-8 mb-2" style={{ color: store.primary_color }} />
              <p className="font-medium">Email Confirmation</p>
              <p className="text-sm text-muted-foreground">
                Check your inbox for order details
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <Clock className="w-8 h-8 mb-2" style={{ color: store.primary_color }} />
              <p className="font-medium">Order Processing</p>
              <p className="text-sm text-muted-foreground">
                We're preparing your order
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <MapPin className="w-8 h-8 mb-2" style={{ color: store.primary_color }} />
              <p className="font-medium">Track Delivery</p>
              <p className="text-sm text-muted-foreground">
                Get real-time updates
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Track Your Order</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={trackingUrl}
                className="flex-1 text-sm bg-background px-3 py-2 rounded border"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(trackingUrl);
                    setCopied(true);
                    toast({ title: 'Tracking link copied!' });
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    // Fallback for browsers without clipboard API
                    const textarea = document.createElement('textarea');
                    textarea.value = trackingUrl;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    setCopied(true);
                    toast({ title: 'Tracking link copied!' });
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link to={`/shop/${storeSlug}/track/${trackingToken}`} className="w-full sm:w-auto">
          <Button style={{ backgroundColor: store.primary_color }} className="w-full sm:w-auto">
            <Package className="w-4 h-4 mr-2" />
            Track Order
          </Button>
        </Link>
        <Link to={`/shop/${storeSlug}/products`} className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto">Continue Shopping</Button>
        </Link>
      </div>
    </div>
  );
}





