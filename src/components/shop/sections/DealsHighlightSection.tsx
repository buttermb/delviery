/**
 * DealsHighlightSection
 * Displays active promotions/deals as cards on the storefront homepage
 * Links to the full deals page for more information
 */

import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Tag, Percent, Clock, Calendar, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useStorefrontDeals, formatDiscount, getDayNames } from '@/hooks/useStorefrontDeals';
import { formatSmartDate } from '@/lib/utils/formatDate';

export interface DealsHighlightSectionProps {
    content?: {
        heading?: string;
        subheading?: string;
        max_deals?: number;
        show_view_all?: boolean;
    };
    styles?: {
        background_color?: string;
        text_color?: string;
        accent_color?: string;
        card_background?: string;
    };
    storeId: string;
}

export function DealsHighlightSection({ content, styles, storeId }: DealsHighlightSectionProps) {
    const { storeSlug } = useParams();
    const { data: deals = [], isLoading } = useStorefrontDeals(storeId);

    const {
        heading = 'Current Deals',
        subheading = 'Don\'t miss out on these limited-time offers',
        max_deals = 3,
        show_view_all = true,
    } = content || {};

    const {
        background_color = 'transparent',
        text_color = 'inherit',
        accent_color = '#10b981',
        card_background = 'var(--card)',
    } = styles || {};

    // Take only the specified number of deals
    const displayDeals = deals.slice(0, max_deals);

    // Don't render if no deals
    if (!isLoading && deals.length === 0) {
        return null;
    }

    return (
        <section
            className="py-12 md:py-16"
            style={{ backgroundColor: background_color, color: text_color }}
        >
            <div className="container mx-auto px-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="flex items-center gap-2 mb-2"
                        >
                            <Tag className="w-5 h-5" style={{ color: accent_color }} />
                            <span
                                className="text-sm font-semibold uppercase tracking-wider"
                                style={{ color: accent_color }}
                            >
                                Special Offers
                            </span>
                        </motion.div>
                        <motion.h2
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="text-2xl md:text-3xl font-bold"
                        >
                            {heading}
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="text-muted-foreground mt-1"
                        >
                            {subheading}
                        </motion.p>
                    </div>

                    {show_view_all && deals.length > max_deals && (
                        <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                        >
                            <Link to={`/shop/${storeSlug}/deals`}>
                                <Button variant="outline" className="group">
                                    View All Deals
                                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                        </motion.div>
                    )}
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-48 rounded-xl" />
                        ))}
                    </div>
                )}

                {/* Deals Grid */}
                {!isLoading && displayDeals.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayDeals.map((deal, index) => (
                            <motion.div
                                key={deal.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Card
                                    className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 h-full"
                                    style={{ backgroundColor: card_background }}
                                >
                                    {/* Decorative gradient */}
                                    <div
                                        className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20"
                                        style={{ backgroundColor: accent_color }}
                                    />

                                    <CardContent className="p-6 relative z-10">
                                        {/* Discount Badge */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div
                                                className="flex items-center justify-center w-16 h-16 rounded-full border-2"
                                                style={{ borderColor: accent_color, backgroundColor: `${accent_color}10` }}
                                            >
                                                <div className="text-center">
                                                    <span
                                                        className="text-lg font-bold block"
                                                        style={{ color: accent_color }}
                                                    >
                                                        {deal.discount_type === 'percentage' ? (
                                                            `${deal.discount_value}%`
                                                        ) : (
                                                            `$${deal.discount_value}`
                                                        )}
                                                    </span>
                                                    <span
                                                        className="text-[10px] uppercase font-medium"
                                                        style={{ color: accent_color }}
                                                    >
                                                        OFF
                                                    </span>
                                                </div>
                                            </div>

                                            <Badge
                                                variant="secondary"
                                                className="flex items-center gap-1"
                                            >
                                                <Sparkles className="w-3 h-3" />
                                                {deal.end_date ? 'Limited Time' : 'Recurring'}
                                            </Badge>
                                        </div>

                                        {/* Deal Info */}
                                        <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">
                                            {deal.name}
                                        </h3>

                                        {deal.description && (
                                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                                {deal.description}
                                            </p>
                                        )}

                                        {/* Meta Info */}
                                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-auto">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {getDayNames(deal.active_days)}
                                            </div>
                                            {deal.end_date && (
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    Ends {formatSmartDate(deal.end_date)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Target Badge */}
                                        {deal.applies_to !== 'order' && deal.target_value && (
                                            <Badge variant="outline" className="mt-3">
                                                {deal.applies_to}: {deal.target_value}
                                            </Badge>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* View All Link (Mobile) */}
                {show_view_all && deals.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mt-8 text-center md:hidden"
                    >
                        <Link to={`/shop/${storeSlug}/deals`}>
                            <Button
                                className="w-full"
                                style={{ backgroundColor: accent_color }}
                            >
                                View All Deals
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </motion.div>
                )}
            </div>
        </section>
    );
}
