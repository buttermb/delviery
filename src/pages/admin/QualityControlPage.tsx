import { logger } from '@/lib/logger';
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Search from "lucide-react/dist/esm/icons/search";
import Upload from "lucide-react/dist/esm/icons/upload";
import FileText from "lucide-react/dist/esm/icons/file-text";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Clock from "lucide-react/dist/esm/icons/clock";
import Package from "lucide-react/dist/esm/icons/package";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Shield from "lucide-react/dist/esm/icons/shield";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COAUpload } from "@/components/admin/quality/COAUpload";
import { TestResultsViewer } from "@/components/admin/quality/TestResultsViewer";
import { QuarantineManager } from "@/components/admin/quality/QuarantineManager";
import { queryKeys } from "@/lib/queryKeys";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";

interface Batch {
  id: string;
  batch_number: string;
  product_id: string;
  product?: { name: string };
  test_results?: any;
  lab_name?: string;
  test_date?: string;
  coa_url?: string;
  coa_qr_code_url?: string;
  compliance_status?: string;
  status?: string;
  expiration_date?: string;
}

const COMPLIANCE_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  verified: "bg-green-500",
  failed: "bg-red-500",
};

export default function QualityControlPage() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [isCOAUploadOpen, setIsCOAUploadOpen] = useState(false);
  const [isTestViewerOpen, setIsTestViewerOpen] = useState(false);
  const [isQuarantineOpen, setIsQuarantineOpen] = useState(false);

  const { data: batches, isLoading } = useQuery({
    queryKey: queryKeys.batches.list(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      try {
        const { data, error } = await supabase
          .from("inventory_batches" as any)
          .select(`
            *,
            product:products(name, image_url)
          `)
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false });

        if (error) {
          logger.error('Failed to fetch batches', error, { component: 'QualityControlPage' });
          return [];
        }

        return (data || []) as any as Batch[];
      } catch {
        return [];
      }
    },
    enabled: !!tenant?.id,
  });

  const filteredBatches = batches?.filter((batch) => {
    const matchesSearch =
      batch.batch_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.lab_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "quarantined" && batch.status === "quarantined") ||
      (statusFilter === "failed" && batch.compliance_status === "failed") ||
      (statusFilter === "verified" && batch.compliance_status === "verified") ||
      (statusFilter === "pending" && batch.compliance_status === "pending");

    return matchesSearch && matchesStatus;
  }) || [];

  const handleUploadCOA = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsCOAUploadOpen(true);
  };

  const handleViewTests = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsTestViewerOpen(true);
  };

  const handleQuarantine = (batch: Batch) => {
    setSelectedBatch(batch);
    setIsQuarantineOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            🧪 Quality Control & Lab Testing
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage COAs, track test results, and ensure compliance
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by batch number, product, or lab..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 min-h-[44px] touch-manipulation"
              />
            </div>
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-[200px] min-h-[44px] touch-manipulation">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              <SelectItem value="pending">Pending Verification</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="failed">Failed Tests</SelectItem>
              <SelectItem value="quarantined">Quarantined</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle>Batches & Test Results ({filteredBatches.length})</CardTitle>
          <CardDescription>
            Track lab tests, COAs, and compliance status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredBatches.length === 0 ? (
            <EnhancedEmptyState
              icon={Shield}
              title="No Batches Found"
              description="Create batches in the Batches & Lots page to track quality control."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Number</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Lab</TableHead>
                    <TableHead>Test Date</TableHead>
                    <TableHead>Compliance Status</TableHead>
                    <TableHead>COA</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {batch.batch_number}
                        </div>
                      </TableCell>
                      <TableCell>{batch.product?.name || "-"}</TableCell>
                      <TableCell>{batch.lab_name || "-"}</TableCell>
                      <TableCell>
                        {batch.test_date
                          ? new Date(batch.test_date).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${COMPLIANCE_COLORS[batch.compliance_status || "pending"]
                            } text-white border-0`}
                        >
                          {(batch.compliance_status || "pending")
                            .charAt(0)
                            .toUpperCase() +
                            (batch.compliance_status || "pending").slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {batch.coa_url ? (
                          <Badge variant="outline" className="bg-green-500 text-white">
                            <FileText className="h-3 w-3 mr-1" />
                            Available
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not Uploaded</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewTests(batch)}
                            className="h-8 w-8 p-0"
                            title="View Test Results"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUploadCOA(batch)}
                            className="h-8 w-8 p-0"
                            title="Upload COA"
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          {batch.compliance_status === "failed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuarantine(batch)}
                              className="h-8 w-8 p-0 text-destructive"
                              title="Quarantine"
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* COA Upload Dialog */}
      {selectedBatch && (
        <COAUpload
          open={isCOAUploadOpen}
          onOpenChange={setIsCOAUploadOpen}
          batch={selectedBatch}
          onSuccess={() => {
            setIsCOAUploadOpen(false);
            setSelectedBatch(null);
          }}
        />
      )}

      {/* Test Results Viewer Dialog */}
      {selectedBatch && (
        <TestResultsViewer
          open={isTestViewerOpen}
          onOpenChange={setIsTestViewerOpen}
          batch={selectedBatch}
        />
      )}

      {/* Quarantine Manager Dialog */}
      {selectedBatch && (
        <QuarantineManager
          open={isQuarantineOpen}
          onOpenChange={setIsQuarantineOpen}
          batch={selectedBatch}
          onSuccess={() => {
            setIsQuarantineOpen(false);
            setSelectedBatch(null);
          }}
        />
      )}
    </div>
  );
}

