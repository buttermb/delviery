import { useState, useEffect, useCallback, useRef } from 'react';

interface FormDraftRecoveryOptions {
  /** Unique key to identify this form's draft */
  formKey: string;
  /** Auto-save interval in milliseconds (default: 30000 = 30 seconds) */
  saveInterval?: number;
  /** Time before draft expires in milliseconds (default: 24 hours) */
  expirationTime?: number;
  /** Callback when draft is recovered */
  onRecover?: (data: any) => void;
  /** Callback when draft is discarded */
  onDiscard?: () => void;
}

interface StoredDraft<T> {
  data: T;
  savedAt: number;
  expiresAt: number;
}

interface UseFormDraftRecoveryReturn<T> {
  /** Whether a recoverable draft exists */
  hasDraft: boolean;
  /** The draft data if available */
  draftData: T | null;
  /** Timestamp when draft was saved */
  savedAt: Date | null;
  /** Save current form data */
  saveDraft: (data: T) => void;
  /** Recover the draft (call onRecover callback) */
  recoverDraft: () => void;
  /** Discard the draft */
  discardDraft: () => void;
  /** Clear draft (call after successful submit) */
  clearDraft: () => void;
  /** Whether auto-save is active */
  isAutoSaving: boolean;
}

const DRAFT_PREFIX = 'form_draft_';

export function useFormDraftRecovery<T extends Record<string, any>>(
  options: FormDraftRecoveryOptions
): UseFormDraftRecoveryReturn<T> {
  const {
    formKey,
    saveInterval = 30000,
    expirationTime = 24 * 60 * 60 * 1000, // 24 hours
    onRecover,
    onDiscard,
  } = options;

  const storageKey = `${DRAFT_PREFIX}${formKey}`;
  
  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState<T | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<T | null>(null);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draft: StoredDraft<T> = JSON.parse(stored);
        
        // Check if draft has expired
        if (Date.now() > draft.expiresAt) {
          localStorage.removeItem(storageKey);
          return;
        }

        setHasDraft(true);
        setDraftData(draft.data);
        setSavedAt(new Date(draft.savedAt));
      }
    } catch (error) {
      console.error('Error loading form draft:', error);
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const saveDraft = useCallback((data: T) => {
    try {
      const draft: StoredDraft<T> = {
        data,
        savedAt: Date.now(),
        expiresAt: Date.now() + expirationTime,
      };
      
      localStorage.setItem(storageKey, JSON.stringify(draft));
      lastDataRef.current = data;
      setSavedAt(new Date(draft.savedAt));
      setIsAutoSaving(true);
      
      // Brief indicator that auto-save happened
      setTimeout(() => setIsAutoSaving(false), 1000);
    } catch (error) {
      console.error('Error saving form draft:', error);
    }
  }, [storageKey, expirationTime]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasDraft(false);
    setDraftData(null);
    setSavedAt(null);
    lastDataRef.current = null;
    
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, [storageKey]);

  const recoverDraft = useCallback(() => {
    if (draftData && onRecover) {
      onRecover(draftData);
      setHasDraft(false);
    }
  }, [draftData, onRecover]);

  const discardDraft = useCallback(() => {
    clearDraft();
    onDiscard?.();
  }, [clearDraft, onDiscard]);

  // Setup auto-save interval
  useEffect(() => {
    if (saveInterval > 0) {
      autoSaveTimerRef.current = setInterval(() => {
        if (lastDataRef.current) {
          saveDraft(lastDataRef.current);
        }
      }, saveInterval);

      return () => {
        if (autoSaveTimerRef.current) {
          clearInterval(autoSaveTimerRef.current);
        }
      };
    }
  }, [saveInterval, saveDraft]);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (lastDataRef.current) {
        // Save draft before leaving
        saveDraft(lastDataRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveDraft]);

  return {
    hasDraft,
    draftData,
    savedAt,
    saveDraft,
    recoverDraft,
    discardDraft,
    clearDraft,
    isAutoSaving,
  };
}

/**
 * Component to display draft recovery prompt
 */
export function formatDraftAge(savedAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - savedAt.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  
  return savedAt.toLocaleDateString();
}
