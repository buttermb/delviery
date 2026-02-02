import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import Clock from "lucide-react/dist/esm/icons/clock";

interface HeatmapData {
  hour: number;
  day: string;
  views: number;
}

interface ViewingPatternHeatmapProps {
  data?: HeatmapData[];
  title?: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const ViewingPatternHeatmap = ({ 
  data = [],
  title = 'Viewing Patterns by Time' 
}: ViewingPatternHeatmapProps) => {
  // Use provided data or empty array - no mock data
  const heatmapData = data;
  const hasData = heatmapData.some(d => d.views > 0);

  const getIntensity = (views: number) => {
    const maxViews = Math.max(...heatmapData.map(d => d.views), 1);
    const intensity = views / maxViews;
    
    if (intensity > 0.8) return 'bg-primary';
    if (intensity > 0.6) return 'bg-primary/80';
    if (intensity > 0.4) return 'bg-primary/60';
    if (intensity > 0.2) return 'bg-primary/40';
    if (intensity > 0) return 'bg-primary/20';
    return 'bg-muted';
  };

  const getValue = (day: string, hour: number) => {
    const cell = heatmapData.find(d => d.day === day && d.hour === hour);
    return cell ? cell.views : 0;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">Peak engagement times throughout the week</p>
        </CardHeader>
        <CardContent>
          {!hasData ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No viewing data yet</p>
              <p className="text-sm">Analytics will appear as menus are accessed</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                {/* Hour labels */}
                <div className="flex mb-2">
                  <div className="w-12" />
                  {HOURS.filter(h => h % 3 === 0).map(hour => (
                    <div key={hour} className="flex-1 text-center text-xs text-muted-foreground min-w-[32px]">
                      {hour}h
                    </div>
                  ))}
                </div>
                
                {/* Heatmap grid */}
                {DAYS.map((day, dayIndex) => (
                  <motion.div
                    key={day}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + dayIndex * 0.05 }}
                    className="flex items-center mb-1"
                  >
                    <div className="w-12 text-xs font-medium text-muted-foreground">{day}</div>
                    <div className="flex flex-1 gap-1">
                      {HOURS.map(hour => {
                        const views = getValue(day, hour);
                        return (
                          <div
                            key={hour}
                            className={`h-8 flex-1 rounded ${getIntensity(views)} hover:ring-2 hover:ring-primary transition-all cursor-pointer group relative min-w-[8px]`}
                            title={`${day} ${hour}:00 - ${views} views`}
                          >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                              {day} {hour}:00<br/>
                              {views} views
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
                
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t">
                  <span className="text-xs text-muted-foreground">Less</span>
                  <div className="flex gap-1">
                    <div className="w-6 h-6 rounded bg-muted" />
                    <div className="w-6 h-6 rounded bg-primary/20" />
                    <div className="w-6 h-6 rounded bg-primary/40" />
                    <div className="w-6 h-6 rounded bg-primary/60" />
                    <div className="w-6 h-6 rounded bg-primary/80" />
                    <div className="w-6 h-6 rounded bg-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground">More</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
