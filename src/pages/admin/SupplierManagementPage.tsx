import { logger } from '@/lib/logger';
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Building2,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  TrendingUp,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SupplierForm } from "@/components/admin/suppliers/SupplierForm";
import { SupplierDetail } from "@/components/admin/suppliers/SupplierDetail";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";
import type { Database } from "@/integrations/supabase/types";

type Supplier = Database['public']['Tables']['wholesale_suppliers']['Row'];

export default function SupplierManagementPage() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const { data: suppliers, isLoading } = useQuery({
    queryKey: queryKeys.suppliers.list({ filter }),
    queryFn: async () => {
      const query = supabase
        .from("wholesale_suppliers")
        .select("*")
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      
      if (error) {
        logger.error('Failed to fetch suppliers', error, { component: 'SupplierManagementPage' });
        throw error;
      }

      return (data || []) as Supplier[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("wholesale_suppliers")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() });
      toast.success("Supplier deleted successfully");
    },
    onError: (error: unknown) => {
      logger.error('Failed to delete supplier', error, { component: 'SupplierManagementPage' });
      toast.error("Failed to delete supplier");
    },
  });

  const filteredSuppliers = suppliers?.filter((supplier) => {
    const matchesSearch =
      supplier.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.phone?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  }) || [];

  const handleCreate = () => {
    setEditingSupplier(null);
    setIsFormOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleView = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsDetailOpen(true);
  };

  const handleDelete = async (supplier: Supplier) => {
    if (confirm(`Are you sure you want to delete ${supplier.supplier_name}?`)) {
      await deleteMutation.mutateAsync(supplier.id);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            🏭 Supplier Management
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage suppliers, track performance, and monitor transactions
          </p>
        </div>
        <Button
          className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation"
          onClick={handleCreate}
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="text-sm sm:text-base">New Supplier</span>
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 min-h-[44px] touch-manipulation"
              />
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className="min-h-[44px] touch-manipulation"
            >
              All
            </Button>
            <Button
              variant={filter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("active")}
              className="min-h-[44px] touch-manipulation"
            >
              Active
            </Button>
            <Button
              variant={filter === "inactive" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("inactive")}
              className="min-h-[44px] touch-manipulation"
            >
              Inactive
            </Button>
          </div>
        </div>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Suppliers ({filteredSuppliers.length})</CardTitle>
          <CardDescription>
            View and manage your supplier relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No suppliers found. Create your first supplier to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="cursor-pointer" onClick={() => handleView(supplier)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {supplier.supplier_name}
                        </div>
                      </TableCell>
                      <TableCell>{supplier.contact_person || "-"}</TableCell>
                      <TableCell>
                        {supplier.email ? (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {supplier.email}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {supplier.phone}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.payment_terms ? (
                          <Badge variant="outline">{supplier.payment_terms}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(supplier)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(supplier)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Supplier Form Dialog */}
      <SupplierForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        supplier={editingSupplier}
        onSuccess={() => {
          setIsFormOpen(false);
          setEditingSupplier(null);
        }}
      />

      {/* Supplier Detail Dialog */}
      {selectedSupplier && (
        <SupplierDetail
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          supplier={selectedSupplier}
          onEdit={() => {
            setIsDetailOpen(false);
            handleEdit(selectedSupplier);
          }}
        />
      )}
    </div>
  );
}

