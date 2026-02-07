import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ShiftTimer() {
  const [startTime, setStartTime] = useState<Date | null>(() => {
    const saved = localStorage.getItem('courier_shift_start');
    return saved ? new Date(saved) : null;
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isActive, setIsActive] = useState(!!startTime);

  useEffect(() => {
    if (!isActive || !startTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setElapsedSeconds(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, startTime]);

  const startShift = () => {
    const now = new Date();
    setStartTime(now);
    setIsActive(true);
    localStorage.setItem('courier_shift_start', now.toISOString());
  };

  const endShift = () => {
    setStartTime(null);
    setIsActive(false);
    setElapsedSeconds(0);
    localStorage.removeItem('courier_shift_start');
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getShiftStatus = () => {
    if (elapsedSeconds < 3600) return { label: 'Just started', color: 'text-blue-500' };
    if (elapsedSeconds < 14400) return { label: 'Going strong', color: 'text-green-500' };
    if (elapsedSeconds < 21600) return { label: 'Long shift', color: 'text-yellow-500' };
    return { label: 'Epic shift!', color: 'text-purple-500' };
  };

  const status = getShiftStatus();

  return (
    <Card className="bg-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">Shift Timer</h3>
          </div>
          {isActive && (
            <Badge variant="outline" className={status.color}>
              {status.label}
            </Badge>
          )}
        </div>

        <div className="text-center mb-4">
          <div className="text-4xl font-mono font-bold mb-1">
            {formatTime(elapsedSeconds)}
          </div>
          {isActive && startTime && (
            <p className="text-xs text-muted-foreground">
              Started at {startTime.toLocaleTimeString()}
            </p>
          )}
        </div>

        {isActive ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-center p-2 bg-muted/30 rounded-lg">
                <p className="font-semibold">{Math.floor(elapsedSeconds / 3600)}h {Math.floor((elapsedSeconds % 3600) / 60)}m</p>
                <p className="text-muted-foreground">Active</p>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded-lg">
                <p className="font-semibold">{(elapsedSeconds / 3600).toFixed(1)}h</p>
                <p className="text-muted-foreground">Decimal</p>
              </div>
            </div>
            <Button 
              onClick={endShift} 
              variant="destructive" 
              size="sm" 
              className="w-full"
            >
              <Pause className="w-4 h-4 mr-2" />
              End Shift
            </Button>
          </div>
        ) : (
          <Button 
            onClick={startShift} 
            className="w-full" 
            size="sm"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Shift
          </Button>
        )}
      </CardContent>
    </Card>
  );
}