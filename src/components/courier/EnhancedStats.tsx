import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Package, Clock, DollarSign, Star, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface EnhancedStatsProps {
  todayDeliveries: number;
  todayEarnings: number;
  avgDeliveryTime: number;
  completionRate: number;
  rating: number;
  weeklyGoal?: number;
}

export default function EnhancedStats({
  todayDeliveries,
  todayEarnings,
  avgDeliveryTime,
  completionRate,
  rating,
  weeklyGoal = 50
}: EnhancedStatsProps) {
  const stats = [
    {
      label: 'Today\'s Deliveries',
      value: todayDeliveries,
      target: 10,
      icon: Package,
      color: 'text-primary',
      bg: 'bg-primary/10',
      suffix: '',
      progressColor: 'bg-primary'
    },
    {
      label: 'Today\'s Earnings',
      value: todayEarnings,
      target: 100,
      icon: DollarSign,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      prefix: '$',
      suffix: '',
      progressColor: 'bg-green-500'
    },
    {
      label: 'Avg Time',
      value: avgDeliveryTime,
      target: 30,
      icon: Clock,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      suffix: 'min',
      progressColor: 'bg-blue-500',
      inverse: true // Lower is better
    },
    {
      label: 'Completion Rate',
      value: completionRate,
      target: 100,
      icon: TrendingUp,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      suffix: '%',
      progressColor: 'bg-purple-500'
    },
    {
      label: 'Rating',
      value: rating,
      target: 5,
      icon: Star,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
      suffix: '/5',
      progressColor: 'bg-yellow-500'
    }
  ];

  return (
    <div className="space-y-3">
      {/* Main Earnings Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground overflow-hidden">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm opacity-90">Today's Total</p>
                  <p className="text-4xl font-black mt-1">${todayEarnings.toFixed(2)}</p>
                </div>
                <div className="bg-white/10 p-3 rounded-full">
                  <DollarSign className="w-8 h-8" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center mt-4 pt-4 border-t border-white/20">
                <div>
                  <p className="text-2xl font-bold">{todayDeliveries}</p>
                  <p className="text-xs opacity-75">Deliveries</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{rating.toFixed(1)}</p>
                  <p className="text-xs opacity-75">Rating</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{completionRate}%</p>
                  <p className="text-xs opacity-75">Complete</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Detailed Stats with Progress */}
      <div className="grid grid-cols-2 gap-3">
        {stats.slice(0, 4).map((stat, index) => {
          const progress = stat.inverse 
            ? Math.max(0, 100 - (stat.value / stat.target) * 100)
            : Math.min((stat.value / stat.target) * 100, 100);

          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`${stat.bg} p-2 rounded-lg`}>
                      <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        {stat.prefix}{stat.value.toFixed(stat.suffix === 'min' ? 0 : 2)}{stat.suffix}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{stat.label}</span>
                      <span className="font-medium">{progress.toFixed(0)}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Weekly Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <span className="font-semibold">Weekly Goal</span>
              </div>
              <span className="text-sm font-medium">
                {todayDeliveries * 5}/{weeklyGoal} deliveries
              </span>
            </div>
            <Progress value={(todayDeliveries * 5 / weeklyGoal) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {weeklyGoal - (todayDeliveries * 5)} more to hit your weekly goal
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}