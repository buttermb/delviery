import React from 'react';

import Eye from "lucide-react/dist/esm/icons/eye";
import MoreHorizontal from "lucide-react/dist/esm/icons/more-horizontal";
import Printer from "lucide-react/dist/esm/icons/printer";
import FileText from "lucide-react/dist/esm/icons/file-text";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Building2 from "lucide-react/dist/esm/icons/building-2";

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CopyButton from '@/components/CopyButton';
import { CustomerLink } from '@/components/admin/cross-links';
import { formatSmartDate } from '@/lib/utils/formatDate';

interface OrderRowProps {
  order: {
    id: string;
    order_number: string;
    created_at: string;
    status: string;
    total_amount: number;
    delivery_method?: string;
    order_source?: string;
    user_id?: string;
    customer_id?: string;
    user?: {
      full_name: string | null;
      email: string | null;
      phone: string | null;
      avatar_url?: string | null;
    };
  };
  isSelected: boolean;
  isNew?: boolean;
  onSelect: (checked: boolean) => void;
  onStatusChange: (newStatus: string) => void;
  onView: () => void;
  onPrint: () => void;
  onGenerateInvoice: () => void;
  onCloneToB2B: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

const OrderSourceBadge = ({ source }: { source?: string }) => (
  <Badge variant="outline" className="text-xs">
    {source || 'admin'}
  </Badge>
);

const getStatusBadge = (status: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    confirmed: 'default',
    preparing: 'default',
    ready: 'default',
    in_transit: 'default',
    delivered: 'outline',
    cancelled: 'destructive',
  };
  return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
};

export const OrderRow = React.memo<OrderRowProps>(({
  order,
  isSelected,
  isNew = false,
  onSelect,
  onStatusChange,
  onView,
  onPrint,
  onGenerateInvoice,
  onCloneToB2B,
  onCancel,
  onDelete,
}) => {
  return (
    <tr className={`group hover:bg-muted/50 transition-colors ${isNew ? 'animate-new-order-highlight bg-primary/5 border-l-4 border-l-primary' : ''}`}>
      {/* Checkbox */}
      <td className="w-[50px] px-4 py-3">
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
          />
        </div>
      </td>

      {/* Order Number */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={isNew ? 'font-bold text-primary' : ''}>
            {order.order_number || order.id.slice(0, 8)}
          </span>
          <CopyButton
            text={order.order_number || order.id}
            label="Order Number"
            showLabel={false}
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </td>

      {/* Source */}
      <td className="px-4 py-3 w-[120px]">
        <OrderSourceBadge source={order.order_source} />
      </td>

      {/* Customer */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <CustomerLink
            customerId={order.customer_id || order.user_id}
            customerName={order.user?.full_name || order.user?.email || order.user?.phone || ''}
            customerEmail={order.user?.email}
            customerAvatar={order.user?.avatar_url}
            className="font-medium"
          />
          {order.user?.email && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {order.user.email}
              <CopyButton
                text={order.user.email}
                label="Email"
                showLabel={false}
                className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          )}
          {!order.user?.email && order.user?.phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {order.user.phone}
              <CopyButton
                text={order.user.phone}
                label="Phone"
                showLabel={false}
                className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <div onClick={(e) => e.stopPropagation()}>
          <Select value={order.status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-8 w-[130px] border-none bg-transparent hover:bg-muted/50 focus:ring-0 p-0">
              <SelectValue>{getStatusBadge(order.status)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="preparing">Preparing</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </td>

      {/* Method */}
      <td className="px-4 py-3 capitalize">
        {order.delivery_method || 'N/A'}
      </td>

      {/* Total */}
      <td className="px-4 py-3">
        <span className="font-mono font-medium">
          ${order.total_amount?.toFixed(2)}
        </span>
      </td>

      {/* Date */}
      <td className="px-4 py-3">
        <span className="text-muted-foreground">
          {formatSmartDate(order.created_at)}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onView}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print Order
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onGenerateInvoice}>
                <FileText className="mr-2 h-4 w-4" />
                Generate Invoice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCloneToB2B}>
                <Building2 className="mr-2 h-4 w-4" />
                Clone to B2B
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {order.status !== 'cancelled' && (
                <DropdownMenuItem
                  onClick={onCancel}
                  className="text-destructive focus:text-destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Order
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
});

OrderRow.displayName = 'OrderRow';
