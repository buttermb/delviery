import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFormInput, sanitizeEmail, sanitizePhoneInput, sanitizeTextareaInput } from "@/lib/utils/sanitize";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";
import { Loader2 } from "lucide-react";
import { FieldHelp, fieldHelpTexts } from "@/components/ui/field-help";

interface EditClientDialogProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ClientFormData {
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  client_type: string;
  credit_limit: string;
  payment_terms: string;
  notes: string;
}

export function EditClientDialog({ clientId, open, onOpenChange, onSuccess }: EditClientDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
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

  const fetchClient = useCallback(async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from("wholesale_clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFormData({
          business_name: data.business_name || "",
          contact_name: data.contact_name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          client_type: data.client_type || "sub_dealer",
          credit_limit: String(data.credit_limit || 50000),
          payment_terms: String(data.payment_terms || 7),
          notes: data.notes || ""
        });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.business_name || !formData.contact_name || !formData.phone) {
      showErrorToast("Please fill in all required fields");
      return;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showErrorToast("Invalid email address");
      return;
    }

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="e.g., Mike Johnson"
                  required
                />
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
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="mike@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, Bronx, NY"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_type">Client Type</Label>
                <Select
                  value={formData.client_type}
                  onValueChange={(value) => setFormData({ ...formData, client_type: value })}
                >
                  <SelectTrigger id="client_type">
                    <SelectValue />
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
                  step="1000"
                  value={formData.credit_limit}
                  onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                  placeholder="50000"
                />
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
                    <SelectValue />
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
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
