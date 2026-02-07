import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedMetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  gradient?: boolean;
  onClick?: () => void;
  delay?: number;
}

export function AnimatedMetricCard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  gradient,
  onClick,
  delay = 0
}: AnimatedMetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={onClick ? { scale: 0.98 } : {}}
    >
      <Card 
        className={cn(
          "relative overflow-hidden transition-all duration-300 hover:shadow-xl cursor-pointer border-2",
          gradient && "bg-gradient-to-br from-primary/10 via-background to-background border-primary/30"
        )}
        onClick={onClick}
      >
        {/* Animated Background Effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300"
          initial={false}
        />

        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
          >
            <Icon className="h-5 w-5 text-primary" />
          </motion.div>
        </CardHeader>
        
        <CardContent className="relative z-10">
          <motion.div
            key={value}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="text-3xl font-black bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent"
          >
            {value}
          </motion.div>
          
          {trend && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2 mt-2"
            >
              <Badge 
                variant={trendUp ? "default" : "secondary"}
                className="text-xs"
              >
                {trendUp ? "↗" : "↘"} {trend}
              </Badge>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
