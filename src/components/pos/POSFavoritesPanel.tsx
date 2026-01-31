/**
 * POSFavoritesPanel Component
 * 
 * Displays frequently purchased products for quick access.
 * Tracks purchases locally and shows top items.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Star, Plus, TrendingUp } from 'lucide-react';
import { Product } from '@/pages/admin/PointOfSale';

interface FavoriteProduct {
    productId: string;
    count: number;
    lastUsed: string;
}

interface POSFavoritesPanelProps {
    tenantId: string | undefined;
    products: Product[];
    onAddToCart: (product: Product) => void;
}

const STORAGE_KEY_PREFIX = 'pos_favorites_';

export function POSFavoritesPanel({
    tenantId,
    products,
    onAddToCart,
}: POSFavoritesPanelProps) {
    const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);

    const storageKey = tenantId ? `${STORAGE_KEY_PREFIX}${tenantId}` : null;

    // Load favorites from localStorage
    useEffect(() => {
        if (!storageKey) return;

        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                setFavorites(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Failed to load favorites', e);
        }
    }, [storageKey]);

    // Record a product sale for favorites
    const recordSale = useCallback((productId: string) => {
        if (!storageKey) return;

        setFavorites(prev => {
            const existing = prev.find(f => f.productId === productId);
            let updated: FavoriteProduct[];

            if (existing) {
                updated = prev.map(f =>
                    f.productId === productId
                        ? { ...f, count: f.count + 1, lastUsed: new Date().toISOString() }
                        : f
                );
            } else {
                updated = [...prev, {
                    productId,
                    count: 1,
                    lastUsed: new Date().toISOString()
                }];
            }

            // Keep only top 20
            updated.sort((a, b) => b.count - a.count);
            updated = updated.slice(0, 20);

            localStorage.setItem(storageKey, JSON.stringify(updated));
            return updated;
        });
    }, [storageKey]);

    // Get top 6 favorite products
    const topFavorites = favorites
        .slice(0, 6)
        .map(f => products.find(p => p.id === f.productId))
        .filter((p): p is Product => p !== undefined && p.stock_quantity > 0);

    if (topFavorites.length === 0) {
        return null;
    }

    return (
        <Card className="flex-shrink-0">
            <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Popular Items
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="max-h-32">
                    <div className="px-4 pb-3 flex flex-wrap gap-2">
                        {topFavorites.map((product) => (
                            <Button
                                key={product.id}
                                variant="outline"
                                size="sm"
                                className="h-auto py-2 px-3 flex items-center gap-2"
                                onClick={() => onAddToCart(product)}
                            >
                                <span className="max-w-[100px] truncate">{product.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                    ${product.price}
                                </Badge>
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

// Export hook for recording sales
export function usePOSFavorites(tenantId: string | undefined) {
    const storageKey = tenantId ? `${STORAGE_KEY_PREFIX}${tenantId}` : null;

    const recordSale = useCallback((productIds: string[]) => {
        if (!storageKey) return;

        try {
            const stored = localStorage.getItem(storageKey);
            let favorites: FavoriteProduct[] = stored ? JSON.parse(stored) : [];

            for (const productId of productIds) {
                const existing = favorites.find(f => f.productId === productId);
                if (existing) {
                    existing.count += 1;
                    existing.lastUsed = new Date().toISOString();
                } else {
                    favorites.push({
                        productId,
                        count: 1,
                        lastUsed: new Date().toISOString()
                    });
                }
            }

            // Keep only top 20
            favorites.sort((a, b) => b.count - a.count);
            favorites = favorites.slice(0, 20);

            localStorage.setItem(storageKey, JSON.stringify(favorites));
        } catch (e) {
            console.error('Failed to record sale for favorites', e);
        }
    }, [storageKey]);

    return { recordSale };
}

export default POSFavoritesPanel;
