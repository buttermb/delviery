/**
 * Keyboard Shortcuts Help Dialog
 * Shows available keyboard shortcuts for the current context
 */

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface ShortcutInfo {
    key: string;
    description: string;
    category: string;
}

interface KeyboardShortcutsHelpProps {
    shortcuts: ShortcutInfo[];
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    triggerKey?: string; // Default: '?'
}

/**
 * Keyboard Shortcuts Help Dialog
 * Can be triggered by pressing '?' key
 */
export function KeyboardShortcutsHelp({
    shortcuts,
    open: controlledOpen,
    onOpenChange,
    triggerKey = '?',
}: KeyboardShortcutsHelpProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen ?? internalOpen;
    const setOpen = onOpenChange ?? setInternalOpen;

    // Listen for trigger key
    useEffect(() => {
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

            if (e.key === triggerKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                setOpen(!open);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [triggerKey, open, setOpen]);

    // Group shortcuts by category
    const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
        if (!acc[shortcut.category]) {
            acc[shortcut.category] = [];
        }
        acc[shortcut.category].push(shortcut);
        return acc;
    }, {} as Record<string, ShortcutInfo[]>);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Keyboard className="h-5 w-5" />
                        Keyboard Shortcuts
                    </DialogTitle>
                    <DialogDescription>
                        Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">?</kbd> anytime to toggle this help
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {Object.entries(groupedShortcuts).map(([category, items]) => (
                        <div key={category}>
                            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                                {category}
                            </h4>
                            <div className="grid gap-2">
                                {items.map((shortcut) => (
                                    <div
                                        key={shortcut.key}
                                        className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50"
                                    >
                                        <span className="text-sm">{shortcut.description}</span>
                                        <div className="flex items-center gap-1">
                                            {shortcut.key.split(' / ').map((key, i) => (
                                                <span key={i} className="flex items-center gap-1">
                                                    {i > 0 && <span className="text-muted-foreground text-xs">or</span>}
                                                    {key.split(' ').map((part, j) => (
                                                        <kbd
                                                            key={j}
                                                            className="px-1.5 py-0.5 bg-muted border rounded text-xs font-mono min-w-[24px] text-center"
                                                        >
                                                            {part}
                                                        </kbd>
                                                    ))}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-2 border-t text-xs text-muted-foreground text-center">
                    Tip: Use <kbd className="px-1 bg-muted rounded font-mono">Cmd/Ctrl + K</kbd> for command palette
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Global shortcuts that work everywhere
 */
export const globalShortcuts: ShortcutInfo[] = [
    { key: '⌘ K', description: 'Open command palette', category: 'Global' },
    { key: '?', description: 'Show keyboard shortcuts', category: 'Global' },
    { key: 'Escape', description: 'Close dialog/modal', category: 'Global' },
];

/**
 * Hotbox-specific shortcuts
 */
export const hotboxShortcuts: ShortcutInfo[] = [
    { key: 'j / ↓', description: 'Select next item', category: 'Navigation' },
    { key: 'k / ↑', description: 'Select previous item', category: 'Navigation' },
    { key: '1 / 2 / 3', description: 'Jump to column', category: 'Navigation' },
    { key: 'g u', description: 'Go to first urgent', category: 'Navigation' },
    { key: 'g t', description: 'Go to first today', category: 'Navigation' },
    { key: 'Enter / o', description: 'Open selected item', category: 'Actions' },
    { key: 'd', description: 'Dismiss item', category: 'Actions' },
    { key: 's', description: 'Snooze item', category: 'Actions' },
    { key: 'r', description: 'Refresh', category: 'Actions' },
];

/**
 * Live Orders shortcuts
 */
export const liveOrdersShortcuts: ShortcutInfo[] = [
    { key: 'r', description: 'Refresh orders', category: 'Actions' },
    { key: 'm', description: 'Toggle sound alerts', category: 'Settings' },
    { key: '1 / 2 / 3 / 4', description: 'Focus column', category: 'Navigation' },
];

export default KeyboardShortcutsHelp;
