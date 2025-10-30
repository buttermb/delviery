import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CustomerLayout from '@/layouts/CustomerLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function TrackOrder() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [trackingCode, setTrackingCode] = useState(code || '');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (code) {
      fetchOrder(code);
      const interval = setInterval(() => fetchOrder(code), 15000);
      return () => clearInterval(interval);
    }
  }, [code]);

  const fetchOrder = async (orderCode: string) => {
    setLoading(true);
    try {
      // Use secure tracking function instead of direct query
      const { data, error } = await supabase
        .rpc('get_order_by_tracking_code', { code: orderCode.toUpperCase() });

      if (error) throw error;
      
      if (!data) {
        throw new Error('Order not found');
      }
      
      // Parse the jsonb result (type cast for safety)
      const orderData = data as any;
      
      // Transform to match expected format
      const transformedData = {
        ...orderData,
        merchants: orderData.merchant,
        couriers: orderData.courier,
        order_items: orderData.order_items || []
      };
      
      setOrder(transformedData);
    } catch (error) {
      toast({
        title: "Order not found",
        description: "Please check your tracking code and try again",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTrack = () => {
    if (!trackingCode.trim()) {
      toast({
        title: "Enter tracking code",
        description: "Please enter your tracking code",
        variant: "destructive"
      });
      return;
    }
    navigate(`/track/${trackingCode.toUpperCase()}`);
  };

  const getStatusStep = (status: string) => {
    const steps = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
    return steps.indexOf(status);
  };

  // Search form view (no code in URL)
  if (!code) {
    return (
      <CustomerLayout showBackHome={true}>
        <section className="py-32 bg-black relative overflow-hidden">
          
          {/* Ambient background */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-1/2 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
          </div>
          
          <div className="container mx-auto px-6 relative z-10">
            <div className="max-w-2xl mx-auto">
              
              {/* Header */}
              <div className="text-center mb-16">
                <div className="inline-block px-4 py-1.5 mb-6 bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-full">
                  <span className="text-[10px] text-white/50 font-light tracking-[0.2em] uppercase">
                    Order Tracking
                  </span>
                </div>
                
                <h1 className="text-white font-light text-6xl tracking-tight mb-6">
                  Track Your Order
                </h1>
                
                <p className="text-white/40 text-lg font-light leading-relaxed">
                  Enter your order number to see real-time delivery status
                </p>
              </div>
              
              {/* Search Form */}
              <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8 mb-8">
                
                <div className="mb-6">
                  <label className="block text-white/60 text-sm font-light mb-3">
                    Order Number
                  </label>
                  <Input
                    type="text"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                    placeholder="e.g., NYM-12345"
                    maxLength={13}
                    className="w-full px-6 py-4 bg-white/[0.02] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-colors font-light font-mono text-center text-lg"
                  />
                </div>
                
                <Button 
                  onClick={handleTrack} 
                  className="w-full px-8 py-4 bg-emerald-500 text-black text-sm font-light tracking-wide rounded-xl hover:bg-emerald-400 transition-all duration-300"
                  disabled={!trackingCode.trim()}
                >
                  Track Order
                </Button>
                
              </div>
              
              {/* Help Text */}
              <div className="text-center">
                <p className="text-white/40 text-sm font-light mb-4">
                  Order number sent to your email after purchase
                </p>
                <a href="/support" className="text-emerald-500 text-sm font-light hover:text-emerald-400 transition-colors">
                  Need help? Contact Support →
                </a>
              </div>
              
            </div>
          </div>
          
        </section>
      </CustomerLayout>
    );
  }

  // Loading state
  if (loading && !order) {
    return (
      <CustomerLayout showBackHome={true}>
        <section className="py-32 bg-black relative overflow-hidden">
          <div className="container mx-auto px-6">
            <div className="text-center">
              <div className="w-16 h-16 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white/60 font-light">Loading order...</p>
            </div>
          </div>
        </section>
      </CustomerLayout>
    );
  }

  if (!order) return null;

  const currentStep = getStatusStep(order.status);
  const steps = [
    { label: 'Placed', status: 'pending' },
    { label: 'Confirmed', status: 'confirmed' },
    { label: 'Preparing', status: 'preparing' },
    { label: 'Out for Delivery', status: 'out_for_delivery' },
    { label: 'Delivered', status: 'delivered' }
  ];

  // Order details view (code in URL, order loaded)
  return (
    <CustomerLayout showBackHome={true}>
      <section className="py-32 bg-black relative overflow-hidden">
        
        {/* Ambient background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/2 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-2xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8 mb-8">
              <div className="text-center">
                <h1 className="text-white font-light text-4xl tracking-tight mb-2">Order Tracking</h1>
                <p className="text-emerald-500 font-mono text-2xl">{order.tracking_code}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
              <div className="relative">
                {/* Line */}
                <div className="absolute top-5 left-0 right-0 h-[1px] bg-white/10">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` } as React.CSSProperties}
                  />
                </div>
                
                {/* Steps */}
                <div className="relative flex justify-between">
                  {steps.map((step, index) => (
                    <div key={step.status} className="flex flex-col items-center">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center font-light text-sm
                        transition-all duration-300 z-10
                        ${index <= currentStep 
                          ? 'bg-emerald-500 text-black' 
                          : 'bg-white/10 text-white/30'
                        }
                      `}>
                        {index <= currentStep ? '✓' : index + 1}
                      </div>
                      <p className={`
                        text-xs mt-2 text-center max-w-[80px] font-light
                        ${index <= currentStep ? 'text-white' : 'text-white/30'}
                      `}>
                        {step.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Current Status */}
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
              <h2 className="text-white text-xl font-light mb-4">Current Status</h2>
              <div className="flex items-center gap-4">
                <div className="text-4xl">
                  {order.status === 'pending' && '📝'}
                  {order.status === 'confirmed' && '✅'}
                  {order.status === 'preparing' && '👨‍🍳'}
                  {order.status === 'out_for_delivery' && '🚗'}
                  {order.status === 'delivered' && '🎉'}
                </div>
                <div>
                  <p className="font-light text-lg text-white capitalize">
                    {(order.status || 'pending').replace('_', ' ')}
                  </p>
                  {order.estimated_delivery && (
                    <p className="text-sm text-white/40 font-light">
                      ETA: {new Date(order.estimated_delivery).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Restaurant Info */}
            {order.merchants && (
              <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h3 className="text-white font-light mb-3">📦 Pickup From</h3>
                <p className="text-white font-light text-lg mb-1">{order.merchants.business_name}</p>
                <p className="text-sm text-white/40 font-light">{order.merchants.address}</p>
              </div>
            )}

            {/* Delivery Address */}
            {order.addresses && (
              <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h3 className="text-white font-light mb-3">📍 Delivery To</h3>
                <p className="text-white font-light text-lg mb-1">{order.addresses.street}</p>
                <p className="text-sm text-white/40 font-light">
                  {order.addresses.city}, {order.addresses.state} {order.addresses.zip_code}
                </p>
              </div>
            )}

            {/* Courier Info */}
            {order.couriers && (
              <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h3 className="text-white font-light mb-3">🚗 Your Courier</h3>
                <p className="text-white font-light text-lg mb-1">{order.couriers.full_name}</p>
                <p className="text-sm text-white/40 font-light mb-3">{order.couriers.vehicle_type}</p>
                {order.couriers.phone && (
                  <Button 
                    variant="outline" 
                    className="mt-3 border-white/10 text-white hover:bg-white/5" 
                    asChild
                  >
                    <a href={`tel:${order.couriers.phone}`}>📞 Call Courier</a>
                  </Button>
                )}
              </div>
            )}

            {/* Order Items */}
            {order.order_items && order.order_items.length > 0 && (
              <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h3 className="text-white font-light mb-6">📋 Your Items</h3>
                <div className="space-y-4">
                  {order.order_items.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center pb-4 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-white font-light">{item.products?.name || item.product_name}</p>
                        <p className="text-sm text-white/40 font-light">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-white font-light">${item.price}</p>
                    </div>
                  ))}
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <div className="flex justify-between items-center font-light text-lg text-white">
                      <span>Total</span>
                      <span>${order.total_amount}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Auto-refresh notice */}
            <p className="text-center text-sm text-white/30 font-light">
              This page refreshes automatically every 15 seconds
            </p>
          </div>
        </div>
        
      </section>
    </CustomerLayout>
  );
}
