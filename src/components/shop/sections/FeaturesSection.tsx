import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { FEATURES_ICON_MAP } from '@/components/shop/sections/featuresIconMap';

export interface FeaturesSectionProps {
    content: {
        heading_small: string;
        heading_large: string;
        features: Array<{
            icon: string;
            title: string;
            description: string;
        }>;
    };
    styles: {
        background_color: string;
        text_color: string;
        icon_color: string;
    };
}

const defaultFeatures = [
    {
        icon: 'clock',
        title: 'Same-Day Delivery',
        description: 'Order before 9 PM for delivery within the hour. Real-time tracking included.',
    },
    {
        icon: 'shield',
        title: 'Lab Verified',
        description: 'Every strain tested for purity, potency, and quality. Certificates available.',
    },
    {
        icon: 'lock',
        title: 'Discreet Service',
        description: 'Unmarked packaging. Professional couriers. Your privacy is our priority.',
    },
    {
        icon: 'star',
        title: 'Premium Selection',
        description: 'Hand-picked strains. Indoor cultivation. Top-shelf quality guaranteed.',
    },
];

export function FeaturesSection({ content, styles }: FeaturesSectionProps) {
    const {
        heading_small = "The Difference",
        heading_large = "Excellence in Every Detail",
        features: rawFeatures,
    } = content || {};

    const features = rawFeatures && rawFeatures.length > 0 ? rawFeatures : defaultFeatures;

    const {
        background_color = "#171717", // neutral-900
        text_color = "#ffffff",
        icon_color = "#34d399" // emerald-400
    } = styles || {};

    return (
        <section className="py-24 md:py-32" style={{ backgroundColor: background_color }}>
            <div className="container mx-auto px-6 max-w-7xl">

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-center mb-16 md:mb-20"
                >
                    <div className="text-sm font-light tracking-widest uppercase mb-4" style={{ color: icon_color }}>
                        {heading_small}
                    </div>
                    <h2 className="text-4xl sm:text-6xl md:text-7xl font-light mb-6 tracking-tight" style={{ color: text_color }}>
                        {heading_large}
                    </h2>
                </motion.div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
                    {features.map((feature, index) => {
                        const Icon = FEATURES_ICON_MAP[feature.icon] || Star;
                        return (
                            <motion.div
                                key={`${feature.icon}-${feature.title}`}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: index * 0.1 }}
                                className="text-center"
                            >
                                <div
                                    className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: `${icon_color}1a` }} // 10% opacity
                                >
                                    <Icon className="w-10 h-10" style={{ color: icon_color }} />
                                </div>
                                <h3 className="text-xl font-light mb-3 tracking-tight" style={{ color: text_color }}>
                                    {feature.title}
                                </h3>
                                <p className="text-sm font-light leading-relaxed" style={{ color: `${text_color}b3` }}> {/* 70% opacity */}
                                    {feature.description}
                                </p>
                            </motion.div>
                        );
                    })}
                </div>

            </div>
        </section>
    );
}
