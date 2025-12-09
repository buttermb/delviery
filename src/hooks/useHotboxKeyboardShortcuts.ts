/**
 * Hotbox Keyboard Shortcuts Hook
 * Provides keyboard navigation and shortcuts for the Hotbox/Attention Queue
 */

import { useEffect, useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AttentionItem } from '@/lib/hotbox/attentionQueue';

interface UseHotboxKeyboardShortcutsOptions {
    items: AttentionItem[];
    enabled?: boolean;
    onItemAction?: (item: AttentionItem) => void;
    onDismiss?: (item: AttentionItem) => void;
    onSnooze?: (item: AttentionItem) => void;
    onBatchDismiss?: (items: AttentionItem[], columnId: string) => void;
    onRefresh?: () => void;
}

interface UseHotboxKeyboardShortcutsReturn {
    selectedIndex: number | null;
    selectedItem: AttentionItem | null;
    selectNext: () => void;
    selectPrevious: () => void;
    selectFirst: () => void;
    clearSelection: () => void;
    shortcuts: ShortcutInfo[];
}

interface ShortcutInfo {
    key: string;
    description: string;
    category: string;
}

/**
 * Hook for keyboard shortcuts in Hotbox
 * 
 * Shortcuts:
 * - j/↓: Select next item
 * - k/↑: Select previous item
 * - Enter/o: Open selected item
 * - d: Dismiss selected item
 * - s: Snooze selected item
 * - g then u: Go to urgent column
 * - g then t: Go to today column
 * - r: Refresh
 * - ?: Show shortcuts help
 * - Escape: Clear selection
 */
export function useHotboxKeyboardShortcuts({
    items,
    enabled = true,
    onItemAction,
    onDismiss,
    onSnooze,
    onBatchDismiss,
    onRefresh,
}: UseHotboxKeyboardShortcutsOptions): UseHotboxKeyboardShortcutsReturn {
    const navigate = useNavigate();
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [pendingPrefix, setPendingPrefix] = useState<string | null>(null);

    // Get selected item
    const selectedItem = selectedIndex !== null && items[selectedIndex]
        ? items[selectedIndex]
        : null;

    // Navigation helpers
    const selectNext = useCallback(() => {
        if (items.length === 0) return;
        setSelectedIndex((prev) => {
            if (prev === null) return 0;
            return Math.min(prev + 1, items.length - 1);
        });
    }, [items.length]);

    const selectPrevious = useCallback(() => {
        if (items.length === 0) return;
        setSelectedIndex((prev) => {
            if (prev === null) return items.length - 1;
            return Math.max(prev - 1, 0);
        });
    }, [items.length]);

    const selectFirst = useCallback(() => {
        if (items.length === 0) return;
        setSelectedIndex(0);
    }, [items.length]);

    const clearSelection = useCallback(() => {
        setSelectedIndex(null);
        setPendingPrefix(null);
    }, []);

    // Handle key events
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if in input/textarea
            const target = e.target as HTMLElement;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            ) {
                return;
            }

            // Handle pending prefix (g + key combinations)
            if (pendingPrefix === 'g') {
                setPendingPrefix(null);
                switch (e.key.toLowerCase()) {
                    case 'u': // g + u: Go to urgent
                        const urgentItems = items.filter((i) => i.priority === 'critical');
                        if (urgentItems.length > 0) {
                            const index = items.findIndex((i) => i.id === urgentItems[0].id);
                            setSelectedIndex(index);
                        }
                        e.preventDefault();
                        return;
                    case 't': // g + t: Go to today
                        const todayItems = items.filter((i) => i.priority === 'important');
                        if (todayItems.length > 0) {
                            const index = items.findIndex((i) => i.id === todayItems[0].id);
                            setSelectedIndex(index);
                        }
                        e.preventDefault();
                        return;
                    case 'h': // g + h: Go home (dashboard)
                        navigate(tenantSlug ? `/${tenantSlug}/admin` : '/admin');
                        e.preventDefault();
                        return;
                }
            }

            switch (e.key) {
                case 'j':
                case 'ArrowDown':
                    selectNext();
                    e.preventDefault();
                    break;

                case 'k':
                case 'ArrowUp':
                    selectPrevious();
                    e.preventDefault();
                    break;

                case 'Enter':
                case 'o':
                    if (selectedItem) {
                        if (onItemAction) {
                            onItemAction(selectedItem);
                        } else {
                            // Default: navigate to action URL
                            const url = selectedItem.actionUrl.startsWith('/')
                                ? (tenantSlug ? `/${tenantSlug}${selectedItem.actionUrl}` : selectedItem.actionUrl)
                                : selectedItem.actionUrl;
                            navigate(url);
                        }
                    }
                    e.preventDefault();
                    break;

                case 'd':
                    if (selectedItem && onDismiss) {
                        onDismiss(selectedItem);
                    }
                    e.preventDefault();
                    break;

                case 's':
                    if (selectedItem && onSnooze) {
                        onSnooze(selectedItem);
                    }
                    e.preventDefault();
                    break;

                case 'g':
                    setPendingPrefix('g');
                    e.preventDefault();
                    break;

                case 'r':
                    if (onRefresh) {
                        onRefresh();
                    }
                    e.preventDefault();
                    break;

                case 'Escape':
                    clearSelection();
                    e.preventDefault();
                    break;

                case '1':
                    // Select first urgent item
                    const firstUrgent = items.find((i) => i.priority === 'critical');
                    if (firstUrgent) {
                        setSelectedIndex(items.indexOf(firstUrgent));
                    }
                    e.preventDefault();
                    break;

                case '2':
                    // Select first today item
                    const firstToday = items.find((i) => i.priority === 'important');
                    if (firstToday) {
                        setSelectedIndex(items.indexOf(firstToday));
                    }
                    e.preventDefault();
                    break;

                case '3':
                    // Select first upcoming item
                    const firstUpcoming = items.find((i) => i.priority === 'info');
                    if (firstUpcoming) {
                        setSelectedIndex(items.indexOf(firstUpcoming));
                    }
                    e.preventDefault();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        enabled,
        items,
        selectedItem,
        pendingPrefix,
        selectNext,
        selectPrevious,
        clearSelection,
        onItemAction,
        onDismiss,
        onSnooze,
        onRefresh,
        navigate,
        tenantSlug,
    ]);

    // Clear pending prefix after timeout
    useEffect(() => {
        if (pendingPrefix) {
            const timeout = setTimeout(() => setPendingPrefix(null), 1000);
            return () => clearTimeout(timeout);
        }
    }, [pendingPrefix]);

    // Shortcuts list for help display
    const shortcuts: ShortcutInfo[] = [
        { key: 'j / ↓', description: 'Select next item', category: 'Navigation' },
        { key: 'k / ↑', description: 'Select previous item', category: 'Navigation' },
        { key: '1 / 2 / 3', description: 'Jump to column (Urgent/Today/Upcoming)', category: 'Navigation' },
        { key: 'g u', description: 'Go to first urgent item', category: 'Navigation' },
        { key: 'g t', description: 'Go to first today item', category: 'Navigation' },
        { key: 'g h', description: 'Go to dashboard', category: 'Navigation' },
        { key: 'Enter / o', description: 'Open selected item', category: 'Actions' },
        { key: 'd', description: 'Dismiss selected item', category: 'Actions' },
        { key: 's', description: 'Snooze selected item', category: 'Actions' },
        { key: 'r', description: 'Refresh items', category: 'Actions' },
        { key: 'Escape', description: 'Clear selection', category: 'Actions' },
    ];

    return {
        selectedIndex,
        selectedItem,
        selectNext,
        selectPrevious,
        selectFirst,
        clearSelection,
        shortcuts,
    };
}

/**
 * Visual keyboard shortcut hint component
 */
export function KeyboardShortcutHint({
    shortcut,
    className
}: {
    shortcut: string;
    className?: string;
}) {
    return (
        <kbd className= {`
      inline-flex items-center justify-center
      h-5 px-1.5 text-[10px] font-mono font-medium
      bg-muted border border-border rounded
      text-muted-foreground
      ${className || ''}
    `}>
    { shortcut }
    </kbd>
  );
}
