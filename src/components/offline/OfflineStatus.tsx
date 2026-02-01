/**
 * Offline Status Components
 * UI components for displaying offline status and pending actions
 */

import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
    WifiOff,
    Wifi,
    RefreshCw,
    CloudOff,
    Check,
    X,
    Clock,
    AlertCircle,
} from 'lucide-react';
import { useState } from 'react';

/**
 * Offline Indicator Banner
 * Shows a banner when the user is offline
 */
export function OfflineBanner({ className }: { className?: string }) {
    const { isOnline, pendingCount } = useOfflineQueue();

    if (isOnline && pendingCount === 0) return null;

    return (
        <div
            className={cn(
                'fixed top-0 left-0 right-0 z-50 px-4 py-2',
                isOnline ? 'bg-yellow-500' : 'bg-red-500',
                className
            )}
        >
            <div className="container mx-auto flex items-center justify-center gap-2 text-white text-sm">
                {isOnline ? (
                    <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Syncing {pendingCount} pending actions...</span>
                    </>
                ) : (
                    <>
                        <WifiOff className="h-4 w-4" />
                        <span>You're offline. Changes will sync when you reconnect.</span>
                        {pendingCount > 0 && (
                            <Badge variant="secondary" className="ml-2">
                                {pendingCount} pending
                            </Badge>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * Compact Offline Status Indicator
 * Shows a small icon in the header/sidebar
 */
export function OfflineStatusIndicator({ className }: { className?: string }) {
    const { isOnline, pendingCount, failedCount, sync } = useOfflineQueue();
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await sync();
        } finally {
            setIsSyncing(false);
        }
    };

    const hasIssues = !isOnline || pendingCount > 0 || failedCount > 0;

    if (!hasIssues) {
        return (
            <div className={cn('flex items-center gap-1.5 text-green-500', className)}>
                <Wifi className="h-4 w-4" />
                <span className="text-xs">Online</span>
            </div>
        );
    }

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        'flex items-center gap-1.5',
                        !isOnline && 'text-red-500',
                        isOnline && pendingCount > 0 && 'text-yellow-500',
                        isOnline && failedCount > 0 && 'text-orange-500',
                        className
                    )}
                >
                    {!isOnline ? (
                        <WifiOff className="h-4 w-4" />
                    ) : pendingCount > 0 ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                        <AlertCircle className="h-4 w-4" />
                    )}
                    {(pendingCount > 0 || failedCount > 0) && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            {pendingCount + failedCount}
                        </Badge>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Sync Status</SheetTitle>
                    <SheetDescription>
                        Manage pending and failed actions
                    </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                    {/* Connection Status */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                        <div className="flex items-center gap-2">
                            {isOnline ? (
                                <Wifi className="h-5 w-5 text-green-500" />
                            ) : (
                                <WifiOff className="h-5 w-5 text-red-500" />
                            )}
                            <span className="font-medium">
                                {isOnline ? 'Connected' : 'Offline'}
                            </span>
                        </div>
                        {isOnline && pendingCount > 0 && (
                            <Button
                                size="sm"
                                onClick={handleSync}
                                disabled={isSyncing}
                            >
                                {isSyncing ? (
                                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                Sync Now
                            </Button>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                            <div className="text-2xl font-bold text-yellow-600">
                                {pendingCount}
                            </div>
                            <div className="text-sm text-yellow-700 dark:text-yellow-400">
                                Pending
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                            <div className="text-2xl font-bold text-red-600">
                                {failedCount}
                            </div>
                            <div className="text-sm text-red-700 dark:text-red-400">
                                Failed
                            </div>
                        </div>
                    </div>

                    {/* Pending Actions List */}
                    <PendingActionsList />
                </div>
            </SheetContent>
        </Sheet>
    );
}

/**
 * List of pending/failed actions
 */
function PendingActionsList() {
    const { pendingActions, failedActions, retry, remove } = useOfflineQueue();
    const allActions = [...pendingActions, ...failedActions];

    if (allActions.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>All synced!</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <h4 className="text-sm font-medium">Actions</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
                {allActions.map((action) => (
                    <div
                        key={action.id}
                        className={cn(
                            'flex items-center justify-between p-2 rounded-lg border',
                            action.status === 'failed' && 'border-red-200 bg-red-50 dark:bg-red-950/20',
                            action.status === 'pending' && 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20',
                            action.status === 'processing' && 'border-blue-200 bg-blue-50 dark:bg-blue-950/20'
                        )}
                    >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                {action.status === 'pending' && <Clock className="h-4 w-4 text-yellow-500" />}
                                {action.status === 'processing' && <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />}
                                {action.status === 'failed' && <X className="h-4 w-4 text-red-500" />}
                                <span className="text-sm font-medium truncate">
                                    {action.type.replace(/_/g, ' ')}
                                </span>
                            </div>
                            {action.lastError && (
                                <p className="text-xs text-red-600 mt-1 truncate">
                                    {action.lastError}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                            {action.status === 'failed' && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => retry(action.id)}
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                            )}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => remove(action.id)}
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Offline Mode Alert
 * Shows when user tries to perform an action while offline
 */
export function OfflineAlert({
    show,
    onClose,
}: {
    show: boolean;
    onClose: () => void;
}) {
    if (!show) return null;

    return (
        <Alert className="fixed bottom-4 right-4 max-w-sm shadow-lg z-50 animate-in slide-in-from-right">
            <CloudOff className="h-4 w-4" />
            <AlertTitle>You're offline</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
                <span>This action has been saved and will sync when you're back online.</span>
                <Button size="sm" variant="outline" onClick={onClose}>
                    Dismiss
                </Button>
            </AlertDescription>
        </Alert>
    );
}

export default OfflineBanner;
