import { useCallback, useState } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface UseAsyncActionOptions {
  successMessage?: string;
  errorMessage?: string;
}

/**
 * Wraps an async function with loading state and toast notifications.
 * Returns a callback that can be called with the same args as the action.
 */
export function useAsyncAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<void>,
  options: UseAsyncActionOptions = {}
): (...args: TArgs) => Promise<void> {
  const [, setIsPending] = useState(false);

  return useCallback(
    async (...args: TArgs) => {
      setIsPending(true);
      try {
        await action(...args);
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
      } catch (error) {
        logger.error("useAsyncAction failed", error as Error);
        toast.error(options.errorMessage ?? "Action failed");
      } finally {
        setIsPending(false);
      }
    },
    [action, options.successMessage, options.errorMessage]
  );
}
