import { AlertCircle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "react-router-dom";

interface TrialBannerProps {
  daysRemaining: number;
  trialEndsAt: string | null;
  tenantSlug: string;
}

export function TrialBanner({ daysRemaining, trialEndsAt, tenantSlug }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Guard: Don't show if dismissed, expired, or no trial end date
  if (dismissed || daysRemaining < 0 || !trialEndsAt) {
    return null;
  }

  const getVariant = () => {
    if (daysRemaining <= 1) return "destructive";
    if (daysRemaining <= 3) return "default";
    return "default";
  };

  const getMessage = () => {
    if (daysRemaining === 0) {
      return "Your trial ends today! Your subscription will activate automatically.";
    }
    if (daysRemaining === 1) {
      return "Your trial ends tomorrow. Your card will be charged automatically.";
    }
    return `Your trial ends in ${daysRemaining} days. Your card will be charged on ${new Date(trialEndsAt).toLocaleDateString()}.`;
  };

  return (
    <Alert variant={getVariant()} className="mb-6 relative">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{getMessage()}</span>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            asChild
            className="border-foreground/20"
          >
            <Link to={`/${tenantSlug}/admin/billing`}>
              Manage Subscription
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
