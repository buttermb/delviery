/**
 * Uptime Monitor Component
 * Displays service availability status and response times
 * Inspired by Uptime Kuma and StatusPage.io
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Server, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useEffect } from 'react';

interface ServiceStatus {
  service_name: string;
  endpoint: string;
  status: 'up' | 'down' | 'degraded';
  response_time_ms: number;
  checked_at: string;
  error_message?: string;
  status_code?: number;
}

export function UptimeMonitor() {
  // Fetch current service status
  const { data: services, isLoading } = useQuery({
    queryKey: ['uptime-monitor'],
    queryFn: async () => {
      // Get latest check for each service
      const { data: checks, error } = await supabase
        .from('uptime_checks')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Group by service and get latest
      const serviceMap = new Map<string, ServiceStatus>();
      
      (checks || []).forEach((check: any) => {
        const key = `${check.service_name}:${check.endpoint}`;
        if (!serviceMap.has(key)) {
          serviceMap.set(key, check as ServiceStatus);
        }
      });

      return Array.from(serviceMap.values());
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('uptime-checks-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'uptime_checks',
        },
        () => {
          // Refetch on new data
          window.location.reload(); // Simple refresh - could use query invalidation
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'down':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'up':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Operational</Badge>;
      case 'down':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Down</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Degraded</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up':
        return 'border-green-500/30 bg-green-500/5';
      case 'down':
        return 'border-red-500/30 bg-red-500/5';
      case 'degraded':
        return 'border-yellow-500/30 bg-yellow-500/5';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Service Uptime
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!services || services.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Service Uptime
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Server className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No uptime checks available</p>
            <p className="text-xs mt-1">Checks will appear here once monitoring starts</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate overall uptime percentage
  const upCount = services.filter(s => s.status === 'up').length;
  const uptimePercent = services.length > 0 ? (upCount / services.length) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Service Uptime
          </CardTitle>
          <Badge variant="outline" className="text-lg font-semibold">
            {uptimePercent.toFixed(1)}% Uptime
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {services.map((service) => (
          <div
            key={`${service.service_name}:${service.endpoint}`}
            className={`flex items-center justify-between p-4 border rounded-lg ${getStatusColor(service.status)}`}
          >
            <div className="flex items-center gap-3 flex-1">
              {getStatusIcon(service.status)}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium">{service.service_name}</p>
                  {getStatusBadge(service.status)}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="font-mono text-xs">{service.endpoint}</span>
                  {service.response_time_ms && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {service.response_time_ms}ms
                    </span>
                  )}
                  {service.checked_at && (
                    <span>
                      {formatDistanceToNow(new Date(service.checked_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
                {service.error_message && (
                  <p className="text-xs text-red-500 mt-1">{service.error_message}</p>
                )}
                {service.status_code && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Status Code: {service.status_code}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

