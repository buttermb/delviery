/**
 * usePOSKeyboardShortcuts Hook
 * 
 * Provides keyboard shortcuts and barcode scanner support for POS.
 * 
 * Shortcuts:
 * - Enter: Complete sale (when cart has items)
 * - Escape: Clear cart
 * - F2: Focus search
 * - F3: Toggle fullscreen
 * - Ctrl+H: Hold/park current transaction
 * 
 * Barcode Scanner:
 * - Detects rapid keypresses (< 50ms between chars)
 * - Triggers product lookup on complete scan
 */

import { useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UsePOSKeyboardShortcutsOptions {
    onCompleteSale: () => void;
    onClearCart: () => void;
    onToggleFullscreen: () => void;
    onHoldTransaction: () => void;
    onProductScan: (barcode: string) => void;
    onFocusSearch: () => void;
    cartHasItems: boolean;
    isLoading: boolean;
    enabled?: boolean;
}

interface ScanBuffer {
    chars: string;
    lastTime: number;
}

export function usePOSKeyboardShortcuts({
    onCompleteSale,
    onClearCart,
    onToggleFullscreen,
    onHoldTransaction,
    onProductScan,
    onFocusSearch,
    cartHasItems,
    isLoading,
    enabled = true,
}: UsePOSKeyboardShortcutsOptions) {
    const { toast } = useToast();
    const scanBuffer = useRef<ScanBuffer>({ chars: '', lastTime: 0 });
    const scanTimeout = useRef<NodeJS.Timeout | null>(null);

    // Process barcode scan
    const processScan = useCallback((barcode: string) => {
        if (barcode.length >= 4) { // Minimum barcode length
            onProductScan(barcode);
            toast({
                title: 'Barcode scanned',
                description: barcode,
                duration: 1500,
            });
        }
        scanBuffer.current = { chars: '', lastTime: 0 };
    }, [onProductScan, toast]);

    // Handle keydown events
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!enabled) return;

        // Ignore if user is typing in an input (except for scanner detection)
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

        // Barcode scanner detection (rapid keypresses)
        const now = Date.now();
        const timeSinceLastKey = now - scanBuffer.current.lastTime;

        // If key comes within 50ms, it's likely from a scanner
        if (timeSinceLastKey < 50 && e.key.length === 1) {
            scanBuffer.current.chars += e.key;
            scanBuffer.current.lastTime = now;

            // Clear any pending scan timeout
            if (scanTimeout.current) {
                clearTimeout(scanTimeout.current);
            }

            // Process scan after 100ms of no input
            scanTimeout.current = setTimeout(() => {
                processScan(scanBuffer.current.chars);
            }, 100);

            // Prevent the character from being typed
            if (!isInput) {
                e.preventDefault();
            }
            return;
        }

        // Start new scan buffer if single character
        if (e.key.length === 1 && !isInput) {
            scanBuffer.current = { chars: e.key, lastTime: now };
        }

        // Don't handle shortcuts if in input field (except Escape and F-keys)
        if (isInput && !['Escape', 'F2', 'F3'].includes(e.key)) {
            return;
        }

        // Keyboard shortcuts
        switch (e.key) {
            case 'Enter':
                if (!isInput && cartHasItems && !isLoading) {
                    e.preventDefault();
                    onCompleteSale();
                }
                break;

            case 'Escape':
                e.preventDefault();
                if (cartHasItems) {
                    onClearCart();
                    toast({ title: 'Cart cleared', duration: 1500 });
                }
                break;

            case 'F2':
                e.preventDefault();
                onFocusSearch();
                break;

            case 'F3':
                e.preventDefault();
                onToggleFullscreen();
                break;

            case 'h':
            case 'H':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (cartHasItems) {
                        onHoldTransaction();
                    }
                }
                break;
        }
    }, [
        enabled,
        cartHasItems,
        isLoading,
        onCompleteSale,
        onClearCart,
        onToggleFullscreen,
        onHoldTransaction,
        onFocusSearch,
        processScan,
        toast
    ]);

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (scanTimeout.current) {
                clearTimeout(scanTimeout.current);
            }
        };
    }, [handleKeyDown, enabled]);
}

export default usePOSKeyboardShortcuts;
