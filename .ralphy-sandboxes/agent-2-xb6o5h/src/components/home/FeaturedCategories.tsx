/**
 * Featured Categories Section
 * Premium category showcase with elegant design
 */

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Leaf, Cookie, Droplets, Wind, Cigarette, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const categories = [
  {
    id: 'flower',
    name: 'Flower',
    icon: Leaf,
    gradient: 'from-emerald-500 via-green-400 to-teal-500',
    desc: 'Premium flower strains',
    count: 12
  },
  {
    id: 'edibles',
    name: 'Edibles',
    icon: Cookie,
    gradient: 'from-amber-400 via-orange-400 to-yellow-500',
    desc: 'Gummies & treats',
    count: 8
  },
  {
    id: 'concentrates',
    name: 'Concentrates',
    icon: Droplets,
    gradient: 'from-purple-400 via-pink-400 to-rose-500',
    desc: 'High-potency extracts',
    count: 15
  },
  {
    id: 'vapes',
    name: 'Vapes',
    icon: Wind,
    gradient: 'from-cyan-400 via-blue-400 to-teal-500',
    desc: 'Cartridges & disposables',
    count: 10
  },
  {
    id: 'pre-rolls',
    name: 'Pre-Rolls',
    icon: Cigarette,
    gradient: 'from-orange-400 via-amber-400 to-yellow-500',
    desc: 'Ready to enjoy',
    count: 6
  }
];

export function FeaturedCategories() {
  const scrollToCategory = (_category: string) => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
    // Could trigger category filter here
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="py-16 md:py-24 bg-black"
    >
      <div className="container px-4 mx-auto max-w-7xl">
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium text-primary uppercase tracking-wider">Browse Collection</p>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Shop by Category
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover our premium selection of carefully curated products
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {categories.map((category, index) => {
            const Icon = category.icon;
            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group"
              >
                <Card
                  className="cursor-pointer h-full overflow-hidden border-2 border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-2xl"
                  onClick={() => scrollToCategory(category.id)}
                >
                  {/* Premium gradient background */}
                  <div className={cn(
                    'relative h-full overflow-hidden',
                    'bg-gradient-to-br from-card to-card/90'
                  )}>
                    {/* Subtle gradient overlay on hover */}
                    <div className={cn(
                      'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                      `bg-gradient-to-br ${category.gradient} mix-blend-soft-light`
                    )} />
                    
                    {/* Content */}
                    <div className="relative p-8 space-y-6">
                      {/* Icon with gradient glow */}
                      <div className={cn(
                        'relative w-20 h-20 mx-auto rounded-2xl',
                        'bg-gradient-to-br p-4',
                        'shadow-lg',
                        'flex items-center justify-center',
                        'transform transition-transform duration-300',
                        'group-hover:scale-110 group-hover:rotate-3',
                        `bg-gradient-to-br ${category.gradient}`
                      )}>
                        <Icon className="h-10 w-10 text-white drop-shadow-lg" />
                        <div className={cn(
                          'absolute inset-0 rounded-2xl',
                          'bg-white/20 blur-xl',
                          'group-hover:blur-2xl transition-all duration-500'
                        )} />
                      </div>

                      {/* Category info */}
                      <div className="space-y-2 text-center">
                        <h3 className="text-xl font-bold tracking-tight group-hover:text-primary transition-colors">
                          {category.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {category.desc}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center justify-center gap-2 pt-4 border-t border-border/50">
                        <span className="text-xs font-medium text-muted-foreground">
                          {category.count} items
                        </span>
                      </div>

                      {/* Premium button */}
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full bg-background/50 backdrop-blur-sm border-primary/20 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300"
                      >
                        <span className="font-medium">Explore</span>
                        <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>

                    {/* Decorative corner accent */}
                    <div className={cn(
                      'absolute top-0 right-0 w-20 h-20 -translate-y-10 translate-x-10',
                      'opacity-0 group-hover:opacity-20 transition-opacity duration-500',
                      `bg-gradient-to-br ${category.gradient} rounded-full blur-3xl`
                    )} />
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

