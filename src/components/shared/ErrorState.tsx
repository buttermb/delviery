import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Clock from "lucide-react/dist/esm/icons/clock";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import { cn } from "@/lib/utils";

export type ErrorStateType = "payment_failed" | "session_expired" | "no_internet" | "generic";

interface ErrorStateProps {
  type?: ErrorStateType;
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const errorConfig: Record<ErrorStateType, { icon: React.ReactNode; defaultTitle: string; defaultMessage: string }> = {
  payment_failed: {
    icon: <CreditCard className="h-16 w-16 text-red-400" />,
    defaultTitle: "Payment Failed",
    defaultMessage: "Your card was declined. Please update your payment method.",
  },
  session_expired: {
    icon: <Clock className="h-16 w-16 text-yellow-400" />,
    defaultTitle: "Session Expired",
    defaultMessage: "For security, please sign in again.",
  },
  no_internet: {
    icon: <WifiOff className="h-16 w-16 text-gray-400" />,
    defaultTitle: "No Internet Connection",
    defaultMessage: "Please check your connection and try again.",
  },
  generic: {
    icon: <AlertCircle className="h-16 w-16 text-red-400" />,
    defaultTitle: "Something Went Wrong",
    defaultMessage: "An unexpected error occurred. Please try again.",
  },
};

export function ErrorState({
  type = "generic",
  title,
  message,
  icon,
  primaryAction,
  secondaryAction,
  className,
}: ErrorStateProps) {
  const config = errorConfig[type];
  const finalIcon = icon || config.icon;
  const finalTitle = title || config.defaultTitle;
  const finalMessage = message || config.defaultMessage;

  return (
    <Card className={cn("p-12 text-center max-w-md mx-auto", className)}>
      <CardContent className="flex flex-col items-center justify-center space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-50 dark:bg-red-900/20 mb-4">
          {finalIcon}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{finalTitle}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm">
            {finalMessage}
          </p>
        </div>

        {(primaryAction || secondaryAction) && (
          <div className="flex gap-3 w-full">
            {secondaryAction && (
              <Button
                variant="outline"
                onClick={secondaryAction.onClick}
                className="flex-1"
              >
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                onClick={primaryAction.onClick}
                className="flex-1"
              >
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

