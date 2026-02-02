import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";

interface LastUpdatedProps {
    date: Date;
    onRefresh?: () => void;
    isLoading?: boolean;
    className?: string;
}

export function LastUpdated({ date, onRefresh, isLoading, className }: LastUpdatedProps) {
    const [timeAgo, setTimeAgo] = useState<string>("");

    useEffect(() => {
        const updateTime = () => {
            // Validate date before formatting
            if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
                setTimeAgo('Just now');
                return;
            }
            setTimeAgo(formatDistanceToNow(date, { addSuffix: true }));
        };

        updateTime();
        const interval = setInterval(updateTime, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [date]);

    return (
        <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
            <span>Updated {timeAgo}</span>
            {onRefresh && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onRefresh}
                    disabled={isLoading}
                >
                    <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
                    <span className="sr-only">Refresh</span>
                </Button>
            )}
        </div>
    );
}
