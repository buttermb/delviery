import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, AlertTriangle } from "lucide-react";

interface RateLimitIndicatorProps {
  /**
   * Number of failed attempts so far (0-based)
   * Typically tracked in the parent component
   */
  attemptCount?: number;
  /**
   * Maximum allowed attempts before rate limiting kicks in
   */
  maxAttempts?: number;
  className?: string;
}

export function RateLimitIndicator({
  attemptCount = 0,
  maxAttempts = 5,
  className = "",
}: RateLimitIndicatorProps) {
  const [showIndicator, setShowIndicator] = useState(false);
  const remainingAttempts = maxAttempts - attemptCount;
  const isNearLimit = remainingAttempts <= 2 && remainingAttempts > 0;
  const isAtLimit = remainingAttempts <= 0;

  useEffect(() => {
    setShowIndicator(isNearLimit || isAtLimit);
  }, [isNearLimit, isAtLimit]);

  if (!showIndicator || attemptCount === 0) {
    return null;
  }

  return (
    <Alert
      variant={isAtLimit ? "destructive" : "default"}
      className={className}
    >
      {isAtLimit ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <Info className="h-4 w-4" />
      )}
      <AlertDescription>
        {isAtLimit ? (
          <span>
            Too many failed login attempts. Your account has been temporarily
            locked for security.
          </span>
        ) : (
          <span>
            <strong>{remainingAttempts}</strong> login{" "}
            {remainingAttempts === 1 ? "attempt" : "attempts"} remaining before
            temporary lockout.
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}
