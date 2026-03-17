import { MoreVertical } from 'lucide-react';

import type { Driver } from '@/pages/drivers/DriverDirectoryPage';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { DriverRowActionsMenu } from '@/components/drivers/DriverRowActionsMenu';

interface DriverTableRowProps {
  driver: Driver;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  tenantId: string;
  onViewProfile?: (id: string) => void;
  onEditDetails?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'rgba(16,185,129,0.2)', text: '#10B981', label: 'Active' },
  pending: { bg: 'rgba(245,158,11,0.2)', text: '#F59E0B', label: 'Pending' },
  inactive: { bg: 'rgba(100,116,139,0.2)', text: '#94A3B8', label: 'Inactive' },
  suspended: { bg: 'rgba(239,68,68,0.2)', text: '#EF4444', label: 'Suspended' },
  terminated: { bg: 'rgba(239,68,68,0.2)', text: '#EF4444', label: 'Terminated' },
};

const AVAILABILITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  online: { bg: 'rgba(34,197,94,0.2)', text: '#22C55E', label: 'Online' },
  offline: { bg: 'rgba(100,116,139,0.2)', text: '#94A3B8', label: 'Offline' },
  on_delivery: { bg: 'rgba(245,158,11,0.2)', text: '#F59E0B', label: 'On Delivery' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.inactive;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

function AvailabilityBadge({ availability }: { availability: string }) {
  const a = AVAILABILITY_STYLES[availability] ?? AVAILABILITY_STYLES.offline;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: a.bg, color: a.text }}
    >
      {a.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function vehicleLabel(driver: Driver): string {
  if (driver.vehicle_make && driver.vehicle_model) {
    return `${driver.vehicle_make} ${driver.vehicle_model}`;
  }
  return driver.vehicle_type ?? '—';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DriverTableRow({ driver, isSelected, onSelect, tenantId, onViewProfile, onEditDetails }: DriverTableRowProps) {
  const isOnline = driver.availability === 'online';

  return (
    <TableRow
      className={`border-border transition-colors ${
        isSelected
          ? 'bg-emerald-500/5'
          : 'hover:bg-accent'
      }`}
      style={isOnline ? { borderLeft: '2px solid #22C55E' } : undefined}
    >
      {/* Checkbox */}
      <TableCell className="w-[40px] bg-transparent">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(driver.id, !!checked)}
          className="border-muted-foreground data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
        />
      </TableCell>

      {/* Name + email */}
      <TableCell className="bg-transparent">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-semibold text-muted-foreground">
            {getInitials(driver.full_name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              {driver.display_name || driver.full_name}
            </div>
            <div className="truncate text-xs text-muted-foreground">{driver.email}</div>
          </div>
        </div>
      </TableCell>

      {/* Phone */}
      <TableCell className="bg-transparent font-['JetBrains_Mono'] text-xs text-muted-foreground">
        {formatPhone(driver.phone)}
      </TableCell>

      {/* Vehicle */}
      <TableCell className="bg-transparent text-sm text-muted-foreground">
        {vehicleLabel(driver)}
      </TableCell>

      {/* Zone */}
      <TableCell className="bg-transparent text-sm text-muted-foreground">
        {driver.zone_name ?? '—'}
      </TableCell>

      {/* Status */}
      <TableCell className="bg-transparent">
        <StatusBadge status={driver.status} />
      </TableCell>

      {/* Availability */}
      <TableCell className="bg-transparent">
        <AvailabilityBadge availability={driver.availability} />
      </TableCell>

      {/* Rating */}
      <TableCell className="bg-transparent text-xs text-muted-foreground">
        —
      </TableCell>

      {/* Deliveries */}
      <TableCell className="bg-transparent font-['Space_Grotesk'] text-sm text-foreground">
        —
      </TableCell>

      {/* Commission */}
      <TableCell className="bg-transparent font-['JetBrains_Mono'] text-xs text-muted-foreground">
        {driver.commission_rate != null ? `${driver.commission_rate}%` : '—'}
      </TableCell>

      {/* Last Active */}
      <TableCell className="bg-transparent text-xs text-muted-foreground">
        {formatRelativeTime(driver.last_seen_at)}
      </TableCell>

      {/* Actions menu */}
      <TableCell className="w-[40px] bg-transparent">
        <DriverRowActionsMenu driver={driver} tenantId={tenantId} onViewProfile={onViewProfile} onEditDetails={onEditDetails}>
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <MoreVertical className="h-4 w-4" />
          </button>
        </DriverRowActionsMenu>
      </TableCell>
    </TableRow>
  );
}
