import { motion } from 'framer-motion';
import { CountUpNumber } from './CountUpNumber';
import { TrendingUp, Users, DollarSign, Clock, Star, Headphones } from 'lucide-react';

interface StatCardProps {
  value: string | number;
  label: string;
  index?: number;
  icon?: string;
}

import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  'Distributors': Users,
  'Orders/Month': DollarSign,
  'Saved/Week': Clock,
  'Uptime': TrendingUp,
  'Rating': Star,
  'Support': Headphones,
};

export function StatCard({ value, label, index = 0, icon }: StatCardProps) {
  // Extract numeric value for animation
  const numericValue = typeof value === 'string' 
    ? parseFloat(value.replace(/[^0-9.]/g, '')) 
    : value;
  
  const prefix = typeof value === 'string' && value.includes('$') ? '$' : '';
  const suffix = typeof value === 'string' 
    ? value.includes('+') ? '+' 
      : value.includes('%') ? '%'
      : value.includes('hrs') ? 'hrs'
      : value.includes('M') ? 'M'
      : value.includes('/7') ? '/7'
      : ''
    : '';

  const Icon = icon ? iconMap[icon] : iconMap[label];
  const decimals = typeof value === 'string' && (value.includes('.') || value.includes('M')) ? 1 : 0;

  return (
    <motion.div
      className="relative group"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ 
        delay: index * 0.1,
        type: 'spring',
        stiffness: 100,
        damping: 15
      }}
    >
      <motion.div 
        className="glass-card p-8 rounded-xl border border-border hover:border-[hsl(var(--marketing-primary))]/50 transition-colors relative overflow-hidden"
        whileHover={{ y: -5, scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={`stat-gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--marketing-primary))" stopOpacity="0.05" />
                <stop offset="100%" stopColor="hsl(var(--marketing-accent))" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill={`url(#stat-gradient-${index})`} />
          </svg>
        </div>

        {/* Floating particles */}
        <motion.div
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[hsl(var(--marketing-accent))]/30"
          animate={{
            y: [0, -10, 0],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: index * 0.2,
          }}
        />

        <div className="relative z-10 text-center">
          {/* Icon */}
          {Icon && (
            <motion.div
              className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[hsl(var(--marketing-primary))]/10 mb-4"
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                delay: index * 0.3,
              }}
            >
              <Icon className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
            </motion.div>
          )}

          {/* Animated Number */}
          <motion.div 
            className="text-5xl md:text-6xl font-bold mb-2 bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] bg-clip-text text-transparent"
            initial={{ scale: 0.5 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ 
              delay: index * 0.1 + 0.3,
              type: 'spring',
              stiffness: 200,
              damping: 15
            }}
          >
            {!isNaN(numericValue) ? (
              <>
                {prefix}
                <CountUpNumber 
                  end={numericValue} 
                  duration={2000}
                  decimals={decimals}
                />
                {suffix}
              </>
            ) : (
              value
            )}
          </motion.div>

          {/* Label */}
          <div className="text-lg text-[hsl(var(--marketing-text-light))] font-medium">
            {label}
          </div>

          {/* Progress bar indicator */}
          <motion.div
            className="h-1 bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] rounded-full mt-4 opacity-0 group-hover:opacity-100"
            initial={{ width: 0 }}
            whileInView={{ width: '100%' }}
            viewport={{ once: true }}
            transition={{ 
              delay: index * 0.1 + 0.5,
              duration: 1,
              ease: 'easeOut'
            }}
          />
        </div>

        {/* Corner accent */}
        <motion.div
          className="absolute -top-1 -right-1 w-8 h-8 bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] opacity-0 group-hover:opacity-20 rounded-bl-xl"
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: index * 0.2,
          }}
        />
      </motion.div>
    </motion.div>
  );
}

