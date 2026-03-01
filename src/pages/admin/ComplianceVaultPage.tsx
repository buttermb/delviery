import { logger } from '@/lib/logger';
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Plus,
  AlertCircle,
} from "lucide-react";
import { DocumentList } from "@/components/admin/compliance/DocumentList";
import { DocumentUpload } from "@/components/admin/compliance/DocumentUpload";
import { DocumentDetail } from "@/components/admin/compliance/DocumentDetail";
import { queryKeys } from "@/lib/queryKeys";

interface ComplianceDocument {
  id: string;
  name: string;
  document_type: string;
  file_url?: string;
  expiration_date: string | null;
  status: "active" | "expired" | "expiring_soon";
  created_at: string;
}

export default function ComplianceVaultPage() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ComplianceDocument | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: queryKeys.compliance.documents(),
    queryFn: async () => {
      if (!tenant?.id) return [];

      try {
        const { data, error } = await supabase
          .from("compliance_documents")
          .select('id, name, document_type, file_url, expiration_date, status, created_at')
          .eq("tenant_id", tenant.id)
          .order("expiration_date", { ascending: true });

        if (error && error.code !== "42P01") {
          logger.error('Failed to fetch documents', error, { component: 'ComplianceVaultPage' });
          return [];
        }

        return (data ?? []) as ComplianceDocument[];
      } catch {
        return [];
      }
    },
    enabled: !!tenant?.id,
  });

  const filteredDocuments = documents?.filter((doc) => {
    if (activeTab === "all") return true;
    if (activeTab === "expiring") return doc.status === "expiring_soon" || doc.status === "expired";
    return doc.document_type === activeTab;
  }) ?? [];

  return (
    <div className="space-y-4 sm:space-y-4 p-2 sm:p-4 md:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground">
            Compliance Document Vault
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage compliance documents, track expiration dates, and maintain audit trails
          </p>
        </div>
        <Button
          className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation"
          onClick={() => setIsUploadOpen(true)}
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="text-sm sm:text-base">Upload Document</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {documents?.filter((d) => d.status === "expiring_soon").length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {documents?.filter((d) => d.status === "expired").length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {documents?.filter((d) => d.status === "active").length ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="all" className="min-h-[44px] touch-manipulation">
            All
          </TabsTrigger>
          <TabsTrigger value="license" className="min-h-[44px] touch-manipulation">
            Licenses
          </TabsTrigger>
          <TabsTrigger value="permit" className="min-h-[44px] touch-manipulation">
            Permits
          </TabsTrigger>
          <TabsTrigger value="certificate" className="min-h-[44px] touch-manipulation">
            Certificates
          </TabsTrigger>
          <TabsTrigger value="expiring" className="min-h-[44px] touch-manipulation">
            Expiring
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {selectedDocument ? (
            <DocumentDetail
              document={selectedDocument as unknown as Parameters<typeof DocumentDetail>[0]['document']}
              onBack={() => setSelectedDocument(null)}
              onUpdate={() => {
                queryClient.invalidateQueries({ queryKey: queryKeys.compliance.documents() });
                setSelectedDocument(null);
              }}
            />
          ) : (
            <DocumentList
              documents={filteredDocuments}
              isLoading={isLoading}
              onSelect={(doc) => setSelectedDocument(doc as unknown as ComplianceDocument)}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Document Upload Dialog */}
      {isUploadOpen && (
        <DocumentUpload
          open={isUploadOpen}
          onOpenChange={setIsUploadOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.compliance.documents() });
            setIsUploadOpen(false);
          }}
        />
      )}
    </div>
  );
}

