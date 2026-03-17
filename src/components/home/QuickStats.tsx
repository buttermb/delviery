/**
 * Quick Stats Banner
 * Shows impressive numbers and trust signals
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Users, Package, Truck, Star } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';

export function QuickStats() {
  const { data: stats } = useQuery({
    queryKey: queryKeys.home.quickStats(),
    queryFn: async () => {
      const [ordersResult, reviewsResult, customersResult] = await Promise.all([
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'delivered'),
        supabase
          .from('reviews')
          .select('rating'),
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true }),
      ]);

      const ratings = reviewsResult.data ?? [];
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratings.length
        : 0;

      return {
        totalOrders: ordersResult.count ?? 0,
        totalReviews: ratings.length,
        avgRating: Math.round(avgRating * 10) / 10,
        totalCustomers: customersResult.count ?? 0,
      };
    }
  });

  if (!stats) return null;

  const items = [
    { icon: Package, value: `${stats.totalOrders.toLocaleString()}+`, label: 'Orders Delivered' },
    { icon: Users, value: `${stats.totalCustomers.toLocaleString()}+`, label: 'Happy Customers' },
    { icon: Star, value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—', label: 'Average Rating' },
    { icon: Truck, value: `${stats.totalReviews}`, label: 'Reviews' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 py-8"
    >
      <div className="container px-4 mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="flex justify-center mb-2">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-primary">
                  {item.value}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground mt-1">
                  {item.label}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}


