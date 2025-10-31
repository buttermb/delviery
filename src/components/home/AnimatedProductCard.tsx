import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/utils/haptics";
import { motion } from "framer-motion";

interface AnimatedProductCardProps {
  product: any;
  onAddToCart: () => void;
  onQuickView: () => void;
}

export function AnimatedProductCard({ product, onAddToCart, onQuickView }: AnimatedProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleAddToCart = () => {
    haptics.success();
    onAddToCart();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ duration: 0.3 }}
      onHoverStart={() => {
        setIsHovered(true);
        haptics.light();
      }}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card className={cn(
        "group relative overflow-hidden border-2 transition-all duration-300 cursor-pointer",
        isHovered && "border-primary shadow-2xl shadow-primary/20"
      )}>
        {/* Trending Badge */}
        {product.average_rating >= 4.5 && (
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="absolute top-3 left-3 z-10"
          >
            <Badge className="bg-gradient-to-r from-primary to-primary/80 gap-1">
              <Zap className="w-3 h-3" />
              Trending
            </Badge>
          </motion.div>
        )}

        {/* Image Container */}
        <div 
          className="relative h-64 overflow-hidden bg-muted"
          onClick={onQuickView}
        >
          <motion.img
            src={product.image_url || "/placeholder.svg"}
            alt={product.name}
            className="w-full h-full object-cover"
            animate={{
              scale: isHovered ? 1.1 : 1,
            }}
            transition={{ duration: 0.4 }}
          />
          
          {/* Overlay on hover */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end justify-center pb-6"
          >
            <Button 
              variant="secondary" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onQuickView();
              }}
            >
              Quick View
            </Button>
          </motion.div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          {/* Rating */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-primary text-primary" />
              <span className="text-sm font-semibold">{product.average_rating?.toFixed(1) || "5.0"}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              ({product.review_count || 0} reviews)
            </span>
          </div>

          {/* Title */}
          <h3 className="font-bold text-lg line-clamp-2 min-h-[3.5rem]">
            {product.name}
          </h3>

          {/* Category */}
          <Badge variant="outline" className="text-xs">
            {product.category}
          </Badge>

          {/* Price and CTA */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="text-2xl font-black text-primary">
                ${product.price}
              </span>
              {product.prices && Object.keys(product.prices).length > 1 && (
                <span className="text-xs text-muted-foreground ml-1">+</span>
              )}
            </div>
            
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                size="lg"
                onClick={handleAddToCart}
                className="gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Add
              </Button>
            </motion.div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
