/**
 * WishlistPage - User's saved wishlist with quick add-to-cart
 */

import { Link, useParams } from 'react-router-dom';
import { useShop } from './ShopLayout';
import { useWishlist } from '@/hooks/useWishlist';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { WishlistButton } from '@/components/shop/WishlistButton';
import ProductImage from '@/components/ProductImage';

export default function WishlistPage() {
    const { storeSlug } = useParams<{ storeSlug: string }>();
    const { store } = useShop();
    const { items, removeItem, clearWishlist } = useWishlist({ storeId: store?.id });

    if (!store) return null;

    if (items.length === 0) {
        return (
            <div className="container mx-auto px-4 py-16">
                <div className="max-w-lg mx-auto text-center">
                    <div className="mb-6 flex justify-center">
                        <div className="w-24 h-24 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                            <Heart className="w-12 h-12 text-neutral-400" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold mb-4">Your Wishlist is Empty</h1>
                    <p className="text-muted-foreground mb-8">
                        Start adding your favorite products to your wishlist!
                    </p>
                    <Link to={`/shop/${storeSlug}/products`}>
                        <Button size="lg">Browse Products</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2">My Wishlist</h1>
                    <p className="text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                </div>
                <Button variant="outline" onClick={clearWishlist} size="sm">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                </Button>
            </div>

            {/* Wishlist Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((item) => (
                    <Card key={item.productId} className="group hover:shadow-lg transition-all overflow-hidden h-full">
                        <Link to={`/shop/${storeSlug}/products/${item.productId}`}>
                            <div className="aspect-square relative overflow-hidden bg-muted">
                                <ProductImage
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                                />

                                {/* Wishlist Button */}
                                <div className="absolute top-2 right-2">
                                    <WishlistButton
                                        isInWishlist={true}
                                        onToggle={() => removeItem(item.productId)}
                                        size="sm"
                                    />
                                </div>
                            </div>
                        </Link>

                        <CardContent className="p-4">
                            <Link to={`/shop/${storeSlug}/products/${item.productId}`}>
                                <h2 className="font-medium line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                                    {item.name}
                                </h2>
                            </Link>
                            <div className="flex items-center justify-between">
                                <span className="font-bold" style={{ color: store.primary_color }}>
                                    {formatCurrency(item.price)}
                                </span>
                                <Button size="sm" variant="ghost">
                                    <ShoppingCart className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
