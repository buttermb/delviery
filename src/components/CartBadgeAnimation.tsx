import { useEffect, useState } from 'react';
import { ShoppingCart, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestCart } from '@/hooks/useGuestCart';

export function CartBadgeAnimation() {
  const { user } = useAuth();
  const { getGuestCartCount } = useGuestCart();
  const [showAnimation, setShowAnimation] = useState(false);
  const [prevCount, setPrevCount] = useState(0);

  const { data: cartItems = [] } = useQuery({
    queryKey: ["cart", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("cart_items")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const dbCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const guestCartCount = user ? 0 : getGuestCartCount();
  const cartCount = user ? dbCartCount : guestCartCount;

  useEffect(() => {
    if (cartCount > prevCount && prevCount > 0) {
      setShowAnimation(true);
      setTimeout(() => setShowAnimation(false), 1500);
    }
    setPrevCount(cartCount);
  }, [cartCount]);

  if (!showAnimation) return null;

  return (
    <div className="fixed top-20 right-4 md:right-8 z-[100] pointer-events-none">
      <div className="bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-5 duration-300">
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
          <Check className="w-5 h-5 animate-bounce" />
        </div>
        <div>
          <div className="font-bold">Added to Cart!</div>
          <div className="text-xs opacity-90">{cartCount} {cartCount === 1 ? 'item' : 'items'} total</div>
        </div>
        <ShoppingCart className="w-5 h-5 animate-bounce" />
      </div>
    </div>
  );
}
