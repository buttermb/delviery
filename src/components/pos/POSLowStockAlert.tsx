/**
 * POSLowStockAlert Component
 * 
 * Shows a warning when adding items with low stock.
 */

import { AlertTriangle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface POSLowStockAlertProps {
    productName: string;
    currentStock: number;
    threshold?: number;
    className?: string;
}

export function POSLowStockAlert({
    productName,
    currentStock,
    threshold = 5,
    className,
}: POSLowStockAlertProps) {
    if (currentStock > threshold) {
        return null;
    }

    const isOutOfStock = currentStock === 0;
    const isCritical = currentStock <= 2;

    return (
        <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm animate-in fade-in slide-in-from-bottom-2 duration-200",
            isOutOfStock && "bg-destructive/10 text-destructive",
            isCritical && !isOutOfStock && "bg-orange-500/10 text-orange-600 dark:text-orange-400",
            !isCritical && !isOutOfStock && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
            className
        )}>
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 truncate">
                {isOutOfStock
                    ? `${productName} is out of stock`
                    : `${productName}: only ${currentStock} left`
                }
            </span>
            <Package className="h-4 w-4 flex-shrink-0 opacity-50" />
        </div>
    );
}

// Hook to manage low stock alerts
import { useState, useCallback } from 'react';
import { Product, CartItem } from '@/pages/admin/PointOfSale';

interface LowStockItem {
    id: string;
    name: string;
    stock: number;
    timestamp: number;
}

export function usePOSLowStockAlerts(threshold: number = 5) {
    const [alerts, setAlerts] = useState<LowStockItem[]>([]);

    const checkStock = useCallback((product: Product, cartQuantity: number = 0) => {
        const availableStock = product.stock_quantity - cartQuantity;

        if (availableStock <= threshold) {
            setAlerts(prev => {
                // Remove existing alert for this product
                const filtered = prev.filter(a => a.id !== product.id);

                // Add new alert
                return [...filtered, {
                    id: product.id,
                    name: product.name,
                    stock: availableStock,
                    timestamp: Date.now(),
                }].slice(-3); // Keep only last 3 alerts
            });

            return true;
        }

        return false;
    }, [threshold]);

    const dismissAlert = useCallback((productId: string) => {
        setAlerts(prev => prev.filter(a => a.id !== productId));
    }, []);

    const clearAlerts = useCallback(() => {
        setAlerts([]);
    }, []);

    // Auto-dismiss alerts after 5 seconds
    const visibleAlerts = alerts.filter(a => Date.now() - a.timestamp < 5000);

    return {
        alerts: visibleAlerts,
        checkStock,
        dismissAlert,
        clearAlerts,
    };
}

export default POSLowStockAlert;
