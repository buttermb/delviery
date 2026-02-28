/**
 * PromotionsBannerSection
 * Displays rotating marketing banners/announcements from marketplace_banners
 * Supports auto-rotation and manual navigation
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBanners } from '@/hooks/useBanners';
import { cn } from '@/lib/utils';

export interface PromotionsBannerSectionProps {
    content?: {
        auto_rotate?: boolean;
        rotation_interval?: number; // seconds
        show_navigation?: boolean;
        show_indicators?: boolean;
    };
    styles?: {
        height?: string;
        overlay_opacity?: number;
        text_color?: string;
        accent_color?: string;
    };
    storeId: string;
}

export function PromotionsBannerSection({ content, styles, storeId }: PromotionsBannerSectionProps) {
    const { data: banners = [], isLoading } = useBanners(storeId);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const {
        auto_rotate = true,
        rotation_interval = 5,
        show_navigation = true,
        show_indicators = true,
    } = content || {};

    const {
        height = '400px',
        overlay_opacity = 0.4,
        text_color = '#ffffff',
        accent_color = '#10b981',
    } = styles || {};

    // Clamp currentIndex when banners array shrinks
    useEffect(() => {
        if (banners.length > 0 && currentIndex >= banners.length) {
            setCurrentIndex(0);
        }
    }, [banners.length, currentIndex]);

    // Auto-rotate banners
    useEffect(() => {
        if (!auto_rotate || banners.length <= 1 || isPaused) return;

        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % banners.length);
        }, rotation_interval * 1000);

        return () => clearInterval(timer);
    }, [auto_rotate, rotation_interval, banners.length, isPaused]);

    const goToNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, [banners.length]);

    const goToPrev = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
    }, [banners.length]);

    // Don't render if no banners
    if (isLoading || banners.length === 0) {
        return null;
    }

    const safeIndex = currentIndex < banners.length ? currentIndex : 0;
    const currentBanner = banners[safeIndex];
    if (!currentBanner) return null;

    return (
        <section
            className="relative overflow-hidden"
            style={{ height }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentBanner.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0"
                >
                    {/* Background Image */}
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${currentBanner.image_url})` }}
                    />

                    {/* Overlay */}
                    <div
                        className="absolute inset-0"
                        style={{ backgroundColor: `rgba(0, 0, 0, ${overlay_opacity})` }}
                    />

                    {/* Content */}
                    <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center">
                        {/* Promotion Badge */}
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="mb-4"
                        >
                            <span
                                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
                                style={{ backgroundColor: `${accent_color}20`, color: accent_color }}
                            >
                                <Megaphone className="w-4 h-4" />
                                Promotion
                            </span>
                        </motion.div>

                        {/* Heading */}
                        {currentBanner.heading && (
                            <motion.h2
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-3xl md:text-5xl font-bold mb-4 max-w-3xl"
                                style={{ color: text_color }}
                            >
                                {currentBanner.heading}
                            </motion.h2>
                        )}

                        {/* Subheading */}
                        {currentBanner.subheading && (
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="text-lg md:text-xl mb-6 max-w-2xl"
                                style={{ color: `${text_color}CC` }}
                            >
                                {currentBanner.subheading}
                            </motion.p>
                        )}

                        {/* CTA Button */}
                        {currentBanner.button_text && currentBanner.button_link && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                            >
                                <Link to={currentBanner.button_link}>
                                    <Button
                                        size="lg"
                                        className="rounded-full px-8 text-white"
                                        style={{ backgroundColor: accent_color }}
                                    >
                                        {currentBanner.button_text}
                                    </Button>
                                </Link>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Navigation Arrows */}
            {show_navigation && banners.length > 1 && (
                <>
                    <button
                        onClick={goToPrev}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
                        style={{ color: text_color }}
                        aria-label="Previous banner"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                        onClick={goToNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
                        style={{ color: text_color }}
                        aria-label="Next banner"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </>
            )}

            {/* Indicators */}
            {show_indicators && banners.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                    {banners.map((banner, index) => (
                        <button
                            key={banner.id}
                            onClick={() => setCurrentIndex(index)}
                            className={cn(
                                'w-2 h-2 rounded-full transition-all',
                                index === safeIndex
                                    ? 'w-6'
                                    : 'bg-white/50 hover:bg-white/70'
                            )}
                            style={index === safeIndex ? { backgroundColor: accent_color } : undefined}
                            aria-label={`Go to banner ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
