import { logger } from '@/lib/logger';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Edit,
  X,
  Calendar,
} from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import type { Database } from "@/integrations/supabase/types";
import { formatSmartDate } from '@/lib/formatters';

type Supplier = Database['public']['Tables']['wholesale_suppliers']['Row'];
type SupplierTransaction = Database['public']['Tables']['supplier_transactions']['Row'];

interface SupplierDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
  onEdit: () => void;
}

export function SupplierDetail({ open, onOpenChange, supplier, onEdit }: SupplierDetailProps) {
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: queryKeys.suppliers.transactions(supplier.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_transactions")
        .select('id, transaction_type, description, reference_number, amount, created_at')
        .eq("supplier_id", supplier.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        logger.error('Failed to fetch supplier transactions', error, { component: 'SupplierDetail' });
        return [];
      }

      return (data ?? []) as SupplierTransaction[];
    },
    enabled: open && !!supplier.id,
  });

  const totalTransactions = transactions?.length ?? 0;
  const totalAmount = transactions?.reduce((sum, t) => sum + Number(t.amount || 0), 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {supplier.supplier_name}
            </DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {supplier.contact_person && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Contact Person:</span>
                  <span>{supplier.contact_person}</span>
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{supplier.email}</span>
                </div>
              )}
              {supplier.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{supplier.phone}</span>
                </div>
              )}
              {supplier.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                  <span className="flex-1">{supplier.address}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Terms */}
          {supplier.payment_terms && (
            <Card>
              <CardHeader>
                <CardTitle>Payment Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" className="text-lg">
                  {supplier.payment_terms}
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* Transaction Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction Summary</CardTitle>
              <CardDescription>
                Recent activity and financial overview
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Transactions</div>
                  <div className="text-2xl font-bold">{totalTransactions}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Amount</div>
                  <div className="text-2xl font-bold">
                    ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {transactionsLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading transactions...
                </div>
              ) : transactions && transactions.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium mb-2">Recent Transactions</div>
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{transaction.transaction_type}</div>
                        {transaction.description && (
                          <div className="text-sm text-muted-foreground">
                            {transaction.description}
                          </div>
                        )}
                        {transaction.reference_number && (
                          <div className="text-xs text-muted-foreground">
                            Ref: {transaction.reference_number}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          ${Number(transaction.amount || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        {transaction.created_at && (
                          <div className="text-xs text-muted-foreground">
                            {formatSmartDate(transaction.created_at)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No transactions found
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span>
                  {supplier.created_at
                    ? formatSmartDate(supplier.created_at)
                    : "N/A"}
                </span>
              </div>
              {supplier.updated_at && supplier.updated_at !== supplier.created_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span>{formatSmartDate(supplier.updated_at)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

