/**
 * CustomReportBuilder Component
 *
 * Standalone report builder widget for the analytics module.
 * Wraps the full ReportBuilder dialog and displays saved reports.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { ReportBuilder } from '@/components/admin/reporting/ReportBuilder';
import { BarChart3, Plus, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  report_type: string;
  created_at: string;
}

export function CustomReportBuilder() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const { data: reports, isLoading } = useQuery({
    queryKey: queryKeys.customReports.byTenant(tenantId),
    queryFn: async (): Promise<SavedReport[]> => {
      if (!tenantId) return [];
      try {
        const { data, error } = await supabase
          .from('custom_reports')
          .select('id, name, description, report_type, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) {
          if (error.code === '42P01') return [];
          throw error;
        }
        return (data ?? []) as SavedReport[];
      } catch (err) {
        logger.error('Failed to fetch reports for builder widget', err, {
          component: 'CustomReportBuilder',
        });
        return [];
      }
    },
    enabled: !!tenantId,
    staleTime: 60_000,
    retry: 2,
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <div>
                <CardTitle>Custom Report Builder</CardTitle>
                <CardDescription>Build and run custom data reports</CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={() => setIsBuilderOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : reports && reports.length > 0 ? (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{report.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(report.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize shrink-0">
                    {report.report_type}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No reports yet. Create your first custom report.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ReportBuilder
        open={isBuilderOpen}
        onOpenChange={setIsBuilderOpen}
      />
    </>
  );
}
