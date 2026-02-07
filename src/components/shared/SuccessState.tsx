import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, Eye, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

export type SuccessStateType = "order_placed" | "menu_created" | "payment_successful" | "generic";

interface SuccessStateProps {
  type?: SuccessStateType;
  title?: string;
  message?: string;
  details?: string;
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

const successConfig: Record<SuccessStateType, { 
  icon: React.ReactNode; 
  defaultTitle: string; 
  defaultMessage: string;
  defaultDetails?: string;
}> = {
  order_placed: {
    icon: <ShoppingBag className="h-16 w-16 text-green-400" />,
    defaultTitle: "Order Placed!",
    defaultMessage: "We've sent a confirmation to your email.",
    defaultDetails: "#ORD-1473",
  },
  menu_created: {
    icon: <CheckCircle2 className="h-16 w-16 text-green-400" />,
    defaultTitle: "Menu Created!",
    defaultMessage: "3 customers have been notified via email.",
  },
  payment_successful: {
    icon: <CheckCircle2 className="h-16 w-16 text-green-400" />,
    defaultTitle: "Payment Received!",
    defaultMessage: "Receipt sent to your email.",
    defaultDetails: "$19,562.55",
  },
  generic: {
    icon: <CheckCircle2 className="h-16 w-16 text-green-400" />,
    defaultTitle: "Success!",
    defaultMessage: "Your request has been processed successfully.",
  },
};

export function SuccessState({
  type = "generic",
  title,
  message,
  details,
  primaryAction,
  secondaryAction,
  className,
}: SuccessStateProps) {
  const config = successConfig[type];
  const finalTitle = title || config.defaultTitle;
  const finalMessage = message || config.defaultMessage;
  const finalDetails = details || config.defaultDetails;

  return (
    <Card className={cn("p-12 text-center max-w-md mx-auto", className)}>
      <CardContent className="flex flex-col items-center justify-center space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-50 dark:bg-green-900/20 mb-4">
          <div className="success-checkmark">
            {config.icon}
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{finalTitle}</h3>
          {finalDetails && (
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              {finalDetails}
            </p>
          )}
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
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
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

