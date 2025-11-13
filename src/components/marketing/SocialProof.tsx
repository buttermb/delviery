import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, TrendingUp, Zap } from 'lucide-react';

interface Activity {
  id: string;
  type: 'signup' | 'purchase' | 'milestone';
  message: string;
  timestamp: Date;
}

const mockActivities: Activity[] = [
  { id: '1', type: 'signup', message: 'Sarah from New York just signed up', timestamp: new Date() },
  { id: '2', type: 'purchase', message: 'Team from London upgraded to Pro', timestamp: new Date() },
  { id: '3', type: 'milestone', message: '1,000+ businesses using FloraIQ', timestamp: new Date() },
  { id: '4', type: 'signup', message: 'Alex from Singapore joined', timestamp: new Date() },
  { id: '5', type: 'purchase', message: 'Startup from Berlin went Enterprise', timestamp: new Date() },
];

export function SocialProof() {
  const [currentActivity, setCurrentActivity] = useState<Activity>(mockActivities[0]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % mockActivities.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCurrentActivity(mockActivities[index]);
  }, [index]);

  const getIcon = (type: Activity['type']) => {
    switch (type) {
      case 'signup':
        return <Users className="w-4 h-4" />;
      case 'purchase':
        return <TrendingUp className="w-4 h-4" />;
      case 'milestone':
        return <Zap className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-40 hidden lg:block">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentActivity.id}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ duration: 0.4 }}
          className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-4 max-w-xs"
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              {getIcon(currentActivity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {currentActivity.message}
              </p>
              <p className="text-xs text-muted-foreground">Just now</p>
            </div>
          </div>
          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 4, ease: 'linear' }}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
