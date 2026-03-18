/**
 * Storefront Deals Page
 * Lists all active promotions and deals for the store
 */

import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from '@/pages/shop/ShopLayout';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { logger } from '@/lib/logger';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Tag,
    Clock,
    Calendar,
    Sparkles,
    ShoppingBag,
} from 'lucide-react';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { queryKeys } from '@/lib/queryKeys';

interface Deal {
    id: string;
    name: string;
    description: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    applies_to: string;
    target_value: string | null;
    active_days: number[];
    end_date: string | null;
}

export default function DealsPage() {
    const { storeSlug } = useParams<{ storeSlug: string }>();
    const { store } = useShop();
    const { isLuxuryTheme, cardBg, cardBorder, textPrimary, textMuted } = useLuxuryTheme();

    const { data: deals = [], isLoading } = useQuery({
        queryKey: queryKeys.storePages.activeDeals(store?.id),
        queryFn: async (): Promise<Deal[]> => {
            if (!store?.id) return [];

            // Query marketplace_deals table directly
            const { data, error } = await supabase
                .from('marketplace_deals')
                .select('id, name, description, discount_type, discount_value, applies_to, target_value, active_days, end_date, is_active, store_id')
                .eq('store_id', store.id)
                .eq('is_active', true);

            if (error) {
                logger.warn('Deals not available', error);
                return [];
            }

            return (data ?? []) as unknown as Deal[];
        },
        enabled: !!store?.id,
    });

    const getDayNames = (days: number[]) => {
        if (days?.length === 7) return 'Every Day';
        const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days.map(d => dayMap[d]).join(', ');
    };

    const DealCard = ({ deal }: { deal: Deal }) => (
        <div
            className={`group relative overflow-hidden rounded-xl border transition-all hover:scale-[1.01] ${isLuxuryTheme ? `${cardBg} ${cardBorder}` : 'bg-card'
                }`}
        >
            {/* Background decoration */}
            <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-10 blur-2xl ${isLuxuryTheme ? 'bg-white' : 'bg-primary'
                }`} />

            <div className="p-6 relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center">
                {/* Discount Badge */}
                <div className={`flex-shrink-0 flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 ${isLuxuryTheme ? 'border-white/10 bg-white/5' : 'border-primary/10 bg-primary/5'
                    }`}>
                    <span className={`text-2xl font-bold ${isLuxuryTheme ? 'text-white' : 'text-primary'}`}>
                        {deal.discount_type === 'percentage' ? (
                            <>{deal.discount_value}<span className="text-sm">%</span></>
                        ) : (
                            <><span className="text-sm">$</span>{deal.discount_value}</>
                        )}
                    </span>
                    <span className={`text-xs uppercase tracking-wider font-medium ${isLuxuryTheme ? 'text-white/60' : 'text-muted-foreground'}`}>
                        OFF
                    </span>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2 mb-2">
                        <Badge variant="secondary" className={isLuxuryTheme ? 'bg-white/10 text-white border-none' : ''}>
                            <Sparkles className="w-3 h-3 mr-1" />
                            {deal.end_date ? 'Limited Time' : 'Recurring Deal'}
                        </Badge>
                        {deal.applies_to !== 'order' && (
                            <Badge variant="outline" className={isLuxuryTheme ? 'border-white/20 text-white/80' : ''}>
                                {deal.applies_to}: {deal.target_value}
                            </Badge>
                        )}
                    </div>

                    <h2 className={`text-xl font-bold ${isLuxuryTheme ? textPrimary : ''}`}>
                        {deal.name}
                    </h2>
                    <p className={`text-sm ${isLuxuryTheme ? textMuted : 'text-muted-foreground'}`}>
                        {deal.description || `Get ${deal.discount_value}${deal.discount_type === 'percentage' ? '%' : '$'} off ${deal.target_value ? deal.target_value : 'your entire order'}.`}
                    </p>

                    <div className={`flex flex-wrap gap-4 pt-2 text-xs font-medium ${isLuxuryTheme ? 'text-white/70' : 'text-muted-foreground'}`}>
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            {getDayNames(deal.active_days)}
                        </div>
                        {deal.end_date && (
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                Ends {formatSmartDate(deal.end_date)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Action */}
                <div className="flex-shrink-0 w-full md:w-auto mt-2 md:mt-0">
                    <Button
                        className={`w-full md:w-auto ${isLuxuryTheme ? 'bg-white text-black hover:bg-white/90' : ''}`}
                        asChild
                    >
                        <Link to={`/shop/${storeSlug}`}>
                            <ShoppingBag className="w-4 h-4 mr-2" />
                            Shop Now
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <div {...(isLuxuryTheme ? { 'data-dark-panel': true } : {})} className={`min-h-dvh pb-20 pt-24 ${isLuxuryTheme ? 'bg-neutral-950' : 'bg-gray-50 dark:bg-zinc-900'}`}>
            <div className="container mx-auto px-4 max-w-4xl">
                <div className="text-center mb-12 space-y-4">
                    <h1 className={`text-4xl md:text-5xl font-bold tracking-tight ${isLuxuryTheme ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                        Current Deals
                    </h1>
                    <p className={`text-lg max-w-2xl mx-auto ${isLuxuryTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                        Check out our latest promotions and everyday savings.
                        Discounts are automatically applied at checkout.
                    </p>
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} className={`h-40 w-full rounded-xl ${isLuxuryTheme ? 'bg-white/5' : ''}`} />
                        ))}
                    </div>
                ) : deals.length === 0 ? (
                    <Card className={isLuxuryTheme ? 'bg-white/5 border-white/10' : ''}>
                        <CardContent className="py-16 text-center">
                            <Tag className={`w-12 h-12 mx-auto mb-4 opacity-50 ${isLuxuryTheme ? 'text-white' : 'text-gray-400'}`} />
                            <h2 className={`text-xl font-semibold mb-2 ${isLuxuryTheme ? 'text-white' : ''}`}>No active deals right now</h2>
                            <p className={`text-muted-foreground mb-6 ${isLuxuryTheme ? 'text-gray-400' : ''}`}>
                                Check back later for new promotions!
                            </p>
                            <Button asChild variant={isLuxuryTheme ? 'secondary' : 'default'}>
                                <Link to={`/shop/${storeSlug}`}>Shop All Products</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {deals.map(deal => (
                            <DealCard key={deal.id} deal={deal} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
