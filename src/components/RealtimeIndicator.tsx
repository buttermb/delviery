import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RealtimeIndicatorProps {
  isConnected: boolean;
  lastUpdate?: Date;
  className?: string;
}

export function RealtimeIndicator({ 
  isConnected, 
  lastUpdate,
  className 
}: RealtimeIndicatorProps) {
  const [timeAgo, setTimeAgo] = useState<string>("");

  useEffect(() => {
    if (!lastUpdate) return;

    const updateTimeAgo = () => {
      const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
      
      if (seconds < 10) {
        setTimeAgo("just now");
      } else if (seconds < 60) {
        setTimeAgo(`${seconds}s ago`);
      } else if (seconds < 3600) {
        setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
      } else {
        setTimeAgo(`${Math.floor(seconds / 3600)}h ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 10000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={isConnected ? "default" : "destructive"}
            className={cn("gap-1.5 cursor-help", className)}
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3 animate-pulse" />
                <span className="text-xs">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                <span className="text-xs">Offline</span>
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {isConnected ? "Real-time updates active" : "Real-time updates disconnected"}
            {lastUpdate && timeAgo && (
              <span className="block text-muted-foreground mt-0.5">
                Last update: {timeAgo}
              </span>
            )}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
