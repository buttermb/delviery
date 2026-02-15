/**
 * ProductSyncStatusIndicator
 *
 * Displays the sync status between admin product and storefront.
 * Shows real-time connection status and last sync timestamp.
 * Used on product detail and list pages to indicate sync health.
 */

import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ProductSyncStatus } from '@/hooks/useStorefrontProductSync';
type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';
import { CheckCircle, RefreshCw, Clock, AlertCircle, Wifi, WifiOff, Loader2 } from 'lucide-react';

interface ProductSyncStatusIndicatorProps {
  /** Sync status for the product */
  syncStatus: ProductSyncStatus;
  /** Connection status for realtime */
  connectionStatus?: ConnectionStatus;
  /** Last sync timestamp (ISO string) */
  lastSyncAt?: string | null;
  /** Total sync count in session */
  syncCount?: number;
  /** Product name for tooltip context */
  productName?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show detailed status */
  showDetails?: boolean;
  /** Whether to show connection status */
  showConnection?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Get icon and color for sync status
 */
function getSyncStatusConfig(status: ProductSyncStatus): {
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
        label: 'Synced',
        description: 'Product is in sync with storefront',
      };
    case 'syncing':
      return {
        icon: <RefreshCw className={cn(iconSize, 'text-blue-500 animate-spin')} />,
        color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
        label: 'Syncing',
        description: 'Product is being synced to storefront',
      };
    case 'pending':
      return {
        icon: <Clock className={cn(iconSize, 'text-amber-500')} />,
        color: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
        label: 'Pending',
        description: 'Product changes are pending sync',
      };
    case 'error':
      return {
        icon: <AlertCircle className={cn(iconSize, 'text-red-500')} />,
        color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400',
        label: 'Error',
        description: 'Failed to sync product to storefront',
      };
    default:
      return {
        icon: <CheckCircle className={cn(iconSize, 'text-gray-500')} />,
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

export function ProductSyncStatusIndicator({
  syncStatus,
  connectionStatus = 'connected',
  lastSyncAt,
  syncCount,
  productName,
  size = 'sm',
  showDetails = false,
  showConnection = false,
  className,
}: ProductSyncStatusIndicatorProps) {
  const statusConfig = useMemo(() => getSyncStatusConfig(syncStatus), [syncStatus]);
  const connectionConfig = useMemo(
    () => getConnectionConfig(connectionStatus),
    [connectionStatus]
  );

  const lastSyncText = useMemo(() => {
    if (!lastSyncAt) return null;
    try {
      return formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true });
    } catch {
      return null;
    }
  }, [lastSyncAt]);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const tooltipContent = (
    <div className="space-y-1.5 max-w-xs">
      <div className="font-medium">{statusConfig.label}</div>
      <div className="text-xs text-muted-foreground">{statusConfig.description}</div>
      {productName && (
        <div className="text-xs">
          Product: <span className="font-medium">{productName}</span>
        </div>
      )}
      {lastSyncText && (
        <div className="text-xs">
          Last synced: <span className="font-medium">{lastSyncText}</span>
        </div>
      )}
      {syncCount !== undefined && syncCount > 0 && (
        <div className="text-xs">
          Syncs this session: <span className="font-medium">{syncCount}</span>
        </div>
      )}
      {showConnection && (
        <div className="flex items-center gap-1.5 text-xs pt-1 border-t">
          {connectionConfig.icon}
          <span>Realtime: {connectionConfig.label}</span>
        </div>
      )}
    </div>
  );

  // Compact badge for tables/lists
  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                'gap-1 font-normal border cursor-default',
                statusConfig.color,
                sizeClasses[size],
                className
              )}
            >
              {statusConfig.icon}
              {size !== 'sm' && <span>{statusConfig.label}</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="z-50">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed view with connection status and timestamp
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                'gap-1.5 font-normal border cursor-default',
                statusConfig.color,
                sizeClasses[size]
              )}
            >
              {statusConfig.icon}
              <span>{statusConfig.label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipContent}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {showConnection && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn('flex items-center gap-1', connectionConfig.color)}>
                {connectionConfig.icon}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span>Realtime: {connectionConfig.label}</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {lastSyncText && (
        <span className="text-xs text-muted-foreground">
          Synced {lastSyncText}
        </span>
      )}
    </div>
  );
}

export default ProductSyncStatusIndicator;
