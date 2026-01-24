import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { logger } from '@/lib/logger';

interface LicenseAlert {
  clientId: string;
  clientName: string;
  businessName: string | null;
  licenseNumber: string | null;
  expirationDate: Date;
  daysUntilExpiration: number;
  status: 'valid' | 'expiring_soon' | 'expired';
  alertType: '30_day' | '14_day' | '7_day' | 'expired';
}

interface WholesaleClientWithLicense {
  id: string;
  contact_name: string | null;
  business_name: string | null;
  license_number?: string | null;
  license_expiration_date?: string | null;
  license_status?: string | null;
}

export function useLicenseExpirationAlerts(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['license-alerts', tenantId],
    queryFn: async (): Promise<LicenseAlert[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('wholesale_clients')
        .select('id, contact_name, business_name')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);

      if (error) throw error;

      // Cast to include new columns added by migration
      const clients = data as unknown as WholesaleClientWithLicense[];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return clients
        .filter(client => client.license_expiration_date)
        .map(client => {
          const expDate = new Date(client.license_expiration_date!);
          const daysUntil = differenceInDays(expDate, today);
          
          let alertType: LicenseAlert['alertType'];
          let status: LicenseAlert['status'];

          if (daysUntil < 0) {
            alertType = 'expired';
            status = 'expired';
          } else if (daysUntil <= 7) {
            alertType = '7_day';
            status = 'expiring_soon';
          } else if (daysUntil <= 14) {
            alertType = '14_day';
            status = 'expiring_soon';
          } else if (daysUntil <= 30) {
            alertType = '30_day';
            status = 'expiring_soon';
          } else {
            return null;
          }

          return {
            clientId: client.id,
            clientName: client.contact_name || client.business_name || 'Unknown',
            businessName: client.business_name,
            licenseNumber: client.license_number || null,
            expirationDate: expDate,
            daysUntilExpiration: daysUntil,
            status,
            alertType
          } as LicenseAlert;
        })
        .filter((alert): alert is LicenseAlert => alert !== null);
    },
    enabled: !!tenantId
  });

  const updateLicenseStatuses = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('update_license_statuses');
      if (error) throw error;
      return data;
    },
    onSuccess: (updated) => {
      if (typeof updated === 'number' && updated > 0) {
        toast.info(`Updated ${updated} license statuses`);
      }
      queryClient.invalidateQueries({ queryKey: ['license-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['wholesale-clients'] });
    },
    onError: (error: Error) => {
      logger.error('Failed to update license statuses', { error });
      toast.error('Failed to update license statuses');
    },
  });

  const expiredCount = alerts.filter(a => a.status === 'expired').length;
  const expiringSoonCount = alerts.filter(a => a.status === 'expiring_soon').length;

  return {
    alerts,
    expiredCount,
    expiringSoonCount,
    isLoading,
    updateLicenseStatuses: updateLicenseStatuses.mutate,
    isUpdating: updateLicenseStatuses.isPending
  };
}
