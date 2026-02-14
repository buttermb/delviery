import { useCallback, useEffect, useRef, useState } from 'react';

import { STORAGE_KEYS } from '@/constants/storageKeys';
import { logger } from '@/lib/logger';
import { safeStorage } from '@/utils/safeStorage';

/**
 * Persisted form data structure
 */
interface PersistedFormData<T> {
  values: T;
  savedAt: number;
}

/**
 * Options for useFormPersistence hook
 */
interface UseFormPersistenceOptions {
  /** Debounce delay in milliseconds (default: 1000ms) */
  debounceMs?: number;
  /** Max age in milliseconds before data is considered stale (default: 24 hours) */
  maxAgeMs?: number;
}

/**
 * Return type for useFormPersistence hook
 */
interface UseFormPersistenceReturn<T> {
  /** Restore previously saved form data, returns null if none exists or is stale */
  restoreForm: () => T | null;
  /** Clear saved form data (call on successful submit) */
  clearSavedForm: () => void;
  /** Whether a persisted form exists */
  hasSavedForm: boolean;
  /** Timestamp of last save, null if no saved form */
  lastSavedAt: number | null;
}

/**
 * Auto-saves form state to localStorage so users don't lose work if they navigate away.
 *
 * Features:
 * - Debounced saves (1 second default) to prevent excessive writes
 * - Automatic restoration with restoreForm()
 * - Clear on successful submit with clearSavedForm()
 * - Uses STORAGE_KEYS with form-specific prefix
 * - Handles JSON serialization errors gracefully
 * - Max age validation to prevent restoring stale data
 *
 * @param formId - Unique identifier for the form
 * @param formValues - Current form values to persist
 * @param options - Configuration options
 * @returns Object with restoreForm, clearSavedForm, hasSavedForm, and lastSavedAt
 *
 * @example
 * ```tsx
 * const { restoreForm, clearSavedForm, hasSavedForm } = useFormPersistence(
 *   'create-product-form',
 *   formValues
 * );
 *
 * // On mount, check for saved data
 * useEffect(() => {
 *   const saved = restoreForm();
 *   if (saved) {
 *     form.reset(saved);
 *   }
 * }, []);
 *
 * // On successful submit
 * const onSubmit = async (data) => {
 *   await saveProduct(data);
 *   clearSavedForm();
 * };
 * ```
 */
export function useFormPersistence<T extends Record<string, unknown>>(
  formId: string,
  formValues: T,
  options: UseFormPersistenceOptions = {}
): UseFormPersistenceReturn<T> {
  const { debounceMs = 1000, maxAgeMs = 24 * 60 * 60 * 1000 } = options;

  const storageKey = `${STORAGE_KEYS.FORM_PERSISTENCE_PREFIX}${formId}`;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [hasSavedForm, setHasSavedForm] = useState<boolean>(false);

  // Check for existing saved form on mount
  useEffect(() => {
    const savedData = safeStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData) as PersistedFormData<T>;
        const isStale = Date.now() - parsed.savedAt > maxAgeMs;
        if (!isStale) {
          setHasSavedForm(true);
          setLastSavedAt(parsed.savedAt);
        } else {
          // Clear stale data
          safeStorage.removeItem(storageKey);
          logger.debug('Cleared stale form persistence data', { formId }, 'useFormPersistence');
        }
      } catch (error) {
        logger.warn('Failed to parse saved form data', error, { formId, component: 'useFormPersistence' });
        safeStorage.removeItem(storageKey);
      }
    }
  }, [formId, storageKey, maxAgeMs]);

  // Debounced save effect
  useEffect(() => {
    // Clear any pending timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set up new debounced save
    debounceTimerRef.current = setTimeout(() => {
      try {
        const dataToSave: PersistedFormData<T> = {
          values: formValues,
          savedAt: Date.now(),
        };
        const serialized = JSON.stringify(dataToSave);
        safeStorage.setItem(storageKey, serialized);
        setLastSavedAt(dataToSave.savedAt);
        setHasSavedForm(true);
        logger.debug('Form persisted to localStorage', { formId }, 'useFormPersistence');
      } catch (error) {
        logger.error('Failed to persist form data', error, { formId, component: 'useFormPersistence' });
      }
    }, debounceMs);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [formValues, formId, storageKey, debounceMs]);

  /**
   * Restore previously saved form data
   * Returns null if no saved data exists or if data is stale
   */
  const restoreForm = useCallback((): T | null => {
    const savedData = safeStorage.getItem(storageKey);
    if (!savedData) {
      logger.debug('No saved form data found', { formId }, 'useFormPersistence');
      return null;
    }

    try {
      const parsed = JSON.parse(savedData) as PersistedFormData<T>;

      // Check if data is stale
      const isStale = Date.now() - parsed.savedAt > maxAgeMs;
      if (isStale) {
        logger.debug('Saved form data is stale, clearing', { formId, savedAt: parsed.savedAt }, 'useFormPersistence');
        safeStorage.removeItem(storageKey);
        setHasSavedForm(false);
        setLastSavedAt(null);
        return null;
      }

      logger.debug('Restored form data from localStorage', { formId, savedAt: parsed.savedAt }, 'useFormPersistence');
      return parsed.values;
    } catch (error) {
      logger.error('Failed to restore form data', error, { formId, component: 'useFormPersistence' });
      safeStorage.removeItem(storageKey);
      setHasSavedForm(false);
      setLastSavedAt(null);
      return null;
    }
  }, [formId, storageKey, maxAgeMs]);

  /**
   * Clear saved form data (call on successful submit)
   */
  const clearSavedForm = useCallback((): void => {
    // Clear any pending save timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    safeStorage.removeItem(storageKey);
    setHasSavedForm(false);
    setLastSavedAt(null);
    logger.debug('Cleared saved form data', { formId }, 'useFormPersistence');
  }, [formId, storageKey]);

  return {
    restoreForm,
    clearSavedForm,
    hasSavedForm,
    lastSavedAt,
  };
}
