/**
 * Product Info
 * Product name, price, strain info, add-to-cart, effects, and trust indicators
 */

import { useState } from 'react';

import type { ProductDetails } from '@/pages/shop/product-detail/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  Minus,
  Plus,
  Star,
  Truck,
  Shield,
  RotateCcw,
  Loader2,
  Moon,
  Smile,
  Zap,
  Target,
  Lightbulb,
  Activity,
  Sun,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface ProductInfoProps {
  product: ProductDetails;
  averageRating: number;
  reviewCount: number;
  isLuxuryTheme: boolean;
  onAddToCart: (quantity: number, variant: string | null) => void;
  isAddingToCart: boolean;
}

export function ProductInfo({
  product,
  averageRating,
  reviewCount,
  isLuxuryTheme,
  onAddToCart,
  isAddingToCart,
}: ProductInfoProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  const handleAddToCart = () => {
    onAddToCart(quantity, selectedVariant);
  };

  return (
    <div className="lg:col-span-5 relative">
      <div className="sticky top-24 space-y-8">
        {/* Glassmorphism Details Card */}
        <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-8 backdrop-blur-xl ${isLuxuryTheme ? 'bg-white/5 border border-white/10' : 'bg-card border'}`}>
          {/* Brand & Category */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {product.brand && (
                <span className="text-sm font-medium tracking-widest uppercase text-white/50">
                  {product.brand}
                </span>
              )}
              {product.strain_type && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <Badge variant="outline" className={`border-white/10 bg-white/5 ${product.strain_type.toLowerCase() === 'sativa' ? 'text-yellow-400' :
                    product.strain_type.toLowerCase() === 'indica' ? 'text-purple-400' : 'text-emerald-400'
                    }`}>
                    {product.strain_type}
                  </Badge>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className={`text-sm font-medium ${isLuxuryTheme ? 'text-white' : ''}`}>{averageRating.toFixed(1)}</span>
              <span className={`text-xs ${isLuxuryTheme ? 'text-white/40' : 'text-muted-foreground'}`}>({reviewCount})</span>
            </div>
          </div>

          {/* Title */}
          <h1 className={`text-2xl sm:text-4xl md:text-5xl font-light tracking-tight mb-4 leading-tight ${isLuxuryTheme ? 'text-white' : ''}`}>
            {product.name}
          </h1>

          {/* Short Description */}
          {product.short_description && (
            <p className={`text-sm sm:text-lg leading-relaxed mb-4 sm:mb-6 ${isLuxuryTheme ? 'text-white/60' : 'text-muted-foreground'}`}>
              {product.short_description}
            </p>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3 sm:gap-4 mb-4 sm:mb-6">
            <span className="text-2xl sm:text-3xl font-medium text-emerald-400">
              {formatCurrency(product.display_price)}
            </span>
            {product.compare_at_price && (
              <span className={`text-base sm:text-lg line-through ${isLuxuryTheme ? 'text-white/30 decoration-white/30' : 'text-muted-foreground'}`}>
                {formatCurrency(product.compare_at_price)}
              </span>
            )}
          </div>

          {/* THC/CBD Content */}
          {(product.thc_content !== null || product.cbd_content !== null) && (
            <div className="flex items-center gap-4 mb-6">
              {product.thc_content !== null && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLuxuryTheme ? 'bg-white/5 border border-white/10' : 'bg-muted'}`}>
                  <span className={`text-xs uppercase tracking-wider font-medium ${isLuxuryTheme ? 'text-white/50' : 'text-muted-foreground'}`}>THC</span>
                  <span className={`text-sm font-bold ${isLuxuryTheme ? 'text-emerald-400' : 'text-foreground'}`}>{product.thc_content}%</span>
                </div>
              )}
              {product.cbd_content !== null && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLuxuryTheme ? 'bg-white/5 border border-white/10' : 'bg-muted'}`}>
                  <span className={`text-xs uppercase tracking-wider font-medium ${isLuxuryTheme ? 'text-white/50' : 'text-muted-foreground'}`}>CBD</span>
                  <span className={`text-sm font-bold ${isLuxuryTheme ? 'text-blue-400' : 'text-foreground'}`}>{product.cbd_content}%</span>
                </div>
              )}
            </div>
          )}

          {/* Stock Status */}
          <div className="mb-6">
            {product.in_stock ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className={`text-sm ${isLuxuryTheme ? 'text-emerald-400' : 'text-green-600'}`}>In Stock</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className={`text-sm ${isLuxuryTheme ? 'text-red-400' : 'text-red-600'}`}>Out of Stock</span>
              </div>
            )}
          </div>

          <Separator className={isLuxuryTheme ? "bg-white/10 mb-8" : "mb-8"} />

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="mb-8 space-y-4">
              <span className={`text-sm uppercase tracking-widest font-medium ${isLuxuryTheme ? 'text-white/50' : 'text-muted-foreground'}`}>Select Option</span>
              <div className="flex flex-wrap gap-3">
                {product.variants.map((variant) => {
                  const variantName = variant;
                  return (
                    <button
                      key={variantName}
                      onClick={() => setSelectedVariant(variantName)}
                      className={`px-6 py-3 rounded-xl border transition-all duration-300 text-sm font-medium ${selectedVariant === variantName
                        ? 'bg-white text-black border-white scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                        : 'bg-transparent text-white/70 border-white/10 hover:border-white/30 hover:bg-white/5'
                        }`}
                    >
                      {variantName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add To Cart Actions */}
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`flex items-center rounded-xl border p-1 ${isLuxuryTheme ? 'bg-black/30 border-white/10' : 'bg-muted'}`}>
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${isLuxuryTheme ? 'hover:bg-white/10 text-white' : 'hover:bg-background'
                    }`}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className={`w-12 text-center text-lg font-medium ${isLuxuryTheme ? 'text-white' : ''}`}>{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${isLuxuryTheme ? 'hover:bg-white/10 text-white' : 'hover:bg-background'
                    }`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddToCart}
                  disabled={!product.in_stock || isAddingToCart}
                  className={`w-full py-3 sm:py-4 rounded-xl font-medium text-base sm:text-lg flex items-center justify-center gap-2 sm:gap-3 transition-all relative overflow-hidden group ${!product.in_stock
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : isLuxuryTheme
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                >
                  {isAddingToCart ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      {product.in_stock ? 'Add to Bag' : 'Out of Stock'}
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>

          {/* Effects Badges */}
          {product.effects && product.effects.length > 0 && (
            <EffectsBadges effects={product.effects} />
          )}

          {/* Trust Indicators */}
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/10">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <Truck className="w-4 h-4 text-white/60" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/40">Fast Delivery</span>
            </div>
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white/60" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/40">Secure</span>
            </div>
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <RotateCcw className="w-4 h-4 text-white/60" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/40">Returns</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/** Effects badges with dynamic icon mapping */
function EffectsBadges({ effects }: { effects: string[] }) {
  return (
    <div className="mt-8 pt-6 border-t border-white/10">
      <div className="flex flex-wrap gap-4">
        {effects.map((effect) => {
          const iconName = effect.toLowerCase();
          let IconComponent = Activity;

          if (iconName.includes('sleep') || iconName.includes('night')) IconComponent = Moon;
          else if (iconName.includes('happy') || iconName.includes('mood')) IconComponent = Smile;
          else if (iconName.includes('energy') || iconName.includes('uplift')) IconComponent = Zap;
          else if (iconName.includes('relax') || iconName.includes('calm')) IconComponent = Sun;
          else if (iconName.includes('focus')) IconComponent = Target;
          else if (iconName.includes('creat')) IconComponent = Lightbulb;

          return (
            <div key={effect} className="flex flex-col items-center gap-2 group">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-colors">
                <IconComponent className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-xs uppercase tracking-wider text-white/40 font-medium">{effect}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
