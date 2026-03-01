import { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cleanProductName } from '@/utils/productName';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import ProductImage from '@/components/ProductImage';

interface Product {
    id: string;
    name: string;
    price: number;
    image_url?: string;
    category?: string;
}

interface SmartSearchOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    onProductSelect: (productId: string) => void;
}

export function SmartSearchOverlay({ isOpen, onClose, products, onProductSelect }: SmartSearchOverlayProps) {
    const [query, setQuery] = useState('');
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load recent searches from local storage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMER_RECENT_SEARCHES);
            if (saved) {
                setRecentSearches(JSON.parse(saved) as string[]);
            }
        } catch {
            localStorage.removeItem(STORAGE_KEYS.CUSTOMER_RECENT_SEARCHES);
        }
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => inputRef.current?.focus(), 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleSearch = (term: string) => {
        setQuery(term);
        if (term.trim()) {
            const newRecent = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
            setRecentSearches(newRecent);
            localStorage.setItem(STORAGE_KEYS.CUSTOMER_RECENT_SEARCHES, JSON.stringify(newRecent));
        }
    };

    const filteredProducts = query
        ? products.filter(p =>
            cleanProductName(p.name).toLowerCase().includes(query.toLowerCase()) ||
            p.category?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 10)
        : [];

    const trendingSearches = ['Edibles', 'Pre-rolls', 'Vapes', 'Flower', 'Sativa'];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="container mx-auto max-w-2xl h-full flex flex-col p-4">
                {/* Header */}
                <div className="flex items-center gap-2 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            ref={inputRef}
                            aria-label="Search for products and categories"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search for products, categories..."
                            className="pl-10 h-12 text-lg bg-gray-100 border-0 rounded-xl focus-visible:ring-2 focus-visible:ring-primary"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full"
                            >
                                <X className="h-4 w-4 text-gray-500" />
                            </button>
                        )}
                    </div>
                    <Button variant="ghost" onClick={onClose} className="text-base font-medium">
                        Cancel
                    </Button>
                </div>

                <ScrollArea className="flex-1 -mx-4 px-4">
                    <div className="space-y-8 pb-10">
                        {/* Results */}
                        {query ? (
                            <div className="space-y-2">
                                {filteredProducts.length > 0 ? (
                                    filteredProducts.map(product => (
                                        <div
                                            key={product.id}
                                            onClick={() => {
                                                handleSearch(product.name);
                                                onProductSelect(product.id);
                                                onClose();
                                            }}
                                            className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors group"
                                        >
                                            <div className="h-12 w-12 rounded-lg overflow-hidden">
                                                <ProductImage
                                                    src={product.image_url}
                                                    alt={product.name}
                                                    className="h-full w-full"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                                                    {cleanProductName(product.name)}
                                                </h4>
                                                <p className="text-sm text-gray-500">{product.category || 'Product'}</p>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-gray-300" />
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-gray-500">
                                        No results found for "{query}"
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Recent Searches */}
                                {recentSearches.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            Recent
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {recentSearches.map(term => (
                                                <button
                                                    key={term}
                                                    onClick={() => setQuery(term)}
                                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-medium transition-colors"
                                                >
                                                    {term}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Trending */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4" />
                                        Trending Now
                                    </h3>
                                    <div className="space-y-2">
                                        {trendingSearches.map(term => (
                                            <div
                                                key={term}
                                                onClick={() => setQuery(term)}
                                                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors"
                                            >
                                                <span className="font-medium text-gray-700">{term}</span>
                                                <ChevronRight className="h-4 w-4 text-gray-300" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}
