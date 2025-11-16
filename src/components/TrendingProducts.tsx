import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Star, Flame } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const TrendingProducts = () => {
  const { data: products, isLoading } = useQuery({
    queryKey: ["trending-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("in_stock", true)
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <section className="py-12">
        <div className="container px-4 mx-auto">
          {/* Reserve exact space to prevent layout shift */}
          <div className="flex items-center justify-between mb-8 h-[60px]">
            <div className="animate-pulse flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted"></div>
              <div>
                <div className="h-8 bg-muted rounded w-40 mb-2"></div>
                <div className="h-4 bg-muted rounded w-48"></div>
              </div>
            </div>
            <div className="h-8 bg-muted rounded w-24"></div>
          </div>
          {/* Reserve space for carousel - matches aspect-square cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-muted rounded-t-lg"></div>
                <div className="p-4 space-y-3 bg-card rounded-b-lg">
                  <div className="h-6 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-8 bg-muted rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!products || products.length === 0) return null;

  return (
    <section className="py-12">
      <div className="container px-4 mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Flame className="w-6 h-6 text-primary animate-pulse" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Trending Now</h2>
              <p className="text-white/60">Popular products this week</p>
            </div>
          </div>
          <Badge variant="outline" className="px-4 py-2 text-base">
            <TrendingUp className="w-4 h-4 mr-2" />
            Hot Picks
          </Badge>
        </div>

        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {products.map((product) => (
              <CarouselItem key={product.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                <Card className="overflow-hidden backdrop-blur-2xl transition-all duration-500 cursor-pointer relative bg-white/[0.02] border border-white/[0.05] hover:border-white/10 hover:-translate-y-3 hover:scale-[1.02] group">
                  <div className="relative aspect-square overflow-hidden">
                    <ProductImage
                      src={product.image_url || undefined}
                      alt={product.name}
                      className="aspect-square w-full h-full group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-primary/90 backdrop-blur-sm">
                        <Flame className="w-3 h-3 mr-1" />
                        New
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-lg line-clamp-1">{product.name}</h3>
                      <p className="text-sm text-muted-foreground capitalize">{product.category}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-primary text-primary" />
                        <span className="text-sm font-semibold">{product.average_rating || 5.0}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        ({product.review_count || 0} reviews)
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-2xl font-bold text-primary">
                        ${product.prices?.[0]?.price || product.price}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const productsSection = document.getElementById('products');
                          productsSection?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex" />
          <CarouselNext className="hidden md:flex" />
        </Carousel>
      </div>
    </section>
  );
};

export default TrendingProducts;
