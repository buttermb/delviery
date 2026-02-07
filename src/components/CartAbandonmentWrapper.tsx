import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import CartAbandonmentPopup from "./CartAbandonmentPopup";

const CartAbandonmentWrapper = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: cartItems = [] } = useQuery({
    queryKey: ["cart", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("cart_items")
        .select("*, products(*)")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const handleCheckout = () => {
    navigate("/checkout");
  };

  return <CartAbandonmentPopup cartItems={cartItems} onCheckout={handleCheckout} />;
};

export default CartAbandonmentWrapper;
