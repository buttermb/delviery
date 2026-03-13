/**
 * Storefront Wishlist Drawer
 * Shows saved wishlist items with remove and add-to-cart actions
 */

import { useState, useEffect, useCallback } from 'react';
import { Heart, Trash2, ShoppingCart } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import ProductImage from '@/components/ProductImage';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import { getWishlistItems } from './WishlistButton';
import type { WishlistItem } from './WishlistButton';

const WISHLIST_STORAGE_KEY = 'floraiq_wishlist';

interface WishlistDrawerProps {
  onAddToCart?: (productId: string) => void;
  trigger?: React.ReactNode;
}

export default function WishlistDrawer({ onAddToCart, trigger }: WishlistDrawerProps) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const refreshItems = useCallback(() => {
    setItems(getWishlistItems());
  }, []);

  useEffect(() => {
    refreshItems();
    window.addEventListener('wishlist-updated', refreshItems);
    return () => window.removeEventListener('wishlist-updated', refreshItems);
  }, [refreshItems]);

  useEffect(() => {
    if (isOpen) refreshItems();
  }, [isOpen, refreshItems]);

  const removeItem = (productId: string) => {
    const updated = items.filter((item) => item.productId !== productId);
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(updated));
    setItems(updated);
    window.dispatchEvent(new CustomEvent('wishlist-updated'));
    toast.success('Removed from wishlist');
  };

  const handleAddToCart = (productId: string) => {
    if (onAddToCart) {
      onAddToCart(productId);
      toast.success('Added to cart');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="relative">
            <Heart className="h-5 w-5" />
            {items.length > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                {items.length}
              </Badge>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Wishlist ({items.length})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Heart className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Your wishlist is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Save items you love for later
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-1">
              {items.map((item, index) => (
                <div key={item.productId}>
                  <div className="flex gap-3 py-3">
                    <div className="h-16 w-16 rounded-md overflow-hidden bg-muted shrink-0">
                      <ProductImage
                        src={item.productImage}
                        alt={item.productName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.productName}</p>
                      <p className="text-sm font-semibold mt-1">
                        {formatCurrency(item.productPrice)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {onAddToCart && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleAddToCart(item.productId)}
                          >
                            <ShoppingCart className="h-3 w-3" />
                            Add to Cart
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => removeItem(item.productId)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {index < items.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
