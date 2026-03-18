/**
 * Contextual Help Tooltip Component
 * Shows helpful tooltips for first 7 days, then allows dismissal
 */

import { useState, useEffect } from "react";
import { Info, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { STORAGE_KEYS } from "@/constants/storageKeys";

interface TooltipGuideProps {
  title: string;
  content: string;
  placement?: "top" | "right" | "bottom" | "left";
  tenantId?: string;
  tenantCreatedAt?: string;
}

export function TooltipGuide({
  title,
  content,
  placement = "right",
  tenantId,
  tenantCreatedAt,
}: TooltipGuideProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!tenantId || !tenantCreatedAt) {
      setShouldShow(false);
      return;
    }

    // Check if tooltips are dismissed in localStorage
    const dismissedKey = `tenant_${tenantId}_tooltips_dismissed`;
    const dismissed = localStorage.getItem(dismissedKey);
    if (dismissed === "true") {
      setIsDismissed(true);
      setShouldShow(false);
      return;
    }

    // Check if 7 days have passed
    const createdDate = new Date(tenantCreatedAt);
    const daysSinceCreation = Math.floor(
      (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceCreation < 7) {
      // Show tooltip for first 7 days
      setShouldShow(true);
    } else {
      // Show dismiss banner after 7 days
      setShowBanner(true);
      setShouldShow(false);
    }
  }, [tenantId, tenantCreatedAt]);

  const handleDismiss = () => {
    setIsDismissed(true);
    setShowBanner(false);
    if (tenantId) {
      localStorage.setItem(`${STORAGE_KEYS.TOOLTIPS_DISMISSED_PREFIX}${tenantId}${STORAGE_KEYS.TOOLTIPS_DISMISSED_SUFFIX}`, "true");
      // Also update in database if needed
      // This could be done via an Edge Function or directly
    }
  };

  const handleKeep = () => {
    setShowBanner(false);
    setShouldShow(true);
  };

  if (isDismissed) return null;

  return (
    <>
      {shouldShow && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors p-1.5 ml-2"
                aria-label="Help"
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={placement} className="max-w-xs">
              <div className="space-y-1">
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-gray-600">{content}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {showBanner && (
        <Card className="border-blue-200 bg-blue-50 mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                <p className="text-sm text-blue-900">
                  Hide beginner tips? These helpful tooltips can be dismissed.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleKeep}
                  className="text-blue-700 hover:text-blue-900"
                >
                  Keep them
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="text-blue-700 hover:text-blue-900"
                >
                  <X className="h-4 w-4 mr-1" />
                  Yes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

