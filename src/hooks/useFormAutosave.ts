import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

interface UseFormAutosaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void> | void;
  debounceMs?: number;
  enabled?: boolean;
  storageKey?: string;
}

/**
 * Hook to automatically save form data to prevent data loss
 * Saves to localStorage and optionally triggers server save
 *
 * @example
 * ```tsx
 * useFormAutosave({
 *   data: formData,
 *   onSave: async (data) => {
 *     await supabase.from('drafts').upsert({ ...data });
 *   },
 *   debounceMs: 2000,
 *   storageKey: 'product-form-draft',
 * });
 * ```
 */
export function useFormAutosave<T>({
  data,
  onSave,
  debounceMs = 2000,
  enabled = true,
  storageKey,
}: UseFormAutosaveOptions<T>) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const previousDataRef = useRef<T>(data);

  useEffect(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Check if data has actually changed
    const hasChanged =
      JSON.stringify(data) !== JSON.stringify(previousDataRef.current);

    if (!hasChanged) return;

    // Update previous data
    previousDataRef.current = data;

    // Save to localStorage immediately if key provided
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch (error) {
        logger.error("Failed to save to localStorage", error, {
          hook: "useFormAutosave",
          storageKey,
        });
      }
    }

    // Debounce the server save
    timeoutRef.current = setTimeout(() => {
      try {
        void onSave(data);
      } catch (error) {
        logger.error("Failed to autosave form data", error, {
          hook: "useFormAutosave",
        });
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, onSave, debounceMs, enabled, storageKey]);
}

/**
 * Retrieve autosaved form data from localStorage
 */
export function getAutosavedData<T>(storageKey: string): T | null {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return null;
    return JSON.parse(saved) as T;
  } catch (error) {
    logger.error("Failed to retrieve autosaved data", error, {
      hook: "useFormAutosave",
      storageKey,
    });
    return null;
  }
}

/**
 * Clear autosaved form data from localStorage
 */
export function clearAutosavedData(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch (error) {
    logger.error("Failed to clear autosaved data", error, {
      hook: "useFormAutosave",
      storageKey,
    });
  }
}
