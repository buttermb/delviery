import { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, Search, FileText, Package, AlertTriangle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateOnEvent } from '@/lib/invalidation';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatPhoneNumber, formatCurrency } from '@/lib/formatters';

export interface ConvertToInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    total_amount: number;
    created_at: string;
    order_data?: {
      items?: Array<{
        name?: string;
        product_name?: string;
        quantity?: number;
        price?: number;
        unit_price?: number;
      }>;
      subtotal?: number;
      tax?: number;
    };
    client_id?: string | null;
    converted_to_invoice_id?: string | null;
  };
  onSuccess?: () => void;
}

export function ConvertToInvoiceDialog({ 
  open, 
  onOpenChange, 
  order,
  onSuccess 
}: ConvertToInvoiceDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string>(order.client_id ?? '');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  // Fetch wholesale clients for selection
  const { data: clients, isLoading: clientsLoading, isError: clientsError, refetch: refetchClients } = useQuery({
    queryKey: queryKeys.wholesaleClients.list({ filter: 'all' }),
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from('wholesale_clients')
        .select('id, business_name, contact_name, email, phone')
        .eq('tenant_id', tenant.id)
        .order('business_name', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!tenant?.id,
  });

  // Filter clients by search query
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientSearchQuery.trim()) return clients;

    const query = clientSearchQuery.toLowerCase();
    return clients.filter(client =>
      client.business_name?.toLowerCase().includes(query) ||
      client.contact_name?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.phone?.includes(query)
    );
  }, [clients, clientSearchQuery]);

  // Calculate order totals
  const orderItems = useMemo(() => {
    const items = order.order_data?.items ?? [];
    return items.map((item) => ({
      product_name: item.name || item.product_name || 'Unknown Product',
      quantity: Number(item.quantity || 1),
      price: Number(item.price || item.unit_price || 0),
      total: Number(item.quantity || 1) * Number(item.price || item.unit_price || 0),
    }));
  }, [order.order_data]);

  const subtotal = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.total, 0);
  }, [orderItems]);

  const tax = useMemo(() => {
    return Number(order.order_data?.tax || 0);
  }, [order.order_data]);

  const total = useMemo(() => {
    return subtotal + tax;
  }, [subtotal, tax]);

  const selectedClient = useMemo(() => {
    return clients?.find(c => c.id === selectedClientId);
  }, [clients, selectedClientId]);

  const handleConvert = useCallback(async () => {
    if (!selectedClientId) {
      showErrorToast('Please select a client');
      return;
    }

    if (order.converted_to_invoice_id) {
      showErrorToast('This order has already been converted to an invoice');
      return;
    }

    try {
      setIsConverting(true);

      const { data, error } = await supabase.functions.invoke('convert-menu-order-to-invoice', {
        body: {
          menu_order_id: order.id,
          client_id: selectedClientId,
        },
      });

      if (error) {
        logger.error('Failed to convert order to invoice', error, { 
          component: 'ConvertToInvoiceDialog',
          orderId: order.id,
          clientId: selectedClientId,
        });
        showErrorToast(error.message || 'Failed to convert order to invoice');
        return;
      }

      if (!data || !data.success) {
        logger.error('Conversion failed', { data }, { 
          component: 'ConvertToInvoiceDialog',
          orderId: order.id,
        });
        showErrorToast(data?.error || 'Failed to convert order to invoice');
        return;
      }

      showSuccessToast(
        'Order Converted',
        `Invoice ${data.invoice_number} created successfully`
      );

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: queryKeys.menuOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.all() });

      // Cross-panel invalidation — finance hub, dashboard, collections
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'INVOICE_CREATED', tenant.id, {
          invoiceId: data.invoice_id,
          customerId: selectedClientId,
        });
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      logger.error('Error converting order to invoice', error, { 
        component: 'ConvertToInvoiceDialog',
        orderId: order.id,
      });
      showErrorToast('An unexpected error occurred');
    } finally {
      setIsConverting(false);
    }
  }, [selectedClientId, order, queryClient, onSuccess, onOpenChange, tenant?.id]);

  // Check if already converted
  if (order.converted_to_invoice_id) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Already Converted</DialogTitle>
            <DialogDescription>
              This order has already been converted to an invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Convert Order to Invoice</DialogTitle>
          <DialogDescription>
            Create an invoice from this order with locked prices
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleConvert(); }}>
        <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Order Summary
              </h3>
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order Date:</span>
                  <span>{format(new Date(order.created_at), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order Total:</span>
                  <span className="font-semibold">{formatCurrency(order.total_amount ?? 0)}</span>
                </div>
              </div>

              {/* Order Items */}
              {orderItems.length > 0 && (
                <div className="space-y-2">
                  <Label>Order Items</Label>
                  <div className="border rounded-lg divide-y">
                    {orderItems.map((item, idx) => (
                      <div key={idx} className="p-3 flex justify-between items-center">
                        <div className="flex-1">
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.quantity} × ${item.price.toFixed(2)}
                          </div>
                        </div>
                        <div className="font-semibold">
                          ${item.total.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end space-x-4 pt-2">
                    <div className="text-sm">
                      <div className="flex justify-between gap-4">
                        <span>Subtotal:</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      {tax > 0 && (
                        <div className="flex justify-between gap-4">
                          <span>Tax:</span>
                          <span>${tax.toFixed(2)}</span>
                        </div>
                      )}
                      <Separator className="my-2" />
                      <div className="flex justify-between gap-4 font-semibold">
                        <span>Total:</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Client Selection */}
            <div className="space-y-3">
              <Label htmlFor="client-select">Select Client <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>

              {/* Client Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="client-search"
                  placeholder="Search clients by name, email, or phone..."
                  aria-label="Search clients"
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Client Select Dropdown */}
              {clientsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : clientsError ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <p className="text-sm text-destructive">Failed to load clients</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => refetchClients()}>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Retry
                  </Button>
                </div>
              ) : (
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredClients.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No clients found
                      </div>
                    ) : (
                      filteredClients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{client.business_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {client.contact_name} • {formatPhoneNumber(client.phone)}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}

              {/* Selected Client Info */}
              {selectedClient && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{selectedClient.business_name}</span>
                    <Badge variant="outline">Selected</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Contact: {selectedClient.contact_name}</div>
                    {selectedClient.email && <div>Email: {selectedClient.email}</div>}
                    <div>Phone: {formatPhoneNumber(selectedClient.phone)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isConverting}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!selectedClientId || isConverting}
          >
            {isConverting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Convert to Invoice
              </>
            )}
          </Button>
        </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

