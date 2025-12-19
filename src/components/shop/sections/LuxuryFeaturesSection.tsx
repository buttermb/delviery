import { motion } from 'framer-motion';
import { Shield, Clock, Leaf, Award, Truck, HeartHandshake } from 'lucide-react';

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

const iconMap: Record<string, any> = {
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
    <section className="relative py-24 bg-black overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950" />

      {/* Subtle accent glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-3xl opacity-5"
        style={{ backgroundColor: accentColor }}
      />

      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-white font-serif italic text-4xl md:text-5xl tracking-tight mb-4">
            {heading}
          </h2>
          <p className="text-white/50 text-lg font-light font-sans tracking-wide">
            {subheading}
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = iconMap[feature.icon] || Shield;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group"
              >
                <div className="relative h-full p-8 bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] hover:border-white/20 rounded-2xl transition-all duration-500 hover:-translate-y-2">
                  {/* Hover glow */}
                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at top left, ${accentColor}15 0%, transparent 60%)`
                    }}
                  />

                  {/* Icon */}
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mb-6 relative border border-white/5 group-hover:border-white/20 transition-colors duration-500"
                    style={{
                      background: `linear-gradient(135deg, ${accentColor}10 0%, transparent 100%)`
                    }}
                  >
                    <Icon
                      className="w-6 h-6 transform group-hover:scale-110 transition-transform duration-500"
                      style={{ color: accentColor }}
                    />
                  </div>

                  {/* Content */}
                  <h3 className="text-white text-xl font-serif italic font-light tracking-wide mb-3 relative group-hover:text-white transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-white/40 text-sm font-sans font-light leading-relaxed relative group-hover:text-white/60 transition-colors">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
