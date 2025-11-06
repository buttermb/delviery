import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Users, ShoppingCart, Menu } from 'lucide-react';

interface Activity {
  id: number;
  message: string;
  location: string;
  time: string;
}

interface Stat {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}

export function LiveActivitySection() {
  const [activities, setActivities] = useState<Activity[]>([
    { id: 1, message: 'just created a secure menu', location: 'NYC', time: '2m ago' },
    { id: 2, message: 'processed an order', location: 'LA', time: '5m ago' },
    { id: 3, message: 'updated inventory', location: 'Chicago', time: '8m ago' },
    { id: 4, message: 'created a new menu', location: 'Miami', time: '12m ago' },
  ]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState<Stat[]>([
    { label: 'Orders Today', value: 2435, icon: ShoppingCart, color: 'text-blue-500' },
    { label: 'Users Online', value: 184, icon: Users, color: 'text-emerald-500' },
    { label: 'Menus Created', value: 892, icon: Menu, color: 'text-purple-500' },
  ]);

  // Rotate activities
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activities.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [activities.length]);

  // Animate stats
  useEffect(() => {
    const interval = setInterval(() => {
      setStats((prev) =>
        prev.map((stat) => ({
          ...stat,
          value: stat.value + Math.floor(Math.random() * 5),
        }))
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentActivity = activities[currentIndex];
  const names = ['John', 'Sarah', 'Mike', 'Emma', 'David', 'Lisa'];

  return (
    <section className="py-16 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Stats Counter */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="glass-card p-6 rounded-xl"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </div>
                <motion.div
                  className="text-3xl font-bold text-foreground"
                  key={stat.value}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {stat.value.toLocaleString()}
                </motion.div>
              </motion.div>
            ))}
          </div>

          {/* Live Activity Feed */}
          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <h3 className="text-lg font-semibold text-foreground">Live Activity</h3>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentActivity.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] flex items-center justify-center text-white font-semibold">
                  {names[Math.floor(Math.random() * names.length)][0]}
                </div>
                <div className="flex-1">
                  <p className="text-foreground">
                    <span className="font-semibold">
                      {names[Math.floor(Math.random() * names.length)]} from {currentActivity.location}
                    </span>{' '}
                    {currentActivity.message}
                  </p>
                  <p className="text-sm text-muted-foreground">{currentActivity.time}</p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Activity Indicators */}
            <div className="flex gap-1 mt-4 justify-center">
              {activities.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-1.5 rounded-full transition-all ${
                    index === currentIndex
                      ? 'w-8 bg-[hsl(var(--marketing-primary))]'
                      : 'w-1.5 bg-muted-foreground/30'
                  }`}
                  aria-label={`View activity ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

