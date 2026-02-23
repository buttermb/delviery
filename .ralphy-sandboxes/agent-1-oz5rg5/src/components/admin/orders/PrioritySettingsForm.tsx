/**
 * Priority Settings Form Component
 *
 * Form for configuring tenant-specific order priority rules.
 * Includes settings for VIP customers, large orders, wholesale defaults,
 * urgent delivery thresholds, and notification preferences.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import {
  usePrioritySettings,
  useUpdatePrioritySettings,
} from '@/hooks/useOrderPriority';
import Save from 'lucide-react/dist/esm/icons/save';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Crown from 'lucide-react/dist/esm/icons/crown';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import Building from 'lucide-react/dist/esm/icons/building';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Bell from 'lucide-react/dist/esm/icons/bell';

const prioritySettingsSchema = z.object({
  vip_customer_priority: z.enum(['normal', 'high', 'urgent']),
  large_order_threshold: z.coerce.number().min(0),
  large_order_priority: z.enum(['normal', 'high', 'urgent']),
  wholesale_default_priority: z.enum(['low', 'normal', 'high']),
  urgent_delivery_hours: z.coerce.number().min(1).max(48),
  urgent_delivery_priority: z.enum(['high', 'urgent']),
  auto_priority_enabled: z.boolean(),
  notify_on_urgent: z.boolean(),
  notify_on_high: z.boolean(),
});

type PrioritySettingsFormValues = z.infer<typeof prioritySettingsSchema>;

interface PrioritySettingsFormProps {
  className?: string;
}

export function PrioritySettingsForm({ className }: PrioritySettingsFormProps) {
  const { data: settings, isLoading } = usePrioritySettings();
  const updateSettings = useUpdatePrioritySettings();

  const form = useForm<PrioritySettingsFormValues>({
    resolver: zodResolver(prioritySettingsSchema),
    values: settings
      ? {
          vip_customer_priority: settings.vip_customer_priority,
          large_order_threshold: settings.large_order_threshold / 100, // Convert cents to dollars
          large_order_priority: settings.large_order_priority,
          wholesale_default_priority: settings.wholesale_default_priority,
          urgent_delivery_hours: settings.urgent_delivery_hours,
          urgent_delivery_priority: settings.urgent_delivery_priority,
          auto_priority_enabled: settings.auto_priority_enabled,
          notify_on_urgent: settings.notify_on_urgent,
          notify_on_high: settings.notify_on_high,
        }
      : undefined,
  });

  const onSubmit = (values: PrioritySettingsFormValues) => {
    updateSettings.mutate({
      ...values,
      large_order_threshold: values.large_order_threshold * 100, // Convert dollars to cents
    });
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Priority Settings</CardTitle>
        <CardDescription>
          Configure automatic priority assignment rules for orders
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Auto-priority toggle */}
            <FormField
              control={form.control}
              name="auto_priority_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Auto-Priority</FormLabel>
                    <FormDescription>
                      Automatically assign priority based on rules below
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* VIP Customer Priority */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                <h4 className="font-medium">VIP Customers</h4>
              </div>
              <FormField
                control={form.control}
                name="vip_customer_priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VIP Customer Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Priority assigned to orders from VIP customers
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Large Order Rules */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <h4 className="font-medium">Large Orders</h4>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="large_order_threshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Threshold ($)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">
                            $
                          </span>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="pl-7"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Orders above this amount
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="large_order_priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Large Order Priority</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Wholesale Default */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-blue-500" />
                <h4 className="font-medium">Wholesale Orders</h4>
              </div>
              <FormField
                control={form.control}
                name="wholesale_default_priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Wholesale Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Default priority for wholesale orders
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Urgent Delivery */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <h4 className="font-medium">Scheduled Delivery</h4>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="urgent_delivery_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Urgent Threshold (hours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={48}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Mark urgent when delivery is within this time
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="urgent_delivery_priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Approaching Delivery Priority</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Notification Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-purple-500" />
                <h4 className="font-medium">Notifications</h4>
              </div>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="notify_on_urgent"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Urgent Order Notifications</FormLabel>
                        <FormDescription>
                          Get notified when an urgent order is created
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notify_on_high"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>High Priority Notifications</FormLabel>
                        <FormDescription>
                          Get notified when a high priority order is created
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default PrioritySettingsForm;
