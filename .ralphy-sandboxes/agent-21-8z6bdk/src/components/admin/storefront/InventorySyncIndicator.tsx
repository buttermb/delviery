/**
 * InventorySyncIndicator
 *
 * Displays the sync status between admin inventory and storefront display.
 * Shows real-time connection health, last sync timestamp, and manual sync option.
 * Used in admin header near other status indicators.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { logger } from '@/lib/logger';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import XCircle from 'lucide-react/dist/esm/icons/x-circle';
import Wifi from 'lucide-react/dist/esm/icons/wifi';
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off';
import Database from 'lucide-react/dist/esm/icons/database';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import { queryKeys } from '@/lib/queryKeys';

type SyncStatus = 'synced' | 'syncing' | 'lagging' | 'error' | 'disconnected';
type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface InventorySyncIndicatorProps {
  /** Size variant */
  size?: 'sm' | 'md';
  /** Whether to show extended details on click */
  showDetails?: boolean;
  /** Custom class name */
  className?: string;
}

/** Threshold in milliseconds for considering sync as lagging (30 seconds) */
const _LAG_THRESHOLD_MS = 30000;

/** Tables to monitor for inventory sync */
const INVENTORY_TABLES = ['products', 'inventory_batches', 'marketplace_product_settings'];

/**
 * Get visual config for sync status
 */
function getSyncStatusConfig(status: SyncStatus): {
  icon: React.ReactNode;
  color: string;
  label: string;
  description: string;
} {
  const iconSize = 'h-3.5 w-3.5';

  switch (status) {
    case 'synced':
      return {
        icon: <CheckCircle className={cn(iconSize, 'text-green-500')} />,
        color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400',
        label: 'In Sync',
        description: 'Storefront inventory is synchronized with admin',
      };
    case 'syncing':
      return {
        icon: <RefreshCw className={cn(iconSize, 'text-blue-500 animate-spin')} />,
        color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
        label: 'Syncing',
        description: 'Inventory updates are being synchronized',
      };
    case 'lagging':
      return {
        icon: <AlertTriangle className={cn(iconSize, 'text-amber-500')} />,
        color: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
        label: 'Sync Lag',
        description: 'Storefront may be showing outdated inventory',
      };
    case 'error':
      return {
        icon: <XCircle className={cn(iconSize, 'text-red-500')} />,
        color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400',
        label: 'Sync Error',
        description: 'Failed to sync inventory to storefront',
      };
    case 'disconnected':
      return {
        icon: <WifiOff className={cn(iconSize, 'text-gray-500')} />,
        color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
        label: 'Disconnected',
        description: 'Real-time connection is offline',
      };
    default:
      return {
        icon: <Database className={cn(iconSize, 'text-gray-500')} />,
        color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
        label: 'Unknown',
        description: 'Sync status unknown',
      };
  }
}

/**
 * Get connection status indicator
 */
function getConnectionConfig(status: ConnectionStatus): {
  icon: React.ReactNode;
  label: string;
  color: string;
} {
  const iconSize = 'h-3 w-3';

  switch (status) {
    case 'connected':
      return {
        icon: <Wifi className={cn(iconSize, 'text-green-500')} />,
        label: 'Connected',
        color: 'text-green-500',
      };
    case 'connecting':
      return {
        icon: <Loader2 className={cn(iconSize, 'text-blue-500 animate-spin')} />,
        label: 'Connecting',
        color: 'text-blue-500',
      };
    case 'disconnected':
      return {
        icon: <WifiOff className={cn(iconSize, 'text-gray-400')} />,
        label: 'Disconnected',
        color: 'text-gray-400',
      };
    case 'error':
      return {
        icon: <WifiOff className={cn(iconSize, 'text-red-500')} />,
        label: 'Connection Error',
        color: 'text-red-500',
      };
    default:
      return {
        icon: <WifiOff className={cn(iconSize, 'text-gray-400')} />,
        label: 'Unknown',
        color: 'text-gray-400',
      };
  }
}

export function InventorySyncIndicator({
  size = 'sm',
  showDetails = true,
  className,
}: InventorySyncIndicatorProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncCount, setSyncCount] = useState(0);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tenantId = tenant?.id;

  // Use the shared realtime sync hook instead of creating standalone channels.
  // This piggybacks on the existing useRealtimeSync channels and avoids
  // opening duplicate connections for 'products' and other inventory tables.
  const { isActive: realtimeActive } = useRealtimeSync({
    tenantId,
    tables: INVENTORY_TABLES,
    enabled: !!tenantId,
  });

  /**
   * Force manual sync of inventory queries
   */
  const handleManualSync = useCallback(async () => {
    if (!tenantId) return;

    setIsManualSyncing(true);
    setSyncStatus('syncing');

    try {
      logger.info('[InventorySyncIndicator] Manual sync triggered');

      // Invalidate all inventory-related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.byTenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventorySyncKeys.inventoryBatches() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.shopStoreProducts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventorySyncKeys.storefrontProducts() }),
      ]);

      setLastSyncAt(new Date());
      setSyncCount((prev) => prev + 1);
      setSyncStatus('synced');

      logger.info('[InventorySyncIndicator] Manual sync completed');
    } catch (error) {
      logger.error('[InventorySyncIndicator] Manual sync failed', error);
      setSyncStatus('error');
    } finally {
      setIsManualSyncing(false);
    }
  }, [tenantId, queryClient]);

  // Derive connection/sync status from the shared realtime hook
  // instead of managing our own channel and re-fire-prone callbacks.
  // This avoids the 50+ connection leak caused by useCallback deps in the effect.
  // The useRealtimeSync hook already handles subscriptions, failure tracking, and cleanup.
  // We just reflect its state here for the UI indicator.
  // Update connection status based on realtimeActive
  const connectionStatus: ConnectionStatus = !tenantId
    ? 'disconnected'
    : realtimeActive
      ? 'connected'
      : 'connecting';

  // Mark as synced once connected (effect to avoid render-time side effects)
  useEffect(() => {
    if (!realtimeActive || lastSyncAt || syncTimeoutRef.current) return;
    syncTimeoutRef.current = setTimeout(() => {
      setSyncStatus('synced');
      setLastSyncAt(new Date());
      syncTimeoutRef.current = null;
    }, 0);
  }, [realtimeActive, lastSyncAt]);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, []);

  const statusConfig = useMemo(() => getSyncStatusConfig(syncStatus), [syncStatus]);
  const connectionConfig = useMemo(() => getConnectionConfig(connectionStatus), [connectionStatus]);

  const lastSyncText = useMemo(() => {
    if (!lastSyncAt) return null;
    try {
      return formatDistanceToNow(lastSyncAt, { addSuffix: true });
    } catch {
      return null;
    }
  }, [lastSyncAt]);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  // If no tenant, don't render
  if (!tenantId) {
    return null;
  }

  // Simple tooltip version for compact display
  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              aria-label={`Inventory sync status: ${statusConfig.label}`}
              className={cn(
                'gap-1 font-normal border cursor-default',
                statusConfig.color,
                sizeClasses[size],
                className
              )}
            >
              {statusConfig.icon}
              {size === 'md' && <span>{statusConfig.label}</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="z-50">
            <div className="space-y-1 max-w-xs">
              <div className="font-medium">Inventory Sync: {statusConfig.label}</div>
              <div className="text-xs text-muted-foreground">{statusConfig.description}</div>
              {lastSyncText && (
                <div className="text-xs">
                  Last synced: <span className="font-medium">{lastSyncText}</span>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed popover version
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-1.5 h-8 px-2',
            (connectionStatus as string) === 'error' && 'text-red-500',
            syncStatus === 'lagging' && 'text-amber-500',
            className
          )}
        >
          {statusConfig.icon}
          <span className="hidden sm:inline text-xs">{statusConfig.label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Inventory Sync
            </h4>
            <Badge
              variant="outline"
              className={cn('gap-1 font-normal', statusConfig.color)}
            >
              {statusConfig.icon}
              <span>{statusConfig.label}</span>
            </Badge>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground">{statusConfig.description}</p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* Connection Status */}
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
              {connectionConfig.icon}
              <div>
                <div className="text-xs text-muted-foreground">Connection</div>
                <div className="font-medium">{connectionConfig.label}</div>
              </div>
            </div>

            {/* Sync Count */}
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Syncs</div>
                <div className="font-medium">{syncCount}</div>
              </div>
            </div>
          </div>

          {/* Last Sync */}
          {lastSyncText && (
            <div className="text-sm">
              <span className="text-muted-foreground">Last synced: </span>
              <span className="font-medium">{lastSyncText}</span>
            </div>
          )}

          {/* Manual Sync Button */}
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={handleManualSync}
            disabled={isManualSyncing || connectionStatus === 'disconnected'}
          >
            {isManualSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Force Sync Now
              </>
            )}
          </Button>

          {/* Warning for disconnected state */}
          {connectionStatus === 'disconnected' && (
            <p className="text-xs text-muted-foreground">
              Real-time updates are unavailable. Manual sync still works.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default InventorySyncIndicator;
