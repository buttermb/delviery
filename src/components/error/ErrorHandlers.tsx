import { useEffect } from "react";
import { toast } from "sonner";
import { PostgrestError } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Wifi, WifiOff, RefreshCw } from "lucide-react";

/**
 * Handle Supabase connection errors
 */
export function handleSupabaseError(error: unknown): void {
  const postgrestError = error as PostgrestError;

  if (!postgrestError) {
    toast.error("An unexpected error occurred");
    return;
  }

  // Connection errors
  if (
    postgrestError.message?.includes("Failed to fetch") ||
    postgrestError.message?.includes("NetworkError")
  ) {
    toast.error("Connection Error", {
      description:
        "Unable to connect to the server. Please check your internet connection.",
      icon: <WifiOff className="h-4 w-4" />,
    });
    return;
  }

  // Authentication errors
  if (postgrestError.code === "PGRST301") {
    toast.error("Session Expired", {
      description: "Please sign in again to continue.",
    });
    return;
  }

  // Permission errors
  if (postgrestError.code === "42501" || postgrestError.code === "PGRST116") {
    toast.error("Permission Denied", {
      description: "You don't have permission to perform this action.",
    });
    return;
  }

  // Conflict errors
  if (postgrestError.code === "23505") {
    toast.error("Duplicate Entry", {
      description: "This record already exists.",
    });
    return;
  }

  // Generic error
  logger.error("Supabase error", postgrestError);
  toast.error("Database Error", {
    description:
      postgrestError.message || "An error occurred while processing your request.",
  });
}

/**
 * Handle request timeout errors
 */
export function handleRequestTimeout(operation: string): void {
  logger.error("Request timeout", { operation });
  toast.error("Request Timeout", {
    description: `The ${operation} operation took too long. Please try again.`,
    icon: <AlertCircle className="h-4 w-4" />,
    action: {
      label: "Retry",
      onClick: () => window.location.reload(),
    },
  });
}

/**
 * Handle rate limit errors
 */
export function handleRateLimitError(retryAfter?: number): void {
  const message = retryAfter
    ? `Too many requests. Please try again in ${retryAfter} seconds.`
    : "Too many requests. Please slow down and try again.";

  toast.error("Rate Limit Exceeded", {
    description: message,
    duration: 5000,
  });
}

/**
 * Handle data validation errors
 */
export function handleValidationError(
  errors: Record<string, string[]> | string
): void {
  if (typeof errors === "string") {
    toast.error("Validation Error", {
      description: errors,
    });
    return;
  }

  const errorMessages = Object.entries(errors)
    .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
    .join("\n");

  toast.error("Validation Error", {
    description: errorMessages,
  });
}

/**
 * Handle file upload errors
 */
export function handleFileUploadError(error: {
  type: "size" | "type" | "network" | "unknown";
  maxSize?: number;
  allowedTypes?: string[];
}): void {
  switch (error.type) {
    case "size":
      toast.error("File Too Large", {
        description: `Maximum file size is ${error.maxSize ? `${error.maxSize / 1024 / 1024}MB` : "unknown"}.`,
        action: {
          label: "Learn More",
          onClick: () => {
            /* navigate to help */
          },
        },
      });
      break;
    case "type":
      toast.error("Invalid File Type", {
        description: error.allowedTypes
          ? `Allowed types: ${error.allowedTypes.join(", ")}`
          : "This file type is not supported.",
      });
      break;
    case "network":
      toast.error("Upload Failed", {
        description: "Network error. Please check your connection and try again.",
        action: {
          label: "Retry",
          onClick: () => {
            /* retry upload */
          },
        },
      });
      break;
    default:
      toast.error("Upload Failed", {
        description: "An error occurred while uploading the file.",
      });
  }
}

/**
 * Component to display connection status
 */
export function ConnectionStatusIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <WifiOff className="h-4 w-4" />
      <AlertTitle>No Internet Connection</AlertTitle>
      <AlertDescription>
        You're currently offline. Some features may not be available.
      </AlertDescription>
    </Alert>
  );
}

/**
 * Component to handle concurrent edit detection
 */
interface ConcurrentEditWarningProps {
  entityType: string;
  lastModified: string;
  currentVersion: string;
  onReload: () => void;
  onOverride: () => void;
}

export function ConcurrentEditWarning({
  entityType,
  lastModified,
  currentVersion,
  onReload,
  onOverride,
}: ConcurrentEditWarningProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Concurrent Edit Detected</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          This {entityType} was modified by someone else at {lastModified}. Your
          version is outdated.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onReload}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Reload Latest
          </Button>
          <Button size="sm" variant="destructive" onClick={onOverride}>
            Override Changes
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Hook to handle session expiry
 */
export function useSessionExpiry(onExpired: () => void) {
  useEffect(() => {
    const checkSession = () => {
      // Check if session has expired
      const sessionExpiry = localStorage.getItem("session_expiry");
      if (sessionExpiry && new Date(sessionExpiry) < new Date()) {
        toast.error("Session Expired", {
          description: "Your session has expired. Please sign in again.",
          duration: Infinity,
          action: {
            label: "Sign In",
            onClick: onExpired,
          },
        });
      }
    };

    // Check immediately and then every minute
    checkSession();
    const interval = setInterval(checkSession, 60000);

    return () => clearInterval(interval);
  }, [onExpired]);
}

// Add missing import
import { useState } from "react";
