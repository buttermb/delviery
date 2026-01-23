import { logger } from '@/lib/logger';
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { sanitizeFormInput, sanitizeEmail, sanitizePhoneInput, sanitizeTextareaInput } from "@/lib/utils/sanitize";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import type { Database } from "@/integrations/supabase/types";

type Supplier = Database['public']['Tables']['wholesale_suppliers']['Row'];
type SupplierInsert = Database['public']['Tables']['wholesale_suppliers']['Insert'];
type SupplierUpdate = Database['public']['Tables']['wholesale_suppliers']['Update'];

interface SupplierFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
  onSuccess?: () => void;
}

export function SupplierForm({ open, onOpenChange, supplier, onSuccess }: SupplierFormProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    supplier_name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    payment_terms: "",
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        supplier_name: supplier.supplier_name || "",
        contact_person: supplier.contact_person || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
        address: supplier.address || "",
        payment_terms: supplier.payment_terms || "",
      });
    } else {
      setFormData({
        supplier_name: "",
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        payment_terms: "",
      });
    }
  }, [supplier, open]);

  const createMutation = useMutation({
    mutationFn: async (data: SupplierInsert) => {
      const { error } = await supabase
        .from("wholesale_suppliers")
        .insert([data]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() });
      toast.success("Supplier created successfully");
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to create supplier', error, { component: 'SupplierForm' });
      toast.error("Failed to create supplier");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SupplierUpdate) => {
      if (!supplier?.id) throw new Error("Supplier ID is required");

      const { error } = await supabase
        .from("wholesale_suppliers")
        .update(data)
        .eq("id", supplier.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.detail(supplier!.id) });
      toast.success("Supplier updated successfully");
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to update supplier', error, { component: 'SupplierForm' });
      toast.error("Failed to update supplier");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplier_name.trim()) {
      toast.error("Supplier name is required");
      return;
    }

    const isEditing = !!supplier;

    const sanitizedData = {
      supplier_name: sanitizeFormInput(formData.supplier_name, 200),
      contact_person: formData.contact_person ? sanitizeFormInput(formData.contact_person, 200) : null,
      email: formData.email ? sanitizeEmail(formData.email) : null,
      phone: formData.phone ? sanitizePhoneInput(formData.phone) : null,
      address: formData.address ? sanitizeTextareaInput(formData.address, 500) : null,
      payment_terms: formData.payment_terms ? sanitizeFormInput(formData.payment_terms, 200) : null,
    };

    if (isEditing) {
      const updateData: SupplierUpdate = {
        ...sanitizedData,
        updated_at: new Date().toISOString(),
      };

      await updateMutation.mutateAsync(updateData);
    } else {
      const insertData: SupplierInsert = sanitizedData;

      await createMutation.mutateAsync(insertData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {supplier ? "Edit Supplier" : "Create New Supplier"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_name">
                Supplier Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="supplier_name"
                value={formData.supplier_name}
                onChange={(e) =>
                  setFormData({ ...formData, supplier_name: e.target.value })
                }
                placeholder="Enter supplier name"
                required
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) =>
                  setFormData({ ...formData, contact_person: e.target.value })
                }
                placeholder="Enter contact person name"
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="supplier@example.com"
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="(555) 123-4567"
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Enter full address"
                rows={2}
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Input
                id="payment_terms"
                value={formData.payment_terms}
                onChange={(e) =>
                  setFormData({ ...formData, payment_terms: e.target.value })
                }
                placeholder="e.g., Net 30, Net 60, COD"
                className="min-h-[44px] touch-manipulation"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="min-h-[44px] touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="min-h-[44px] touch-manipulation"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {supplier ? "Update Supplier" : "Create Supplier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

