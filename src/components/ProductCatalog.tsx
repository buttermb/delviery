import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import ProductCard from "./ProductCard";
import MobileSearch from "./MobileSearch";
import { Loader2, Leaf, Cookie, Droplets, Cigarette, Wind, ChevronRight, ChevronLeft, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInventoryBatch } from "@/hooks/useInventoryBatch";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import type { Product } from "@/types/product";

const INITIAL_CATEGORIES_TO_SHOW = 2;

const ProductCatalog = () => {
  const queryClient = useQueryClient();
  const [showAllCategories, setShowAllCategories] = useState(false);
  const isMobile = useIsMobile();
  
  // Persistent search query that remembers between sessions
  const [searchQuery, setSearchQuery] = useLocalStorageState("product-catalog-search", "");
  
  // Premium filter state
  const [premiumFilter, setPremiumFilter] = useState(false);

  // Realtime subscription for product updates
  useEffect(() => {
    const channel = supabase
      .channel('product-catalog-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        (payload) => {
          console.log('Product updated:', payload);
          queryClient.invalidateQueries({ queryKey: ["products"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch all products with batch inventory
  const { data: allProducts = [], isLoading, error, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("in_stock", true);
      if (error) throw error;
      return data;
    },
  });

  // Batch fetch inventory for all products
  const productIds = allProducts.map(p => p.id);
  const { data: inventoryMap = {} } = useInventoryBatch(productIds);

  // Listen for filter events from hero button
  useEffect(() => {
    const handleFilterEvent = (e: CustomEvent) => {
      if (e.detail?.filter === 'premium') {
        setPremiumFilter(true);
      }
    };
    
    const savedFilter = localStorage.getItem('productFilter');
    if (savedFilter === 'premium') {
      setPremiumFilter(true);
    }
    
    window.addEventListener('setProductFilter', handleFilterEvent as EventListener);
    return () => window.removeEventListener('setProductFilter', handleFilterEvent as EventListener);
  }, []);

  // Filter products by search and premium
  let filteredProducts = searchQuery
    ? allProducts.filter((p) => {
        const query = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.vendor_name?.toLowerCase().includes(query)
        );
      })
    : allProducts;
  
  // Apply premium filter (products with higher price or premium indicator)
  if (premiumFilter) {
    filteredProducts = filteredProducts.filter((p) => {
      const price = typeof p.price === 'number' ? p.price : parseFloat(p.price);
      // Consider products over $40 as premium
      return price >= 40 || p.description?.toLowerCase().includes('premium') || p.vendor_name?.toLowerCase().includes('premium');
    });
  }

  // Group products by category
  const productsByCategory = {
    flower: filteredProducts.filter((p) => p.category === "flower"),
    edibles: filteredProducts.filter((p) => p.category === "edibles"),
    "pre-rolls": filteredProducts.filter((p) => p.category === "pre-rolls"),
    concentrates: filteredProducts.filter((p) => p.category === "concentrates"),
    vapes: filteredProducts.filter((p) => p.category === "vapes"),
  };

  const categories = [
    { key: "flower", label: "Flower", icon: Leaf, desc: "Premium indoor-grown flower" },
    { key: "edibles", label: "Edibles", icon: Cookie, desc: "Delicious edibles" },
    { key: "pre-rolls", label: "Pre-Rolls", icon: Cigarette, desc: "Convenient & ready" },
    { key: "concentrates", label: "Concentrates", icon: Droplets, desc: "High-potency extracts" },
    { key: "vapes", label: "Vapes", icon: Wind, desc: "Smooth vapor experience" },
  ];

  // Scroll helper
  const scrollContainerRef = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const scroll = (categoryKey: string, direction: 'left' | 'right') => {
    const container = scrollContainerRef.current[categoryKey];
    if (!container) return;
    
    const scrollAmount = direction === 'left' ? -400 : 400;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  return (
    <section id="products" className="py-16 md:py-32 bg-gradient-subtle overflow-hidden">
      <div className="container px-4 mx-auto max-w-full">
        <div className="text-center space-y-4 md:space-y-6 mb-12 md:mb-20">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black uppercase tracking-wider">Shop Premium Flower</h2>
          <p className="text-lg md:text-2xl text-muted-foreground max-w-3xl mx-auto font-medium">
            Premium indoor-grown flower from licensed NYC cultivators
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-12">
          <MobileSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search products, strains, vendors..."
            className={isMobile ? "" : "relative"}
          />
        </div>
        
        {/* Premium Filter Toggle */}
        <div className="flex justify-center mb-8">
          <Button
            variant={premiumFilter ? "default" : "outline"}
            onClick={() => {
              setPremiumFilter(!premiumFilter);
              localStorage.setItem('productFilter', !premiumFilter ? 'premium' : 'all');
            }}
            className={premiumFilter ? "bg-emerald-500 text-white hover:bg-emerald-600" : "border-white/30 text-white hover:bg-white/5"}
          >
            {premiumFilter ? "✓ Premium Only" : "Show Premium Only"}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-muted/30 rounded-lg p-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-2xl font-semibold text-center">Unable to Load Products</h3>
            <p className="text-muted-foreground text-center max-w-md">
              We're having trouble loading our product catalog. Please try refreshing the page.
            </p>
            <Button
              size="lg"
              onClick={() => refetch()}
            >
              Retry Loading
            </Button>
          </div>
        ) : (
          <div className="space-y-12 md:space-y-16">
            {categories
              .slice(0, showAllCategories ? categories.length : INITIAL_CATEGORIES_TO_SHOW)
              .map((category) => {
              const products = productsByCategory[category.key as keyof typeof productsByCategory];
              if (products.length === 0) return null;

              const Icon = category.icon;

              return (
                <div key={category.key} id={category.key} className="space-y-4 md:space-y-6 scroll-mt-24">
                  {/* Category Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-2xl md:text-3xl font-bold">{category.label}</h3>
                        <p className="text-sm text-muted-foreground">{category.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 rounded-full hidden md:flex"
                        onClick={() => scroll(category.key, 'left')}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 rounded-full hidden md:flex"
                        onClick={() => scroll(category.key, 'right')}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Horizontal Scrollable Product Row */}
                  <div className="relative group -mx-4 md:mx-0">
                    {/* Desktop scroll buttons */}
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/95 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
                      onClick={() => scroll(category.key, 'left')}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/95 backdrop-blur-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
                      onClick={() => scroll(category.key, 'right')}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>

                    <div 
                      ref={(el) => scrollContainerRef.current[category.key] = el}
                      className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-4 snap-x snap-mandatory px-4 md:px-0"
                      style={{ 
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        WebkitOverflowScrolling: 'touch',
                        overscrollBehaviorX: 'contain'
                      }}
                    >
                      {products.map((product) => (
                      <div 
                        key={product.id} 
                        className="w-[280px] md:w-[320px] flex-shrink-0 snap-start snap-always"
                      >
                          <ProductCard product={product as Product} stockLevel={inventoryMap[product.id]} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {!showAllCategories && categories.length > INITIAL_CATEGORIES_TO_SHOW && (
              <div className="flex justify-center pt-8">
                <Button 
                  size="lg"
                  onClick={() => setShowAllCategories(true)}
                  className="px-8"
                >
                  Show More Categories
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductCatalog;
