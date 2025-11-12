/**
 * Optimistic Update Hook
 * Provides immediate UI feedback with background sync and automatic rollback on failure
 */

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useNetworkStatus } from './useNetworkStatus';

interface OptimisticUpdateOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  rollbackDelay?: number; // Delay before rollback to show error state
}

interface OptimisticUpdateReturn<T, P> {
  data: T | null;
  isLoading: boolean;
  isOptimistic: boolean;
  error: Error | null;
  execute: (params: P, optimisticData: T, actualOperation: (params: P) => Promise<T>) => Promise<T | null>;
  reset: () => void;
}

export function useOptimisticUpdate<T = any, P = any>(
  options: OptimisticUpdateOptions<T> = {}
): OptimisticUpdateReturn<T, P> {
  const {
    onSuccess,
    onError,
    successMessage = 'Success!',
    errorMessage = 'Operation failed',
    rollbackDelay = 1000,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimistic, setIsOptimistic] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const previousDataRef = useRef<T | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const { isOnline, retryWhenOnline } = useNetworkStatus();

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
    setIsOptimistic(false);
    setError(null);
    previousDataRef.current = null;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const execute = useCallback(
    async (
      params: P,
      optimisticData: T,
      actualOperation: (params: P) => Promise<T>
    ): Promise<T | null> => {
      // Store previous state for rollback
      previousDataRef.current = data;
      
      // Create abort controller for this operation
      abortControllerRef.current = new AbortController();
      
      // Immediately show optimistic update
      setIsOptimistic(true);
      setIsLoading(true);
      setError(null);
      setData(optimisticData);
      
      // Show immediate success feedback
      const loadingToast = toast.loading('Saving...', {
        duration: Infinity,
      });

      try {
        // If offline, queue for later
        if (!isOnline) {
          logger.info('Offline - queueing operation for retry');
          
          toast.dismiss(loadingToast);
          toast.info('Queued for sync', {
            description: 'Will sync when connection is restored',
          });
          
          retryWhenOnline(async () => {
            try {
              const result = await actualOperation(params);
              setData(result);
              setIsOptimistic(false);
              toast.success('Synced!', {
                description: 'Changes have been saved',
              });
              onSuccess?.(result);
            } catch (retryError: any) {
              logger.error('Background sync failed', retryError);
              toast.error('Sync failed', {
                description: 'Please try again manually',
              });
            }
          });
          
          setIsLoading(false);
          return optimisticData;
        }

        // Perform actual operation in background
        const result = await actualOperation(params);
        
        // Check if this operation was aborted
        if (abortControllerRef.current?.signal.aborted) {
          logger.info('Operation was aborted');
          return null;
        }

        // Success! Update with real data
        toast.dismiss(loadingToast);
        toast.success(successMessage, {
          duration: 3000,
        });
        
        setData(result);
        setIsOptimistic(false);
        setIsLoading(false);
        setError(null);
        
        onSuccess?.(result);
        
        logger.info('Optimistic update confirmed', { 
          component: 'useOptimisticUpdate',
          success: true 
        });
        
        return result;
      } catch (err: any) {
        // Check if operation was aborted
        if (abortControllerRef.current?.signal.aborted) {
          logger.info('Operation was aborted during error handling');
          return null;
        }

        logger.error('Optimistic update failed - rolling back', err, {
          component: 'useOptimisticUpdate',
        });
        
        toast.dismiss(loadingToast);
        
        // Show error state briefly before rollback
        setError(err);
        
        // Rollback after delay to show error
        setTimeout(() => {
          setData(previousDataRef.current);
          setIsOptimistic(false);
          setIsLoading(false);
          
          toast.error(errorMessage, {
            description: err.message || 'Please try again',
            duration: 4000,
          });
        }, rollbackDelay);
        
        onError?.(err);
        
        return null;
      }
    },
    [
      data,
      isOnline,
      retryWhenOnline,
      successMessage,
      errorMessage,
      rollbackDelay,
      onSuccess,
      onError,
    ]
  );

  return {
    data,
    isLoading,
    isOptimistic,
    error,
    execute,
    reset,
  };
}

/**
 * Optimistic mutation for lists (add, update, delete)
 */
export function useOptimisticList<T extends { id: string }>(
  initialData: T[] = []
) {
  const [items, setItems] = useState<T[]>(initialData);
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());

  const addOptimistic = useCallback(
    async (
      newItem: T,
      actualOperation: (item: T) => Promise<T>
    ): Promise<T | null> => {
      // Add optimistically
      const tempId = `temp-${Date.now()}`;
      const optimisticItem = { ...newItem, id: tempId };
      
      setItems(prev => [optimisticItem, ...prev]);
      setOptimisticIds(prev => new Set(prev).add(tempId));
      
      const loadingToast = toast.loading('Adding...');

      try {
        const result = await actualOperation(newItem);
        
        // Replace temp item with real item
        setItems(prev => 
          prev.map(item => item.id === tempId ? result : item)
        );
        setOptimisticIds(prev => {
          const next = new Set(prev);
          next.delete(tempId);
          return next;
        });
        
        toast.dismiss(loadingToast);
        toast.success('Added successfully');
        
        return result;
      } catch (error: any) {
        // Rollback
        setItems(prev => prev.filter(item => item.id !== tempId));
        setOptimisticIds(prev => {
          const next = new Set(prev);
          next.delete(tempId);
          return next;
        });
        
        toast.dismiss(loadingToast);
        toast.error('Failed to add', {
          description: error.message,
        });
        
        return null;
      }
    },
    []
  );

  const updateOptimistic = useCallback(
    async (
      id: string,
      updates: Partial<T>,
      actualOperation: (id: string, updates: Partial<T>) => Promise<T>
    ): Promise<T | null> => {
      const previousItems = [...items];
      
      // Update optimistically
      setItems(prev =>
        prev.map(item => (item.id === id ? { ...item, ...updates } : item))
      );
      setOptimisticIds(prev => new Set(prev).add(id));
      
      const loadingToast = toast.loading('Updating...');

      try {
        const result = await actualOperation(id, updates);
        
        setItems(prev =>
          prev.map(item => (item.id === id ? result : item))
        );
        setOptimisticIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        
        toast.dismiss(loadingToast);
        toast.success('Updated successfully');
        
        return result;
      } catch (error: any) {
        // Rollback
        setItems(previousItems);
        setOptimisticIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        
        toast.dismiss(loadingToast);
        toast.error('Failed to update', {
          description: error.message,
        });
        
        return null;
      }
    },
    [items]
  );

  const deleteOptimistic = useCallback(
    async (
      id: string,
      actualOperation: (id: string) => Promise<void>
    ): Promise<boolean> => {
      const previousItems = [...items];
      const deletedItem = items.find(item => item.id === id);
      
      // Delete optimistically
      setItems(prev => prev.filter(item => item.id !== id));
      
      const loadingToast = toast.loading('Deleting...');

      try {
        await actualOperation(id);
        
        toast.dismiss(loadingToast);
        toast.success('Deleted successfully');
        
        return true;
      } catch (error: any) {
        // Rollback
        if (deletedItem) {
          setItems(previousItems);
        }
        
        toast.dismiss(loadingToast);
        toast.error('Failed to delete', {
          description: error.message,
        });
        
        return false;
      }
    },
    [items]
  );

  return {
    items,
    optimisticIds,
    addOptimistic,
    updateOptimistic,
    deleteOptimistic,
    setItems,
  };
}
