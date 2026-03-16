import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { Driver } from '@/pages/drivers/DriverDirectoryPage';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusTogglePopover } from '@/components/drivers/StatusTogglePopover';

interface DriverRowActionsMenuProps {
  driver: Driver;
  tenantId: string;
  children: React.ReactNode;
}

export function DriverRowActionsMenu({ driver, tenantId, children }: DriverRowActionsMenuProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const { token } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const resetPin = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('reset-driver-pin', {
        body: { driver_id: driver.id, notify_email: true },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw res.error;
      return res.data as { pin?: string };
    },
    onSuccess: (data) => {
      if (data.pin) {
        toast.success(`PIN reset to ${data.pin}`);
      } else {
        toast.success('PIN reset successfully');
      }
    },
    onError: (error) => {
      logger.error('Reset PIN failed', error);
      toast.error('Failed to reset PIN');
    },
  });

  const suspendDriver = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('suspend-driver', {
        body: {
          driver_id: driver.id,
          reason: 'Suspended by admin',
          notify_email: true,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success('Driver suspended');
    },
    onError: (error) => {
      logger.error('Suspend driver failed', error);
      toast.error('Failed to suspend driver');
    },
  });

  const terminateDriver = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('terminate-driver', {
        body: {
          driver_id: driver.id,
          reason: 'Terminated by admin',
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success('Driver terminated');
    },
    onError: (error) => {
      logger.error('Terminate driver failed', error);
      toast.error('Failed to terminate driver');
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[200px] border-[#334155] bg-[#1E293B] text-[#F8FAFC]"
        >
          <DropdownMenuItem className="text-sm text-[#F8FAFC] focus:bg-[#263548] focus:text-[#F8FAFC]">
            View Profile
          </DropdownMenuItem>
          <DropdownMenuItem className="text-sm text-[#F8FAFC] focus:bg-[#263548] focus:text-[#F8FAFC]">
            Edit Details
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-sm text-[#F8FAFC] focus:bg-[#263548] focus:text-[#F8FAFC]"
            onClick={() => setStatusOpen(true)}
          >
            Change Status
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-[#334155]" />

          <DropdownMenuItem
            className="text-sm text-[#F8FAFC] focus:bg-[#263548] focus:text-[#F8FAFC]"
            onClick={() => resetPin.mutate()}
            disabled={resetPin.isPending}
          >
            Reset PIN
          </DropdownMenuItem>
          <DropdownMenuItem className="text-sm text-[#F8FAFC] focus:bg-[#263548] focus:text-[#F8FAFC]">
            Resend Invite
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-[#334155]" />

          <DropdownMenuItem
            className="text-sm text-[#F59E0B] focus:bg-[#263548] focus:text-[#F59E0B]"
            onClick={() => suspendDriver.mutate()}
            disabled={suspendDriver.isPending || driver.status === 'suspended'}
          >
            Suspend Driver
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-sm text-[#EF4444] focus:bg-[#263548] focus:text-[#EF4444]"
            onClick={() => terminateDriver.mutate()}
            disabled={terminateDriver.isPending || driver.status === 'terminated'}
          >
            Terminate Driver
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <StatusTogglePopover
        open={statusOpen}
        onOpenChange={setStatusOpen}
        driver={driver}
        tenantId={tenantId}
      />
    </>
  );
}
