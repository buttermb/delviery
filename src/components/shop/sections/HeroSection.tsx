import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { sanitizeWithLineBreaks } from '@/lib/utils/sanitize';
import { FEATURES_ICON_MAP } from '@/components/shop/sections/featuresIconMap';
import { Star } from 'lucide-react';

/** Feature card displayed in the split-features hero variant */
interface HeroFeatureCard {
    icon: string;
    title: string;
    description: string;
}

/** Countdown timer values for landing variant */
interface CountdownValues {
    days: string;
    hours: string;
    minutes: string;
}

export interface HeroSectionProps {
    content: {
        heading_line_1?: string;
        heading_line_2?: string;
        heading_line_3?: string;
        headline?: string;
        subheading?: string;
        label?: string;
        cta_primary_text?: string;
        cta_primary_link?: string;
        cta_secondary_text?: string;
        cta_secondary_link?: string;
        background_image?: string;
        trust_badges?: boolean;
        announcement_banner?: string;
        /** Hero layout variant */
        hero_variant?: 'centered' | 'split-features' | 'split-gallery' | 'luxury-centered';
        /** Feature cards for split-features variant */
        hero_features?: HeroFeatureCard[];
        /** Countdown for landing variant */
        countdown?: CountdownValues;
        /** Gallery image placeholders for split-gallery variant */
        gallery_count?: number;
    };
    styles: {
        background_gradient_start?: string;
        background_gradient_end?: string;
        text_color?: string;
        accent_color?: string;
        overlay_opacity?: number;
        /** Card background for feature cards */
        card_bg?: string;
        /** Card text color */
        card_text?: string;
    };
}

const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: 'easeOut' as const, delay },
});

export function HeroSection({ content, styles }: HeroSectionProps) {
    const {
        heading_line_1,
        heading_line_2,
        heading_line_3,
        headline,
        label,
        subheading = 'Curated strains. Same-day delivery.',
        cta_primary_text = 'Shop Now',
        cta_primary_link = '/shop',
        cta_secondary_text,
        cta_secondary_link,
        background_image,
        trust_badges = false,
        announcement_banner,
        hero_variant = 'centered',
        hero_features,
        countdown,
        gallery_count = 4,
    } = content || {};

    const {
        background_gradient_start = '#000000',
        background_gradient_end = '#022c22',
        text_color = '#ffffff',
        accent_color = '#34d399',
        overlay_opacity = 0.6,
        card_bg,
        card_text,
    } = styles || {};

    const resolvedHeadline = headline
        || [heading_line_1, heading_line_2, heading_line_3].filter(Boolean).join(' ')
        || 'Premium Flower Delivered';

    const hasImage = Boolean(background_image);
    const isSplit = hero_variant === 'split-features' || hero_variant === 'split-gallery';
    const isLuxury = hero_variant === 'luxury-centered';

    /** Shared background layer */
    const backgroundLayer = (
        <div className="absolute inset-0">
            {hasImage ? (
                <>
                    <img
                        src={background_image}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                    />
                    <div
                        className="absolute inset-0"
                        style={{
                            background: `linear-gradient(to bottom, ${background_gradient_start}${Math.round(overlay_opacity * 255).toString(16).padStart(2, '0')}, ${background_gradient_end}${Math.round(overlay_opacity * 255).toString(16).padStart(2, '0')})`,
                        }}
                    />
                </>
            ) : (
                <div
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(to bottom right, ${background_gradient_start}, ${background_gradient_end})`,
                    }}
                />
            )}
        </div>
    );

    /** Announcement banner */
    const announcementBar = announcement_banner ? (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute top-0 left-0 right-0 z-20 py-2.5 px-4 text-center text-sm font-medium"
            style={{
                backgroundColor: accent_color,
                color: background_gradient_start,
            }}
        >
            {announcement_banner}
        </motion.div>
    ) : null;

    /** CTA buttons */
    const ctaButtons = (
        <motion.div
            {...fadeUp(0.4)}
            className={`flex flex-col sm:flex-row gap-4 ${isSplit ? 'items-start' : 'items-center justify-center'}`}
        >
            <Link to={cta_primary_link} className={isSplit ? '' : 'w-full sm:w-auto'}>
                <Button
                    className="px-8 py-3 text-base font-medium rounded-full h-auto transition-transform duration-200 hover:scale-105"
                    style={{
                        backgroundColor: accent_color,
                        color: background_gradient_start,
                    }}
                >
                    {cta_primary_text}
                </Button>
            </Link>
            {cta_secondary_text && cta_secondary_link && (
                <Link to={cta_secondary_link} className={isSplit ? '' : 'w-full sm:w-auto'}>
                    <Button
                        variant="outline"
                        className="px-8 py-3 text-base font-medium rounded-full h-auto backdrop-blur-sm transition-colors duration-200"
                        style={{
                            borderColor: `${text_color}33`,
                            color: text_color,
                            backgroundColor: `${text_color}0D`,
                        }}
                    >
                        {cta_secondary_text}
                    </Button>
                </Link>
            )}
        </motion.div>
    );

    /** Trust badges strip */
    const trustBadgesEl = trust_badges ? (
        <motion.div
            {...fadeUp(0.6)}
            className={`flex gap-4 sm:gap-8 mt-12 text-xs font-light tracking-wider flex-wrap ${isSplit ? 'items-start' : 'items-center justify-center'}`}
            style={{ color: `${text_color}80` }}
        >
            {['Licensed', 'Lab Verified', 'Same-Day'].map((badge) => (
                <span key={badge} className="flex items-center gap-2">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: accent_color }}>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {badge}
                </span>
            ))}
        </motion.div>
    ) : null;

    // ── Split-Features: Professional / Nature ──
    if (hero_variant === 'split-features') {
        const features = hero_features || [
            { icon: 'shield-check', title: 'Lab Tested', description: 'Every product verified for purity and potency' },
            { icon: 'truck', title: 'Fast Delivery', description: 'Same-day dispatch on orders before 2pm' },
            { icon: 'lock', title: 'Secure Pay', description: 'Encrypted checkout with multiple payment options' },
            { icon: 'headphones', title: 'Expert Support', description: 'Knowledgeable staff available 7 days a week' },
        ];

        const featureCardBg = card_bg || `${text_color}12`;
        const featureCardText = card_text || text_color;

        return (
            <section
                className="relative overflow-hidden"
                style={{ backgroundColor: background_gradient_start }}
            >
                {announcementBar}
                {backgroundLayer}

                <div className="container mx-auto px-4 sm:px-6 relative z-10 py-20 md:py-28 lg:py-36">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                        {/* Left: Text */}
                        <div>
                            {label && (
                                <motion.div
                                    {...fadeUp(0)}
                                    className="text-sm font-medium tracking-widest uppercase mb-4"
                                    style={{ color: accent_color }}
                                >
                                    {label}
                                </motion.div>
                            )}
                            <motion.h1
                                {...fadeUp(0.1)}
                                className="font-bold leading-[1.1] tracking-tight"
                                style={{
                                    color: text_color,
                                    fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                                }}
                            >
                                {resolvedHeadline}
                            </motion.h1>
                            <motion.p
                                {...fadeUp(0.2)}
                                className="mt-5 mb-8 max-w-lg font-light leading-relaxed"
                                style={{
                                    color: `${text_color}B3`,
                                    fontSize: 'clamp(0.95rem, 1.5vw, 1.125rem)',
                                }}
                                dangerouslySetInnerHTML={{ __html: sanitizeWithLineBreaks(subheading) }}
                            />
                            {ctaButtons}
                            {trustBadgesEl}
                        </div>

                        {/* Right: Feature cards 2x2 */}
                        <motion.div
                            {...fadeUp(0.3)}
                            className="grid grid-cols-2 gap-4"
                        >
                            {features.map((feature, i) => {
                                const IconComp = FEATURES_ICON_MAP[feature.icon] || Star;
                                return (
                                    <motion.div
                                        key={feature.title}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.6, delay: 0.4 + i * 0.1 }}
                                        className="rounded-xl p-5 backdrop-blur-sm"
                                        style={{ backgroundColor: featureCardBg }}
                                    >
                                        <IconComp
                                            className="w-6 h-6 mb-3"
                                            style={{ color: featureCardText }}
                                        />
                                        <h3
                                            className="font-semibold text-sm mb-1"
                                            style={{ color: featureCardText }}
                                        >
                                            {feature.title}
                                        </h3>
                                        <p
                                            className="text-xs leading-relaxed"
                                            style={{ color: `${featureCardText}99` }}
                                        >
                                            {feature.description}
                                        </p>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    </div>
                </div>
            </section>
        );
    }

    // ── Split-Gallery: Landing Page ──
    if (hero_variant === 'split-gallery') {
        return (
            <section
                className="relative overflow-hidden"
                style={{ backgroundColor: background_gradient_start }}
            >
                {announcementBar}
                {backgroundLayer}

                <div className="container mx-auto px-4 sm:px-6 relative z-10 py-20 md:py-28 lg:py-36">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                        {/* Left: Text + countdown */}
                        <div>
                            {label && (
                                <motion.div
                                    {...fadeUp(0)}
                                    className="inline-block text-sm font-semibold tracking-wide uppercase mb-6 px-4 py-1.5 rounded-full"
                                    style={{
                                        backgroundColor: `${text_color}15`,
                                        color: text_color,
                                    }}
                                >
                                    {label}
                                </motion.div>
                            )}
                            <motion.h1
                                {...fadeUp(0.1)}
                                className="font-extrabold leading-[1.05] tracking-tight"
                                style={{
                                    color: text_color,
                                    fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                                }}
                            >
                                {resolvedHeadline}
                            </motion.h1>
                            <motion.p
                                {...fadeUp(0.2)}
                                className="mt-5 mb-8 max-w-lg font-light leading-relaxed"
                                style={{
                                    color: `${text_color}CC`,
                                    fontSize: 'clamp(0.95rem, 1.5vw, 1.125rem)',
                                }}
                                dangerouslySetInnerHTML={{ __html: sanitizeWithLineBreaks(subheading) }}
                            />

                            {/* Countdown timer */}
                            {countdown && (
                                <motion.div
                                    {...fadeUp(0.3)}
                                    className="flex items-center gap-3 mb-8"
                                >
                                    {[
                                        { value: countdown.days, unit: 'DAYS' },
                                        { value: countdown.hours, unit: 'HOURS' },
                                        { value: countdown.minutes, unit: 'MIN' },
                                    ].map(({ value, unit }, i) => (
                                        <div key={unit} className="flex items-center gap-3">
                                            {i > 0 && (
                                                <span
                                                    className="text-2xl font-bold"
                                                    style={{ color: `${text_color}60` }}
                                                >
                                                    :
                                                </span>
                                            )}
                                            <div
                                                className="rounded-xl px-4 py-3 text-center min-w-[60px]"
                                                style={{ backgroundColor: `${text_color}15` }}
                                            >
                                                <div
                                                    className="text-2xl font-bold tabular-nums"
                                                    style={{ color: text_color }}
                                                >
                                                    {value}
                                                </div>
                                                <div
                                                    className="text-[10px] font-medium tracking-widest uppercase"
                                                    style={{ color: `${text_color}80` }}
                                                >
                                                    {unit}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}

                            {ctaButtons}
                        </div>

                        {/* Right: 2x2 gallery grid */}
                        <motion.div
                            {...fadeUp(0.3)}
                            className="grid grid-cols-2 gap-4"
                        >
                            {Array.from({ length: gallery_count }, (_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.6, delay: 0.4 + i * 0.1 }}
                                    className="aspect-square rounded-2xl flex items-center justify-center"
                                    style={{ backgroundColor: `${text_color}12` }}
                                >
                                    <span
                                        className="text-3xl font-light tabular-nums"
                                        style={{ color: `${text_color}30` }}
                                    >
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </section>
        );
    }

    // ── Luxury Centered ──
    if (isLuxury) {
        return (
            <section
                className="relative overflow-hidden"
                style={{ backgroundColor: background_gradient_start }}
            >
                {announcementBar}
                {backgroundLayer}

                <div className="container mx-auto px-4 sm:px-6 relative z-10 py-28 md:py-40 lg:py-48">
                    <div className="max-w-3xl mx-auto text-center">
                        {/* Decorative line + label */}
                        <motion.div
                            {...fadeUp(0)}
                            className="flex items-center justify-center gap-4 mb-6"
                        >
                            <div className="w-12 h-px" style={{ backgroundColor: accent_color }} />
                            {label && (
                                <span
                                    className="text-xs font-medium tracking-[0.2em] uppercase"
                                    style={{ color: accent_color }}
                                >
                                    {label}
                                </span>
                            )}
                            <div className="w-12 h-px" style={{ backgroundColor: accent_color }} />
                        </motion.div>

                        <motion.h1
                            {...fadeUp(0.15)}
                            className="leading-[1.15] tracking-tight"
                            style={{
                                color: text_color,
                                fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
                                fontWeight: 400,
                            }}
                        >
                            {resolvedHeadline}
                        </motion.h1>

                        <motion.p
                            {...fadeUp(0.25)}
                            className="mt-6 mb-10 max-w-xl mx-auto font-light leading-relaxed"
                            style={{
                                color: `${text_color}99`,
                                fontSize: 'clamp(0.95rem, 1.5vw, 1.1rem)',
                            }}
                            dangerouslySetInnerHTML={{ __html: sanitizeWithLineBreaks(subheading) }}
                        />

                        {/* Single CTA with outline style */}
                        <motion.div {...fadeUp(0.35)}>
                            <Link to={cta_primary_link}>
                                <Button
                                    variant="outline"
                                    className="px-10 py-3.5 text-sm font-medium tracking-[0.15em] uppercase h-auto transition-colors duration-300"
                                    style={{
                                        borderColor: accent_color,
                                        color: accent_color,
                                        backgroundColor: 'transparent',
                                    }}
                                >
                                    {cta_primary_text}
                                </Button>
                            </Link>
                        </motion.div>

                        {/* Bottom decorative line */}
                        <motion.div
                            {...fadeUp(0.45)}
                            className="flex justify-center mt-16"
                        >
                            <div className="w-12 h-px" style={{ backgroundColor: `${accent_color}40` }} />
                        </motion.div>
                    </div>
                </div>
            </section>
        );
    }

    // ── Default: Centered ──
    return (
        <section
            className="relative min-h-[80vh] aspect-[21/9] flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: background_gradient_start }}
        >
            {announcementBar}
            {backgroundLayer}

            <div className="container mx-auto px-4 sm:px-6 relative z-10">
                <div className="max-w-4xl mx-auto text-center">
                    {label && (
                        <motion.div
                            {...fadeUp(0)}
                            className="text-sm font-medium tracking-widest uppercase mb-4"
                            style={{ color: accent_color }}
                        >
                            {label}
                        </motion.div>
                    )}

                    <motion.h1
                        {...fadeUp(0.1)}
                        className="font-bold leading-tight tracking-tight"
                        style={{
                            color: text_color,
                            fontSize: 'clamp(2.25rem, 6vw, 5rem)',
                        }}
                    >
                        {resolvedHeadline}
                    </motion.h1>

                    <motion.p
                        {...fadeUp(0.2)}
                        className="mt-6 mb-10 max-w-2xl mx-auto font-light leading-relaxed"
                        style={{
                            color: `${text_color}CC`,
                            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                        }}
                        dangerouslySetInnerHTML={{ __html: sanitizeWithLineBreaks(subheading) }}
                    />

                    {ctaButtons}
                    {trustBadgesEl}
                </div>
            </div>
        </section>
    );
}
