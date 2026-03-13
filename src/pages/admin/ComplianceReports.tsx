/**
 * ComplianceReports Page
 *
 * Generate compliance reports for regulatory requirements.
 * - Audit trail export
 * - Data retention policy display
 * - GDPR customer data export
 * - IP access logging display
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Download,
  FileText,
  Clock,
  Database,
  Globe,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ComplianceReports() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [customerId, setCustomerId] = useState('');

  // Fetch data retention policy
  const { data: retentionPolicy, isLoading: policyLoading } = useQuery({
    queryKey: ['compliance', 'settings', 'retention-policy', tenantId],
    queryFn: async () => {
      // Default retention policy
      return {
        orders: 7 * 365, // 7 years
        customers: 7 * 365,
        auditLogs: 3 * 365,
        invoices: 7 * 365,
        products: 'Indefinite',
      };
    },
    enabled: !!tenantId,
  });

  // Fetch recent IP access logs
  const { data: ipLogs, isLoading: logsLoading } = useQuery({
    queryKey: [...queryKeys.auditLog.all, 'ip-logs', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, user_id, action, ip_address, created_at')
        .eq('tenant_id', tenantId)
        .not('ip_address', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.error('Failed to fetch IP logs', error, {
          component: 'ComplianceReports',
          tenantId,
        });
        return [];
      }

      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Generate audit trail export
  const exportAuditTrail = useMutation({
    mutationFn: async ({ startDate, endDate }: { startDate?: string; endDate?: string }) => {
      if (!tenantId) throw new Error('No tenant context');

      const query = supabase
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (startDate) {
        query.gte('created_at', startDate);
      }
      if (endDate) {
        query.lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Convert to CSV
      const headers = [
        'Timestamp',
        'User ID',
        'Action',
        'Entity Type',
        'Entity ID',
        'IP Address',
        'Details',
      ];
      const csvLines = [
        headers.join(','),
        ...(data ?? []).map((log) =>
          [
            log.created_at,
            log.user_id,
            log.action,
            log.entity_type ?? '',
            log.entity_id ?? '',
            log.ip_address ?? '',
            log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '',
          ]
            .map((v) => `"${v}"`)
            .join(',')
        ),
      ];

      const csv = csvLines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      return data?.length ?? 0;
    },
    onSuccess: (count) => {
      toast.success(`Exported ${count} audit log records`);
      logger.info('Exported audit trail', { count });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to export audit trail'));
      logger.error('Failed to export audit trail', error);
    },
  });

  // GDPR customer data export
  const exportCustomerData = useMutation({
    mutationFn: async (customerId: string) => {
      if (!tenantId || !customerId) throw new Error('Missing required data');

      // Fetch all customer-related data
      const [customerRes, ordersRes, invoicesRes, notesRes] = await Promise.all([
        supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('id', customerId)
          .maybeSingle(),
        supabase
          .from('orders')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('customer_id', customerId),
        supabase
          .from('invoices')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('customer_id', customerId),
        supabase
          .from('customer_notes')
          .select('*')
          .eq('customer_id', customerId),
      ]);

      if (customerRes.error) throw customerRes.error;
      if (!customerRes.data) throw new Error('Customer not found');

      const exportData = {
        customer: customerRes.data,
        orders: ordersRes.data ?? [],
        invoices: invoicesRes.data ?? [],
        notes: notesRes.data ?? [],
        exportedAt: new Date().toISOString(),
        dataProtectionNotice:
          'This data export contains all personal information stored for this customer in compliance with GDPR Article 15.',
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customer-data-${customerId}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      return exportData;
    },
    onSuccess: () => {
      toast.success('Customer data exported');
      logger.info('Exported customer data for GDPR request');
      setCustomerId('');
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to export customer data'));
      logger.error('Failed to export customer data', error);
    },
  });

  if (policyLoading || logsLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Compliance Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate compliance reports and manage data protection policies
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Audit Trail Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Audit Trail Export
            </CardTitle>
            <CardDescription>Export complete audit log history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Download a complete record of all system actions and changes for compliance and
              security audits.
            </p>
            <Button
              onClick={() => exportAuditTrail.mutate({})}
              disabled={exportAuditTrail.isPending}
              className="w-full gap-2"
            >
              {exportAuditTrail.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export Audit Trail (CSV)
            </Button>
          </CardContent>
        </Card>

        {/* Data Retention Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Data Retention Policy
            </CardTitle>
            <CardDescription>Current retention periods</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {retentionPolicy && (
              <div className="space-y-2">
                {Object.entries(retentionPolicy).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <Badge variant="secondary">
                      {typeof value === 'number' ? `${Math.floor(value / 365)} years` : value}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Data is automatically archived after the retention period and permanently deleted
              after regulatory requirements are met.
            </p>
          </CardContent>
        </Card>

        {/* GDPR Customer Data Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5" />
              GDPR Data Export
            </CardTitle>
            <CardDescription>Export customer data for GDPR requests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="customer-id">Customer ID</Label>
              <Input
                id="customer-id"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="Enter customer UUID"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Customer can request their data under GDPR Article 15
              </p>
            </div>
            <Button
              onClick={() => exportCustomerData.mutate(customerId)}
              disabled={!customerId || exportCustomerData.isPending}
              className="w-full gap-2"
            >
              {exportCustomerData.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export Customer Data (JSON)
            </Button>
          </CardContent>
        </Card>

        {/* IP Access Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              IP Access Logging
            </CardTitle>
            <CardDescription>Recent access by IP address</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {ipLogs && ipLogs.length > 0 ? (
                ipLogs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-sm p-2 border rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs truncate">{log.ip_address}</div>
                      <div className="text-xs text-muted-foreground truncate">{log.action}</div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {new Date(log.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No IP logs available
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              IP addresses are logged for security monitoring and retained for{' '}
              {retentionPolicy?.auditLogs
                ? `${Math.floor(retentionPolicy.auditLogs / 365)} years`
                : '3 years'}
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ComplianceReports;
