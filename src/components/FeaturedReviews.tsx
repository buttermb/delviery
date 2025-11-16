import { Star, User, ThumbsUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const mockReviews = [
  {
    id: "1",
    rating: 5,
    comment: "Amazing quality! The delivery was super fast and discreet. Will definitely order again.",
    product: { name: "Gelato-41 Flower", category: "flower" }
  },
  {
    id: "2",
    rating: 5,
    comment: "Best flower in NYC. Customer service was excellent and the quality is exactly as advertised.",
    product: { name: "Premium Vape Cart", category: "vapes" }
  },
  {
    id: "3",
    rating: 5,
    comment: "Quick delivery, great packaging, and the effects are phenomenal. Highly recommend!",
    product: { name: "Live Resin Sugar", category: "concentrates" }
  },
  {
    id: "4",
    rating: 4,
    comment: "Really impressed with the quality and the professionalism. Will be a repeat customer.",
    product: { name: "OG Kush Premium", category: "flower" }
  },
  {
    id: "5",
    rating: 5,
    comment: "Perfect for my needs. The lab testing gives me peace of mind. Five stars!",
    product: { name: "Premium Gummies", category: "edibles" }
  },
  {
    id: "6",
    rating: 5,
    comment: "Fast, reliable, and top-quality products. The best flower delivery service in NYC!",
    product: { name: "Wedding Cake Premium", category: "flower" }
  },
];

const FeaturedReviews = () => {
  return (
    <section className="py-20 bg-gradient-to-b from-background to-card/30">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 text-primary border-primary/50">
            Customer Reviews
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            What Our Customers Say
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Real reviews from real customers who love our premium products
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockReviews.map((review) => (
            <Card key={review.id} className="p-6 hover:shadow-elegant transition-all hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-4">
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <User className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">Verified Customer</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {review.product.category} Customer
                  </p>
                </div>
                <Badge variant="outline" className="bg-primary/5">
                  Verified
                </Badge>
              </div>

              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < review.rating
                        ? "fill-primary text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                ))}
              </div>

              <p className="text-sm text-foreground mb-4">
                {review.comment}
              </p>

              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  {review.product.name}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ThumbsUp className="w-3 h-3" />
                  <span>Helpful</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-6 py-3 rounded-full">
            <Star className="w-5 h-5 fill-primary" />
            <span className="font-bold text-lg">4.9/5 Average Rating</span>
            <span className="text-sm">from 1,000+ reviews</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturedReviews;
