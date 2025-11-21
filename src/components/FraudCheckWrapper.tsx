import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/utils/logger";

interface FraudCheckWrapperProps {
  children: React.ReactNode;
  orderId?: string;
  orderTotal?: number;
  onFraudDetected?: () => void;
}

export function FraudCheckWrapper({ 
  children, 
  orderId, 
  orderTotal,
  onFraudDetected 
}: FraudCheckWrapperProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const checkFraud = async () => {
      if (!orderId || !orderTotal) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase.functions.invoke("check-order-fraud", {
          body: { orderId, userId: user.id, orderTotal },
        });

        if (error) {
          logger.error("Fraud check function error", error, { component: 'FraudCheckWrapper' });
          // Continue processing if fraud check fails - don't block legitimate orders
          return;
        }

        // Check for error in response body (some edge functions return 200 with error)
        if (data && typeof data === 'object' && 'error' in data && data.error) {
          const errorMessage = typeof data.error === 'string' ? data.error : 'Fraud check failed';
          logger.error("Fraud check returned error in response", { error: errorMessage, component: 'FraudCheckWrapper' });
          // Continue processing if fraud check fails - don't block legitimate orders
          return;
        }

        if (data && !data.allowed) {
          toast.error(data.message || "Order blocked due to fraud risk");
          if (onFraudDetected) {
            onFraudDetected();
          } else {
            navigate("/");
          }
        } else if (data && data.flags && data.flags.length > 0) {
          toast.warning("Your order has been flagged for review");
        }
      } catch (error: unknown) {
        logger.error("Fraud check error", error, { component: 'FraudCheckWrapper' });
        // Continue processing if fraud check fails
      }
    };

    checkFraud();
  }, [orderId, orderTotal, navigate, onFraudDetected]);

  return <>{children}</>;
}