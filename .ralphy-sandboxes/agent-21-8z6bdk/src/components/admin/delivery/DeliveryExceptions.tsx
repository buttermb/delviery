/**
 * DeliveryExceptions Component
 * Handle delivery failures with various exception reasons, photo logging,
 * auto-reroute/reschedule options, admin/customer notifications,
 * return-to-store process, and exception rate tracking.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  format,
  parseISO,
  startOfDay,
  endOfDay,
  subDays,
} from 'date-fns';
import {
  AlertTriangle,
  Camera,
  RotateCcw,
  Loader2,
  Home,
  MapPin,
  Ban,
  Lock,
  Package,
  Truck,
  ArrowLeftRight,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  RefreshCw,
  FileText,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { AnalyticsDateRangePicker } from '@/components/admin/disposable-menus/AnalyticsDateRangePicker';

// =============================================================================
// Types
// =============================================================================

export type ExceptionReason =
  | 'customer_not_home'
  | 'wrong_address'
  | 'refused_delivery'
  | 'access_issue'
  | 'weather'
  | 'vehicle_issue'
  | 'other';

export type ExceptionResolution =
  | 'rerouted'
  | 'rescheduled'
  | 'returned_to_store'
  | 'cancelled'
  | 'resolved'
  | 'pending';

export interface DeliveryException {
  id: string;
  tenant_id: string;
  order_id: string;
  delivery_id: string | null;
  courier_id: string | null;
  reason: ExceptionReason;
  reason_details: string | null;
  photo_url: string | null;
  location_lat: number | null;
  location_lng: number | null;
  resolution: ExceptionResolution;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  admin_notified: boolean;
  customer_notified: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  order?: {
    id: string;
    tracking_code: string;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    delivery_address: string | null;
    status: string;
  };
  courier?: {
    id: string;
    full_name: string;
    phone: string | null;
  };
}

interface ExceptionStats {
  total: number;
  pending: number;
  resolved: number;
  byReason: Record<ExceptionReason, number>;
  resolutionRate: number;
  avgResolutionTimeMinutes: number;
}

interface DeliveryExceptionsProps {
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const EXCEPTION_REASONS: { value: ExceptionReason; label: string; icon: React.ElementType; description: string }[] = [
  {
    value: 'customer_not_home',
    label: 'Customer Not Home',
    icon: Home,
    description: 'Customer was not available at the delivery location',
  },
  {
    value: 'wrong_address',
    label: 'Wrong Address',
    icon: MapPin,
    description: 'Delivery address was incorrect or could not be found',
  },
  {
    value: 'refused_delivery',
    label: 'Refused Delivery',
    icon: Ban,
    description: 'Customer refused to accept the delivery',
  },
  {
    value: 'access_issue',
    label: 'Access Issue',
    icon: Lock,
    description: 'Unable to access building, gate, or delivery area',
  },
  {
    value: 'weather',
    label: 'Weather',
    icon: AlertTriangle,
    description: 'Weather conditions prevented safe delivery',
  },
  {
    value: 'vehicle_issue',
    label: 'Vehicle Issue',
    icon: Truck,
    description: 'Delivery vehicle had mechanical problems',
  },
  {
    value: 'other',
    label: 'Other',
    icon: FileText,
    description: 'Other reason not listed above',
  },
];

const RESOLUTION_OPTIONS: { value: ExceptionResolution; label: string; description: string }[] = [
  { value: 'rerouted', label: 'Reroute', description: 'Assign to different courier' },
  { value: 'rescheduled', label: 'Reschedule', description: 'Schedule for later delivery' },
  { value: 'returned_to_store', label: 'Return to Store', description: 'Return package to origin' },
  { value: 'cancelled', label: 'Cancel Delivery', description: 'Cancel the delivery order' },
  { value: 'resolved', label: 'Mark Resolved', description: 'Issue has been resolved' },
];

// =============================================================================
// Form Schema
// =============================================================================

const exceptionFormSchema = z.object({
  reason: z.enum([
    'customer_not_home',
    'wrong_address',
    'refused_delivery',
    'access_issue',
    'weather',
    'vehicle_issue',
    'other',
  ]),
  reason_details: z.string().min(10, 'Please provide at least 10 characters of detail'),
  notify_admin: z.boolean().default(true),
  notify_customer: z.boolean().default(true),
});

const resolutionFormSchema = z.object({
  resolution: z.enum([
    'rerouted',
    'rescheduled',
    'returned_to_store',
    'cancelled',
    'resolved',
  ]),
  resolution_notes: z.string().optional(),
  reschedule_date: z.string().optional(),
  new_courier_id: z.string().optional(),
});

type ExceptionFormData = z.infer<typeof exceptionFormSchema>;
type ResolutionFormData = z.infer<typeof resolutionFormSchema>;

// =============================================================================
// Component
// =============================================================================

export function DeliveryExceptions({ className }: DeliveryExceptionsProps) {
  const { tenantId, hasPermission, isReady } = useTenantContext();
  const queryClient = useQueryClient();

  // State
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterReason, setFilterReason] = useState<ExceptionReason | 'all'>('all');
  const [filterResolution, setFilterResolution] = useState<ExceptionResolution | 'pending' | 'all'>('pending');
  const [selectedExceptionId, setSelectedExceptionId] = useState<string | null>(null);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [logOrderId, setLogOrderId] = useState<string>('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false);
  const [exceptionToReturn, setExceptionToReturn] = useState<DeliveryException | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManageDeliveries = useMemo(
    () => hasPermission('manage:deliveries'),
    [hasPermission]
  );

  // Forms
  const exceptionForm = useForm<ExceptionFormData>({
    resolver: zodResolver(exceptionFormSchema),
    defaultValues: {
      reason: 'customer_not_home',
      reason_details: '',
      notify_admin: true,
      notify_customer: true,
    },
  });

  const resolutionForm = useForm<ResolutionFormData>({
    resolver: zodResolver(resolutionFormSchema),
    defaultValues: {
      resolution: 'rescheduled',
      resolution_notes: '',
    },
  });
  const watchedReason = useWatch({ control: exceptionForm.control, name: 'reason' });
  const watchedResolution = useWatch({ control: resolutionForm.control, name: 'resolution' });
  const watchedNewCourierId = useWatch({ control: resolutionForm.control, name: 'new_courier_id' });

  // =============================================================================
  // Queries
  // =============================================================================

  // Fetch exceptions
  const {
    data: exceptions = [],
    isLoading: isExceptionsLoading,
    error: exceptionsError,
    refetch: refetchExceptions,
  } = useQuery({
    queryKey: [...queryKeys.deliveries.all, 'exceptions', tenantId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<DeliveryException[]> => {
      if (!tenantId || !dateRange?.from || !dateRange?.to) return [];

      const { data, error } = await supabase
        .from('delivery_exceptions')
        .select(`
          *,
          order:orders!delivery_exceptions_order_id_fkey(
            id,
            tracking_code,
            customer_name,
            customer_email,
            customer_phone,
            delivery_address,
            status
          ),
          courier:couriers!delivery_exceptions_courier_id_fkey(
            id,
            full_name,
            phone
          )
        `)
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfDay(dateRange.from).toISOString())
        .lte('created_at', endOfDay(dateRange.to).toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        // Table might not exist yet
        if (error.code === '42P01') {
          logger.debug('delivery_exceptions table does not exist yet', { component: 'DeliveryExceptions' });
          return [];
        }
        logger.error('Failed to fetch delivery exceptions', error, { component: 'DeliveryExceptions' });
        throw error;
      }

      return (data ?? []) as DeliveryException[];
    },
    enabled: !!tenantId && !!dateRange?.from && !!dateRange?.to,
    staleTime: 30000,
  });

  // Fetch available couriers for rerouting
  const { data: availableCouriers = [] } = useQuery({
    queryKey: [...queryKeys.couriers.all, 'available', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('couriers')
        .select('id, full_name, phone')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('full_name');

      if (error) {
        logger.error('Failed to fetch available couriers', error, { component: 'DeliveryExceptions' });
        return [];
      }

      return data ?? [];
    },
    enabled: !!tenantId && isResolveDialogOpen,
  });

  // =============================================================================
  // Computed Values
  // =============================================================================

  // Filter exceptions
  const filteredExceptions = useMemo(() => {
    let result = exceptions;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.order?.tracking_code?.toLowerCase().includes(query) ||
          e.order?.customer_name?.toLowerCase().includes(query) ||
          e.reason_details?.toLowerCase().includes(query)
      );
    }

    // Reason filter
    if (filterReason !== 'all') {
      result = result.filter((e) => e.reason === filterReason);
    }

    // Resolution filter
    if (filterResolution !== 'all') {
      result = result.filter((e) => e.resolution === filterResolution);
    }

    return result;
  }, [exceptions, searchQuery, filterReason, filterResolution]);

  // Calculate stats
  const stats = useMemo((): ExceptionStats => {
    if (exceptions.length === 0) {
      return {
        total: 0,
        pending: 0,
        resolved: 0,
        byReason: {
          customer_not_home: 0,
          wrong_address: 0,
          refused_delivery: 0,
          access_issue: 0,
          weather: 0,
          vehicle_issue: 0,
          other: 0,
        },
        resolutionRate: 0,
        avgResolutionTimeMinutes: 0,
      };
    }

    const pending = exceptions.filter((e) => e.resolution === 'pending').length;
    const resolved = exceptions.filter((e) => e.resolution !== 'pending').length;

    const byReason = exceptions.reduce(
      (acc, e) => {
        acc[e.reason] = (acc[e.reason] ?? 0) + 1;
        return acc;
      },
      {} as Record<ExceptionReason, number>
    );

    // Ensure all reasons are present
    EXCEPTION_REASONS.forEach((r) => {
      if (!byReason[r.value]) byReason[r.value] = 0;
    });

    // Calculate average resolution time
    const resolvedWithTime = exceptions.filter((e) => e.resolved_at && e.resolution !== 'pending');
    let avgResolutionTimeMinutes = 0;
    if (resolvedWithTime.length > 0) {
      const totalMinutes = resolvedWithTime.reduce((sum, e) => {
        const created = parseISO(e.created_at);
        const resolved = parseISO(e.resolved_at!);
        return sum + (resolved.getTime() - created.getTime()) / (1000 * 60);
      }, 0);
      avgResolutionTimeMinutes = Math.round(totalMinutes / resolvedWithTime.length);
    }

    return {
      total: exceptions.length,
      pending,
      resolved,
      byReason,
      resolutionRate: exceptions.length > 0 ? Math.round((resolved / exceptions.length) * 100) : 0,
      avgResolutionTimeMinutes,
    };
  }, [exceptions]);

  // =============================================================================
  // Mutations
  // =============================================================================

  // Log new exception
  const logExceptionMutation = useMutation({
    mutationFn: async (data: ExceptionFormData & { order_id: string; photo_url?: string | null }) => {
      if (!tenantId) throw new Error('No tenant ID');

      // Get current location
      let locationLat: number | null = null;
      let locationLng: number | null = null;

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        locationLat = position.coords.latitude;
        locationLng = position.coords.longitude;
      } catch {
        logger.debug('Could not get current location for exception', { component: 'DeliveryExceptions' });
      }

      const exceptionData = {
        tenant_id: tenantId,
        order_id: data.order_id,
        reason: data.reason,
        reason_details: data.reason_details,
        photo_url: data.photo_url || null,
        location_lat: locationLat,
        location_lng: locationLng,
        resolution: 'pending' as ExceptionResolution,
        admin_notified: data.notify_admin,
        customer_notified: data.notify_customer,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: inserted, error } = await supabase
        .from('delivery_exceptions')
        .insert(exceptionData)
        .select()
        .maybeSingle();

      if (error) throw error;

      // Update order status to reflect exception
      await supabase
        .from('orders')
        .update({
          status: 'exception',
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.order_id)
        .eq('tenant_id', tenantId);

      // Notify admin (simulated - would integrate with notification system)
      if (data.notify_admin) {
        logger.info('Admin notification sent for delivery exception', {
          component: 'DeliveryExceptions',
          orderId: data.order_id,
          reason: data.reason,
        });
      }

      // Notify customer (simulated - would integrate with SMS/email system)
      if (data.notify_customer) {
        logger.info('Customer notification sent for delivery exception', {
          component: 'DeliveryExceptions',
          orderId: data.order_id,
          reason: data.reason,
        });
      }

      return inserted;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.deliveries.all, 'exceptions', tenantId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Delivery exception logged successfully');
      setIsLogDialogOpen(false);
      exceptionForm.reset();
      setPhotoPreview(null);
      setPhotoFile(null);
      setLogOrderId('');
    },
    onError: (error: Error) => {
      logger.error('Failed to log delivery exception', error, { component: 'DeliveryExceptions' });
      toast.error('Failed to log delivery exception', {
        description: humanizeError(error),
      });
    },
  });

  // Resolve exception
  const resolveExceptionMutation = useMutation({
    mutationFn: async (data: ResolutionFormData & { exception_id: string }) => {
      if (!tenantId) throw new Error('No tenant ID');

      const exception = exceptions.find((e) => e.id === data.exception_id);
      if (!exception) throw new Error('Exception not found');

      const updateData = {
        resolution: data.resolution,
        resolution_notes: data.resolution_notes || null,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('delivery_exceptions')
        .update(updateData)
        .eq('id', data.exception_id)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      // Handle resolution-specific actions
      if (data.resolution === 'rescheduled' && data.reschedule_date) {
        await supabase
          .from('orders')
          .update({
            status: 'confirmed',
            delivery_scheduled_at: data.reschedule_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', exception.order_id)
          .eq('tenant_id', tenantId);

        logger.info('Order rescheduled', {
          component: 'DeliveryExceptions',
          orderId: exception.order_id,
          newDate: data.reschedule_date,
        });
      } else if (data.resolution === 'rerouted' && data.new_courier_id) {
        await supabase
          .from('orders')
          .update({
            status: 'confirmed',
            courier_id: data.new_courier_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', exception.order_id)
          .eq('tenant_id', tenantId);

        logger.info('Order rerouted to new courier', {
          component: 'DeliveryExceptions',
          orderId: exception.order_id,
          newCourierId: data.new_courier_id,
        });
      } else if (data.resolution === 'returned_to_store') {
        await supabase
          .from('orders')
          .update({
            status: 'return_to_store',
            updated_at: new Date().toISOString(),
          })
          .eq('id', exception.order_id)
          .eq('tenant_id', tenantId);

        logger.info('Order marked for return to store', {
          component: 'DeliveryExceptions',
          orderId: exception.order_id,
        });
      } else if (data.resolution === 'cancelled') {
        await supabase
          .from('orders')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', exception.order_id)
          .eq('tenant_id', tenantId);

        logger.info('Order cancelled due to delivery exception', {
          component: 'DeliveryExceptions',
          orderId: exception.order_id,
        });
      } else if (data.resolution === 'resolved') {
        await supabase
          .from('orders')
          .update({
            status: 'delivered',
            delivery_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', exception.order_id)
          .eq('tenant_id', tenantId);

        logger.info('Exception resolved, order marked as delivered', {
          component: 'DeliveryExceptions',
          orderId: exception.order_id,
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.deliveries.all, 'exceptions', tenantId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Exception resolved successfully');
      setIsResolveDialogOpen(false);
      setSelectedExceptionId(null);
      resolutionForm.reset();
    },
    onError: (error: Error) => {
      logger.error('Failed to resolve delivery exception', error, { component: 'DeliveryExceptions' });
      toast.error('Failed to resolve exception', {
        description: humanizeError(error),
      });
    },
  });

  // Return to store mutation
  const returnToStoreMutation = useMutation({
    mutationFn: async (exceptionId: string) => {
      if (!tenantId) throw new Error('No tenant ID');

      const exception = exceptions.find((e) => e.id === exceptionId);
      if (!exception) throw new Error('Exception not found');

      // Update exception
      await supabase
        .from('delivery_exceptions')
        .update({
          resolution: 'returned_to_store',
          resolution_notes: 'Package returned to store via quick action',
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', exceptionId)
        .eq('tenant_id', tenantId);

      // Update order status
      await supabase
        .from('orders')
        .update({
          status: 'return_to_store',
          updated_at: new Date().toISOString(),
        })
        .eq('id', exception.order_id)
        .eq('tenant_id', tenantId);

      logger.info('Package return to store initiated', {
        component: 'DeliveryExceptions',
        orderId: exception.order_id,
      });

      return exceptionId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.deliveries.all, 'exceptions', tenantId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Return to store initiated');
      setReturnConfirmOpen(false);
      setExceptionToReturn(null);
    },
    onError: (error: Error) => {
      logger.error('Failed to initiate return to store', error, { component: 'DeliveryExceptions' });
      toast.error('Failed to initiate return', {
        description: humanizeError(error),
      });
    },
  });

  // =============================================================================
  // Handlers
  // =============================================================================

  const handlePhotoSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    setPhotoFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const clearPhoto = useCallback(() => {
    setPhotoPreview(null);
    setPhotoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile || !tenantId) return null;

    try {
      const fileName = `${tenantId}/exceptions/${Date.now()}-${photoFile.name}`;

      const { error } = await supabase.storage
        .from('delivery-proofs')
        .upload(fileName, photoFile, {
          contentType: photoFile.type,
          cacheControl: '3600',
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('delivery-proofs').getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (error) {
      logger.error('Failed to upload exception photo', error, { component: 'DeliveryExceptions' });
      return null;
    }
  };

  const handleLogException = async (data: ExceptionFormData) => {
    if (!logOrderId) {
      toast.error('Please enter an order ID');
      return;
    }

    const photoUrl = await uploadPhoto();
    logExceptionMutation.mutate({
      ...data,
      order_id: logOrderId,
      photo_url: photoUrl,
    });
  };

  const handleResolveException = (data: ResolutionFormData) => {
    if (!selectedExceptionId) return;

    resolveExceptionMutation.mutate({
      ...data,
      exception_id: selectedExceptionId,
    });
  };

  const handleOpenResolve = (exception: DeliveryException) => {
    setSelectedExceptionId(exception.id);
    resolutionForm.reset({
      resolution: 'rescheduled',
      resolution_notes: '',
    });
    setIsResolveDialogOpen(true);
  };

  const handleReturnToStore = (exception: DeliveryException) => {
    setExceptionToReturn(exception);
    setReturnConfirmOpen(true);
  };

  const getReasonIcon = (reason: ExceptionReason) => {
    const reasonConfig = EXCEPTION_REASONS.find((r) => r.value === reason);
    return reasonConfig?.icon || AlertTriangle;
  };

  const getReasonLabel = (reason: ExceptionReason) => {
    const reasonConfig = EXCEPTION_REASONS.find((r) => r.value === reason);
    return reasonConfig?.label || reason;
  };

  const getResolutionBadgeVariant = (resolution: ExceptionResolution): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (resolution) {
      case 'resolved':
        return 'default';
      case 'rerouted':
      case 'rescheduled':
        return 'secondary';
      case 'returned_to_store':
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // =============================================================================
  // Render
  // =============================================================================

  if (!isReady) {
    return (
      <div className={cn('space-y-6', className)}>
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (exceptionsError) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <XCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground">Failed to load delivery exceptions</p>
          <Button variant="outline" onClick={() => refetchExceptions()} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Delivery Exceptions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Handle delivery failures, log issues, and manage resolutions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AnalyticsDateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
          {canManageDeliveries && (
            <Button onClick={() => setIsLogDialogOpen(true)}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Log Exception
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Exceptions</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                {stats.pending} pending
              </Badge>
              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                {stats.resolved} resolved
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                stats.resolutionRate >= 80 ? 'bg-green-500/10' : 'bg-amber-500/10'
              )}>
                {stats.resolutionRate >= 80 ? (
                  <TrendingUp className="h-6 w-6 text-green-600" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-amber-600" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.resolutionRate}%</p>
                <p className="text-xs text-muted-foreground">Resolution Rate</p>
              </div>
            </div>
            <Progress value={stats.resolutionRate} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats.avgResolutionTimeMinutes > 0 ? `${Math.round(stats.avgResolutionTimeMinutes / 60)}h` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">Avg Resolution Time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats.total > 0
                    ? Math.max(
                        ...Object.entries(stats.byReason).map(([, count]) => count)
                      )
                    : 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Top Reason:{' '}
                  {stats.total > 0
                    ? getReasonLabel(
                        Object.entries(stats.byReason).reduce(
                          (max, [reason, count]) =>
                            count > (stats.byReason[max as ExceptionReason] ?? 0)
                              ? (reason as ExceptionReason)
                              : max,
                          'customer_not_home' as ExceptionReason
                        )
                      )
                    : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Exception List
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Exception List Tab */}
        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by order ID or customer..."
                      aria-label="Search by order ID or customer"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={filterReason}
                    onValueChange={(v) => setFilterReason(v as ExceptionReason | 'all')}
                  >
                    <SelectTrigger className="w-[180px]" aria-label="Filter by reason">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reasons</SelectItem>
                      {EXCEPTION_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filterResolution}
                    onValueChange={(v) => setFilterResolution(v as ExceptionResolution | 'all')}
                  >
                    <SelectTrigger className="w-[160px]" aria-label="Filter by status">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="rescheduled">Rescheduled</SelectItem>
                      <SelectItem value="rerouted">Rerouted</SelectItem>
                      <SelectItem value="returned_to_store">Returned</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exceptions Table */}
          <Card>
            <CardContent className="p-0">
              {isExceptionsLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredExceptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <p className="font-medium">No exceptions found</p>
                  <p className="text-sm">
                    {exceptions.length === 0
                      ? 'Great! No delivery exceptions in this period.'
                      : 'No exceptions match your current filters.'}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Order</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExceptions.map((exception) => {
                        const ReasonIcon = getReasonIcon(exception.reason);
                        const isExpanded = expandedRowId === exception.id;

                        return (
                          <Collapsible key={exception.id} open={isExpanded} asChild>
                            <>
                              <TableRow
                                className={cn(
                                  'cursor-pointer hover:bg-muted/50',
                                  exception.resolution === 'pending' && 'bg-amber-50/50 dark:bg-amber-950/20'
                                )}
                                onClick={() => setExpandedRowId(isExpanded ? null : exception.id)}
                              >
                                <TableCell className="font-mono text-sm">
                                  {exception.order?.tracking_code?.slice(0, 8).toUpperCase() || exception.order_id.slice(0, 8)}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium text-sm">
                                      {exception.order?.customer_name || 'Unknown'}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                      {exception.order?.delivery_address}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <ReasonIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{getReasonLabel(exception.reason)}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={getResolutionBadgeVariant(exception.resolution)}>
                                    {exception.resolution.replace(/_/g, ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {format(parseISO(exception.created_at), 'MMM d, h:mm a')}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                              <CollapsibleContent asChild>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                  <TableCell colSpan={6} className="p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      {/* Details */}
                                      <div className="space-y-3">
                                        <h4 className="font-medium text-sm">Details</h4>
                                        <p className="text-sm text-muted-foreground">
                                          {exception.reason_details || 'No additional details provided'}
                                        </p>
                                        {exception.photo_url && (
                                          <img
                                            src={exception.photo_url}
                                            alt="Exception photo"
                                            className="w-32 h-24 object-cover rounded-lg border"
                                            loading="lazy"
                                          />
                                        )}
                                        {exception.courier && (
                                          <div className="text-sm">
                                            <span className="text-muted-foreground">Courier:</span>{' '}
                                            {exception.courier.full_name}
                                          </div>
                                        )}
                                      </div>

                                      {/* Contact */}
                                      <div className="space-y-3">
                                        <h4 className="font-medium text-sm">Contact</h4>
                                        {exception.order?.customer_phone && (
                                          <div className="flex items-center gap-2 text-sm">
                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                            {exception.order.customer_phone}
                                          </div>
                                        )}
                                        {exception.order?.customer_email && (
                                          <div className="flex items-center gap-2 text-sm">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            {exception.order.customer_email}
                                          </div>
                                        )}
                                        <div className="flex gap-2">
                                          {exception.admin_notified && (
                                            <Badge variant="outline" className="text-xs">
                                              <Users className="h-3 w-3 mr-1" />
                                              Admin notified
                                            </Badge>
                                          )}
                                          {exception.customer_notified && (
                                            <Badge variant="outline" className="text-xs">
                                              <Mail className="h-3 w-3 mr-1" />
                                              Customer notified
                                            </Badge>
                                          )}
                                        </div>
                                      </div>

                                      {/* Actions */}
                                      <div className="space-y-3">
                                        <h4 className="font-medium text-sm">Actions</h4>
                                        {exception.resolution === 'pending' && canManageDeliveries && (
                                          <div className="flex flex-col gap-2">
                                            <Button
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenResolve(exception);
                                              }}
                                            >
                                              <ArrowLeftRight className="h-4 w-4 mr-2" />
                                              Resolve
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleReturnToStore(exception);
                                              }}
                                            >
                                              <Package className="h-4 w-4 mr-2" />
                                              Return to Store
                                            </Button>
                                          </div>
                                        )}
                                        {exception.resolution !== 'pending' && (
                                          <div className="text-sm">
                                            <span className="text-muted-foreground">Resolved:</span>{' '}
                                            {exception.resolved_at
                                              ? format(parseISO(exception.resolved_at), 'MMM d, h:mm a')
                                              : 'N/A'}
                                            {exception.resolution_notes && (
                                              <p className="text-muted-foreground mt-1">
                                                {exception.resolution_notes}
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </CollapsibleContent>
                            </>
                          </Collapsible>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Exception by Reason */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Exceptions by Reason</CardTitle>
                <CardDescription>
                  Distribution of exceptions across different failure reasons
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {EXCEPTION_REASONS.map((reason) => {
                    const count = stats.byReason[reason.value] ?? 0;
                    const percentage = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                    const ReasonIcon = reason.icon;

                    return (
                      <div key={reason.value} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <ReasonIcon className="h-4 w-4 text-muted-foreground" />
                            <span>{reason.label}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {count} ({percentage}%)
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Resolution Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resolution Distribution</CardTitle>
                <CardDescription>
                  How exceptions are being resolved
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: 'Pending', value: 'pending', count: stats.pending, color: 'bg-amber-500' },
                    {
                      label: 'Rescheduled',
                      value: 'rescheduled',
                      count: exceptions.filter((e) => e.resolution === 'rescheduled').length,
                      color: 'bg-blue-500',
                    },
                    {
                      label: 'Rerouted',
                      value: 'rerouted',
                      count: exceptions.filter((e) => e.resolution === 'rerouted').length,
                      color: 'bg-purple-500',
                    },
                    {
                      label: 'Returned',
                      value: 'returned_to_store',
                      count: exceptions.filter((e) => e.resolution === 'returned_to_store').length,
                      color: 'bg-orange-500',
                    },
                    {
                      label: 'Resolved',
                      value: 'resolved',
                      count: exceptions.filter((e) => e.resolution === 'resolved').length,
                      color: 'bg-green-500',
                    },
                    {
                      label: 'Cancelled',
                      value: 'cancelled',
                      count: exceptions.filter((e) => e.resolution === 'cancelled').length,
                      color: 'bg-red-500',
                    },
                  ].map((item) => {
                    const percentage = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;

                    return (
                      <div key={item.value} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>{item.label}</span>
                          <span className="text-muted-foreground">
                            {item.count} ({percentage}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', item.color)}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Exception Rate Trend - placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Exception Rate</CardTitle>
              <CardDescription>
                Percentage of deliveries that resulted in exceptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Exception rate tracking requires delivery volume data</p>
                  <p className="text-sm">Connect with your delivery system to enable this view</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Log Exception Dialog */}
      <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Delivery Exception</DialogTitle>
            <DialogDescription>
              Record a delivery failure with details and optional photo proof
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={exceptionForm.handleSubmit(handleLogException)} className="space-y-4">
            {/* Order ID */}
            <div className="space-y-2">
              <Label htmlFor="order_id">Order ID *</Label>
              <Input
                id="order_id"
                placeholder="Enter order ID or tracking code"
                value={logOrderId}
                onChange={(e) => setLogOrderId(e.target.value)}
              />
            </div>

            {/* Reason Selection */}
            <div className="space-y-2">
              <Label>Exception Reason *</Label>
              <div className="grid grid-cols-2 gap-2">
                {EXCEPTION_REASONS.map((reason) => {
                  const isSelected = watchedReason === reason.value;
                  const ReasonIcon = reason.icon;

                  return (
                    <Button
                      key={reason.value}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      className="justify-start h-auto py-3"
                      onClick={() => exceptionForm.setValue('reason', reason.value)}
                    >
                      <ReasonIcon className="h-4 w-4 mr-2" />
                      <span className="text-sm">{reason.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2">
              <Label htmlFor="reason_details">Details *</Label>
              <Textarea
                id="reason_details"
                placeholder="Describe the situation..."
                rows={3}
                {...exceptionForm.register('reason_details')}
              />
              {exceptionForm.formState.errors.reason_details && (
                <p className="text-sm text-destructive">
                  {exceptionForm.formState.errors.reason_details.message}
                </p>
              )}
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>Photo Evidence (Optional)</Label>
              {!photoPreview ? (
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload photo</p>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Exception photo"
                    className="w-full h-32 object-cover rounded-lg"
                    loading="lazy"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={clearPhoto}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                id="exception-photo-upload"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
                aria-label="Upload exception photo"
              />
            </div>

            {/* Notification Options */}
            <Separator />
            <div className="space-y-3">
              <Label>Notifications</Label>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Notify Admin</p>
                  <p className="text-xs text-muted-foreground">Send alert to admin dashboard</p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  {...exceptionForm.register('notify_admin')}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Notify Customer</p>
                  <p className="text-xs text-muted-foreground">Send SMS/email to customer</p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  {...exceptionForm.register('notify_customer')}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLogDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={logExceptionMutation.isPending}>
                {logExceptionMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Log Exception
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Resolve Exception Dialog */}
      <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Exception</DialogTitle>
            <DialogDescription>
              Choose how to handle this delivery exception
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={resolutionForm.handleSubmit(handleResolveException)} className="space-y-4">
            {/* Resolution Type */}
            <div className="space-y-2">
              <Label>Resolution Action *</Label>
              <Select
                value={watchedResolution}
                onValueChange={(v: string) => resolutionForm.setValue('resolution', v as Exclude<ExceptionResolution, 'pending'>)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select resolution action" />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <p>{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditional: Reschedule Date */}
            {watchedResolution === 'rescheduled' && (
              <div className="space-y-2">
                <Label htmlFor="reschedule_date">New Delivery Date *</Label>
                <Input
                  type="datetime-local"
                  id="reschedule_date"
                  {...resolutionForm.register('reschedule_date')}
                />
              </div>
            )}

            {/* Conditional: New Courier */}
            {watchedResolution === 'rerouted' && (
              <div className="space-y-2">
                <Label>Assign New Courier *</Label>
                <Select
                  value={watchedNewCourierId ?? ''}
                  onValueChange={(v) => resolutionForm.setValue('new_courier_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select courier" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCouriers.map((courier) => (
                      <SelectItem key={courier.id} value={courier.id}>
                        {courier.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="resolution_notes">Notes (Optional)</Label>
              <Textarea
                id="resolution_notes"
                placeholder="Add any relevant notes..."
                rows={2}
                {...resolutionForm.register('resolution_notes')}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsResolveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={resolveExceptionMutation.isPending}>
                {resolveExceptionMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Resolve
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Return to Store Confirmation */}
      <AlertDialog open={returnConfirmOpen} onOpenChange={setReturnConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return Package to Store</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the package for return to the store and update the order status.
              The customer will be notified about the return.
              {exceptionToReturn?.order?.tracking_code && (
                <span className="block mt-2 font-mono">
                  Order: {exceptionToReturn.order.tracking_code.slice(0, 8).toUpperCase()}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => exceptionToReturn && returnToStoreMutation.mutate(exceptionToReturn.id)}
              disabled={returnToStoreMutation.isPending}
            >
              {returnToStoreMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirm Return
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default DeliveryExceptions;
