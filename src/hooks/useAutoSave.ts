import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions<T> {
  onSave: (value: T) => Promise<void>;
  debounceMs?: number;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

export function useAutoSave<T>({
  onSave,
  debounceMs = 500,
  onError,
  onSuccess,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValue = useRef<T | null>(null);

  const mutation = useMutation({
    mutationFn: onSave,
    onSuccess: () => {
      setStatus('saved');
      onSuccess?.();
      // Reset to idle after 2 seconds
      setTimeout(() => setStatus('idle'), 2000);
    },
    onError: (error: Error) => {
      setStatus('error');
      onError?.(error);
    },
  });

  const save = useCallback(
    (value: T) => {
      pendingValue.current = value;

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setStatus('saving');

      // Debounce the save
      timeoutRef.current = setTimeout(() => {
        if (pendingValue.current !== null) {
          mutation.mutate(pendingValue.current);
        }
      }, debounceMs);
    },
    [debounceMs, mutation]
  );

  const saveImmediate = useCallback(
    (value: T) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setStatus('saving');
      mutation.mutate(value);
    },
    [mutation]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    save,
    saveImmediate,
    status,
    isLoading: status === 'saving',
    isError: status === 'error',
    isSaved: status === 'saved',
  };
}

