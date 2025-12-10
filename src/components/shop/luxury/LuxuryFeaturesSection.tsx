/**
 * Luxury Features Section - Trust badges with dark theme glassmorphism
 */

import { Shield, Truck, Clock, Award, CheckCircle, Leaf } from 'lucide-react';

interface LuxuryFeaturesSectionProps {
    content?: {
        heading?: string;
        subheading?: string;
        features?: Array<{
            icon: string;
            title: string;
            description: string;
        }>;
    };
    styles?: {
        accent_color?: string;
    };
}

const defaultFeatures = [
    {
        icon: 'shield',
        title: 'Licensed & Legal',
        description: 'Fully licensed and compliant with all state regulations',
    },
    {
        icon: 'truck',
        title: 'Same-Day Delivery',
        description: 'Fast, discreet delivery throughout the service area',
    },
    {
        icon: 'award',
        title: 'Lab Tested',
        description: 'All products verified for quality and purity',
    },
    {
        icon: 'clock',
        title: 'Always Fresh',
        description: 'Curated selection kept at optimal conditions',
    },
];

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    shield: Shield,
    truck: Truck,
    clock: Clock,
    award: Award,
    check: CheckCircle,
    leaf: Leaf,
};

export function LuxuryFeaturesSection({ content, styles }: LuxuryFeaturesSectionProps) {
    const accentColor = styles?.accent_color || '#10b981';
    const features = content?.features || defaultFeatures;

    return (
        <section className="py-24 bg-black relative overflow-hidden">
            {/* Subtle ambient lighting */}
            <div className="absolute inset-0 pointer-events-none">
                <div
                    className="absolute bottom-0 right-1/4 w-[600px] h-[400px] rounded-full blur-3xl opacity-5"
                    style={{ backgroundColor: accentColor }}
                />
            </div>

            <div className="container mx-auto px-6 relative z-10">
                {/* Header */}
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-extralight text-white mb-4">
                        {content?.heading || 'Why Choose Us'}
                    </h2>
                    <p className="text-white/50 font-light max-w-2xl mx-auto">
                        {content?.subheading || 'Safe, legal, and convenient delivery you can trust'}
                    </p>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {features.map((feature, index) => {
                        const IconComponent = iconMap[feature.icon] || Shield;

                        return (
                            <div
                                key={index}
                                className="group relative p-8 bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/[0.05] hover:border-white/[0.1] transition-all duration-500"
                            >
                                {/* Icon */}
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-colors duration-300"
                                    style={{
                                        backgroundColor: `${accentColor}15`,
                                    }}
                                >
                                    <IconComponent
                                        className="w-6 h-6 transition-colors duration-300"
                                        style={{ color: accentColor }}
                                    />
                                </div>

                                {/* Content */}
                                <h3 className="text-white font-light text-lg mb-3">
                                    {feature.title}
                                </h3>
                                <p className="text-white/40 text-sm font-light leading-relaxed">
                                    {feature.description}
                                </p>

                                {/* Hover accent line */}
                                <div
                                    className="absolute bottom-0 left-0 w-0 h-[2px] group-hover:w-full transition-all duration-500"
                                    style={{ backgroundColor: accentColor }}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Trust indicators */}
                <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-white/20 text-xs font-light tracking-wider">
                    <span className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3" style={{ color: accentColor }} />
                        Licensed Retailer
                    </span>
                    <span className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3" style={{ color: accentColor }} />
                        21+ Only
                    </span>
                    <span className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3" style={{ color: accentColor }} />
                        Secure Checkout
                    </span>
                    <span className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3" style={{ color: accentColor }} />
                        Discreet Packaging
                    </span>
                </div>
            </div>
        </section>
    );
}
