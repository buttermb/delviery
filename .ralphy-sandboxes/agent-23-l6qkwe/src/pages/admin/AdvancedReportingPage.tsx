import { logger } from '@/lib/logger';
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Plus,
  Calendar,
  FileText,
  LayoutDashboard,
} from "lucide-react";
import { ReportBuilder } from "@/components/admin/reporting/ReportBuilder";
import { ReportList } from "@/components/admin/reporting/ReportList";
import { ScheduledReports } from "@/components/admin/reporting/ScheduledReports";
import { ReportTemplates } from "@/components/admin/reporting/ReportTemplates";
import { queryKeys } from "@/lib/queryKeys";

interface CustomReport {
  id: string;
  name: string;
  description: string;
  report_type: string;
  filters: Record<string, unknown>;
  created_at: string;
}

export default function AdvancedReportingPage() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("builder");
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const { data: reports, isLoading } = useQuery({
    queryKey: queryKeys.reporting.custom(),
    queryFn: async () => {
      if (!tenant?.id) return [];

      try {
        const { data, error } = await supabase
          .from("custom_reports")
          .select('id, name, description, report_type, filters, created_at')
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false });

        if (error && error.code !== "42P01") {
          logger.error('Failed to fetch reports', error, { component: 'AdvancedReportingPage' });
          return [];
        }

        return (data ?? []) as CustomReport[];
      } catch {
        return [];
      }
    },
    enabled: !!tenant?.id,
  });

  return (
    <div className="space-y-4 sm:space-y-4 p-2 sm:p-4 md:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Advanced Reporting & BI
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Build custom reports, schedule automated deliveries, and create visual dashboards
          </p>
        </div>
        <Button
          className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation"
          onClick={() => setIsBuilderOpen(true)}
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="text-sm sm:text-base">New Report</span>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="builder" className="min-h-[44px] touch-manipulation">
            <BarChart3 className="h-4 w-4 mr-2" />
            Builder
          </TabsTrigger>
          <TabsTrigger value="reports" className="min-h-[44px] touch-manipulation">
            <FileText className="h-4 w-4 mr-2" />
            My Reports
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="min-h-[44px] touch-manipulation">
            <Calendar className="h-4 w-4 mr-2" />
            Scheduled
          </TabsTrigger>
          <TabsTrigger value="templates" className="min-h-[44px] touch-manipulation">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-4">
          <ReportBuilder
            open={isBuilderOpen}
            onOpenChange={setIsBuilderOpen}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.reporting.custom() });
              setIsBuilderOpen(false);
            }}
          />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <ReportList
            reports={reports ?? []}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <ScheduledReports />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <ReportTemplates />
        </TabsContent>
      </Tabs>
    </div>
  );
}

