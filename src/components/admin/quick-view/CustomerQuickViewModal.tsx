/**
 * CustomerQuickViewModal - Quick view dialog for customer details
 * Shows key customer information: contact, spending, loyalty, and status
 */

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Mail,
  Phone,
  Award,
  DollarSign,
  Calendar,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { getStatusColor } from '@/lib/utils/statusColors';
import { cn } from '@/lib/utils';
import { QuickViewModal } from './QuickViewModal';

interface CustomerQuickViewData {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  customer_type?: string | null;
  total_spent?: number;
  loyalty_points?: number;
  loyalty_tier?: string;
  last_purchase_at?: string | null;
  status?: string;
  medical_card_expiration?: string | null;
}

interface CustomerQuickViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerQuickViewData | null;
  onViewFullDetails?: () => void;
}

export function CustomerQuickViewModal({
  open,
  onOpenChange,
  customer,
  onViewFullDetails,
}: CustomerQuickViewModalProps) {
  if (!customer) return null;

  const fullName = `${customer.first_name} ${customer.last_name}`.trim();
  const initials = `${customer.first_name?.[0] || ''}${customer.last_name?.[0] || ''}`.toUpperCase();

  const isMedicalExpired = customer.medical_card_expiration
    ? new Date(customer.medical_card_expiration) < new Date()
    : false;

  return (
    <QuickViewModal
      open={open}
      onOpenChange={onOpenChange}
      title={fullName}
      description={customer.customer_type || undefined}
      onViewFullDetails={onViewFullDetails}
    >
      {/* Header with Avatar and Status */}
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
          <AvatarFallback className="text-sm font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold truncate">{fullName}</h4>
          <div className="flex items-center gap-2 mt-1">
            {customer.status && (
              <Badge
                variant="outline"
                className={cn('text-xs', getStatusColor(customer.status))}
              >
                {customer.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </Badge>
            )}
            {customer.customer_type && (
              <Badge variant="secondary" className="text-xs">
                {customer.customer_type}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Contact Info */}
      <div className="space-y-2">
        {customer.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate text-muted-foreground">{customer.email}</span>
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">{customer.phone}</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Financial & Loyalty Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <p className="text-sm font-semibold text-success">
              {formatCurrency(customer.total_spent || 0)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Loyalty Points</p>
            <p className="text-sm font-semibold">
              {customer.loyalty_points?.toLocaleString() || '0'}
            </p>
          </div>
        </div>
      </div>

      {/* Loyalty Tier */}
      {customer.loyalty_tier && (
        <div className="flex items-center gap-2 text-sm">
          <Award className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">Tier:</span>
          <Badge variant="outline" className="text-xs">
            {customer.loyalty_tier}
          </Badge>
        </div>
      )}

      {/* Last Purchase */}
      {customer.last_purchase_at && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span>Last purchase: {formatSmartDate(customer.last_purchase_at)}</span>
        </div>
      )}

      {/* Medical Card */}
      {customer.medical_card_expiration && (
        <div className={cn(
          'flex items-center gap-2 text-sm',
          isMedicalExpired ? 'text-destructive' : 'text-muted-foreground'
        )}>
          {isMedicalExpired ? (
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
          )}
          <span>
            Medical card {isMedicalExpired ? 'expired' : 'expires'}:{' '}
            {formatSmartDate(customer.medical_card_expiration)}
          </span>
        </div>
      )}
    </QuickViewModal>
  );
}
