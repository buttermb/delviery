/**
 * DeliveryScheduler Component
 * Schedule deliveries for specific time slots with capacity management
 * - Define available time slots per day
 * - Customer selects slot during checkout
 * - Show slot capacity (max deliveries per slot)
 * - Block full slots
 * - Calendar view of upcoming scheduled deliveries
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  format,
  startOfDay,
  endOfDay,
  addDays,
  subDays,
  isSameDay,
  parseISO,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  isBefore,
  setHours,
  setMinutes,
} from 'date-fns';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Users,
  Truck,
  Settings,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

// Types
export interface DeliveryTimeSlot {
  id: string;
  label: string;
  start_time: string; // HH:MM format
  end_time: string;   // HH:MM format
  max_capacity: number;
  is_enabled: boolean;
  days_of_week: number[]; // 0 = Sunday, 6 = Saturday
  priority: number;
}

interface ScheduledDelivery {
  id: string;
  order_id: string;
  customer_name: string;
  delivery_address: string;
  delivery_scheduled_at: string;
  slot_label: string;
  status: string;
  courier_name: string | null;
}

interface SlotAvailability {
  slot: DeliveryTimeSlot;
  date: Date;
  bookedCount: number;
  availableCount: number;
  isFull: boolean;
  isPast: boolean;
}

interface DeliverySchedulerProps {
  className?: string;
}

// Form schema for time slot
const timeSlotSchema = z.object({
  label: z.string().min(1, 'Label is required').max(50),
  start_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  end_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  max_capacity: z.number().int().min(1, 'Capacity must be at least 1').max(100),
  is_enabled: z.boolean(),
  days_of_week: z.array(z.number().min(0).max(6)).min(1, 'Select at least one day'),
  priority: z.number().int().min(0),
}).refine(
  (data) => {
    const [startHour, startMin] = data.start_time.split(':').map(Number);
    const [endHour, endMin] = data.end_time.split(':').map(Number);
    return endHour * 60 + endMin > startHour * 60 + startMin;
  },
  { message: 'End time must be after start time', path: ['end_time'] }
);

type TimeSlotFormData = z.infer<typeof timeSlotSchema>;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function DeliveryScheduler({ className }: DeliverySchedulerProps) {
  const { tenantId, hasPermission, isReady } = useTenantContext();
  const queryClient = useQueryClient();

  // State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [isSlotDialogOpen, setIsSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<DeliveryTimeSlot | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<DeliveryTimeSlot | null>(null);

  const canManageDeliveries = useMemo(
    () => hasPermission('manage:deliveries'),
    [hasPermission]
  );

  // Form
  const form = useForm<TimeSlotFormData>({
    resolver: zodResolver(timeSlotSchema),
    defaultValues: {
      label: '',
      start_time: '09:00',
      end_time: '12:00',
      max_capacity: 10,
      is_enabled: true,
      days_of_week: [1, 2, 3, 4, 5], // Mon-Fri default
      priority: 0,
    },
  });

  // Fetch time slots configuration
  const { data: timeSlots = [], isLoading: isSlotsLoading } = useQuery({
    queryKey: [...queryKeys.deliveries.all, 'time-slots', tenantId],
    queryFn: async (): Promise<DeliveryTimeSlot[]> => {
      if (!tenantId) return [];

      // First try to get from delivery_time_slots table
      const { data, error } = await (supabase as any)
        .from('delivery_time_slots')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        // Table might not exist, return default slots
        if (error.code === '42P01') {
          logger.debug('delivery_time_slots table does not exist, using defaults', { component: 'DeliveryScheduler' });
          return getDefaultTimeSlots();
        }
        logger.error('Failed to fetch time slots', error, { component: 'DeliveryScheduler' });
        return getDefaultTimeSlots();
      }

      return (data || []).map((slot: any) => ({
        id: slot.id,
        label: slot.label,
        start_time: slot.start_time,
        end_time: slot.end_time,
        max_capacity: slot.max_capacity,
        is_enabled: slot.is_enabled,
        days_of_week: slot.days_of_week || [0, 1, 2, 3, 4, 5, 6],
        priority: slot.priority || 0,
      }));
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  // Fetch scheduled deliveries for the week
  const { data: scheduledDeliveries = [], isLoading: isDeliveriesLoading } = useQuery({
    queryKey: [...queryKeys.deliveries.all, 'scheduled', tenantId, weekStart.toISOString()],
    queryFn: async (): Promise<ScheduledDelivery[]> => {
      if (!tenantId) return [];

      const weekEnd = endOfWeek(weekStart);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          customer_name,
          delivery_address,
          delivery_scheduled_at,
          status,
          couriers(full_name)
        `)
        .eq('tenant_id', tenantId)
        .not('delivery_scheduled_at', 'is', null)
        .gte('delivery_scheduled_at', startOfDay(weekStart).toISOString())
        .lte('delivery_scheduled_at', endOfDay(weekEnd).toISOString())
        .order('delivery_scheduled_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch scheduled deliveries', error, { component: 'DeliveryScheduler' });
        throw error;
      }

      return (data || []).map((order) => ({
        id: order.id,
        order_id: order.id,
        customer_name: order.customer_name || 'Unknown',
        delivery_address: order.delivery_address || '',
        delivery_scheduled_at: order.delivery_scheduled_at!,
        slot_label: getSlotLabelForTime(order.delivery_scheduled_at!, timeSlots),
        status: order.status,
        courier_name: (order.couriers as any)?.full_name || null,
      }));
    },
    enabled: !!tenantId && timeSlots.length > 0,
    staleTime: 30000,
  });

  // Calculate slot availability for a given date
  const getSlotAvailability = useCallback((date: Date): SlotAvailability[] => {
    const dayOfWeek = date.getDay();
    const now = new Date();

    return timeSlots
      .filter((slot) => slot.is_enabled && slot.days_of_week.includes(dayOfWeek))
      .map((slot) => {
        // Parse slot times and create datetime for comparison
        const [startHour, startMin] = slot.start_time.split(':').map(Number);
        const slotDateTime = setMinutes(setHours(date, startHour), startMin);
        const isPast = isBefore(slotDateTime, now);

        // Count booked deliveries for this slot on this date
        const bookedCount = scheduledDeliveries.filter((delivery) => {
          const deliveryDate = parseISO(delivery.delivery_scheduled_at);
          if (!isSameDay(deliveryDate, date)) return false;

          const deliveryHour = deliveryDate.getHours();
          const deliveryMin = deliveryDate.getMinutes();
          const deliveryMinutes = deliveryHour * 60 + deliveryMin;

          const [slotStartHour, slotStartMin] = slot.start_time.split(':').map(Number);
          const [slotEndHour, slotEndMin] = slot.end_time.split(':').map(Number);
          const slotStartMinutes = slotStartHour * 60 + slotStartMin;
          const slotEndMinutes = slotEndHour * 60 + slotEndMin;

          return deliveryMinutes >= slotStartMinutes && deliveryMinutes < slotEndMinutes;
        }).length;

        return {
          slot,
          date,
          bookedCount,
          availableCount: Math.max(0, slot.max_capacity - bookedCount),
          isFull: bookedCount >= slot.max_capacity,
          isPast,
        };
      });
  }, [timeSlots, scheduledDeliveries]);

  // Get deliveries for a specific day
  const getDeliveriesForDay = useCallback((date: Date): ScheduledDelivery[] => {
    return scheduledDeliveries.filter((delivery) =>
      isSameDay(parseISO(delivery.delivery_scheduled_at), date)
    );
  }, [scheduledDeliveries]);

  // Week days for calendar view
  const weekDays = useMemo(() => {
    return eachDayOfInterval({
      start: weekStart,
      end: endOfWeek(weekStart),
    });
  }, [weekStart]);

  // Save time slot mutation
  const saveSlotMutation = useMutation({
    mutationFn: async (data: TimeSlotFormData & { id?: string }) => {
      if (!tenantId) throw new Error('No tenant ID');

      const slotData = {
        tenant_id: tenantId,
        label: data.label,
        start_time: data.start_time,
        end_time: data.end_time,
        max_capacity: data.max_capacity,
        is_enabled: data.is_enabled,
        days_of_week: data.days_of_week,
        priority: data.priority,
      };

      if (data.id) {
        const { error } = await (supabase as any)
          .from('delivery_time_slots')
          .update(slotData)
          .eq('id', data.id)
          .eq('tenant_id', tenantId);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('delivery_time_slots')
          .insert(slotData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.deliveries.all, 'time-slots', tenantId] });
      toast.success(editingSlot ? 'Time slot updated' : 'Time slot created');
      setIsSlotDialogOpen(false);
      setEditingSlot(null);
      form.reset();
    },
    onError: (error) => {
      logger.error('Failed to save time slot', error, { component: 'DeliveryScheduler' });
      toast.error('Failed to save time slot');
    },
  });

  // Delete time slot mutation
  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      if (!tenantId) throw new Error('No tenant ID');

      const { error } = await (supabase as any)
        .from('delivery_time_slots')
        .delete()
        .eq('id', slotId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.deliveries.all, 'time-slots', tenantId] });
      toast.success('Time slot deleted');
      setDeleteDialogOpen(false);
      setSlotToDelete(null);
    },
    onError: (error) => {
      logger.error('Failed to delete time slot', error, { component: 'DeliveryScheduler' });
      toast.error('Failed to delete time slot');
    },
  });

  // Handle form submission
  const onSubmit = (data: TimeSlotFormData) => {
    saveSlotMutation.mutate({
      ...data,
      id: editingSlot?.id,
    });
  };

  // Open edit dialog
  const handleEditSlot = (slot: DeliveryTimeSlot) => {
    setEditingSlot(slot);
    form.reset({
      label: slot.label,
      start_time: slot.start_time,
      end_time: slot.end_time,
      max_capacity: slot.max_capacity,
      is_enabled: slot.is_enabled,
      days_of_week: slot.days_of_week,
      priority: slot.priority,
    });
    setIsSlotDialogOpen(true);
  };

  // Open create dialog
  const handleCreateSlot = () => {
    setEditingSlot(null);
    form.reset({
      label: '',
      start_time: '09:00',
      end_time: '12:00',
      max_capacity: 10,
      is_enabled: true,
      days_of_week: [1, 2, 3, 4, 5],
      priority: 0,
    });
    setIsSlotDialogOpen(true);
  };

  // Navigate weeks
  const goToPreviousWeek = () => setWeekStart(subDays(weekStart, 7));
  const goToNextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToToday = () => setWeekStart(startOfWeek(new Date()));

  if (!isReady) {
    return (
      <div className={cn('space-y-6', className)}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Delivery Scheduler
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage delivery time slots and view scheduled deliveries
          </p>
        </div>
        {canManageDeliveries && (
          <Button onClick={handleCreateSlot}>
            <Plus className="h-4 w-4 mr-2" />
            Add Time Slot
          </Button>
        )}
      </div>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar View
          </TabsTrigger>
          <TabsTrigger value="slots" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Time Slots
          </TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar" className="space-y-4">
          {/* Week Navigation */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Today
                  </Button>
                  <Button variant="outline" size="icon" onClick={goToNextWeek}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm font-medium">
                  {format(weekStart, 'MMM d')} - {format(endOfWeek(weekStart), 'MMM d, yyyy')}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Pick Date
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setWeekStart(startOfWeek(date));
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isSlotsLoading || isDeliveriesLoading ? (
                <div className="p-6">
                  <Skeleton className="h-[400px] w-full" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px] sticky left-0 bg-background">Slot</TableHead>
                        {weekDays.map((day) => (
                          <TableHead
                            key={day.toISOString()}
                            className={cn(
                              'min-w-[140px] text-center',
                              isToday(day) && 'bg-primary/5'
                            )}
                          >
                            <div className="flex flex-col items-center">
                              <span className="text-xs text-muted-foreground">
                                {format(day, 'EEE')}
                              </span>
                              <span className={cn(
                                'text-lg font-semibold',
                                isToday(day) && 'text-primary'
                              )}>
                                {format(day, 'd')}
                              </span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeSlots.filter((s) => s.is_enabled).map((slot) => (
                        <TableRow key={slot.id}>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            <div className="text-sm">{slot.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {slot.start_time} - {slot.end_time}
                            </div>
                          </TableCell>
                          {weekDays.map((day) => {
                            const availability = getSlotAvailability(day).find(
                              (a) => a.slot.id === slot.id
                            );

                            if (!availability || !slot.days_of_week.includes(day.getDay())) {
                              return (
                                <TableCell
                                  key={day.toISOString()}
                                  className={cn(
                                    'text-center',
                                    isToday(day) && 'bg-primary/5'
                                  )}
                                >
                                  <span className="text-xs text-muted-foreground">-</span>
                                </TableCell>
                              );
                            }

                            const { bookedCount, availableCount, isFull, isPast } = availability;
                            const utilization = (bookedCount / slot.max_capacity) * 100;

                            return (
                              <TableCell
                                key={day.toISOString()}
                                className={cn(
                                  'text-center p-2',
                                  isToday(day) && 'bg-primary/5',
                                  isPast && 'opacity-50'
                                )}
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <Badge
                                    variant={isFull ? 'destructive' : isPast ? 'secondary' : 'outline'}
                                    className={cn(
                                      'text-xs',
                                      !isFull && !isPast && utilization > 70 && 'border-amber-500 text-amber-600'
                                    )}
                                  >
                                    {isFull ? (
                                      <XCircle className="h-3 w-3 mr-1" />
                                    ) : (
                                      <Users className="h-3 w-3 mr-1" />
                                    )}
                                    {bookedCount}/{slot.max_capacity}
                                  </Badge>
                                  <Progress
                                    value={utilization}
                                    className={cn(
                                      'h-1 w-16',
                                      isFull && '[&>div]:bg-destructive',
                                      !isFull && utilization > 70 && '[&>div]:bg-amber-500'
                                    )}
                                  />
                                  {!isPast && !isFull && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {availableCount} avail
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Day Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Deliveries for {format(selectedDate, 'EEEE, MMMM d')}
              </CardTitle>
              <CardDescription>
                {getDeliveriesForDay(selectedDate).length} scheduled deliveries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getDeliveriesForDay(selectedDate).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No deliveries scheduled for this day</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {getDeliveriesForDay(selectedDate).map((delivery) => (
                      <div
                        key={delivery.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{delivery.customer_name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {delivery.delivery_address}
                          </p>
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              {format(parseISO(delivery.delivery_scheduled_at), 'h:mm a')}
                            </Badge>
                            {delivery.courier_name && (
                              <Badge variant="secondary">
                                <Users className="h-3 w-3 mr-1" />
                                {delivery.courier_name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={
                            delivery.status === 'delivered'
                              ? 'default'
                              : delivery.status === 'out_for_delivery'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {delivery.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time Slots Management */}
        <TabsContent value="slots" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Delivery Time Slots</CardTitle>
              <CardDescription>
                Configure available time windows for customer deliveries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSlotsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No time slots configured</p>
                  <p className="text-sm mt-1">Add time slots to allow customers to schedule deliveries</p>
                  {canManageDeliveries && (
                    <Button onClick={handleCreateSlot} className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Time Slot
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {timeSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={cn(
                        'flex items-center justify-between p-4 border rounded-lg',
                        !slot.is_enabled && 'opacity-60 bg-muted/50'
                      )}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{slot.label}</p>
                          <Badge variant={slot.is_enabled ? 'default' : 'secondary'}>
                            {slot.is_enabled ? 'Active' : 'Disabled'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {slot.start_time} - {slot.end_time}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            Max {slot.max_capacity} deliveries
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {slot.days_of_week.map((day) => (
                            <Badge key={day} variant="outline" className="text-xs">
                              {DAY_NAMES[day]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {canManageDeliveries && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSlot(slot)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setSlotToDelete(slot);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Time Slot Dialog */}
      <Dialog open={isSlotDialogOpen} onOpenChange={setIsSlotDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSlot ? 'Edit Time Slot' : 'Create Time Slot'}
            </DialogTitle>
            <DialogDescription>
              {editingSlot
                ? 'Update the time slot settings'
                : 'Add a new delivery time window'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="label">Slot Name *</Label>
              <Input
                id="label"
                {...form.register('label')}
                placeholder="e.g., Morning, Afternoon"
              />
              {form.formState.errors.label && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.label.message}
                </p>
              )}
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time *</Label>
                <Input
                  type="time"
                  id="start_time"
                  {...form.register('start_time')}
                />
                {form.formState.errors.start_time && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.start_time.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">End Time *</Label>
                <Input
                  type="time"
                  id="end_time"
                  {...form.register('end_time')}
                />
                {form.formState.errors.end_time && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.end_time.message}
                  </p>
                )}
              </div>
            </div>

            {/* Capacity */}
            <div className="space-y-2">
              <Label htmlFor="max_capacity">Max Deliveries per Slot *</Label>
              <Input
                type="number"
                id="max_capacity"
                {...form.register('max_capacity', { valueAsNumber: true })}
                min={1}
                max={100}
              />
              {form.formState.errors.max_capacity && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.max_capacity.message}
                </p>
              )}
            </div>

            {/* Days of Week */}
            <div className="space-y-2">
              <Label>Available Days *</Label>
              <div className="flex flex-wrap gap-2">
                {FULL_DAY_NAMES.map((day, index) => {
                  const days = form.watch('days_of_week');
                  const isSelected = days.includes(index);

                  return (
                    <Button
                      key={day}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const newDays = isSelected
                          ? days.filter((d) => d !== index)
                          : [...days, index];
                        form.setValue('days_of_week', newDays, { shouldValidate: true });
                      }}
                    >
                      {DAY_NAMES[index]}
                    </Button>
                  );
                })}
              </div>
              {form.formState.errors.days_of_week && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.days_of_week.message}
                </p>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Display Priority</Label>
              <Input
                type="number"
                id="priority"
                {...form.register('priority', { valueAsNumber: true })}
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first
              </p>
            </div>

            {/* Enabled */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Enabled</Label>
                <p className="text-sm text-muted-foreground">
                  Slot available for booking
                </p>
              </div>
              <Switch
                checked={form.watch('is_enabled')}
                onCheckedChange={(checked) => form.setValue('is_enabled', checked)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSlotDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveSlotMutation.isPending}
              >
                {saveSlotMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingSlot ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (slotToDelete) {
            deleteSlotMutation.mutate(slotToDelete.id);
          }
        }}
        itemType="time slot"
        itemName={slotToDelete?.label}
        isLoading={deleteSlotMutation.isPending}
      />
    </div>
  );
}

// Helper function to get slot label for a given time
function getSlotLabelForTime(dateTime: string, slots: DeliveryTimeSlot[]): string {
  const date = parseISO(dateTime);
  const hour = date.getHours();
  const min = date.getMinutes();
  const totalMinutes = hour * 60 + min;

  for (const slot of slots) {
    const [startHour, startMin] = slot.start_time.split(':').map(Number);
    const [endHour, endMin] = slot.end_time.split(':').map(Number);
    const slotStart = startHour * 60 + startMin;
    const slotEnd = endHour * 60 + endMin;

    if (totalMinutes >= slotStart && totalMinutes < slotEnd) {
      return slot.label;
    }
  }

  return format(date, 'h:mm a');
}

// Default time slots when table doesn't exist
function getDefaultTimeSlots(): DeliveryTimeSlot[] {
  return [
    {
      id: 'default-morning',
      label: 'Morning',
      start_time: '09:00',
      end_time: '12:00',
      max_capacity: 10,
      is_enabled: true,
      days_of_week: [1, 2, 3, 4, 5],
      priority: 0,
    },
    {
      id: 'default-afternoon',
      label: 'Afternoon',
      start_time: '12:00',
      end_time: '17:00',
      max_capacity: 15,
      is_enabled: true,
      days_of_week: [1, 2, 3, 4, 5],
      priority: 1,
    },
    {
      id: 'default-evening',
      label: 'Evening',
      start_time: '17:00',
      end_time: '21:00',
      max_capacity: 8,
      is_enabled: true,
      days_of_week: [1, 2, 3, 4, 5, 6],
      priority: 2,
    },
  ];
}

export default DeliveryScheduler;
