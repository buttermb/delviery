import { Shield, Award, Clock, Package, Users, Star, Lock, CheckCircle } from "lucide-react";

const TrustBadges = () => {
  const badges = [
    {
      icon: Shield,
      title: "Licensed Hemp Retailer",
      description: "NY State Compliant",
      stat: "100% Legal"
    },
    {
      icon: Award,
      title: "Lab-Tested Quality",
      description: "Potency & Purity",
      stat: "COA Verified"
    },
    {
      icon: Clock,
      title: "30min Delivery",
      description: "All 5 Boroughs",
      stat: "On-Time Guarantee"
    },
    {
      icon: Package,
      title: "Discreet Packaging",
      description: "Private & Secure",
      stat: "100% Privacy"
    },
    {
      icon: Users,
      title: "10,000+ Customers",
      description: "Join Our Community",
      stat: "5-Star Rated"
    },
    {
      icon: Lock,
      title: "Secure Checkout",
      description: "SSL Encrypted",
      stat: "Safe Payments"
    },
    {
      icon: Star,
      title: "Premium Quality",
      description: "Top-Shelf Products",
      stat: "Satisfaction Guaranteed"
    },
    {
      icon: CheckCircle,
      title: "Age Verified",
      description: "21+ Only",
      stat: "ID Required"
    },
  ];

  return (
    <section className="py-16 bg-gradient-to-b from-card/30 to-background border-y border-border">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Why Choose Us?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Join thousands of satisfied customers who trust us for premium delivery
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {badges.map((badge, index) => {
            const Icon = badge.icon;
            return (
              <div
                key={index}
                className="group relative flex flex-col items-center text-center gap-3 p-6 rounded-xl bg-card/50 hover:bg-card border-2 border-transparent hover:border-primary/50 transition-all hover:shadow-elegant hover:-translate-y-1"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-primary/20 group-hover:bg-gradient-primary/30 flex items-center justify-center transition-all group-hover:scale-110">
                  <Icon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="font-black text-sm uppercase tracking-wide mb-1">{badge.title}</p>
                  <p className="text-xs text-muted-foreground mb-2">{badge.description}</p>
                  <span className="inline-block text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                    {badge.stat}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-6 py-3 rounded-full font-semibold">
            <Shield className="w-5 h-5" />
            <span>30-Day Money-Back Guarantee • Free Shipping on All Orders</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustBadges;
