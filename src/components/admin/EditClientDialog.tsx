import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback, useRef } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFormInput, sanitizeEmail, sanitizePhoneInput, sanitizeTextareaInput } from "@/lib/utils/sanitize";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useDirtyFormGuard } from "@/hooks/useDirtyFormGuard";
import { Loader2 } from "lucide-react";
import { FieldHelp, fieldHelpTexts } from "@/components/ui/field-help";

interface EditClientDialogProps {
  clientId: string;
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

export function EditClientDialog({ clientId, open, onOpenChange, onSuccess }: EditClientDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<ClientFormData>({
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    address: "",
    client_type: "sub_dealer",
    credit_limit: "50000",
    payment_terms: "7",
    notes: ""
  });

  const initialFormDataRef = useRef<string>('');

  const fetchClient = useCallback(async () => {
    try {
      setFetching(true);
      setFormErrors({});
      const { data, error } = await supabase
        .from("wholesale_clients")
        .select('business_name, contact_name, email, phone, address, client_type, credit_limit, payment_terms, notes')
        .eq("id", clientId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const newFormData: ClientFormData = {
          business_name: data.business_name || "",
          contact_name: data.contact_name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          client_type: (data.client_type as ClientFormData['client_type']) || "sub_dealer",
          credit_limit: String(data.credit_limit || 50000),
          payment_terms: String(data.payment_terms || 7),
          notes: data.notes || ""
        };
        setFormData(newFormData);
        initialFormDataRef.current = JSON.stringify(newFormData);
      }
    } catch (error) {
      logger.error("Error fetching client:", error);
      showErrorToast("Failed to load client data");
    } finally {
      setFetching(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (open && clientId) {
      fetchClient();
    }
  }, [open, clientId, fetchClient]);

  const isDirty = !fetching && JSON.stringify(formData) !== initialFormDataRef.current;

  const { guardedOnOpenChange, dialogContentProps, DiscardAlert } = useDirtyFormGuard(
    isDirty,
    () => onOpenChange(false)
  );

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

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from("wholesale_clients")
        .update({
          business_name: sanitizeFormInput(formData.business_name, 200),
          contact_name: sanitizeFormInput(formData.contact_name, 200),
          email: formData.email ? sanitizeEmail(formData.email) : formData.email,
          phone: sanitizePhoneInput(formData.phone),
          address: formData.address ? sanitizeFormInput(formData.address, 500) : formData.address,
          client_type: formData.client_type,
          credit_limit: parseFloat(formData.credit_limit),
          payment_terms: parseInt(formData.payment_terms),
          notes: formData.notes ? sanitizeTextareaInput(formData.notes, 1000) : formData.notes,
          updated_at: new Date().toISOString()
        })
        .eq("id", clientId);

      if (error) throw error;

      showSuccessToast("Client Updated", `${formData.business_name} updated successfully`);
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleClients.all });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      logger.error("Error updating client:", error);
      showErrorToast("Failed to update client");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" {...dialogContentProps}>
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
        </DialogHeader>
        
        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="business_name">Business Name <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
                <Input
                  id="business_name"
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
                <Label htmlFor="credit_limit" className="flex items-center gap-1.5">
                  Credit Limit ($)
                  <FieldHelp tooltip={fieldHelpTexts.creditLimit.tooltip} example={fieldHelpTexts.creditLimit.example} />
                </Label>
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
                <Label htmlFor="payment_terms" className="flex items-center gap-1.5">
                  Payment Terms (days)
                  <FieldHelp tooltip={fieldHelpTexts.paymentTerms.tooltip} example={fieldHelpTexts.paymentTerms.example} />
                </Label>
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
    <DiscardAlert />
    </>
  );
}
