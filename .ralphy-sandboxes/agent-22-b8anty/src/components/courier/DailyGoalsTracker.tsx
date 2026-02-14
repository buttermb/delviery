import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy, Target, Zap, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface DailyGoalsTrackerProps {
  deliveriesToday: number;
  earningsToday: number;
}

export default function DailyGoalsTracker({ deliveriesToday, earningsToday }: DailyGoalsTrackerProps) {
  const goals = [
    {
      id: 'deliveries',
      label: '10 Deliveries',
      current: deliveriesToday,
      target: 10,
      icon: Target,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      reward: '$10 bonus'
    },
    {
      id: 'earnings',
      label: '$100 Earnings',
      current: earningsToday,
      target: 100,
      icon: Trophy,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      reward: '$15 bonus',
      prefix: '$'
    },
    {
      id: 'streak',
      label: '5 Hour Streak',
      current: deliveriesToday >= 5 ? 5 : deliveriesToday,
      target: 5,
      icon: Zap,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      reward: '$5 bonus'
    }
  ];

  const completedGoals = goals.filter(g => g.current >= g.target).length;
  const totalGoals = goals.length;
  const overallProgress = (completedGoals / totalGoals) * 100;

  return (
    <Card className="bg-gradient-to-br from-card to-muted/20 border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Daily Goals
          </CardTitle>
          <div className="text-sm font-semibold">
            {completedGoals}/{totalGoals} Complete
          </div>
        </div>
        <Progress value={overallProgress} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        {goals.map((goal, index) => {
          const progress = Math.min((goal.current / goal.target) * 100, 100);
          const isComplete = goal.current >= goal.target;

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-3 rounded-lg border ${isComplete ? 'border-green-500/50 bg-green-500/5' : 'border-border'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`${goal.bgColor} p-2 rounded-lg`}>
                  <goal.icon className={`w-4 h-4 ${goal.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{goal.label}</span>
                    {isComplete && (
                      <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                        ✓ Done!
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">
                      {goal.prefix}{goal.current.toFixed(0)} / {goal.prefix}{goal.target}
                    </span>
                    <span className="text-xs font-semibold text-primary">
                      {goal.reward}
                    </span>
                  </div>
                </div>
              </div>
              <Progress value={progress} className="h-1.5" />
            </motion.div>
          );
        })}

        {completedGoals === totalGoals && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mt-4 p-4 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 text-center"
          >
            <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
            <p className="font-bold text-sm">All Goals Complete! 🎉</p>
            <p className="text-xs text-muted-foreground mt-1">
              Total bonus: $30
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}