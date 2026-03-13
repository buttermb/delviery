/**
 * Storefront Wishlist Button
 * Heart icon toggle that saves products to localStorage wishlist
 */

import { useState, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const WISHLIST_STORAGE_KEY = 'floraiq_wishlist';

export interface WishlistItem {
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string | null;
  addedAt: string;
}

interface WishlistButtonProps {
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string | null;
  className?: string;
}

export function getWishlistItems(): WishlistItem[] {
  try {
    const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as WishlistItem[]) : [];
  } catch {
    return [];
  }
}

function saveWishlistItems(items: WishlistItem[]): void {
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('wishlist-updated'));
}

export default function WishlistButton({
  productId,
  productName,
  productPrice,
  productImage,
  className,
}: WishlistButtonProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);

  const checkWishlisted = useCallback(() => {
    const items = getWishlistItems();
    setIsWishlisted(items.some((item) => item.productId === productId));
  }, [productId]);

  useEffect(() => {
    checkWishlisted();
    window.addEventListener('wishlist-updated', checkWishlisted);
    return () => window.removeEventListener('wishlist-updated', checkWishlisted);
  }, [checkWishlisted]);

  const toggleWishlist = () => {
    const items = getWishlistItems();

    if (isWishlisted) {
      const updated = items.filter((item) => item.productId !== productId);
      saveWishlistItems(updated);
      setIsWishlisted(false);
      toast.success('Removed from wishlist');
    } else {
      const newItem: WishlistItem = {
        productId,
        productName,
        productPrice,
        productImage,
        addedAt: new Date().toISOString(),
      };
      saveWishlistItems([...items, newItem]);
      setIsWishlisted(true);
      toast.success('Added to wishlist');
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleWishlist}
      className={cn('rounded-full', className)}
      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <Heart
        className={cn(
          'h-5 w-5 transition-colors',
          isWishlisted ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
        )}
      />
    </Button>
  );
}
