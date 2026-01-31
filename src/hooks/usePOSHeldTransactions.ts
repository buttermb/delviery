/**
 * usePOSHeldTransactions Hook
 * 
 * Manages held/parked transactions for POS.
 * Persists to localStorage so transactions survive page refresh.
 */

import { useState, useEffect, useCallback } from 'react';
import { CartItem } from '@/pages/admin/PointOfSale';

export interface HeldTransaction {
    id: string;
    cart: CartItem[];
    customerId?: string;
    customerName?: string;
    heldAt: string;
    note?: string;
}

interface UsePOSHeldTransactionsOptions {
    tenantId: string | undefined;
    maxHeld?: number;
}

const STORAGE_KEY_PREFIX = 'pos_held_transactions_';

export function usePOSHeldTransactions({
    tenantId,
    maxHeld = 5,
}: UsePOSHeldTransactionsOptions) {
    const [heldTransactions, setHeldTransactions] = useState<HeldTransaction[]>([]);

    const storageKey = tenantId ? `${STORAGE_KEY_PREFIX}${tenantId}` : null;

    // Load from localStorage on mount
    useEffect(() => {
        if (!storageKey) return;

        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored) as HeldTransaction[];
                // Clean up old transactions (older than 24 hours)
                const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
                const valid = parsed.filter(t => new Date(t.heldAt).getTime() > oneDayAgo);
                setHeldTransactions(valid);

                // Save cleaned list back
                if (valid.length !== parsed.length) {
                    localStorage.setItem(storageKey, JSON.stringify(valid));
                }
            }
        } catch (e) {
            console.error('Failed to load held transactions', e);
        }
    }, [storageKey]);

    // Save to localStorage whenever held transactions change
    useEffect(() => {
        if (!storageKey) return;

        try {
            localStorage.setItem(storageKey, JSON.stringify(heldTransactions));
        } catch (e) {
            console.error('Failed to save held transactions', e);
        }
    }, [heldTransactions, storageKey]);

    // Hold a transaction
    const holdTransaction = useCallback((
        cart: CartItem[],
        customerId?: string,
        customerName?: string,
        note?: string
    ): boolean => {
        if (cart.length === 0) return false;
        if (heldTransactions.length >= maxHeld) return false;

        const transaction: HeldTransaction = {
            id: crypto.randomUUID(),
            cart,
            customerId,
            customerName,
            heldAt: new Date().toISOString(),
            note,
        };

        setHeldTransactions(prev => [...prev, transaction]);
        return true;
    }, [heldTransactions.length, maxHeld]);

    // Recall a held transaction
    const recallTransaction = useCallback((id: string): HeldTransaction | null => {
        const transaction = heldTransactions.find(t => t.id === id);
        if (!transaction) return null;

        setHeldTransactions(prev => prev.filter(t => t.id !== id));
        return transaction;
    }, [heldTransactions]);

    // Delete a held transaction
    const deleteTransaction = useCallback((id: string) => {
        setHeldTransactions(prev => prev.filter(t => t.id !== id));
    }, []);

    // Clear all held transactions
    const clearAll = useCallback(() => {
        setHeldTransactions([]);
    }, []);

    return {
        heldTransactions,
        holdTransaction,
        recallTransaction,
        deleteTransaction,
        clearAll,
        canHold: heldTransactions.length < maxHeld,
        heldCount: heldTransactions.length,
    };
}

export default usePOSHeldTransactions;
