import { motion } from 'framer-motion';
import { Shield, Clock, Leaf, Award, Truck, HeartHandshake, type LucideIcon } from 'lucide-react';

export interface LuxuryFeaturesSectionProps {
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

const iconMap: Record<string, LucideIcon> = {
  shield: Shield,
  clock: Clock,
  leaf: Leaf,
  award: Award,
  truck: Truck,
  heart: HeartHandshake,
};

const defaultFeatures = [
  {
    icon: 'shield',
    title: 'Licensed & Verified',
    description: 'NYS licensed dispensary with full compliance verification'
  },
  {
    icon: 'leaf',
    title: 'Lab Tested',
    description: 'All products are third-party tested for purity and potency'
  },
  {
    icon: 'clock',
    title: '30-Min Delivery',
    description: 'Fast, discreet delivery throughout NYC boroughs'
  },
  {
    icon: 'award',
    title: 'Premium Quality',
    description: 'Curated selection of top-shelf flower and concentrates'
  },
  {
    icon: 'truck',
    title: 'Free Delivery',
    description: 'Free delivery on orders over $100 within service areas'
  },
  {
    icon: 'heart',
    title: '24/7 Support',
    description: 'Dedicated customer support available around the clock'
  }
];

export function LuxuryFeaturesSection({ content, styles }: LuxuryFeaturesSectionProps) {
  const {
    heading = "Why Choose Us",
    subheading = "The premium difference",
    features = defaultFeatures
  } = content || {};

  const accentColor = styles?.accent_color || '#10b981';

  return (
    <section className="relative py-16 md:py-24 bg-black overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950" />

      {/* Subtle accent glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-3xl opacity-5"
        style={{ backgroundColor: accentColor }}
      />

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-10 md:mb-16"
        >
          <h2 className="text-white text-3xl md:text-4xl lg:text-5xl tracking-tight mb-4">
            {heading}
          </h2>
          <p className="text-white/50 text-lg font-light font-sans tracking-wide">
            {subheading}
          </p>
        </motion.div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto auto-rows-[180px]">
          {features.map((feature, index) => {
            const Icon = iconMap[feature.icon] || Shield;
            // First and fourth items are larger (span 2 columns)
            const isLarge = index === 0 || index === 3;

            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className={`group ${isLarge ? 'md:col-span-2' : ''}`}
              >
                <div className="relative h-full p-6 md:p-8 bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] hover:border-white/20 rounded-3xl transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-white/5 overflow-hidden">
                  {/* Animated gradient background on hover */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse at top left, ${accentColor}20 0%, transparent 50%)`
                    }}
                  />

                  {/* Corner accent */}
                  <div
                    className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-700"
                    style={{ backgroundColor: accentColor }}
                  />

                  <div className="relative z-10 h-full flex flex-col">
                    {/* Icon with gradient background */}
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border border-white/10 group-hover:border-white/20 transition-all duration-500 group-hover:scale-110"
                      style={{
                        background: `linear-gradient(135deg, ${accentColor}25 0%, ${accentColor}05 100%)`
                      }}
                    >
                      <Icon
                        className="w-5 h-5 transition-transform duration-500 group-hover:scale-110"
                        style={{ color: accentColor }}
                      />
                    </div>

                    {/* Content */}
                    <h3 className="text-white text-lg font-bold tracking-wide mb-2 group-hover:text-white transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-white/70 text-sm font-light leading-relaxed group-hover:text-white/60 transition-colors flex-1">
                      {feature.description}
                    </p>

                    {/* Subtle arrow indicator on large cards */}
                    {isLarge && (
                      <div className="flex items-center gap-1 mt-4 text-white/70 group-hover:text-white transition-colors">
                        <span className="text-xs font-medium uppercase tracking-wider">Learn more</span>
                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
