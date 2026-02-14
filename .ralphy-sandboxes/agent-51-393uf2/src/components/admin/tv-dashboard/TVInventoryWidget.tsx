/**
 * TVInventoryWidget Component
 * 
 * Shows low stock inventory alerts:
 * - Products below reorder threshold
 * - Priority sorted (lowest stock first)
 * - Warning icons for critical items
 */

import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface InventoryAlert {
    id: string;
    productName: string;
    currentQty: number;
    threshold: number;
    unit?: string;
}

interface TVInventoryWidgetProps {
    alerts: InventoryAlert[];
    maxItems?: number;
}

function AlertRow({ alert }: { alert: InventoryAlert }) {
    const isCritical = alert.currentQty <= 5;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={cn(
                "flex items-center gap-4 px-4 py-3 rounded-lg border",
                isCritical
                    ? "bg-red-500/10 border-red-500/30"
                    : "bg-amber-500/10 border-amber-500/30"
            )}
        >
            <AlertTriangle className={cn(
                "w-6 h-6 flex-shrink-0",
                isCritical ? "text-red-400" : "text-amber-400"
            )} />

            <div className="flex-1 min-w-0">
                <div className="text-lg font-medium text-white truncate">
                    {alert.productName}
                </div>
            </div>

            <div className="text-right">
                <div className={cn(
                    "text-2xl font-bold",
                    isCritical ? "text-red-400" : "text-amber-400"
                )}>
                    {alert.currentQty}
                </div>
                <div className="text-xs text-zinc-500">
                    / {alert.threshold} min
                </div>
            </div>
        </motion.div>
    );
}

export function TVInventoryWidget({ alerts, maxItems = 8 }: TVInventoryWidgetProps) {
    // Sort by lowest stock first
    const sortedAlerts = [...alerts]
        .sort((a, b) => a.currentQty - b.currentQty)
        .slice(0, maxItems);

    const criticalCount = alerts.filter(a => a.currentQty <= 5).length;
    const warningCount = alerts.length - criticalCount;

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 px-2">
                <h2 className="text-xl font-semibold text-zinc-300">Inventory Alerts</h2>
                {alerts.length > 0 && (
                    <div className="flex items-center gap-3">
                        {criticalCount > 0 && (
                            <span className="text-sm font-medium text-red-400">
                                {criticalCount} critical
                            </span>
                        )}
                        {warningCount > 0 && (
                            <span className="text-sm font-medium text-amber-400">
                                {warningCount} low
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
                <AnimatePresence>
                    {sortedAlerts.map(alert => (
                        <AlertRow key={alert.id} alert={alert} />
                    ))}
                </AnimatePresence>

                {alerts.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                        <CheckCircle2 className="w-16 h-16 text-emerald-500/50 mb-4" />
                        <div className="text-xl font-medium text-emerald-400">All Good!</div>
                        <div className="text-zinc-500 mt-1">No low stock items</div>
                    </div>
                )}

                {alerts.length > maxItems && (
                    <div className="text-center text-zinc-500 text-sm py-2">
                        +{alerts.length - maxItems} more items
                    </div>
                )}
            </div>
        </div>
    );
}
