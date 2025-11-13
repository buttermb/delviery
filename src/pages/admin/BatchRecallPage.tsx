// @ts-nocheck - Batch recalls table types not yet regenerated
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  AlertTriangle,
  Plus,
  Loader2,
  FileText,
  Users,
} from "lucide-react";
import { RecallList } from "@/components/admin/recall/RecallList";
import { RecallForm } from "@/components/admin/recall/RecallForm";
import { RecallDetail } from "@/components/admin/recall/RecallDetail";
import { TraceabilityView } from "@/components/admin/recall/TraceabilityView";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";

interface Recall {
  id: string;
  batch_id: string;
  batch_number: string;
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "draft" | "active" | "resolved" | "closed";
  affected_customers_count: number;
  created_at: string;
}

export default function BatchRecallPage() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("recalls");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRecall, setSelectedRecall] = useState<Recall | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const { data: recalls, isLoading } = useQuery({
    queryKey: queryKeys.recall.all(),
    queryFn: async () => {
      if (!tenant?.id) return [];

      try {
        const { data, error } = await supabase
          .from("batch_recalls")
          .select("*")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false });

        if (error && error.code !== "42P01") {
          logger.error('Failed to fetch recalls', error, { component: 'BatchRecallPage' });
          return [];
        }

        return (data || []) as Recall[];
      } catch {
        return [];
      }
    },
    enabled: !!tenant?.id,
  });

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            ⚠️ Batch Recall & Traceability
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage product recalls, track affected customers, and generate regulatory reports
          </p>
        </div>
        <Button
          className="bg-red-500 hover:bg-red-600 min-h-[44px] touch-manipulation"
          onClick={() => {
            setSelectedRecall(null);
            setIsFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="text-sm sm:text-base">New Recall</span>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recalls" className="min-h-[44px] touch-manipulation">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Recalls
          </TabsTrigger>
          <TabsTrigger value="traceability" className="min-h-[44px] touch-manipulation">
            <Users className="h-4 w-4 mr-2" />
            Traceability
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recalls" className="space-y-4">
          {selectedRecall ? (
            <RecallDetail
              recall={selectedRecall}
              onBack={() => setSelectedRecall(null)}
              onUpdate={() => {
                queryClient.invalidateQueries({ queryKey: queryKeys.recall.all() });
                setSelectedRecall(null);
              }}
            />
          ) : (
            <RecallList
              recalls={recalls || []}
              isLoading={isLoading}
              onSelect={(recall) => setSelectedRecall(recall)}
            />
          )}
        </TabsContent>

        <TabsContent value="traceability" className="space-y-4">
          <TraceabilityView
            batchId={selectedBatchId}
            onBatchSelect={setSelectedBatchId}
          />
        </TabsContent>
      </Tabs>

      {/* Recall Form Dialog */}
      {isFormOpen && (
        <RecallForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          recall={selectedRecall}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.recall.all() });
            setIsFormOpen(false);
            setSelectedRecall(null);
          }}
        />
      )}
    </div>
  );
}

