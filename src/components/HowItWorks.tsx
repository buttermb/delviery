import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag, Store, Truck } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const steps = [
  {
    icon: ShoppingBag,
    title: "1. Browse & Order",
    description: "Browse premium flower from licensed NYC cultivators. Add items to your cart, select your preferred weights, and proceed to checkout.",
  },
  {
    icon: Store,
    title: "2. Order Processing",
    description: "Your order is confirmed and prepared by a verified local shop. All products are lab-tested for quality and compliance. You'll receive real-time updates via SMS/email.",
  },
  {
    icon: Truck,
    title: "3. ID Check & Delivery",
    description: "Licensed courier delivers to your door within 30-60 minutes. Valid government-issued ID required - must be 21+. Payment accepted at delivery: cash, card, or crypto. Signature required upon receipt.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-16 md:py-32 bg-muted/30">
      <div className="container px-4 mx-auto">
        <div className="text-center space-y-4 md:space-y-6 mb-12 md:mb-24">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black uppercase tracking-wider">How It Works</h2>
          <p className="text-lg md:text-2xl text-muted-foreground max-w-3xl mx-auto font-medium">
            Three simple steps to get premium flower delivered
          </p>
        </div>

        {/* Mobile: Swipeable Carousel */}
        <div className="md:hidden">
          <Carousel className="w-full max-w-sm mx-auto">
            <CarouselContent>
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <CarouselItem key={index}>
                    <Card className="border-2 bg-card/50 backdrop-blur-sm">
                      <CardContent className="pt-12 pb-8 text-center space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-primary flex items-center justify-center">
                          <Icon className="w-8 h-8 text-primary-foreground" />
                        </div>
                        <div className="w-10 h-10 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-lg font-black text-primary">{index + 1}</span>
                        </div>
                        <h3 className="text-2xl font-black uppercase tracking-wide">{step.title}</h3>
                        <p className="text-muted-foreground text-base">{step.description}</p>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
          <p className="text-center text-sm text-muted-foreground mt-4">Swipe to see steps</p>
        </div>

        {/* Desktop: Grid */}
        <div className="hidden md:grid grid-cols-3 gap-12 max-w-6xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card 
                key={index} 
                className="relative overflow-hidden border-2 hover:shadow-elegant transition-all duration-300 hover:-translate-y-2 bg-card/50 backdrop-blur-sm"
              >
                <CardContent className="pt-16 pb-12 text-center space-y-6">
                  <div className="absolute top-6 right-6 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xl font-black text-primary">{index + 1}</span>
                  </div>
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-primary flex items-center justify-center">
                    <Icon className="w-10 h-10 text-primary-foreground" />
                  </div>
                  <h3 className="text-3xl font-black uppercase tracking-wide">{step.title}</h3>
                  <p className="text-muted-foreground text-lg">{step.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
