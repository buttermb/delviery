import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    <div 
      className="relative h-[280px] cursor-pointer perspective-1000"
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="relative w-full h-full"
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front Side */}
        <motion.div
          className="absolute inset-0 w-full h-full backface-hidden"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="glass-card p-6 rounded-xl h-full flex flex-col border border-border hover:border-primary/50 transition-colors group">
            <motion.div 
              className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Icon className="h-7 w-7 text-white" />
            </motion.div>
            <h3 className="text-xl font-bold mb-3 text-foreground">{title}</h3>
            <p className="text-muted-foreground text-sm flex-grow">{description}</p>
            <div className="mt-4 text-xs text-primary font-medium flex items-center gap-1">
              Hover to explore
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </motion.div>

        {/* Back Side */}
        <motion.div
          className="absolute inset-0 w-full h-full backface-hidden"
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="glass-card p-6 rounded-xl h-full flex flex-col bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/30">
            <div className="flex items-center gap-2 mb-4">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-foreground">{title}</h3>
            </div>

            {/* Benefits */}
            <div className="space-y-2 mb-4 flex-grow">
              {benefits.map((benefit, index) => (
                  <motion.div
                    key={index}
                    className="flex items-start gap-3"
                    initial={{ opacity: 0, x: -10 }}
                    animate={isFlipped ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                    transition={{ 
                      type: 'spring' as const,
                      stiffness: 300,
                      damping: 25,
                      delay: index * 0.05,
                    }}
                  >
                  <CheckCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">{benefit}</span>
                </motion.div>
              ))}
            </div>

            {/* Metric */}
            <motion.div
              className="bg-card/50 rounded-lg p-3 mb-3 text-center"
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring' as const, stiffness: 400, damping: 20 }}
            >
              <div className="text-2xl font-bold text-primary">{metric.value}</div>
              <div className="text-xs text-muted-foreground">{metric.label}</div>
            </motion.div>

            {/* CTA */}
            <Link to={link}>
              <Button variant="outline" size="sm" className="w-full group/btn">
                Learn More
                <ArrowRight className="ml-2 h-3 w-3 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
