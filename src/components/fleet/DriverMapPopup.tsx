import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PopupDriver {
  id: string;
  full_name: string;
  status: 'online' | 'delivering' | 'idle' | 'offline';
  phone?: string;
  vehicle_type?: string;
  current_order_number?: string | null;
  current_delivery_address?: string | null;
  eta_minutes?: number | null;
  last_updated?: string;
}

interface DriverMapPopupProps {
  driver: PopupDriver;
  onClose: () => void;
  onTrackOrder?: (orderId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<PopupDriver['status'], { label: string; color: string }> = {
  online: { label: 'Online', color: '#10B981' },
  delivering: { label: 'On Delivery', color: '#F59E0B' },
  idle: { label: 'Idle', color: '#94A3B8' },
  offline: { label: 'Offline', color: '#64748B' },
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DriverMapPopup({ driver, onClose, onTrackOrder }: DriverMapPopupProps) {
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();
  const slug = tenant?.slug ?? tenant?.id ?? '';
  const statusInfo = STATUS_LABELS[driver.status];

  return (
    <div className="w-[260px] rounded-lg border border-border bg-card text-foreground shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: statusInfo.color }}
          />
          <span className="truncate text-sm font-medium">{driver.full_name}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Status</span>
          <span style={{ color: statusInfo.color }} className="font-medium">
            {statusInfo.label}
          </span>
        </div>

        {driver.vehicle_type && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Vehicle</span>
            <span className="text-muted-foreground">{driver.vehicle_type}</span>
          </div>
        )}

        {driver.last_updated && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Last ping</span>
            <span className="text-muted-foreground">{formatRelativeTime(driver.last_updated)}</span>
          </div>
        )}

        {/* Active delivery */}
        {driver.status === 'delivering' && driver.current_order_number && (
          <div className="mt-1 rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-amber-500">
                #{driver.current_order_number}
              </span>
              {driver.eta_minutes != null && (
                <span className="text-muted-foreground">ETA {driver.eta_minutes}m</span>
              )}
            </div>
            {driver.current_delivery_address && (
              <p className="mt-1 text-[11px] leading-tight text-muted-foreground truncate">
                {driver.current_delivery_address}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-border px-3 py-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (slug) navigate(`/${slug}/admin/drivers/${driver.id}`);
          }}
          className="h-7 flex-1 border-border bg-transparent text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          View Profile
        </Button>
        {driver.status === 'delivering' && onTrackOrder && (
          <Button
            size="sm"
            onClick={() => onTrackOrder(driver.id)}
            className="h-7 flex-1 bg-emerald-500 text-xs text-white hover:bg-emerald-600"
          >
            Track Order
          </Button>
        )}
      </div>
    </div>
  );
}
