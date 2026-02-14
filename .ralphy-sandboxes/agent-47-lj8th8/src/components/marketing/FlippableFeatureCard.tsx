import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle } from 'lucide-react';

interface FlippableFeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  link: string;
  benefits?: string[];
  metric?: { label: string; value: string };
}

export function FlippableFeatureCard({
  icon: Icon,
  title,
  description,
  link,
  benefits = [
    'Easy to use',
    'Fast setup',
    'Secure & reliable',
  ],
  metric = { label: 'Time Saved', value: '10hrs/week' },
}: FlippableFeatureCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <motion.div
      className="h-[420px] perspective-1000 cursor-pointer"
      onHoverStart={() => setIsFlipped(true)}
      onHoverEnd={() => setIsFlipped(false)}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="relative w-full h-full"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* FRONT SIDE */}
        <motion.div
          className="absolute inset-0 backface-hidden p-8 rounded-2xl bg-[hsl(var(--marketing-bg))] border border-[hsl(var(--marketing-border))] shadow-lg flex flex-col"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="mb-6">
            <Icon className="h-14 w-14 text-[hsl(var(--marketing-primary))]" />
          </div>
          <h3 className="text-xl font-bold mb-3 text-[hsl(var(--marketing-text))]">
            {title}
          </h3>
          <p className="text-[hsl(var(--marketing-text-light))] mb-6 flex-grow">
            {description}
          </p>
          <p className="text-sm text-[hsl(var(--marketing-accent))] font-medium mt-auto">
            Hover to see benefits →
          </p>
        </motion.div>

        {/* BACK SIDE */}
        <motion.div
          className="absolute inset-0 backface-hidden p-8 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl flex flex-col justify-between"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          <div>
            <h3 className="text-xl font-bold mb-6 text-white">
              {title}
            </h3>

            {benefits && (
              <ul className="space-y-3 mb-6">
                {benefits.map((benefit, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 text-white/90"
                  >
                    <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed">{benefit}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            {metric && (
              <div className="p-4 rounded-lg bg-white/10 backdrop-blur-sm">
                <div className="text-xs text-white/70 mb-1">{metric.label}</div>
                <div className="text-3xl font-bold text-white">{metric.value}</div>
              </div>
            )}

            <a
              href={link}
              className="inline-flex items-center gap-2 text-sm font-medium text-white hover:text-white/80 transition-colors border-b border-white/30 pb-1"
              onClick={(e) => e.stopPropagation()}
            >
              Learn More
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
