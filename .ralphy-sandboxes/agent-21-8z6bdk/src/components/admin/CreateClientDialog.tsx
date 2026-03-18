import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFormInput, sanitizeEmail, sanitizePhoneInput, sanitizeTextareaInput } from "@/lib/utils/sanitize";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";
import { Loader2, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { Database } from "@/integrations/supabase/types";
import { useDirtyFormGuard } from "@/hooks/useDirtyFormGuard";

type WholesaleClientInsert = Database['public']['Tables']['wholesale_clients']['Insert'];

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const clientFormSchema = z.object({
  business_name: z.string().min(1, 'Business name is required').max(200, 'Business name must be 200 characters or less'),
  contact_name: z.string().min(1, 'Contact name is required').max(200, 'Contact name must be 200 characters or less'),
  email: z.string().email('Invalid email address').max(254, 'Email must be 254 characters or less').optional().or(z.literal('')),
  phone: z.string()
    .regex(/^[\d\s\-+()]+$/, 'Invalid phone number')
    .min(7, 'Phone number must be at least 7 characters')
    .max(20, 'Phone number must be 20 characters or less'),
  address: z.string().max(500, 'Address must be 500 characters or less').optional().or(z.literal('')),
  client_type: z.enum(['sub_dealer', 'small_shop', 'network', 'supplier']),
  credit_limit: z.string().refine((val) => !val || !isNaN(parseFloat(val)), 'Credit limit must be a valid number'),
  payment_terms: z.string(),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional().or(z.literal('')),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

const defaultFormData: ClientFormData = {
  business_name: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  client_type: "sub_dealer",
  credit_limit: "50000",
  payment_terms: "7",
  notes: ""
};

export function CreateClientDialog({ open, onOpenChange, onSuccess }: CreateClientDialogProps) {
  const { tenant, loading: tenantLoading } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const isContextReady = !tenantLoading && !!tenant?.id;
  const contextError = !tenantLoading && !tenant?.id
    ? 'Tenant context not available. Please refresh the page or contact support.'
    : null;
  const [formData, setFormData] = useState<ClientFormData>(defaultFormData);

  // Reset form state when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData(defaultFormData);
      setFormErrors({});
    }
  }, [open]);

  // Dirty state: any field differs from default
  const isDirty = JSON.stringify(formData) !== JSON.stringify(defaultFormData);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const { guardedOnOpenChange, dialogContentProps, DiscardAlert } = useDirtyFormGuard(isDirty, handleClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = clientFormSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0];
        if (field && !fieldErrors[field as string]) {
          fieldErrors[field as string] = err.message;
        }
      });
      setFormErrors(fieldErrors);
      showErrorToast("Please fix the validation errors");
      return;
    }
    setFormErrors({});

    if (!tenant?.id) {
      showErrorToast("Tenant information not available");
      return;
    }

    try {
      setLoading(true);

      // Check for duplicate business name within tenant
      const { data: existingClient, error: dupCheckError } = await supabase
        .from("wholesale_clients")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("business_name", formData.business_name.trim())
        .maybeSingle();

      if (dupCheckError) {
        logger.error("Error checking duplicate client", dupCheckError, { component: 'CreateClientDialog' });
      }

      if (existingClient) {
        showErrorToast("A client with this business name already exists");
        setLoading(false);
        return;
      }

      const clientData: WholesaleClientInsert = {
        tenant_id: tenant.id,
        business_name: sanitizeFormInput(formData.business_name, 200),
        contact_name: sanitizeFormInput(formData.contact_name, 200),
        email: formData.email ? sanitizeEmail(formData.email) : null,
        phone: sanitizePhoneInput(formData.phone),
        address: formData.address ? sanitizeFormInput(formData.address, 500) : null,
        client_type: formData.client_type,
        credit_limit: parseFloat(formData.credit_limit) || 0,
        payment_terms: parseInt(formData.payment_terms) || 7,
        notes: formData.notes ? sanitizeTextareaInput(formData.notes, 1000) : null,
        status: "active",
        outstanding_balance: 0,
        monthly_volume: 0,
      };

      // Add tenant_id if column exists (will be handled by RLS in most cases)
      const { error } = await supabase
        .from("wholesale_clients")
        .insert([clientData]);

      if (error) throw error;

      showSuccessToast("Client Created", `${formData.business_name} created successfully`);
      
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleClients.lists() });
      
      // Reset form
      setFormData(defaultFormData);
      
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: unknown) {
      logger.error("Error creating client", error, { component: 'CreateClientDialog' });
      showErrorToast("Failed to create client", error instanceof Error ? error.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" {...dialogContentProps}>
        <DialogHeader>
          <DialogTitle>Create New Client</DialogTitle>
        </DialogHeader>

        {contextError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{contextError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
              <Input
                id="business_name"
                autoComplete="organization"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                placeholder="e.g., Big Mike's Shop"
                maxLength={200}
                required
              />
              {formErrors.business_name && <p className="text-sm text-destructive">{formErrors.business_name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
              <Input
                id="contact_name"
                autoComplete="name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="e.g., Mike Johnson"
                maxLength={200}
                required
              />
              {formErrors.contact_name && <p className="text-sm text-destructive">{formErrors.contact_name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
                maxLength={20}
                required
              />
              {formErrors.phone && <p className="text-sm text-destructive">{formErrors.phone}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="mike@example.com"
                maxLength={254}
              />
              {formErrors.email && <p className="text-sm text-destructive">{formErrors.email}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              autoComplete="street-address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Main St, Bronx, NY"
              maxLength={500}
            />
            {formErrors.address && <p className="text-sm text-destructive">{formErrors.address}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_type">Client Type</Label>
              <Select
                value={formData.client_type}
                onValueChange={(value: "sub_dealer" | "small_shop" | "network" | "supplier") => setFormData({ ...formData, client_type: value })}
              >
                <SelectTrigger id="client_type">
                  <SelectValue placeholder="Select client type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sub_dealer">Sub-Dealer</SelectItem>
                  <SelectItem value="small_shop">Small Shop</SelectItem>
                  <SelectItem value="network">Network/Crew</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="credit_limit">Credit Limit ($)</Label>
              <Input
                id="credit_limit"
                type="number"
                min="0"
                step="1000"
                value={formData.credit_limit}
                onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                placeholder="50000"
              />
              {formErrors.credit_limit && <p className="text-sm text-destructive">{formErrors.credit_limit}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_terms">Payment Terms (days)</Label>
              <Select
                value={formData.payment_terms}
                onValueChange={(value) => setFormData({ ...formData, payment_terms: value })}
              >
                <SelectTrigger id="payment_terms">
                  <SelectValue placeholder="Select payment terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Cash (0 days)</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this client..."
              rows={3}
              maxLength={1000}
            />
            {formErrors.notes && <p className="text-sm text-destructive">{formErrors.notes}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardedOnOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !isContextReady || tenantLoading}>
              {(loading || tenantLoading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tenantLoading ? 'Loading...' : 'Create Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <DiscardAlert />
    </>
  );
}

