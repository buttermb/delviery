import { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface RateLimitErrorDisplayProps {
  retryAfter?: number; // Seconds until retry is allowed
  message?: string;
  onRetryReady?: () => void;
}

export function RateLimitErrorDisplay({
  retryAfter = 60,
  message,
  onRetryReady,
}: RateLimitErrorDisplayProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(retryAfter);

  useEffect(() => {
    setSecondsRemaining(retryAfter);

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onRetryReady) {
            onRetryReady();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [retryAfter, onRetryReady]);

  const progressPercent = ((retryAfter - secondsRemaining) / retryAfter) * 100;

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Rate Limit Exceeded</AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm">
          {message ||
            'You have made too many requests. Please wait before trying again.'}
        </p>

        {secondsRemaining > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span>
                You can retry in{' '}
                <span className="font-semibold">{secondsRemaining}</span> second
                {secondsRemaining !== 1 ? 's' : ''}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        ) : (
          <p className="text-sm font-medium text-emerald-600">
            You can now retry your request.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
