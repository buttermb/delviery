/**
 * AnnouncementBar
 * A thin banner at the top of the storefront displaying the latest promotion
 * Auto-cycles through multiple announcements if banners are available
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Sparkles } from 'lucide-react';
import { useBanners } from '@/hooks/useBanners';
import { useStorefrontDeals, formatDiscount } from '@/hooks/useStorefrontDeals';

interface AnnouncementBarProps {
    storeId: string;
    accentColor?: string;
    dismissible?: boolean;
}

interface Announcement {
    id: string;
    text: string;
    link?: string | null;
    type: 'banner' | 'deal';
}

export function AnnouncementBar({
    storeId,
    accentColor = '#10b981',
    dismissible = true,
}: AnnouncementBarProps) {
    const { data: banners = [] } = useBanners(storeId);
    const { data: deals = [] } = useStorefrontDeals(storeId);
    const [isDismissed, setIsDismissed] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Build announcements from banners and deals
    const announcements: Announcement[] = [
        // Add banners as announcements
        ...banners
            .filter(b => b.heading || b.subheading)
            .map(b => ({
                id: `banner-${b.id}`,
                text: b.heading ?? b.subheading ?? '',
                link: b.button_link,
                type: 'banner' as const,
            })),
        // Add top deals as announcements
        ...deals.slice(0, 2).map(d => ({
            id: `deal-${d.id}`,
            text: `${d.name} - ${formatDiscount(d)}`,
            link: null,
            type: 'deal' as const,
        })),
    ];

    // Clamp currentIndex when announcements array shrinks
    useEffect(() => {
        if (announcements.length > 0 && currentIndex >= announcements.length) {
            setCurrentIndex(0);
        }
    }, [announcements.length, currentIndex]);

    // Auto-cycle through announcements
    useEffect(() => {
        if (announcements.length <= 1) return;

        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % announcements.length);
        }, 5000);

        return () => clearInterval(timer);
    }, [announcements.length]);

    // Check dismissal from session storage
    useEffect(() => {
        try {
            const dismissed = sessionStorage.getItem(`announcement-dismissed-${storeId}`);
            if (dismissed) {
                setIsDismissed(true);
            }
        } catch {
            // sessionStorage unavailable (private browsing)
        }
    }, [storeId]);

    const handleDismiss = () => {
        try {
            sessionStorage.setItem(`announcement-dismissed-${storeId}`, 'true');
        } catch {
            // sessionStorage unavailable (private browsing)
        }
        setIsDismissed(true);
    };

    // Don't render if dismissed or no announcements
    if (isDismissed || announcements.length === 0) {
        return null;
    }

    const safeIndex = currentIndex < announcements.length ? currentIndex : 0;
    const current = announcements[safeIndex];
    if (!current) return null;

    return (
        <div
            className="relative py-2 px-4 text-center text-sm font-medium text-white"
            style={{ backgroundColor: accentColor }}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={current.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-center gap-2"
                >
                    <Sparkles className="w-4 h-4" />
                    {current.link ? (
                        <Link
                            to={current.link}
                            className="hover:underline flex items-center gap-1"
                        >
                            {current.text}
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    ) : (
                        <span>{current.text}</span>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Dismiss Button */}
            {dismissible && (
                <button
                    onClick={handleDismiss}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/20 transition-colors"
                    aria-label="Dismiss announcement"
                >
                    <X className="w-4 h-4" />
                </button>
            )}

            {/* Progress Indicators */}
            {announcements.length > 1 && (
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-1">
                    {announcements.map((announcement, index) => (
                        <div
                            key={announcement.id}
                            className={`w-1 h-1 rounded-full transition-all ${
                                index === safeIndex ? 'bg-white' : 'bg-white/40'
                            }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
