import React from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Award from "lucide-react/dist/esm/icons/award";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Edit from "lucide-react/dist/esm/icons/edit";
import Eye from "lucide-react/dist/esm/icons/eye";
import Lock from "lucide-react/dist/esm/icons/lock";
import MoreHorizontal from "lucide-react/dist/esm/icons/more-horizontal";
import Trash from "lucide-react/dist/esm/icons/trash";
import CopyButton from "@/components/CopyButton";
import { formatSmartDate } from "@/lib/formatters";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  customer_type: string;
  total_spent: number;
  loyalty_points: number;
  loyalty_tier: string;
  last_purchase_at: string | null;
  status: string;
  medical_card_expiration: string | null;
  /** Indicates data is encrypted but cannot be decrypted with current key */
  _encryptedIndicator?: boolean;
}

interface CustomerRowProps {
  customer: Customer;
  isSelected: boolean;
  tenantSlug?: string;
  onSelectChange: (customerId: string, isChecked: boolean) => void;
  onDeleteClick: (customerId: string, customerName: string) => void;
}

const getCustomerStatus = (customer: Customer) => {
  if (!customer.last_purchase_at) return <Badge variant="outline">New</Badge>;

  const daysSince = Math.floor(
    (Date.now() - new Date(customer.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSince > 60) return <Badge variant="destructive">At Risk</Badge>;
  if (daysSince <= 7) return <Badge className="bg-green-600">Active</Badge>;
  return <Badge variant="secondary">Regular</Badge>;
};

const CustomerRow: React.FC<CustomerRowProps> = ({
  customer,
  isSelected,
  tenantSlug,
  onSelectChange,
  onDeleteClick,
}) => {
  const navigate = useNavigate();

  return (
    <tr className="hover:bg-muted/50 transition-colors">
      <td className="px-6 py-4">
        <input
          type="checkbox"
          className="rounded"
          checked={isSelected}
          onChange={(e) => onSelectChange(customer.id, e.target.checked)}
        />
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
            {customer.first_name?.[0]}{customer.last_name?.[0]}
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium">
              {customer.first_name} {customer.last_name}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              {customer._encryptedIndicator ? (
                <span className="flex items-center gap-1 text-amber-600" title="Contact info encrypted - sign in to view">
                  <Lock className="w-3 h-3" />
                  <span className="italic">Encrypted</span>
                </span>
              ) : (
                <>
                  {customer.email || customer.phone || 'No contact'}
                  {customer.email && (
                    <CopyButton text={customer.email} label="Email" showLabel={false} size="icon" variant="ghost" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <Badge variant={customer.customer_type === 'medical' ? 'default' : 'secondary'}>
          {customer.customer_type === 'medical' ? '🏥 Medical' : 'Recreational'}
        </Badge>
      </td>
      <td className="px-6 py-4 text-sm font-semibold">
        ${customer.total_spent?.toFixed(2) || '0.00'}
      </td>
      <td className="px-6 py-4 text-sm">
        <span className="flex items-center gap-1">
          <Award className="w-4 h-4 text-yellow-600" />
          {customer.loyalty_points || 0}
        </span>
      </td>
      <td className="px-6 py-4 text-sm text-muted-foreground">
        {customer.last_purchase_at
          ? formatSmartDate(customer.last_purchase_at)
          : 'Never'}
      </td>
      <td className="px-6 py-4">
        {getCustomerStatus(customer)}
      </td>
      <td className="px-6 py-4 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => tenantSlug && navigate(`/${tenantSlug}/admin/customers/${customer.id}`)}>
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => tenantSlug && navigate(`/${tenantSlug}/admin/customer-management/${customer.id}/edit`)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => tenantSlug && navigate(`/${tenantSlug}/admin/pos?customer=${customer.id}`)}>
              <DollarSign className="w-4 h-4 mr-2" />
              New Order
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => onDeleteClick(customer.id, `${customer.first_name} ${customer.last_name}`)}
            >
              <Trash className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
};

// Wrap with React.memo to prevent unnecessary re-renders
export default React.memo(CustomerRow);
