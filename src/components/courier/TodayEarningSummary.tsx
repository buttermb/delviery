import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DollarSign, TrendingUp, Gift, Clock, Target } from 'lucide-react';
import { motion } from 'framer-motion';

interface TodayEarningSummaryProps {
  earnings: number;
  commission: number;
  tips: number;
  bonuses: number;
  deliveries: number;
  hoursWorked?: number;
  dailyGoal?: number;
}

export default function TodayEarningSummary({
  earnings,
  commission,
  tips,
  bonuses,
  deliveries,
  hoursWorked = 0,
  dailyGoal = 100
}: TodayEarningSummaryProps) {
  const progress = Math.min((earnings / dailyGoal) * 100, 100);
  const hourlyRate = hoursWorked > 0 ? earnings / hoursWorked : 0;
  const avgPerDelivery = deliveries > 0 ? earnings / deliveries : 0;

  return (
    <div className="space-y-3">
      {/* Main Earnings Display */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm opacity-90 mb-1">Today's Earnings</p>
                <p className="text-5xl font-black tracking-tight">
                  ${earnings.toFixed(2)}
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                <DollarSign className="w-7 h-7" />
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-90">Daily Goal Progress</span>
                <span className="font-bold">{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-white/20" />
              <p className="text-xs opacity-75">
                ${(dailyGoal - earnings).toFixed(2)} to reach ${dailyGoal} goal
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/20">
              <div className="text-center">
                <p className="text-xl font-bold">{deliveries}</p>
                <p className="text-xs opacity-75">Deliveries</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">${avgPerDelivery.toFixed(2)}</p>
                <p className="text-xs opacity-75">Per Order</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">${hourlyRate.toFixed(2)}</p>
                <p className="text-xs opacity-75">Per Hour</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-3 gap-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-card">
            <CardContent className="p-3 text-center">
              <div className="bg-primary/10 p-2 rounded-full w-fit mx-auto mb-2">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <p className="text-lg font-bold text-primary">${commission.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Commission</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-card">
            <CardContent className="p-3 text-center">
              <div className="bg-green-500/10 p-2 rounded-full w-fit mx-auto mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-lg font-bold text-green-600">${tips.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Tips</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-card">
            <CardContent className="p-3 text-center">
              <div className="bg-purple-500/10 p-2 rounded-full w-fit mx-auto mb-2">
                <Gift className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-lg font-bold text-purple-600">${bonuses.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Bonuses</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Performance Insights */}
      {deliveries > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Performance Insights
              </h4>
              <div className="space-y-2 text-xs">
                {avgPerDelivery > 15 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="w-3 h-3" />
                    <span>Great! Above average earnings per delivery</span>
                  </div>
                )}
                {hourlyRate > 25 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <DollarSign className="w-3 h-3" />
                    <span>Excellent hourly rate! Keep it up!</span>
                  </div>
                )}
                {tips / earnings > 0.3 && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Gift className="w-3 h-3" />
                    <span>Customers love your service! High tip ratio</span>
                  </div>
                )}
                {deliveries >= 5 && (
                  <div className="flex items-center gap-2 text-purple-600">
                    <Target className="w-3 h-3" />
                    <span>You're on a roll! Keep the momentum going</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}