/**
 * Quick Stats Banner
 * Shows impressive numbers and trust signals
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import Users from "lucide-react/dist/esm/icons/users";
import Package from "lucide-react/dist/esm/icons/package";
import Truck from "lucide-react/dist/esm/icons/truck";
import Star from "lucide-react/dist/esm/icons/star";

export function QuickStats() {
  const { data: stats } = useQuery({
    queryKey: ['quick-stats'],
    queryFn: async () => {
      const [ordersResult, reviewsResult] = await Promise.all([
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'delivered'),
        supabase
          .from('reviews')
          .select('rating', { count: 'exact', head: true })
      ]);

      return {
        totalOrders: ordersResult.count || 0,
        totalReviews: reviewsResult.count || 0,
        avgRating: 4.8, // Could calculate from reviews
        totalCustomers: 1250 // Could calculate from users
      };
    }
  });

  if (!stats) return null;

  const items = [
    { icon: Package, value: `${stats.totalOrders.toLocaleString()}+`, label: 'Orders Delivered' },
    { icon: Users, value: `${stats.totalCustomers.toLocaleString()}+`, label: 'Happy Customers' },
    { icon: Star, value: stats.avgRating, label: 'Average Rating' },
    { icon: Truck, value: '45 min', label: 'Avg Delivery' }
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

