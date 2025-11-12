import { Shield, Truck, RotateCcw, Star } from "lucide-react";

const TrustBanner = () => {
  const trustSignals = [
    { icon: Truck, text: "Free Shipping" },
    { icon: Shield, text: "Secure Checkout" },
    { icon: RotateCcw, text: "Easy Returns" },
    { icon: Star, text: "4.9★ Reviews" },
  ];

  return (
    <div className="bg-gradient-to-r from-background via-muted to-background text-foreground border-b border-border">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-8 flex-wrap">
          {trustSignals.map((signal, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <signal.icon className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{signal.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrustBanner;
