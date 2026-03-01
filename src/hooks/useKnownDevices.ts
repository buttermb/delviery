import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export interface KnownDevice {
  id: string;
  user_id: string;
  device_fingerprint: string;
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  geo_country: string | null;
  geo_city: string | null;
  is_trusted: boolean;
  first_seen_at: string;
  last_seen_at: string;
  trust_confirmed_at: string | null;
}

export interface SuspiciousLoginAlert {
  id: string;
  user_id: string;
  device_fingerprint: string;
  ip_address: string | null;
  geo_country: string | null;
  geo_city: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  alert_type: string;
  severity: string;
  email_sent: boolean;
  user_response: string | null;
  responded_at: string | null;
  account_secured: boolean;
  created_at: string;
}

/**
 * Hook for managing user's known devices
 */
export function useKnownDevices(userId?: string) {
  const queryClient = useQueryClient();

  const devicesQuery = useQuery({
    queryKey: queryKeys.security.knownDevices(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('user_known_devices')
        .select('id, user_id, device_fingerprint, device_name, device_type, browser, os, ip_address, geo_country, geo_city, is_trusted, first_seen_at, last_seen_at, trust_confirmed_at')
        .eq('user_id', userId)
        .order('last_seen_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as KnownDevice[];
    },
    enabled: !!userId,
  });

  const alertsQuery = useQuery({
    queryKey: queryKeys.security.suspiciousAlerts(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('suspicious_login_alerts')
        .select('id, user_id, device_fingerprint, ip_address, geo_country, geo_city, browser, os, device_type, alert_type, severity, email_sent, user_response, responded_at, account_secured, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as SuspiciousLoginAlert[];
    },
    enabled: !!userId,
  });

  const trustDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase
        .from('user_known_devices')
        .update({ is_trusted: true, trust_confirmed_at: new Date().toISOString() })
        .eq('id', deviceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.security.knownDevices(userId) });
      toast.success('Device trusted successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to trust device:', error);
      toast.error('Failed to trust device', { description: errorMessage });
    },
  });

  const untrustDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase
        .from('user_known_devices')
        .update({ is_trusted: false, trust_confirmed_at: null })
        .eq('id', deviceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.security.knownDevices(userId) });
      toast.success('Device untrusted successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to untrust device:', error);
      toast.error('Failed to untrust device', { description: errorMessage });
    },
  });

  const removeDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase
        .from('user_known_devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.security.knownDevices(userId) });
      toast.success('Device removed successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to remove device:', error);
      toast.error('Failed to remove device', { description: errorMessage });
    },
  });

  const confirmAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { data, error } = await supabase.functions.invoke('secure-account', {
        body: { action: 'confirm', alertId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to confirm');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.security.suspiciousAlerts(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.security.knownDevices(userId) });
      toast.success('Login confirmed successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to confirm login alert:', error);
      toast.error('Failed to confirm login', { description: errorMessage });
    },
  });

  return {
    devices: devicesQuery.data ?? [],
    isLoadingDevices: devicesQuery.isLoading,
    alerts: alertsQuery.data ?? [],
    isLoadingAlerts: alertsQuery.isLoading,
    pendingAlerts: (alertsQuery.data ?? []).filter(a => !a.user_response),
    trustDevice: trustDeviceMutation.mutate,
    isTrusting: trustDeviceMutation.isPending,
    untrustDevice: untrustDeviceMutation.mutate,
    isUntrusting: untrustDeviceMutation.isPending,
    removeDevice: removeDeviceMutation.mutate,
    isRemoving: removeDeviceMutation.isPending,
    confirmAlert: confirmAlertMutation.mutate,
    isConfirming: confirmAlertMutation.isPending,
  };
}
