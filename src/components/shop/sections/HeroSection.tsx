import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { sanitizeBasicHtml } from '@/lib/utils/sanitize';

export interface HeroSectionProps {
    content: {
        heading_line_1: string;
        heading_line_2: string;
        heading_line_3: string;
        subheading: string;
        cta_primary_text: string;
        cta_primary_link: string;
        cta_secondary_text: string;
        cta_secondary_link: string;
        trust_badges?: boolean;
    };
    styles: {
        background_gradient_start: string;
        background_gradient_end: string;
        text_color: string;
        accent_color: string;
    };
}

export function HeroSection({ content, styles }: HeroSectionProps) {
    const heroRef = useRef<HTMLDivElement>(null);

    // Default props if missing
    const {
        heading_line_1 = "Premium",
        heading_line_2 = "Flower",
        heading_line_3 = "Delivered",
        subheading = "Curated strains. Same-day delivery.",
        cta_primary_text = "Explore Collection",
        cta_primary_link = "/shop",
        cta_secondary_text = "View Menu",
        cta_secondary_link = "/menu",
        trust_badges = true
    } = content || {};

    const {
        background_gradient_start = "#000000",
        background_gradient_end = "#022c22", // emerald-950
        text_color = "#ffffff",
        accent_color = "#34d399" // emerald-400
    } = styles || {};

    // Subtle parallax mouse movement
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!heroRef.current) return;
            const { clientX, clientY } = e;
            const x = (clientX / window.innerWidth - 0.5) * 10;
            const y = (clientY / window.innerHeight - 0.5) * 10;
            heroRef.current.style.transform = `translate(${x}px, ${y}px)`;
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <section className="relative min-h-dvh flex items-center justify-center overflow-hidden" style={{ backgroundColor: background_gradient_start }}>

            {/* Animated background */}
            <div className="absolute inset-0">
                {/* Base gradient */}
                <div
                    className="absolute inset-0 bg-gradient-to-br"
                    style={{
                        backgroundImage: `linear-gradient(to bottom right, ${background_gradient_start}, ${background_gradient_end})`
                    }}
                />

                {/* Animated floating orbs with parallax */}
                <div ref={heroRef} className="absolute inset-0 transition-transform duration-1000 ease-out">
                    <motion.div
                        initial={{ opacity: 0.3 }}
                        animate={{
                            opacity: [0.3, 0.15, 0.3],
                            scale: [1, 1.05, 1]
                        }}
                        transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-3xl"
                        style={{ backgroundColor: `${accent_color}10` }} // 10% opacity
                    />
                    <motion.div
                        initial={{ opacity: 0.3 }}
                        animate={{
                            opacity: [0.3, 0.15, 0.3],
                            scale: [1, 1.05, 1]
                        }}
                        transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 1
                        }}
                        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-3xl"
                        style={{ backgroundColor: `${accent_color}10` }}
                    />
                </div>

                {/* Noise texture */}
                <div
                    className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20viewBox%3D%220%200%20200%20200%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cfilter%20id%3D%22noiseFilter%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%223%22%20numOctaves%3D%224%22%20%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url(%23noiseFilter)%22%20%2F%3E%3C%2Fsvg%3E')]"
                />
            </div>

            {/* Content */}
            <div className="container mx-auto px-6 relative z-10">
                <div className="max-w-5xl mx-auto">

                    {/* Main headline */}
                    <div className="text-center px-4">

                        {/* Top line */}
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0 }}
                            className="font-extralight text-[clamp(4rem,15vw,9rem)] leading-[0.9] tracking-[-0.03em] mb-0"
                            style={{ color: text_color }}
                        >
                            {heading_line_1}
                        </motion.h1>

                        {/* Middle line - Gradient */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                            className="relative inline-block"
                        >
                            <h1
                                className="text-transparent bg-clip-text font-light text-[clamp(4rem,15vw,9rem)] leading-[0.9] tracking-[-0.03em] my-0"
                                style={{ backgroundImage: `linear-gradient(to right, ${accent_color}, white)` }}
                            >
                                {heading_line_2}
                            </h1>
                            {/* Subtle glow effect */}
                            <div
                                className="absolute inset-0 blur-2xl opacity-20 pointer-events-none"
                                style={{ backgroundImage: `linear-gradient(to right, ${accent_color}, white)` }}
                            />
                        </motion.div>

                        {/* Bottom line */}
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
                            className="font-extralight text-[clamp(4rem,15vw,9rem)] leading-[0.9] tracking-[-0.03em] mt-0"
                            style={{ color: text_color }}
                        >
                            {heading_line_3}
                        </motion.h1>

                    </div>

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.6 }}
                        className="text-center text-lg md:text-xl font-light leading-relaxed mt-12 mb-12 max-w-2xl mx-auto"
                        style={{ color: `${text_color}80` }} // 50% opacity
                        dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(subheading) }} // Sanitized HTML - allows only basic formatting
                    />

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.8 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <Link to={cta_primary_link}>
                            <Button
                                className="group relative px-10 py-4 text-sm font-light tracking-wide rounded-full transition-all duration-300 shadow-lg hover:scale-105 h-auto text-black bg-white hover:bg-gray-100"
                            >
                                <span className="relative z-10">{cta_primary_text}</span>
                            </Button>
                        </Link>

                        <Link to={cta_secondary_link}>
                            <Button
                                variant="outline"
                                className="px-10 py-4 text-sm font-light tracking-wide rounded-full border transition-all duration-300 h-auto backdrop-blur-sm"
                                style={{
                                    borderColor: `${text_color}20`,
                                    color: text_color,
                                    backgroundColor: `${text_color}0D` // 5% opacity
                                }}
                            >
                                {cta_secondary_text}
                            </Button>
                        </Link>
                    </motion.div>

                    {/* Trust badges */}
                    {trust_badges && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 1.0 }}
                            className="flex items-center justify-center gap-8 mt-16 text-xs font-light tracking-wider flex-wrap"
                            style={{ color: `${text_color}50` }}
                        >
                            <span className="flex items-center gap-2">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: accent_color }}>
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Licensed
                            </span>
                            <span className="flex items-center gap-2">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: accent_color }}>
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Lab Verified
                            </span>
                            <span className="flex items-center gap-2">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: accent_color }}>
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Same-Day
                            </span>
                        </motion.div>
                    )}

                </div>
            </div>

        </section>
    );
}
