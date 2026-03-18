import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Zap, Leaf, Lock, DollarSign, MapPin } from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    title: "Age Verified",
    description: "Strict 21+ enforcement with ID verification at signup and delivery.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Average delivery time under 45 minutes across Brooklyn, Queens, and Manhattan.",
  },
  {
    icon: Leaf,
    title: "100% Legal",
    description: "Licensed Cannabinoid Hemp Retailer. All products comply with federal and state regulations.",
  },
  {
    icon: Lock,
    title: "Licensed Vendors",
    description: "Only verified, licensed NYC smoke shops and dispensaries on our platform.",
  },
  {
    icon: DollarSign,
    title: "Flexible Payment",
    description: "Pay with cash on delivery or cryptocurrency (Bitcoin, USDC).",
  },
  {
    icon: MapPin,
    title: "Track Your Order",
    description: "Real-time updates from order placement to doorstep delivery.",
  },
];

const Features = () => {
  return (
    <section className="py-32">
      <div className="container px-4 mx-auto">
        <div className="text-center space-y-6 mb-24">
          <h2 className="text-6xl md:text-7xl font-black uppercase tracking-wider">Why Choose Us</h2>
          <p className="text-2xl text-muted-foreground max-w-3xl mx-auto font-medium">
            Safe, legal, and convenient delivery you can trust
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={index} 
                className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-elegant hover:-translate-y-2 bg-card/50 backdrop-blur-sm p-8"
              >
                <CardHeader>
                  <div className="w-16 h-16 rounded-lg bg-gradient-primary flex items-center justify-center mb-6">
                    <Icon className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-2xl font-black uppercase tracking-wide">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-lg">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
