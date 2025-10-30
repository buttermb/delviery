import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "./ProductCard";
import { Sparkles } from "lucide-react";

interface ProductRecommendationsProps {
  currentProductId?: string;
  category?: string;
  limit?: number;
}

const ProductRecommendations = ({ 
  currentProductId, 
  category, 
  limit = 4 
}: ProductRecommendationsProps) => {
  const { data: products = [] } = useQuery({
    queryKey: ["recommendations", currentProductId, category],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .eq("in_stock", true);

      if (currentProductId) {
        query = query.neq("id", currentProductId);
      }

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query
        .order("average_rating", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
  });

  if (products.length === 0) return null;

  return (
    <section className="py-16 bg-background">
      <div className="container px-4 mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Sparkles className="w-8 h-8 text-primary animate-pulse" />
          <h2 className="text-3xl md:text-4xl font-bold">You Might Also Like</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductRecommendations;
