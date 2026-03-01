import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { sanitizeFormInput, sanitizeEmail, sanitizePhoneInput, sanitizeTextareaInput } from "@/lib/utils/sanitize";
import { humanizeError } from "@/lib/humanizeError";
import type { Database } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { logActivityAuto, ActivityActions } from "@/lib/activityLogger";
import { logger } from "@/lib/logger";

type Supplier = Database['public']['Tables']['wholesale_suppliers']['Row'];
type SupplierInsert = Database['public']['Tables']['wholesale_suppliers']['Insert'];
type SupplierUpdate = Database['public']['Tables']['wholesale_suppliers']['Update'];

const supplierSchema = z.object({
  supplier_name: z.string().min(1, "Supplier name is required").max(200),
  contact_person: z.string().max(200).optional().or(z.literal("")),
  email: z.string().email("Invalid email address").max(255).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  payment_terms: z.string().max(200).optional().or(z.literal("")),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

interface SupplierFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
  onSuccess?: () => void;
}

export function SupplierForm({ open, onOpenChange, supplier, onSuccess }: SupplierFormProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      supplier_name: "",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      payment_terms: "",
    },
  });

  useEffect(() => {
    if (supplier) {
      form.reset({
        supplier_name: supplier.supplier_name || "",
        contact_person: supplier.contact_person || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
        address: supplier.address || "",
        payment_terms: supplier.payment_terms || "",
      });
    } else {
      form.reset({
        supplier_name: "",
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        payment_terms: "",
      });
    }
  }, [supplier, open, form]);

  const createMutation = useMutation({
    mutationFn: async (data: SupplierInsert) => {
      const { data: newSupplier, error } = await supabase
        .from("wholesale_suppliers")
        .insert([data])
        .select()
        .maybeSingle();

      if (error) throw error;
      return newSupplier;
    },
    onSuccess: (newSupplier) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() });
      toast.success("Supplier created successfully");

      if (tenant?.id) {
        logActivityAuto(
          tenant.id,
          ActivityActions.CREATE_SUPPLIER,
          'supplier',
          newSupplier.id,
          {
            supplier_name: newSupplier.supplier_name,
            contact_person: newSupplier.contact_person,
            email: newSupplier.email,
          }
        );
      }

      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to create supplier', error, { component: 'SupplierForm' });
      toast.error("Failed to create supplier", { description: humanizeError(error) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SupplierUpdate) => {
      if (!supplier?.id) throw new Error("Supplier ID is required");

      const { data: updatedSupplier, error } = await supabase
        .from("wholesale_suppliers")
        .update(data)
        .eq("id", supplier.id)
        .select()
        .maybeSingle();

      if (error) throw error;
      return updatedSupplier;
    },
    onSuccess: (updatedSupplier) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.detail(supplier!.id) });
      toast.success("Supplier updated successfully");

      if (tenant?.id) {
        logActivityAuto(
          tenant.id,
          ActivityActions.UPDATE_SUPPLIER,
          'supplier',
          supplier!.id,
          {
            supplier_name: updatedSupplier.supplier_name,
            changes: {
              previous_name: supplier!.supplier_name,
              new_name: updatedSupplier.supplier_name,
            },
          }
        );
      }

      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to update supplier', error, { component: 'SupplierForm' });
      toast.error("Failed to update supplier", { description: humanizeError(error) });
    },
  });

  const onSubmit = async (values: SupplierFormValues) => {
    const sanitizedData = {
      supplier_name: sanitizeFormInput(values.supplier_name, 200),
      contact_person: values.contact_person ? sanitizeFormInput(values.contact_person, 200) : null,
      email: values.email ? sanitizeEmail(values.email) : null,
      phone: values.phone ? sanitizePhoneInput(values.phone) : null,
      address: values.address ? sanitizeTextareaInput(values.address, 500) : null,
      payment_terms: values.payment_terms ? sanitizeFormInput(values.payment_terms, 200) : null,
    };

    if (supplier) {
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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supplier_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Supplier Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter supplier name"
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_person"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter contact person name"
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="supplier@example.com"
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder="(555) 123-4567"
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter full address"
                        rows={2}
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_terms"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Payment Terms</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Net 30, Net 60, COD"
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
