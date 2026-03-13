/**
 * Storefront Product Detail Page Component
 * Shows product details with image, price, description, strain info, and add-to-cart
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Minus, Plus, Leaf, Info, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import ProductImage from '@/components/ProductImage';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface ProductDetailData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  strain_type: string | null;
  thc_content: number | null;
  cbd_content: number | null;
  image_url: string | null;
  stock_quantity: number;
  sku: string | null;
  effects: string[] | null;
  terpenes: string[] | null;
  vendor: string | null;
}

interface ProductDetailPageProps {
  product: ProductDetailData;
  storeSlug: string;
  onAddToCart: (productId: string, quantity: number) => void;
  isInCart?: boolean;
  cartQuantity?: number;
}

export default function ProductDetailPage({
  product,
  storeSlug,
  onAddToCart,
  isInCart = false,
  cartQuantity = 0,
}: ProductDetailPageProps) {
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const isOutOfStock = product.stock_quantity <= 0;
  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;

  const handleAddToCart = () => {
    if (isOutOfStock) {
      toast.error('Product is out of stock');
      return;
    }

    if (quantity > product.stock_quantity) {
      toast.error(`Only ${product.stock_quantity} units available`);
      return;
    }

    onAddToCart(product.id, quantity);
    toast.success(`Added ${quantity} ${quantity === 1 ? 'unit' : 'units'} to cart`);
  };

  const handleQuantityChange = (delta: number) => {
    const newQty = quantity + delta;
    if (newQty < 1) return;
    if (newQty > product.stock_quantity) {
      toast.warning(`Only ${product.stock_quantity} units available`);
      return;
    }
    setQuantity(newQty);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Back Button */}
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/store/${storeSlug}/menu`)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Menu
          </Button>
        </div>
      </div>

      {/* Product Detail */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Section */}
          <div className="space-y-4">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
              <ProductImage
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {isOutOfStock && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    Out of Stock
                  </Badge>
                </div>
              )}
              {isLowStock && !isOutOfStock && (
                <div className="absolute top-4 right-4">
                  <Badge variant="destructive">Only {product.stock_quantity} left</Badge>
                </div>
              )}
            </div>

            {/* Quick Info */}
            <Card className="p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {product.category && (
                  <div>
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium">{product.category}</p>
                  </div>
                )}
                {product.strain_type && (
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <Badge variant="outline" className="mt-1">
                      <Leaf className="h-3 w-3 mr-1" />
                      {product.strain_type}
                    </Badge>
                  </div>
                )}
                {product.thc_content !== null && (
                  <div>
                    <p className="text-muted-foreground">THC</p>
                    <p className="font-medium">{product.thc_content}%</p>
                  </div>
                )}
                {product.cbd_content !== null && (
                  <div>
                    <p className="text-muted-foreground">CBD</p>
                    <p className="font-medium">{product.cbd_content}%</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Details Section */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{product.name}</h1>
              {product.sku && (
                <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-primary">
                {formatCurrency(product.price)}
              </span>
              <span className="text-muted-foreground">per unit</span>
            </div>

            {/* Description */}
            {product.description && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Description
                </h2>
                <div
                  className={cn(
                    'text-muted-foreground leading-relaxed',
                    !showFullDescription && 'line-clamp-4'
                  )}
                >
                  {product.description}
                </div>
                {product.description.length > 200 && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowFullDescription(!showFullDescription)}
                    className="px-0"
                  >
                    {showFullDescription ? 'Show less' : 'Read more'}
                  </Button>
                )}
              </div>
            )}

            {/* Effects */}
            {product.effects && product.effects.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Effects</h2>
                <div className="flex flex-wrap gap-2">
                  {product.effects.map((effect) => (
                    <Badge key={effect} variant="secondary">
                      {effect}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Terpenes */}
            {product.terpenes && product.terpenes.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Terpenes</h2>
                <div className="flex flex-wrap gap-2">
                  {product.terpenes.map((terpene) => (
                    <Badge key={terpene} variant="outline">
                      {terpene}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Vendor */}
            {product.vendor && (
              <div className="text-sm text-muted-foreground">
                Vendor: <span className="font-medium text-foreground">{product.vendor}</span>
              </div>
            )}

            {/* Add to Cart */}
            <Card className="p-6 space-y-4 border-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1 || isOutOfStock}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-xl font-semibold min-w-[3ch] text-center">
                    {quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= product.stock_quantity || isOutOfStock}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(product.price * quantity)}
                  </p>
                </div>
              </div>

              <Button
                size="lg"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="w-full gap-2"
              >
                <ShoppingCart className="h-5 w-5" />
                {isOutOfStock
                  ? 'Out of Stock'
                  : isInCart
                    ? `Update Cart (${cartQuantity} in cart)`
                    : 'Add to Cart'}
              </Button>

              {isInCart && (
                <p className="text-sm text-center text-muted-foreground">
                  You already have {cartQuantity} {cartQuantity === 1 ? 'unit' : 'units'} in your
                  cart
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
