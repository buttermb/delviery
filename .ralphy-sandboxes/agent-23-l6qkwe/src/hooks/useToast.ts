/**
 * useToast — Centralized toast hook with standard messages
 *
 * Wraps sonner toast with humanized error messages, deduplication,
 * and consistent standard messages for CRUD operations.
 *
 * Usage:
 *   const t = useToast();
 *   t.success('Product saved');
 *   t.created('Product');
 *   t.updated('Order');
 *   t.deleted('Customer');
 *   t.failed('save product', error);
 */

import { useCallback, useRef } from 'react';
import { toast, ExternalToast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

const DEDUPE_WINDOW_MS = 3000;

function makeDeduper() {
  const recent = new Map<string, number>();

  return function shouldShow(key: string): boolean {
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUPE_WINDOW_MS) {
      return false;
    }
    recent.set(key, now);

    // Prune old entries
    if (recent.size > 50) {
      const cutoff = now - DEDUPE_WINDOW_MS * 2;
      for (const [k, v] of recent) {
        if (v < cutoff) recent.delete(k);
      }
    }
    return true;
  };
}

// ---------------------------------------------------------------------------
// Standard Messages
// ---------------------------------------------------------------------------

const STANDARD = {
  created: (item: string) => `${item} created`,
  updated: (item: string) => `${item} updated`,
  deleted: (item: string) => `${item} deleted`,
  saved: (item?: string) => (item ? `${item} saved` : 'Changes saved'),
  archived: (item: string) => `${item} archived`,
  restored: (item: string) => `${item} restored`,
  duplicated: (item: string) => `${item} duplicated`,
  copied: (item?: string) => (item ? `${item} copied to clipboard` : 'Copied to clipboard'),
  exported: (format: string) => `Exported as ${format}`,
  imported: (count: number, item: string) =>
    `${count} ${item}${count !== 1 ? 's' : ''} imported`,
  failed: (action: string) => `Failed to ${action}`,
} as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseToastReturn {
  /** Generic success toast */
  success: (message: string, opts?: ExternalToast) => void;
  /** Generic error toast — auto-humanizes error objects */
  error: (message: string, error?: unknown, opts?: ExternalToast) => void;
  /** Generic info toast */
  info: (message: string, opts?: ExternalToast) => void;
  /** Generic warning toast */
  warning: (message: string, opts?: ExternalToast) => void;

  // Standard CRUD messages
  /** "[Item] created" */
  created: (item: string, opts?: ExternalToast) => void;
  /** "[Item] updated" */
  updated: (item: string, opts?: ExternalToast) => void;
  /** "[Item] deleted" */
  deleted: (item: string, opts?: ExternalToast) => void;
  /** "[Item] saved" or "Changes saved" */
  saved: (item?: string, opts?: ExternalToast) => void;
  /** "[Item] archived" */
  archived: (item: string, opts?: ExternalToast) => void;
  /** "[Item] restored" */
  restored: (item: string, opts?: ExternalToast) => void;
  /** "[Item] duplicated" */
  duplicated: (item: string, opts?: ExternalToast) => void;
  /** "Copied to clipboard" */
  copied: (item?: string, opts?: ExternalToast) => void;
  /** "Exported as [format]" */
  exported: (format: string, opts?: ExternalToast) => void;
  /** "[count] [item]s imported" */
  imported: (count: number, item: string, opts?: ExternalToast) => void;

  // Error helpers
  /** "Failed to [action]" with humanized error description */
  failed: (action: string, error?: unknown, opts?: ExternalToast) => void;
  /** Permission denied toast */
  permissionDenied: (action?: string) => void;
  /** Network error toast */
  networkError: () => void;

  /** Loading toast — returns ID for dismissal */
  loading: (message: string, opts?: ExternalToast) => string | number;
  /** Dismiss a toast by ID */
  dismiss: (id?: string | number) => void;
}

export function useToast(): UseToastReturn {
  const dedupeRef = useRef(makeDeduper());
  const dedupe = dedupeRef.current;

  const success = useCallback(
    (message: string, opts?: ExternalToast) => {
      if (dedupe(message)) toast.success(message, opts);
    },
    [dedupe],
  );

  const error = useCallback(
    (message: string, err?: unknown, opts?: ExternalToast) => {
      if (!dedupe(message)) return;
      const description = err ? humanizeError(err) : undefined;
      toast.error(message, { description, ...opts });
    },
    [dedupe],
  );

  const info = useCallback(
    (message: string, opts?: ExternalToast) => {
      if (dedupe(message)) toast.info(message, opts);
    },
    [dedupe],
  );

  const warning = useCallback(
    (message: string, opts?: ExternalToast) => {
      if (dedupe(message)) toast.warning(message, opts);
    },
    [dedupe],
  );

  // --- CRUD shortcuts ---

  const created = useCallback(
    (item: string, opts?: ExternalToast) => {
      const msg = STANDARD.created(item);
      if (dedupe(msg)) toast.success(msg, opts);
    },
    [dedupe],
  );

  const updated = useCallback(
    (item: string, opts?: ExternalToast) => {
      const msg = STANDARD.updated(item);
      if (dedupe(msg)) toast.success(msg, opts);
    },
    [dedupe],
  );

  const deleted = useCallback(
    (item: string, opts?: ExternalToast) => {
      const msg = STANDARD.deleted(item);
      if (dedupe(msg)) toast.success(msg, opts);
    },
    [dedupe],
  );

  const saved = useCallback(
    (item?: string, opts?: ExternalToast) => {
      const msg = STANDARD.saved(item);
      if (dedupe(msg)) toast.success(msg, opts);
    },
    [dedupe],
  );

  const archived = useCallback(
    (item: string, opts?: ExternalToast) => {
      const msg = STANDARD.archived(item);
      if (dedupe(msg)) toast.success(msg, opts);
    },
    [dedupe],
  );

  const restored = useCallback(
    (item: string, opts?: ExternalToast) => {
      const msg = STANDARD.restored(item);
      if (dedupe(msg)) toast.success(msg, opts);
    },
    [dedupe],
  );

  const duplicated = useCallback(
    (item: string, opts?: ExternalToast) => {
      const msg = STANDARD.duplicated(item);
      if (dedupe(msg)) toast.success(msg, opts);
    },
    [dedupe],
  );

  const copied = useCallback(
    (item?: string, opts?: ExternalToast) => {
      const msg = STANDARD.copied(item);
      if (dedupe(msg)) toast.success(msg, { duration: 2000, ...opts });
    },
    [dedupe],
  );

  const exported = useCallback(
    (format: string, opts?: ExternalToast) => {
      const msg = STANDARD.exported(format);
      if (dedupe(msg)) toast.success(msg, opts);
    },
    [dedupe],
  );

  const imported = useCallback(
    (count: number, item: string, opts?: ExternalToast) => {
      const msg = STANDARD.imported(count, item);
      if (dedupe(msg)) toast.success(msg, opts);
    },
    [dedupe],
  );

  // --- Error shortcuts ---

  const failed = useCallback(
    (action: string, err?: unknown, opts?: ExternalToast) => {
      const msg = STANDARD.failed(action);
      if (!dedupe(msg)) return;
      const description = err ? humanizeError(err) : undefined;
      toast.error(msg, { description, ...opts });
    },
    [dedupe],
  );

  const permissionDenied = useCallback(
    (action?: string) => {
      const key = 'permission-denied';
      if (!dedupe(key)) return;
      toast.error('Permission denied', {
        description: action
          ? `You do not have permission to ${action}`
          : 'You do not have permission to perform this action',
      });
    },
    [dedupe],
  );

  const networkError = useCallback(() => {
    const key = 'network-error';
    if (!dedupe(key)) return;
    toast.error('Network error', {
      description: 'Please check your connection and try again',
    });
  }, [dedupe]);

  const loading = useCallback(
    (message: string, opts?: ExternalToast) => toast.loading(message, opts),
    [],
  );

  const dismiss = useCallback((id?: string | number) => {
    if (id !== undefined) {
      toast.dismiss(id);
    } else {
      toast.dismiss();
    }
  }, []);

  return {
    success,
    error,
    info,
    warning,
    created,
    updated,
    deleted,
    saved,
    archived,
    restored,
    duplicated,
    copied,
    exported,
    imported,
    failed,
    permissionDenied,
    networkError,
    loading,
    dismiss,
  };
}
