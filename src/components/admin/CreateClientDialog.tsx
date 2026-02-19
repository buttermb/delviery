import { logger } from '@/lib/logger';
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

type WholesaleClientInsert = Database['public']['Tables']['wholesale_clients']['Insert'];

interface CreateClientDialogProps {
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

export function CreateClientDialog({ open, onOpenChange, onSuccess }: CreateClientDialogProps) {
  const { tenant, loading: tenantLoading } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const isContextReady = !tenantLoading && !!tenant?.id;
  const contextError = !tenantLoading && !tenant?.id
    ? 'Tenant context not available. Please refresh the page or contact support.'
    : null;
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

    if (!tenant?.id) {
      showErrorToast("Tenant information not available");
      return;
    }

    try {
      setLoading(true);
      
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
      setFormData({
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <Label htmlFor="credit_limit">Credit Limit ($)</Label>
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
              <Label htmlFor="payment_terms">Payment Terms (days)</Label>
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
            <Button type="submit" disabled={loading || !isContextReady || tenantLoading}>
              {(loading || tenantLoading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tenantLoading ? 'Loading...' : 'Create Client'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

