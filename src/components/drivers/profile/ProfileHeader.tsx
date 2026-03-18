import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Phone, MessageSquare, MapPin, MoreVertical, Copy } from 'lucide-react';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EditDriverDialog } from '@/components/drivers/profile/EditDriverDialog';

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

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'rgba(16,185,129,0.2)', text: '#10B981', label: 'Active' },
  pending: { bg: 'rgba(245,158,11,0.2)', text: '#F59E0B', label: 'Pending' },
  inactive: { bg: 'rgba(100,116,139,0.2)', text: '#94A3B8', label: 'Inactive' },
  suspended: { bg: 'rgba(239,68,68,0.2)', text: '#EF4444', label: 'Suspended' },
  terminated: { bg: 'rgba(239,68,68,0.2)', text: '#EF4444', label: 'Terminated' },
};

const AVAILABILITY_STYLES: Record<string, { dotColor: string; label: string }> = {
  online: { dotColor: '#22C55E', label: 'Online' },
  offline: { dotColor: '#64748B', label: 'Offline' },
  on_delivery: { dotColor: '#F59E0B', label: 'On Delivery' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProfileHeaderProps {
  driver: DriverProfile;
  tenantId: string;
}

export function ProfileHeader({ driver, tenantId }: ProfileHeaderProps) {
  const { token } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const isOnline = driver.availability === 'online';
  const initials = getInitials(driver.full_name);
  const statusStyle = STATUS_STYLES[driver.status] ?? STATUS_STYLES.inactive;
  const availStyle = AVAILABILITY_STYLES[driver.availability] ?? AVAILABILITY_STYLES.offline;

  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const memberSince = new Date(driver.created_at).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  const resetPin = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('reset-driver-pin', {
        body: { driver_id: driver.id, notify_email: true },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw res.error;
      if (!res.data) throw new Error('Invalid response from server');
      return res.data as { pin?: string };
    },
    onSuccess: (data) => {
      toast.success(data?.pin ? `PIN reset to ${data.pin}` : 'PIN reset successfully');
    },
    onError: (err) => { logger.error('Reset PIN failed', err); toast.error('Failed to reset PIN'); },
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('reset-driver-password', {
        body: { driver_id: driver.id, method: 'email' },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw res.error;
      if (!res.data) throw new Error('Invalid response from server');
    },
    onSuccess: () => toast.success('Password reset email sent'),
    onError: (err) => { logger.error('Reset password failed', err); toast.error('Failed to reset password'); },
  });

  const suspendDriver = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('suspend-driver', {
        body: { driver_id: driver.id, reason: 'Suspended by admin', notify_email: true },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw res.error;
      if (!res.data) throw new Error('Invalid response from server');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success('Driver suspended');
    },
    onError: (err) => { logger.error('Suspend failed', err); toast.error('Failed to suspend driver'); },
  });

  const terminateDriver = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('terminate-driver', {
        body: { driver_id: driver.id, reason: 'Terminated by admin' },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw res.error;
      if (!res.data) throw new Error('Invalid response from server');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success('Driver terminated');
    },
    onError: (err) => { logger.error('Terminate failed', err); toast.error('Failed to terminate driver'); },
  });

  const handleCopyLoginUrl = useCallback(async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/courier`);
    toast.success('Login URL copied');
  }, []);

  const handleMessage = useCallback(() => {
    if (driver.phone) {
      window.open(`sms:${driver.phone}`, '_self');
    } else {
      toast.info('No phone number available');
    }
  }, [driver.phone]);

  const handleTrack = useCallback(() => {
    if (driver.current_lat != null && driver.current_lng != null) {
      window.open(
        `https://www.google.com/maps?q=${driver.current_lat},${driver.current_lng}`,
        '_blank',
      );
    } else {
      toast.info('No location data available');
    }
  }, [driver.current_lat, driver.current_lng]);

  const resendInvite = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('add-driver', {
        body: { resend_invite: true, driver_id: driver.id },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw res.error;
      return res.data as { success: boolean; error?: string };
    },
    onSuccess: () => {
      toast.success('Invite email resent');
    },
    onError: (err) => {
      logger.error('Resend invite failed', err);
      toast.error('Failed to resend invite');
    },
  });

  return (
    <>
      <div className="mb-4 rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Avatar + Info */}
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background font-['Space_Grotesk'] text-xl font-bold text-muted-foreground">
                {initials}
              </div>
              {isOnline && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-card bg-green-500" />
                </span>
              )}
            </div>

            <div>
              {/* Name */}
              <h2 className="text-xl font-bold text-foreground">
                {driver.display_name || driver.full_name}
              </h2>

              {/* Badges row */}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                >
                  {statusStyle.label}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <span
                    className="inline-block h-[6px] w-[6px] rounded-full"
                    style={{ backgroundColor: availStyle.dotColor }}
                  />
                  {availStyle.label}
                </span>
                {driver.vehicle_type && (
                  <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    {driver.vehicle_type.charAt(0).toUpperCase() + driver.vehicle_type.slice(1)}
                  </span>
                )}
                {driver.zone_name && (
                  <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                    {driver.zone_name}
                  </span>
                )}
              </div>

              {/* Contact row */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <a href={`tel:${driver.phone}`} className="hover:text-muted-foreground">
                  {driver.phone}
                </a>
                <span className="text-border">/</span>
                <a href={`mailto:${driver.email}`} className="hover:text-muted-foreground">
                  {driver.email}
                </a>
                <span className="text-border">/</span>
                <span>Member since {memberSince}</span>
              </div>
            </div>
          </div>

          {/* Right: Action buttons */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <a href={`tel:${driver.phone}`}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Phone className="mr-1.5 h-3.5 w-3.5" />
                Call
              </Button>
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMessage}
              className="h-8 border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              Message
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTrack}
              className="h-8 border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              Track
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 border-border bg-transparent p-0 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px] border-border bg-card text-foreground">
                <DropdownMenuItem
                  className="text-sm focus:bg-accent focus:text-accent-foreground"
                  onClick={() => setEditDialogOpen(true)}
                >
                  Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-sm focus:bg-accent focus:text-accent-foreground"
                  onClick={() => resetPassword.mutate()}
                  disabled={resetPassword.isPending}
                >
                  Reset Password
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-sm focus:bg-accent focus:text-accent-foreground"
                  onClick={() => resetPin.mutate()}
                  disabled={resetPin.isPending}
                >
                  Reset PIN
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-sm focus:bg-accent focus:text-accent-foreground"
                  onClick={() => resendInvite.mutate()}
                  disabled={resendInvite.isPending || driver.status === 'active'}
                >
                  {resendInvite.isPending ? 'Sending\u2026' : 'Resend Invite'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-sm focus:bg-accent focus:text-accent-foreground"
                  onClick={handleCopyLoginUrl}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy Login URL
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-muted" />

                <DropdownMenuItem
                  className="text-sm text-amber-500 focus:bg-accent focus:text-amber-500"
                  onClick={() => suspendDriver.mutate()}
                  disabled={suspendDriver.isPending || driver.status === 'suspended'}
                >
                  Suspend Driver
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-sm text-destructive focus:bg-accent focus:text-destructive"
                  onClick={() => terminateDriver.mutate()}
                  disabled={terminateDriver.isPending || driver.status === 'terminated'}
                >
                  Terminate Driver
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <EditDriverDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        driver={driver}
        tenantId={tenantId}
      />
    </>
  );
}
