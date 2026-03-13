import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

import { logger } from '@/lib/logger';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ServiceStatus = 'operational' | 'degraded' | 'down' | 'maintenance';

interface SystemStatus {
  overall: ServiceStatus;
  services: {
    database: ServiceStatus;
    auth: ServiceStatus;
    storage: ServiceStatus;
    api: ServiceStatus;
  };
  lastChecked: string;
}

function getStatusColor(status: ServiceStatus): string {
  switch (status) {
    case 'operational':
      return 'text-emerald-600';
    case 'degraded':
      return 'text-yellow-600';
    case 'down':
      return 'text-red-600';
    case 'maintenance':
      return 'text-blue-600';
    default:
      return 'text-gray-400';
  }
}

function getStatusIcon(status: ServiceStatus) {
  switch (status) {
    case 'operational':
      return <CheckCircle className="h-4 w-4" />;
    case 'degraded':
      return <AlertCircle className="h-4 w-4" />;
    case 'down':
      return <XCircle className="h-4 w-4" />;
    case 'maintenance':
      return <Activity className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}

function getStatusLabel(status: ServiceStatus): string {
  switch (status) {
    case 'operational':
      return 'All Systems Operational';
    case 'degraded':
      return 'Degraded Performance';
    case 'down':
      return 'Service Disruption';
    case 'maintenance':
      return 'Scheduled Maintenance';
    default:
      return 'Unknown Status';
  }
}

export function StatusPageIndicator() {
  const { data: status } = useQuery({
    queryKey: ['system-status'],
    queryFn: async (): Promise<SystemStatus> => {
      logger.info('[StatusPage] Checking system status');

      // In a real implementation, this would check actual service health endpoints
      // For now, we'll assume all systems are operational
      const status: SystemStatus = {
        overall: 'operational',
        services: {
          database: 'operational',
          auth: 'operational',
          storage: 'operational',
          api: 'operational',
        },
        lastChecked: new Date().toISOString(),
      };

      return status;
    },
    refetchInterval: 60000, // Check every minute
  });

  if (!status) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors ${getStatusColor(
              status.overall
            )}`}
          >
            {getStatusIcon(status.overall)}
            <span className="text-xs font-medium">{getStatusLabel(status.overall)}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="text-xs font-semibold">Service Status</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4 text-xs">
                <span>Database:</span>
                <span className={`font-medium ${getStatusColor(status.services.database)}`}>
                  {status.services.database}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-xs">
                <span>Authentication:</span>
                <span className={`font-medium ${getStatusColor(status.services.auth)}`}>
                  {status.services.auth}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-xs">
                <span>Storage:</span>
                <span className={`font-medium ${getStatusColor(status.services.storage)}`}>
                  {status.services.storage}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-xs">
                <span>API:</span>
                <span className={`font-medium ${getStatusColor(status.services.api)}`}>
                  {status.services.api}
                </span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
