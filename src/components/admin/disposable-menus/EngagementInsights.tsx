import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Lightbulb from "lucide-react/dist/esm/icons/lightbulb";
import Target from "lucide-react/dist/esm/icons/target";
import Users from "lucide-react/dist/esm/icons/users";
import Zap from "lucide-react/dist/esm/icons/zap";
import { motion } from 'framer-motion';

interface Insight {
  type: 'success' | 'warning' | 'info' | 'tip';
  title: string;
  description: string;
  metric?: string;
}

interface EngagementInsightsProps {
  insights: Insight[];
}

export const EngagementInsights = ({ insights }: EngagementInsightsProps) => {
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <Target className="h-5 w-5" />;
      case 'warning':
        return <Zap className="h-5 w-5" />;
      case 'info':
        return <Users className="h-5 w-5" />;
      default:
        return <Lightbulb className="h-5 w-5" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'warning':
        return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
      case 'info':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      default:
        return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
    }
  };

  const getInsightBadge = (type: string) => {
    switch (type) {
      case 'success':
        return 'High Performance';
      case 'warning':
        return 'Needs Attention';
      case 'info':
        return 'Insight';
      default:
        return 'Recommendation';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Engagement Insights
          </CardTitle>
          <p className="text-sm text-muted-foreground">AI-powered recommendations based on your data</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${getInsightColor(insight.type)}`}>
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{insight.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {getInsightBadge(insight.type)}
                      </Badge>
                    </div>
                    <p className="text-sm opacity-90">{insight.description}</p>
                    {insight.metric && (
                      <p className="text-xs font-mono mt-2 opacity-75">{insight.metric}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
