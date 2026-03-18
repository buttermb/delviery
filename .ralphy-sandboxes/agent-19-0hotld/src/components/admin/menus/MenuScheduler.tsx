import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Repeat from 'lucide-react/dist/esm/icons/repeat';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Check from 'lucide-react/dist/esm/icons/check';
import X from 'lucide-react/dist/esm/icons/x';
import Edit2 from 'lucide-react/dist/esm/icons/edit-2';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

// Types
interface MenuSchedule {
  id: string;
  menuId: string;
  menuName: string;
  tenantId: string;
  startTime: string;
  endTime: string | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  isActive: boolean;
  createdAt: string;
}

interface MenuWithProducts {
  id: string;
  name: string;
  productIds: string[];
}

interface ScheduleConflict {
  schedule1: MenuSchedule;
  schedule2: MenuSchedule;
  overlappingProductIds: string[];
  overlappingProductNames: string[];
}

interface MenuSchedulerProps {
  menuId?: string;
  className?: string;
}

// Constants
const DAYS_OF_WEEK = [
  { value: 'SU', label: 'Sun' },
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
];

const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'UTC', label: 'UTC' },
];

// Helper functions
const formatDateTimeLocal = (isoString: string | null): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 16);
  } catch {
    return '';
  }
};

const parseRecurrenceRule = (rule: string | null): { days: string[]; frequency: string } => {
  if (!rule) return { days: [], frequency: 'weekly' };

  const daysMatch = rule.match(/BYDAY=([A-Z,]+)/);
  const freqMatch = rule.match(/FREQ=(\w+)/);

  return {
    days: daysMatch ? daysMatch[1].split(',') : [],
    frequency: freqMatch ? freqMatch[1].toLowerCase() : 'weekly',
  };
};

const buildRecurrenceRule = (days: string[], frequency: string): string => {
  if (days.length === 0) return `FREQ=${frequency.toUpperCase()}`;
  return `FREQ=${frequency.toUpperCase()};BYDAY=${days.join(',')}`;
};

// Hook to fetch all schedules for a tenant
const useMenuSchedules = (tenantId?: string) => {
  return useQuery({
    queryKey: [...queryKeys.menus.all, 'schedules', tenantId],
    queryFn: async (): Promise<MenuSchedule[]> => {
      if (!tenantId) return [];

      // Use typed query to fetch from menu_schedules
      const { data, error } = await supabase
        .from('menu_schedules')
        .select(`
          id,
          menu_id,
          tenant_id,
          start_time,
          end_time,
          is_recurring,
          recurrence_rule,
          is_active,
          created_at,
          disposable_menus!inner(name)
        `)
        .eq('tenant_id', tenantId)
        .order('start_time', { ascending: true });

      if (error) {
        logger.warn('Failed to fetch menu schedules', { error: error.message, tenantId });
        return [];
      }

      return (data ?? []).map((schedule: Record<string, unknown>) => ({
        id: schedule.id as string,
        menuId: schedule.menu_id as string,
        menuName: (schedule.disposable_menus as Record<string, unknown> | null)?.name as string || 'Unknown Menu',
        tenantId: schedule.tenant_id as string,
        startTime: schedule.start_time as string,
        endTime: schedule.end_time as string | null,
        isRecurring: schedule.is_recurring as boolean,
        recurrenceRule: schedule.recurrence_rule as string | null,
        isActive: schedule.is_active as boolean,
        createdAt: schedule.created_at as string,
      }));
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  });
};

// Hook to fetch menus with their products for conflict detection
const useMenusWithProducts = (tenantId?: string) => {
  return useQuery({
    queryKey: [...queryKeys.menus.all, 'with-products', tenantId],
    queryFn: async (): Promise<MenuWithProducts[]> => {
      if (!tenantId) return [];

      const { data: menus, error: menusError } = await supabase
        .from('disposable_menus')
        .select('id, name')
        .eq('tenant_id', tenantId);

      if (menusError) {
        logger.warn('Failed to fetch menus', { error: menusError.message });
        return [];
      }

      // Fetch menu products for each menu
      const results: MenuWithProducts[] = [];
      for (const menu of menus ?? []) {
        const { data: menuProducts } = await supabase
          .from('menu_products')
          .select('product_id')
          .eq('menu_id', menu.id);

        results.push({
          id: menu.id,
          name: menu.name,
          productIds: (menuProducts ?? []).map((mp) => mp.product_id as string),
        });
      }

      return results;
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });
};

// Hook to create a new schedule
const useCreateSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduleData: {
      menuId: string;
      tenantId: string;
      startTime: string;
      endTime: string | null;
      isRecurring: boolean;
      recurrenceRule: string | null;
    }) => {
      const { data, error } = await supabase
        .from('menu_schedules')
        .insert({
          menu_id: scheduleData.menuId,
          tenant_id: scheduleData.tenantId,
          start_time: scheduleData.startTime,
          end_time: scheduleData.endTime,
          is_recurring: scheduleData.isRecurring,
          recurrence_rule: scheduleData.recurrenceRule,
          is_active: true,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.menus.all, 'schedules', variables.tenantId] });
      showSuccessToast('Schedule Created', 'Menu schedule has been created successfully');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create schedule', { error, message });
      showErrorToast('Failed to Create Schedule', message);
    },
  });
};

// Hook to update a schedule
const useUpdateSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduleData: {
      id: string;
      tenantId: string;
      startTime?: string;
      endTime?: string | null;
      isRecurring?: boolean;
      recurrenceRule?: string | null;
      isActive?: boolean;
    }) => {
      const updateData: Record<string, unknown> = {};
      if (scheduleData.startTime !== undefined) updateData.start_time = scheduleData.startTime;
      if (scheduleData.endTime !== undefined) updateData.end_time = scheduleData.endTime;
      if (scheduleData.isRecurring !== undefined) updateData.is_recurring = scheduleData.isRecurring;
      if (scheduleData.recurrenceRule !== undefined) updateData.recurrence_rule = scheduleData.recurrenceRule;
      if (scheduleData.isActive !== undefined) updateData.is_active = scheduleData.isActive;

      const { data, error } = await supabase
        .from('menu_schedules')
        .update(updateData)
        .eq('id', scheduleData.id)
        .eq('tenant_id', scheduleData.tenantId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.menus.all, 'schedules', variables.tenantId] });
      showSuccessToast('Schedule Updated', 'Menu schedule has been updated successfully');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update schedule', { error, message });
      showErrorToast('Failed to Update Schedule', message);
    },
  });
};

// Hook to delete a schedule
const useDeleteSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tenantId }: { id: string; tenantId: string }) => {
      const { error } = await supabase
        .from('menu_schedules')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.menus.all, 'schedules', variables.tenantId] });
      showSuccessToast('Schedule Deleted', 'Menu schedule has been deleted');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete schedule', { error, message });
      showErrorToast('Failed to Delete Schedule', message);
    },
  });
};

// Schedule Form Component
interface ScheduleFormProps {
  menuId?: string;
  schedule?: MenuSchedule;
  menus: MenuWithProducts[];
  tenantId: string;
  onSave: (data: {
    menuId: string;
    startTime: string;
    endTime: string | null;
    isRecurring: boolean;
    recurrenceRule: string | null;
  }) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function ScheduleForm({ menuId, schedule, menus, tenantId: _tenantId, onSave, onCancel, isSaving }: ScheduleFormProps) {
  const [selectedMenuId, setSelectedMenuId] = useState(schedule?.menuId ?? menuId ?? '');
  const [startTime, setStartTime] = useState(schedule?.startTime ? formatDateTimeLocal(schedule.startTime) : '');
  const [endTime, setEndTime] = useState(schedule?.endTime ? formatDateTimeLocal(schedule.endTime) : '');
  const [isRecurring, setIsRecurring] = useState(schedule?.isRecurring ?? false);
  const [selectedDays, setSelectedDays] = useState<string[]>(
    schedule?.recurrenceRule ? parseRecurrenceRule(schedule.recurrenceRule).days : []
  );
  const [timezone, setTimezone] = useState('America/New_York');

  const handleSubmit = () => {
    if (!selectedMenuId || !startTime) {
      showErrorToast('Validation Error', 'Please select a menu and start time');
      return;
    }

    const startDate = new Date(startTime);
    const endDate = endTime ? new Date(endTime) : null;

    if (endDate && endDate <= startDate) {
      showErrorToast('Validation Error', 'End time must be after start time');
      return;
    }

    onSave({
      menuId: selectedMenuId,
      startTime: startDate.toISOString(),
      endTime: endDate?.toISOString() || null,
      isRecurring,
      recurrenceRule: isRecurring ? buildRecurrenceRule(selectedDays, 'weekly') : null,
    });
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="space-y-6">
      {/* Menu Selection (if not provided) */}
      {!menuId && (
        <div className="space-y-2">
          <Label>Select Menu</Label>
          <Select value={selectedMenuId} onValueChange={setSelectedMenuId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a menu to schedule" />
            </SelectTrigger>
            <SelectContent>
              {menus.map((menu) => (
                <SelectItem key={menu.id} value={menu.id}>
                  {menu.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Timezone */}
      <div className="space-y-2">
        <Label>Timezone</Label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger>
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {COMMON_TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Start Time */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-green-600" />
          Start Time
        </Label>
        <Input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
      </div>

      {/* End Time */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-red-600" />
          End Time (Optional)
        </Label>
        <Input
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Leave empty for indefinite activation
        </p>
      </div>

      <Separator />

      {/* Recurring Schedule */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-blue-600" />
            <Label>Recurring Schedule</Label>
          </div>
          <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
        </div>

        {isRecurring && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <Label className="text-sm">Active on days:</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <Button
                  key={day.value}
                  type="button"
                  variant={selectedDays.includes(day.value) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleDay(day.value)}
                  className="w-12"
                >
                  {day.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Example: Select Fri, Sat, Sun for weekend-only menus
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {schedule ? 'Update Schedule' : 'Create Schedule'}
        </Button>
      </div>
    </div>
  );
}

// Calendar Day Component
interface CalendarDayProps {
  date: Date;
  schedules: MenuSchedule[];
  isCurrentMonth: boolean;
  isToday: boolean;
  onClick: () => void;
}

function CalendarDay({ date, schedules, isCurrentMonth, isToday, onClick }: CalendarDayProps) {
  const activeSchedules = schedules.filter((schedule) => {
    const start = parseISO(schedule.startTime);
    const end = schedule.endTime ? parseISO(schedule.endTime) : null;

    if (isBefore(date, startOfDay(start))) return false;
    if (end && isAfter(date, endOfDay(end))) return false;

    return true;
  });

  return (
    <button
      onClick={onClick}
      className={cn(
        'h-24 p-1 border-r border-b text-left hover:bg-muted/50 transition-colors relative',
        !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
        isToday && 'bg-primary/5 ring-1 ring-primary/30'
      )}
    >
      <span className={cn(
        'text-sm font-medium',
        isToday && 'text-primary'
      )}>
        {format(date, 'd')}
      </span>
      <div className="mt-1 space-y-0.5 overflow-hidden">
        {activeSchedules.slice(0, 3).map((schedule) => (
          <div
            key={schedule.id}
            className={cn(
              'text-[10px] px-1 py-0.5 rounded truncate',
              schedule.isActive
                ? 'bg-green-500/20 text-green-700'
                : 'bg-gray-500/20 text-gray-600 dark:bg-gray-500/30 dark:text-gray-400'
            )}
          >
            {schedule.menuName}
          </div>
        ))}
        {activeSchedules.length > 3 && (
          <div className="text-[10px] text-muted-foreground px-1">
            +{activeSchedules.length - 3} more
          </div>
        )}
      </div>
    </button>
  );
}

// Conflict Detection Component
interface ConflictsPanelProps {
  conflicts: ScheduleConflict[];
}

function ConflictsPanel({ conflicts }: ConflictsPanelProps) {
  if (conflicts.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 p-4 bg-green-50 rounded-lg">
        <Check className="h-4 w-4" />
        <span>No scheduling conflicts detected</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-amber-600">
        <AlertTriangle className="h-5 w-5" />
        <span className="font-semibold">
          {conflicts.length} Scheduling Conflict{conflicts.length > 1 ? 's' : ''} Detected
        </span>
      </div>

      {conflicts.map((conflict) => (
        <Alert key={`${conflict.schedule1.id}-${conflict.schedule2.id}`} variant="destructive" className="border-amber-500/50 bg-amber-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-amber-800">
            Overlapping Products
          </AlertTitle>
          <AlertDescription className="text-amber-700">
            <p className="mb-2">
              <strong>{conflict.schedule1.menuName}</strong> and{' '}
              <strong>{conflict.schedule2.menuName}</strong> share{' '}
              {conflict.overlappingProductIds.length} product(s) during overlapping time periods.
            </p>
            <div className="flex flex-wrap gap-1">
              {conflict.overlappingProductNames.slice(0, 5).map((name) => (
                <Badge key={name} variant="outline" className="text-xs">
                  {name}
                </Badge>
              ))}
              {conflict.overlappingProductNames.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{conflict.overlappingProductNames.length - 5} more
                </Badge>
              )}
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

// Main Component
export function MenuScheduler({ menuId, className }: MenuSchedulerProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<MenuSchedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<MenuSchedule | null>(null);

  // Data fetching
  const { data: schedules = [], isLoading: schedulesLoading } = useMenuSchedules(tenantId);
  const { data: menus = [], isLoading: menusLoading } = useMenusWithProducts(tenantId);

  // Mutations
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();

  // Filter schedules for specific menu if provided
  const filteredSchedules = useMemo(() => {
    if (!menuId) return schedules;
    return schedules.filter((s) => s.menuId === menuId);
  }, [schedules, menuId]);

  // Calendar days for current month view
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    // Start from Sunday of the week containing the first day
    const calendarStart = addDays(start, -start.getDay());
    // End on Saturday of the week containing the last day
    const calendarEnd = addDays(end, 6 - end.getDay());

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Detect conflicts between schedules
  const conflicts = useMemo((): ScheduleConflict[] => {
    const detectedConflicts: ScheduleConflict[] = [];
    const activeSchedules = schedules.filter((s) => s.isActive);

    for (let i = 0; i < activeSchedules.length; i++) {
      for (let j = i + 1; j < activeSchedules.length; j++) {
        const s1 = activeSchedules[i];
        const s2 = activeSchedules[j];

        // Check time overlap
        const start1 = parseISO(s1.startTime);
        const end1 = s1.endTime ? parseISO(s1.endTime) : addDays(new Date(), 365);
        const start2 = parseISO(s2.startTime);
        const end2 = s2.endTime ? parseISO(s2.endTime) : addDays(new Date(), 365);

        const hasTimeOverlap = !(isBefore(end1, start2) || isBefore(end2, start1));

        if (hasTimeOverlap) {
          // Check product overlap
          const menu1 = menus.find((m) => m.id === s1.menuId);
          const menu2 = menus.find((m) => m.id === s2.menuId);

          if (menu1 && menu2) {
            const overlappingIds = menu1.productIds.filter((id) =>
              menu2.productIds.includes(id)
            );

            if (overlappingIds.length > 0) {
              detectedConflicts.push({
                schedule1: s1,
                schedule2: s2,
                overlappingProductIds: overlappingIds,
                overlappingProductNames: overlappingIds.map((id) => `Product ${id.slice(0, 8)}`),
              });
            }
          }
        }
      }
    }

    return detectedConflicts;
  }, [schedules, menus]);

  // Handlers
  const handleCreateSchedule = useCallback(async (data: {
    menuId: string;
    startTime: string;
    endTime: string | null;
    isRecurring: boolean;
    recurrenceRule: string | null;
  }) => {
    if (!tenantId) return;

    await createSchedule.mutateAsync({
      ...data,
      tenantId,
    });

    setIsCreateDialogOpen(false);
  }, [tenantId, createSchedule]);

  const handleUpdateSchedule = useCallback(async (data: {
    menuId: string;
    startTime: string;
    endTime: string | null;
    isRecurring: boolean;
    recurrenceRule: string | null;
  }) => {
    if (!tenantId || !editingSchedule) return;

    await updateSchedule.mutateAsync({
      id: editingSchedule.id,
      tenantId,
      startTime: data.startTime,
      endTime: data.endTime,
      isRecurring: data.isRecurring,
      recurrenceRule: data.recurrenceRule,
    });

    setEditingSchedule(null);
  }, [tenantId, editingSchedule, updateSchedule]);

  const handleDeleteSchedule = useCallback(async () => {
    if (!tenantId || !scheduleToDelete) return;

    await deleteSchedule.mutateAsync({ id: scheduleToDelete.id, tenantId });
    setDeleteDialogOpen(false);
    setScheduleToDelete(null);
  }, [tenantId, deleteSchedule, scheduleToDelete]);

  const handleToggleActive = useCallback(async (schedule: MenuSchedule) => {
    if (!tenantId) return;

    await updateSchedule.mutateAsync({
      id: schedule.id,
      tenantId,
      isActive: !schedule.isActive,
    });
  }, [tenantId, updateSchedule]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => addDays(startOfMonth(prev), -1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => addDays(endOfMonth(prev), 1));
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const isLoading = schedulesLoading || menusLoading;

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Menu Scheduling</h2>
            <p className="text-sm text-muted-foreground">
              Schedule menus to auto-activate and deactivate
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Schedule
        </Button>
      </div>

      {/* Conflicts Warning */}
      {conflicts.length > 0 && (
        <ConflictsPanel conflicts={conflicts} />
      )}

      {/* Calendar View */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Calendar View</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevMonth} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium min-w-[140px] text-center">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <Button variant="outline" size="icon" onClick={handleNextMonth} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b">
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day.value}
                className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
              >
                {day.label}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => (
              <CalendarDay
                key={day.toISOString()}
                date={day}
                schedules={filteredSchedules}
                isCurrentMonth={day.getMonth() === currentMonth.getMonth()}
                isToday={isSameDay(day, new Date())}
                onClick={() => handleDayClick(day)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Schedules List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Schedules</CardTitle>
          <CardDescription>
            {filteredSchedules.length} schedule{filteredSchedules.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSchedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No Schedules Yet</p>
              <p className="text-sm mt-1">
                Create a schedule to have menus automatically activate and deactivate.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className={cn(
                    'flex items-center justify-between p-4 border rounded-lg',
                    schedule.isActive ? 'bg-green-50/50 border-green-200' : 'bg-muted/50'
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{schedule.menuName}</span>
                      {schedule.isRecurring && (
                        <Badge variant="outline" className="text-xs">
                          <Repeat className="h-3 w-3 mr-1" />
                          Recurring
                        </Badge>
                      )}
                      <Badge variant={schedule.isActive ? 'default' : 'secondary'}>
                        {schedule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(schedule.startTime), 'MMM d, yyyy h:mm a')}
                      </span>
                      {schedule.endTime && (
                        <>
                          <span>to</span>
                          <span>{format(parseISO(schedule.endTime), 'MMM d, yyyy h:mm a')}</span>
                        </>
                      )}
                    </div>
                    {schedule.recurrenceRule && (
                      <div className="text-xs text-muted-foreground">
                        {parseRecurrenceRule(schedule.recurrenceRule).days.length > 0
                          ? `Every ${parseRecurrenceRule(schedule.recurrenceRule).days.join(', ')}`
                          : 'Weekly'}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(schedule)}
                            disabled={updateSchedule.isPending}
                            aria-label={schedule.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {updateSchedule.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : schedule.isActive ? (
                              <X className="h-4 w-4" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {schedule.isActive ? 'Deactivate' : 'Activate'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingSchedule(schedule)}
                            aria-label="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit Schedule</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => { setScheduleToDelete(schedule); setDeleteDialogOpen(true); }}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete Schedule</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Schedule Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Menu Schedule</DialogTitle>
            <DialogDescription>
              Schedule a menu to automatically activate and deactivate at specific times.
            </DialogDescription>
          </DialogHeader>
          <ScheduleForm
            menuId={menuId}
            menus={menus}
            tenantId={tenantId ?? ''}
            onSave={handleCreateSchedule}
            onCancel={() => setIsCreateDialogOpen(false)}
            isSaving={createSchedule.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Dialog */}
      <Dialog open={!!editingSchedule} onOpenChange={() => setEditingSchedule(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
            <DialogDescription>
              Update the schedule configuration for {editingSchedule?.menuName}.
            </DialogDescription>
          </DialogHeader>
          {editingSchedule && (
            <ScheduleForm
              menuId={editingSchedule.menuId}
              schedule={editingSchedule}
              menus={menus}
              tenantId={tenantId ?? ''}
              onSave={handleUpdateSchedule}
              onCancel={() => setEditingSchedule(null)}
              isSaving={updateSchedule.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteSchedule}
        itemName={scheduleToDelete?.menuName}
        itemType="schedule"
        isLoading={deleteSchedule.isPending}
      />

      {/* Day Details Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
            <DialogDescription>
              Menus scheduled for this day
            </DialogDescription>
          </DialogHeader>
          {selectedDate && (
            <div className="space-y-3">
              {filteredSchedules
                .filter((schedule) => {
                  const start = parseISO(schedule.startTime);
                  const end = schedule.endTime ? parseISO(schedule.endTime) : null;

                  if (isBefore(selectedDate, startOfDay(start))) return false;
                  if (end && isAfter(selectedDate, endOfDay(end))) return false;

                  return true;
                })
                .map((schedule) => (
                  <div
                    key={schedule.id}
                    className="p-3 border rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{schedule.menuName}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(parseISO(schedule.startTime), 'h:mm a')}
                        {schedule.endTime && ` - ${format(parseISO(schedule.endTime), 'h:mm a')}`}
                      </div>
                    </div>
                    <Badge variant={schedule.isActive ? 'default' : 'secondary'}>
                      {schedule.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              {filteredSchedules.filter((schedule) => {
                const start = parseISO(schedule.startTime);
                const end = schedule.endTime ? parseISO(schedule.endTime) : null;

                if (isBefore(selectedDate, startOfDay(start))) return false;
                if (end && isAfter(selectedDate, endOfDay(end))) return false;

                return true;
              }).length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  No menus scheduled for this day
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MenuScheduler;
