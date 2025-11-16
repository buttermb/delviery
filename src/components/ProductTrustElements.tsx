import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Package, Truck } from "lucide-react";

const ProductTrustElements = () => {
  const trustPoints = [
    { icon: Star, text: "4.8★ Average Rating", count: "10,000+ reviews" },
    { icon: Package, text: "Lab Tested", count: "All products certified" },
    { icon: Truck, text: "Fast Delivery", count: "30-min guarantee" },
  ];

  return (
    <section className="py-8 bg-black">
      <div className="container px-4 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {trustPoints.map((point, idx) => (
            <Card key={idx} className="border border-white/10 bg-neutral-900">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <point.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{point.text}</p>
                  <p className="text-xs text-muted-foreground">{point.count}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductTrustElements;
