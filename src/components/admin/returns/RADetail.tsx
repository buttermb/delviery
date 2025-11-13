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
  RotateCcw,
  Package,
  Calendar,
  DollarSign,
  Edit,
  X,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface ReturnAuthorization {
  id: string;
  ra_number: string;
  order_id: string;
  order_number?: string;
  customer_id?: string;
  customer_name?: string;
  status: string;
  reason: string;
  return_method: string;
  total_amount: number;
  refund_amount?: number;
  restocking_fee?: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  received_at?: string;
  processed_at?: string;
}

interface RADetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnAuth: ReturnAuthorization;
  onEdit: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  received: "bg-blue-500",
  processed: "bg-purple-500",
  refunded: "bg-green-500",
  exchanged: "bg-emerald-500",
  cancelled: "bg-red-500",
};

export function RADetail({ open, onOpenChange, returnAuth, onEdit }: RADetailProps) {
  const canEdit = returnAuth.status === "pending";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              {returnAuth.ra_number}
            </DialogTitle>
            <div className="flex gap-2">
              {canEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Return Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge
                    variant="outline"
                    className={`${STATUS_COLORS[returnAuth.status]} text-white border-0 mt-1`}
                  >
                    {returnAuth.status.charAt(0).toUpperCase() + returnAuth.status.slice(1)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Order Number</div>
                  <div className="mt-1">{returnAuth.order_number || returnAuth.order_id.substring(0, 8)}</div>
                </div>
                {returnAuth.customer_name && (
                  <div>
                    <div className="text-sm text-muted-foreground">Customer</div>
                    <div className="mt-1">{returnAuth.customer_name}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-muted-foreground">Reason</div>
                  <div className="mt-1">{returnAuth.reason}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Return Method</div>
                  <div className="mt-1">{returnAuth.return_method}</div>
                </div>
              </div>

              {returnAuth.notes && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Notes</div>
                  <div className="p-3 bg-muted rounded-lg">{returnAuth.notes}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-medium">
                    ${Number(returnAuth.total_amount || 0).toFixed(2)}
                  </span>
                </div>
                {returnAuth.restocking_fee && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Restocking Fee:</span>
                    <span className="font-medium">
                      ${Number(returnAuth.restocking_fee).toFixed(2)}
                    </span>
                  </div>
                )}
                {returnAuth.refund_amount !== undefined && (
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Refund Amount:</span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {Number(returnAuth.refund_amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span>
                  {returnAuth.created_at
                    ? new Date(returnAuth.created_at).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
              {returnAuth.received_at && (
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  <span className="text-muted-foreground">Received:</span>
                  <span>{new Date(returnAuth.received_at).toLocaleDateString()}</span>
                </div>
              )}
              {returnAuth.processed_at && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-muted-foreground">Processed:</span>
                  <span>{new Date(returnAuth.processed_at).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

