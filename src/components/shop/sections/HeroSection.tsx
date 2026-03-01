import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { sanitizeWithLineBreaks } from '@/lib/utils/sanitize';

export interface HeroSectionProps {
    content: {
        heading_line_1?: string;
        heading_line_2?: string;
        heading_line_3?: string;
        headline?: string;
        subheading?: string;
        cta_primary_text?: string;
        cta_primary_link?: string;
        cta_secondary_text?: string;
        cta_secondary_link?: string;
        background_image?: string;
        trust_badges?: boolean;
        announcement_banner?: string;
    };
    styles: {
        background_gradient_start?: string;
        background_gradient_end?: string;
        text_color?: string;
        accent_color?: string;
        overlay_opacity?: number;
    };
}

export function HeroSection({ content, styles }: HeroSectionProps) {
    const {
        heading_line_1,
        heading_line_2,
        heading_line_3,
        headline,
        subheading = 'Curated strains. Same-day delivery.',
        cta_primary_text = 'Shop Now',
        cta_primary_link = '/shop',
        cta_secondary_text,
        cta_secondary_link,
        background_image,
        trust_badges = false,
        announcement_banner,
    } = content || {};

    const {
        background_gradient_start = '#000000',
        background_gradient_end = '#022c22',
        text_color = '#ffffff',
        accent_color = '#34d399',
        overlay_opacity = 0.6,
    } = styles || {};

    // Build headline from either `headline` field or legacy `heading_line_*` fields
    const resolvedHeadline = headline
        || [heading_line_1, heading_line_2, heading_line_3].filter(Boolean).join(' ')
        || 'Premium Flower Delivered';

    const hasImage = Boolean(background_image);

    return (
        <section
            className="relative min-h-[80vh] aspect-[21/9] flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: background_gradient_start }}
        >
            {/* Announcement Banner */}
            {announcement_banner && (
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
            )}

            {/* Background: image or fallback gradient */}
            <div className="absolute inset-0">
                {hasImage ? (
                    <>
                        <img
                            src={background_image}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        {/* Gradient overlay on image */}
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

            {/* Content */}
            <div className="container mx-auto px-4 sm:px-6 relative z-10">
                <div className="max-w-4xl mx-auto text-center">

                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="font-bold leading-tight tracking-tight"
                        style={{
                            color: text_color,
                            fontSize: 'clamp(2.25rem, 6vw, 5rem)',
                        }}
                    >
                        {resolvedHeadline}
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                        className="mt-6 mb-10 max-w-2xl mx-auto font-light leading-relaxed"
                        style={{
                            color: `${text_color}CC`,
                            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                        }}
                        dangerouslySetInnerHTML={{ __html: sanitizeWithLineBreaks(subheading) }}
                    />

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <Link to={cta_primary_link} className="w-full sm:w-auto">
                            <Button
                                className="w-full sm:w-auto px-8 py-3 text-base font-medium rounded-full h-auto transition-transform duration-200 hover:scale-105"
                                style={{
                                    backgroundColor: accent_color,
                                    color: background_gradient_start,
                                }}
                            >
                                {cta_primary_text}
                            </Button>
                        </Link>

                        {cta_secondary_text && cta_secondary_link && (
                            <Link to={cta_secondary_link} className="w-full sm:w-auto">
                                <Button
                                    variant="outline"
                                    className="w-full sm:w-auto px-8 py-3 text-base font-medium rounded-full h-auto backdrop-blur-sm transition-colors duration-200"
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

                    {/* Trust badges */}
                    {trust_badges && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.6 }}
                            className="flex items-center justify-center gap-4 sm:gap-8 mt-12 text-xs font-light tracking-wider flex-wrap"
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
                    )}
                </div>
            </div>
        </section>
    );
}
