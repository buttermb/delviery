import { CreditCard } from "lucide-react";
import { ComingSoonPlaceholder } from "@/components/shared/ComingSoonPlaceholder";

export function PaymentGatewaySettings() {
  return (
    <ComingSoonPlaceholder
      title="Payment Gateway Configuration"
      description="Configure multiple payment gateways and toggle between test and live modes."
      icon={CreditCard}
    />
  );
}
