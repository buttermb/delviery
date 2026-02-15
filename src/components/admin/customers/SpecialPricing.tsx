/**
 * SpecialPricing Component
 *
 * Manages customer-specific and group-specific pricing rules.
 * Supports percentage discounts or fixed price overrides with
 * optional date ranges for promotional pricing.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  DollarSign,
  Percent,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Package,
  Users,
  User,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

type DiscountType = 'percentage' | 'fixed';

interface CustomerPricing {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  customer_group_id: string | null;
  product_id: string;
  discount_type: DiscountType;
  discount_value: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  customer?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  customer_group?: {
    id: string;
    name: string;
  } | null;
  product?: {
    id: string;
    name: string;
    price: number;
  } | null;
}

interface Customer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface CustomerGroup {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

// ============================================================================
// Form Schema
// ============================================================================

const pricingFormSchema = z.object({
  target_type: z.enum(['customer', 'group']),
  customer_id: z.string().optional(),
  customer_group_id: z.string().optional(),
  product_id: z.string().min(1, 'Product is required'),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.coerce.number().min(0, 'Value must be positive'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  is_active: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.target_type === 'customer') {
      return !!data.customer_id;
    }
    return !!data.customer_group_id;
  },
  {
    message: 'Please select a customer or customer group',
    path: ['customer_id'],
  }
).refine(
  (data) => {
    if (data.discount_type === 'percentage') {
      return data.discount_value <= 100;
    }
    return true;
  },
  {
    message: 'Percentage cannot exceed 100%',
    path: ['discount_value'],
  }
);

type PricingFormValues = z.infer<typeof pricingFormSchema>;

// ============================================================================
// Props
// ============================================================================

interface SpecialPricingProps {
  /** Optional: Filter to a specific customer */
  customerId?: string;
  /** Optional: Filter to a specific customer group */
  customerGroupId?: string;
  /** Compact mode for embedding in detail views */
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SpecialPricing({
  customerId,
  customerGroupId,
  compact = false,
}: SpecialPricingProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState<CustomerPricing | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pricingToDelete, setPricingToDelete] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  // Fetch pricing rules
  const {
    data: pricingRules,
    isLoading: isPricingLoading,
    isError: isPricingError,
    error: pricingError,
  } = useQuery({
    queryKey: ['customer-pricing', tenantId, customerId, customerGroupId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');

      let query = (supabase as any)
        .from('customer_pricing')
        .select(`
          *,
          customer:customers(id, first_name, last_name, email),
          customer_group:customer_groups(id, name),
          product:products(id, name, price)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (customerGroupId) {
        query = query.eq('customer_group_id', customerGroupId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch customer pricing rules', error, {
          tenantId,
          customerId,
          customerGroupId,
          component: 'SpecialPricing',
        });
        throw error;
      }

      return data as unknown as CustomerPricing[];
    },
    enabled: !!tenantId,
  });

  // Fetch customers for dropdown
  const { data: customers } = useQuery({
    queryKey: ['customers-dropdown', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email')
        .eq('tenant_id', tenantId)
        .order('first_name', { ascending: true });

      if (error) {
        logger.error('Failed to fetch customers', error, {
          component: 'SpecialPricing',
        });
        return [];
      }

      return data as Customer[];
    },
    enabled: !!tenantId && !customerId,
  });

  // Fetch customer groups for dropdown
  const { data: customerGroups } = useQuery({
    queryKey: ['customer-groups-dropdown', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await (supabase as any)
        .from('customer_groups')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (error) {
        logger.error('Failed to fetch customer groups', error, {
          component: 'SpecialPricing',
        });
        return [];
      }

      return data as CustomerGroup[];
    },
    enabled: !!tenantId && !customerGroupId,
  });

  // Fetch products for dropdown
  const { data: products } = useQuery({
    queryKey: ['products-dropdown', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (error) {
        logger.error('Failed to fetch products', error, {
          component: 'SpecialPricing',
        });
        return [];
      }

      return data as Product[];
    },
    enabled: !!tenantId,
  });

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: async (values: PricingFormValues) => {
      if (!tenantId) throw new Error('Tenant ID is required');

      const insertData = {
        tenant_id: tenantId,
        customer_id: values.target_type === 'customer' ? values.customer_id : null,
        customer_group_id: values.target_type === 'group' ? values.customer_group_id : null,
        product_id: values.product_id,
        discount_type: values.discount_type,
        discount_value: values.discount_value,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        is_active: values.is_active,
      };

      const { data, error } = await (supabase as any)
        .from('customer_pricing')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        logger.error('Failed to create pricing rule', error, {
          component: 'SpecialPricing',
        });
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-pricing'] });
      toast.success('Pricing rule created successfully');
      setDialogOpen(false);
    },
    onError: (error: unknown) => {
      logger.error('Create pricing rule error', error, {
        component: 'SpecialPricing',
      });
      toast.error('Failed to create pricing rule');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: PricingFormValues;
    }) => {
      if (!tenantId) throw new Error('Tenant ID is required');

      const updateData = {
        customer_id: values.target_type === 'customer' ? values.customer_id : null,
        customer_group_id: values.target_type === 'group' ? values.customer_group_id : null,
        product_id: values.product_id,
        discount_type: values.discount_type,
        discount_value: values.discount_value,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        is_active: values.is_active,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await (supabase as any)
        .from('customer_pricing')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update pricing rule', error, {
          component: 'SpecialPricing',
        });
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-pricing'] });
      toast.success('Pricing rule updated successfully');
      setDialogOpen(false);
      setEditingPricing(null);
    },
    onError: (error: unknown) => {
      logger.error('Update pricing rule error', error, {
        component: 'SpecialPricing',
      });
      toast.error('Failed to update pricing rule');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant ID is required');

      const { error } = await (supabase as any)
        .from('customer_pricing')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to delete pricing rule', error, {
          component: 'SpecialPricing',
        });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-pricing'] });
      toast.success('Pricing rule deleted');
      setDeleteConfirmOpen(false);
      setPricingToDelete(null);
    },
    onError: (error: unknown) => {
      logger.error('Delete pricing rule error', error, {
        component: 'SpecialPricing',
      });
      toast.error('Failed to delete pricing rule');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      if (!tenantId) throw new Error('Tenant ID is required');

      const { error } = await (supabase as any)
        .from('customer_pricing')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to toggle pricing rule', error, {
          component: 'SpecialPricing',
        });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-pricing'] });
    },
    onError: (error: unknown) => {
      logger.error('Toggle pricing rule error', error, {
        component: 'SpecialPricing',
      });
      toast.error('Failed to update pricing rule');
    },
  });

  // -------------------------------------------------------------------------
  // Form
  // -------------------------------------------------------------------------

  const form = useForm<PricingFormValues>({
    resolver: zodResolver(pricingFormSchema),
    defaultValues: {
      target_type: customerId ? 'customer' : customerGroupId ? 'group' : 'customer',
      customer_id: customerId || '',
      customer_group_id: customerGroupId || '',
      product_id: '',
      discount_type: 'percentage',
      discount_value: 0,
      start_date: '',
      end_date: '',
      is_active: true,
    },
  });

  const targetType = form.watch('target_type');
  const discountType = form.watch('discount_type');
  const selectedProductId = form.watch('product_id');

  // Calculate effective price preview
  const effectivePrice = useMemo(() => {
    const product = products?.find((p) => p.id === selectedProductId);
    if (!product) return null;

    const discountValue = form.watch('discount_value');

    if (discountType === 'percentage') {
      return product.price * (1 - discountValue / 100);
    }
    return discountValue;
  }, [products, selectedProductId, discountType, form]);

  const handleOpenCreate = () => {
    setEditingPricing(null);
    form.reset({
      target_type: customerId ? 'customer' : customerGroupId ? 'group' : 'customer',
      customer_id: customerId || '',
      customer_group_id: customerGroupId || '',
      product_id: '',
      discount_type: 'percentage',
      discount_value: 0,
      start_date: '',
      end_date: '',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (pricing: CustomerPricing) => {
    setEditingPricing(pricing);
    form.reset({
      target_type: pricing.customer_id ? 'customer' : 'group',
      customer_id: pricing.customer_id || '',
      customer_group_id: pricing.customer_group_id || '',
      product_id: pricing.product_id,
      discount_type: pricing.discount_type,
      discount_value: pricing.discount_value,
      start_date: pricing.start_date || '',
      end_date: pricing.end_date || '',
      is_active: pricing.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setPricingToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const onSubmit = (values: PricingFormValues) => {
    if (editingPricing) {
      updateMutation.mutate({ id: editingPricing.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const getStatusBadge = (pricing: CustomerPricing) => {
    const now = new Date();
    const startDate = pricing.start_date ? new Date(pricing.start_date) : null;
    const endDate = pricing.end_date ? new Date(pricing.end_date) : null;

    if (!pricing.is_active) {
      return (
        <Badge variant="secondary" className="gap-1">
          <XCircle className="w-3 h-3" />
          Inactive
        </Badge>
      );
    }

    if (startDate && now < startDate) {
      return (
        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
          <Calendar className="w-3 h-3" />
          Scheduled
        </Badge>
      );
    }

    if (endDate && now > endDate) {
      return (
        <Badge variant="secondary" className="gap-1 text-muted-foreground">
          <AlertCircle className="w-3 h-3" />
          Expired
        </Badge>
      );
    }

    return (
      <Badge variant="default" className="gap-1 bg-emerald-500">
        <CheckCircle className="w-3 h-3" />
        Active
      </Badge>
    );
  };

  const formatDiscount = (pricing: CustomerPricing) => {
    if (pricing.discount_type === 'percentage') {
      return `${pricing.discount_value}% off`;
    }
    return `$${pricing.discount_value.toFixed(2)} (fixed)`;
  };

  const getTargetLabel = (pricing: CustomerPricing) => {
    if (pricing.customer) {
      const name = [pricing.customer.first_name, pricing.customer.last_name]
        .filter(Boolean)
        .join(' ');
      return name || pricing.customer.email || 'Unknown Customer';
    }
    if (pricing.customer_group) {
      return pricing.customer_group.name;
    }
    return 'Unknown';
  };

  // -------------------------------------------------------------------------
  // Loading State
  // -------------------------------------------------------------------------

  if (isPricingLoading) {
    return (
      <Card className={compact ? 'border-0 shadow-none' : ''}>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            Special Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Error State
  // -------------------------------------------------------------------------

  if (isPricingError) {
    logger.error(
      'Error displaying special pricing',
      pricingError instanceof Error ? pricingError : new Error(String(pricingError)),
      { component: 'SpecialPricing' }
    );
    return (
      <Card className={compact ? 'border-0 shadow-none' : ''}>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            Special Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>Unable to load pricing rules. Please try again later.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <Card className={compact ? 'border-0 shadow-none' : ''}>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                Special Pricing
              </CardTitle>
              {!compact && (
                <CardDescription>
                  Manage custom pricing rules for customers and groups
                </CardDescription>
              )}
            </div>
            <Button onClick={handleOpenCreate} size={compact ? 'sm' : 'default'}>
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent className={compact ? 'pt-0' : ''}>
          {!pricingRules || pricingRules.length === 0 ? (
            <EnhancedEmptyState
              icon={DollarSign}
              title="No Pricing Rules"
              description="Create custom pricing rules for specific customers or groups."
              primaryAction={{
                label: 'Add Pricing Rule',
                onClick: handleOpenCreate,
              }}
              compact={compact}
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricingRules.map((pricing) => (
                    <TableRow key={pricing.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {pricing.customer_id ? (
                            <User className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Users className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">{getTargetLabel(pricing)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span>{pricing.product?.name || 'Unknown Product'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {pricing.discount_type === 'percentage' ? (
                            <Percent className="w-3 h-3" />
                          ) : (
                            <DollarSign className="w-3 h-3" />
                          )}
                          {formatDiscount(pricing)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {pricing.start_date || pricing.end_date ? (
                          <span className="text-sm text-muted-foreground">
                            {pricing.start_date
                              ? format(new Date(pricing.start_date), 'MMM d, yyyy')
                              : 'Any'}{' '}
                            -{' '}
                            {pricing.end_date
                              ? format(new Date(pricing.end_date), 'MMM d, yyyy')
                              : 'Ongoing'}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Always</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(pricing)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={pricing.is_active}
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({
                                id: pricing.id,
                                isActive: checked,
                              })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(pricing)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(pricing.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingPricing ? 'Edit Pricing Rule' : 'Create Pricing Rule'}
            </DialogTitle>
            <DialogDescription>
              Set custom pricing for a specific customer or customer group.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Target Type */}
              {!customerId && !customerGroupId && (
                <FormField
                  control={form.control}
                  name="target_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apply To</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue placeholder="Select target type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="customer">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              Individual Customer
                            </div>
                          </SelectItem>
                          <SelectItem value="group">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              Customer Group
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Customer Select */}
              {targetType === 'customer' && !customerId && (
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue placeholder="Select a customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers?.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {[customer.first_name, customer.last_name]
                                .filter(Boolean)
                                .join(' ') || customer.email || 'Unknown'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Customer Group Select */}
              {targetType === 'group' && !customerGroupId && (
                <FormField
                  control={form.control}
                  name="customer_group_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Group</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue placeholder="Select a group" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customerGroups?.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Product Select */}
              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products?.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} (${product.price.toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Discount Type */}
              <FormField
                control={form.control}
                name="discount_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue placeholder="Select discount type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">
                          <div className="flex items-center gap-2">
                            <Percent className="w-4 h-4" />
                            Percentage Discount
                          </div>
                        </SelectItem>
                        <SelectItem value="fixed">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Fixed Price
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Discount Value */}
              <FormField
                control={form.control}
                name="discount_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {discountType === 'percentage' ? 'Discount Percentage' : 'Fixed Price'}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {discountType === 'percentage' ? '%' : '$'}
                        </span>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          max={discountType === 'percentage' ? '100' : undefined}
                          step="0.01"
                          className="pl-8 min-h-[44px]"
                        />
                      </div>
                    </FormControl>
                    {effectivePrice !== null && discountType === 'percentage' && (
                      <FormDescription>
                        Effective price: ${effectivePrice.toFixed(2)}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="min-h-[44px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="min-h-[44px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Active Toggle */}
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Enable or disable this pricing rule
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingPricing ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pricing Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this pricing rule? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pricingToDelete && deleteMutation.mutate(pricingToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================================
// Utility Function for Order Creation
// ============================================================================

/**
 * Fetch applicable special pricing for a customer when creating orders.
 * Returns pricing rules that are currently active and applicable.
 */
export async function getApplicableSpecialPricing(
  tenantId: string,
  customerId: string,
  customerGroupId?: string | null
): Promise<CustomerPricing[]> {
  const now = new Date().toISOString();

  let query = (supabase as any)
    .from('customer_pricing')
    .select(`
      *,
      product:products(id, name, price)
    `)
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  // Build OR conditions for customer and group
  if (customerGroupId) {
    query = query.or(`customer_id.eq.${customerId},customer_group_id.eq.${customerGroupId}`);
  } else {
    query = query.eq('customer_id', customerId);
  }

  // Filter by date range
  query = query
    .or(`start_date.is.null,start_date.lte.${now}`)
    .or(`end_date.is.null,end_date.gte.${now}`);

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to fetch applicable special pricing', error, {
      tenantId,
      customerId,
      customerGroupId,
    });
    return [];
  }

  return data as unknown as CustomerPricing[];
}

/**
 * Calculate the effective price for a product given special pricing rules.
 */
export function calculateEffectivePrice(
  originalPrice: number,
  pricingRule: CustomerPricing | null
): number {
  if (!pricingRule) return originalPrice;

  if (pricingRule.discount_type === 'percentage') {
    return originalPrice * (1 - pricingRule.discount_value / 100);
  }

  return pricingRule.discount_value;
}
