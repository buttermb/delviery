import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical, Save, Loader2, AlertCircle, Settings2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useAvailableRunners } from '@/hooks/useAvailableRunners';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

// Rule condition types
const CONDITION_TYPES = [
  { value: 'order_total_min', label: 'Order total minimum ($)' },
  { value: 'order_total_max', label: 'Order total maximum ($)' },
  { value: 'delivery_zone', label: 'Delivery zone' },
  { value: 'product_category', label: 'Product category' },
  { value: 'customer_type', label: 'Customer type' },
  { value: 'time_of_day', label: 'Time of day' },
] as const;

// Schema for a single auto-assign rule
const autoAssignRuleSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Rule name is required'),
  enabled: z.boolean().default(true),
  priority: z.number().min(1).default(1),
  conditions: z.array(z.object({
    type: z.string(),
    operator: z.enum(['equals', 'greater_than', 'less_than', 'contains', 'in']),
    value: z.string(),
  })).min(1, 'At least one condition is required'),
  runner_id: z.string().min(1, 'Runner is required'),
});

// Schema for the entire form
const formSchema = z.object({
  enabled: z.boolean().default(false),
  rules: z.array(autoAssignRuleSchema).default([]),
});

type FormValues = z.infer<typeof formSchema>;
type AutoAssignRule = z.infer<typeof autoAssignRuleSchema>;

interface TenantSettings {
  id: string;
  tenant_id: string;
  order_auto_assign_enabled?: boolean;
  order_auto_assign_rules?: AutoAssignRule[];
  [key: string]: unknown;
}

/**
 * OrderAutoAssign - Settings component for configuring order auto-assignment rules
 *
 * Features:
 * - Enable/disable auto-assignment globally
 * - Create rules with conditions (order amount, zone, product category, etc.)
 * - Assign specific runners to rules
 * - Priority ordering for rules
 * - Rules stored in tenant_settings jsonb
 */
export function OrderAutoAssign() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  // Fetch available runners
  const { data: runners, isLoading: isLoadingRunners } = useAvailableRunners({
    onlyAvailable: false,
  });

  // Fetch current settings
  const { data: settings, isLoading: isLoadingSettings, error: settingsError } = useQuery({
    queryKey: ['tenant-settings', tenant?.id, 'order-auto-assign'],
    queryFn: async (): Promise<TenantSettings | null> => {
      if (!tenant?.id) return null;

      const { data, error } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch tenant settings', error, { component: 'OrderAutoAssign' });
        throw error;
      }

      return data as TenantSettings | null;
    },
    enabled: !!tenant?.id,
  });

  // Form setup
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      enabled: false,
      rules: [],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'rules',
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (settings) {
      form.reset({
        enabled: settings.order_auto_assign_enabled ?? false,
        rules: (settings.order_auto_assign_rules as AutoAssignRule[]) ?? [],
      });
    }
  }, [settings, form]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!tenant?.id) throw new Error('No tenant ID');

      const updateData = {
        tenant_id: tenant.id,
        order_auto_assign_enabled: values.enabled,
        order_auto_assign_rules: values.rules,
        updated_at: new Date().toISOString(),
      };

      // Upsert to handle both create and update
      const { error } = await supabase
        .from('tenant_settings')
        .upsert(updateData, {
          onConflict: 'tenant_id',
        });

      if (error) {
        logger.error('Failed to save auto-assign settings', error, { component: 'OrderAutoAssign' });
        throw error;
      }

      return values;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenant?.id] });
      toast.success('Auto-assign settings saved successfully');
    },
    onError: (error) => {
      logger.error('Save failed', error, { component: 'OrderAutoAssign' });
      toast.error('Failed to save settings. Please try again.');
    },
  });

  // Handle form submission
  const onSubmit = async (values: FormValues) => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync(values);
    } finally {
      setIsSaving(false);
    }
  };

  // Add a new rule
  const addRule = () => {
    append({
      id: crypto.randomUUID(),
      name: `Rule ${fields.length + 1}`,
      enabled: true,
      priority: fields.length + 1,
      conditions: [{ type: 'order_total_min', operator: 'greater_than', value: '' }],
      runner_id: '',
    });
  };

  // Get runner name by ID
  const getRunnerName = (runnerId: string): string => {
    const runner = runners?.find(r => r.id === runnerId);
    return runner?.full_name ?? 'Unknown Runner';
  };

  // Loading state
  if (isLoadingSettings || isLoadingRunners) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (settingsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Order Auto-Assignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load settings. Please refresh the page or try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Order Auto-Assignment
        </CardTitle>
        <CardDescription>
          Configure rules to automatically assign orders to specific runners based on conditions
          like order value, delivery zone, or product categories.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Global Enable Toggle */}
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Enable Auto-Assignment</FormLabel>
                    <FormDescription>
                      When enabled, new confirmed orders will be automatically assigned to runners
                      based on the rules below.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Rules Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Assignment Rules</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRule}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>

              {fields.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Settings2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No rules configured yet.</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add rules to automatically assign orders to runners.
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={addRule}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Rule
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <RuleCard
                      key={field.id}
                      index={index}
                      form={form}
                      runners={runners ?? []}
                      onRemove={() => remove(index)}
                      onMoveUp={() => index > 0 && move(index, index - 1)}
                      onMoveDown={() => index < fields.length - 1 && move(index, index + 1)}
                      isFirst={index === 0}
                      isLast={index === fields.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Active Rules Summary */}
            {fields.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Active Rules Summary</p>
                <div className="flex flex-wrap gap-2">
                  {fields
                    .filter((_, idx) => form.watch(`rules.${idx}.enabled`))
                    .map((field) => {
                      const fieldIndex = fields.indexOf(field);
                      const runnerId = form.watch(`rules.${fieldIndex}.runner_id`);
                      return (
                        <Badge key={field.id} variant="secondary">
                          {form.watch(`rules.${fieldIndex}.name`)} → {getRunnerName(runnerId)}
                        </Badge>
                      );
                    })}
                  {fields.filter((_, i) => form.watch(`rules.${i}.enabled`)).length === 0 && (
                    <span className="text-sm text-muted-foreground">No active rules</span>
                  )}
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={isSaving}
              >
                Reset
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// Rule Card Component
interface RuleCardProps {
  index: number;
  form: ReturnType<typeof useForm<FormValues>>;
  runners: Array<{ id: string; full_name: string; status: string }>;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function RuleCard({
  index,
  form,
  runners,
  onRemove,
  onMoveUp,
  onMoveDown: _onMoveDown,
  isFirst,
  isLast: _isLast,
}: RuleCardProps) {
  const { fields: conditionFields, append: appendCondition, remove: removeCondition } = useFieldArray({
    control: form.control,
    name: `rules.${index}.conditions`,
  });

  const isEnabled = form.watch(`rules.${index}.enabled`);

  return (
    <div className={`border rounded-lg p-4 space-y-4 ${!isEnabled ? 'opacity-60' : ''}`}>
      {/* Rule Header */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveUp}
            disabled={isFirst}
          >
            <GripVertical className="h-4 w-4 rotate-90" />
          </Button>
        </div>

        <FormField
          control={form.control}
          name={`rules.${index}.name`}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input placeholder="Rule name" {...field} className="font-medium" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`rules.${index}.enabled`}
          render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <Label className="text-sm">{field.value ? 'Active' : 'Inactive'}</Label>
            </FormItem>
          )}
        />

        <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Conditions */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Conditions (all must match)</Label>
        {conditionFields.map((condField, condIndex) => (
          <div key={condField.id} className="flex items-center gap-2">
            <FormField
              control={form.control}
              name={`rules.${index}.conditions.${condIndex}.type`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CONDITION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`rules.${index}.conditions.${condIndex}.operator`}
              render={({ field }) => (
                <FormItem>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Operator" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="equals">equals</SelectItem>
                      <SelectItem value="greater_than">greater than</SelectItem>
                      <SelectItem value="less_than">less than</SelectItem>
                      <SelectItem value="contains">contains</SelectItem>
                      <SelectItem value="in">in list</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`rules.${index}.conditions.${condIndex}.value`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input placeholder="Value" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeCondition(condIndex)}
              disabled={conditionFields.length <= 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => appendCondition({ type: 'order_total_min', operator: 'greater_than', value: '' })}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Condition
        </Button>
      </div>

      {/* Runner Assignment */}
      <FormField
        control={form.control}
        name={`rules.${index}.runner_id`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Assign to Runner</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a runner" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {runners.map((runner) => (
                  <SelectItem key={runner.id} value={runner.id}>
                    <div className="flex items-center gap-2">
                      <span>{runner.full_name}</span>
                      <Badge variant={runner.status === 'available' ? 'default' : 'secondary'} className="text-xs">
                        {runner.status}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              Orders matching this rule will be automatically assigned to this runner.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Priority */}
      <FormField
        control={form.control}
        name={`rules.${index}.priority`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Priority</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={1}
                {...field}
                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
              />
            </FormControl>
            <FormDescription>
              Lower numbers are evaluated first. Use priority to control rule order.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export default OrderAutoAssign;
