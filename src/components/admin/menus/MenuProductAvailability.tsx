/**
 * Menu Product Availability Rules Component
 *
 * Manages product availability rules for disposable menus.
 * Features:
 * - Time window rules (available only during specific hours)
 * - Day of week rules (available only on certain days)
 * - Quantity limit rules (limited per menu session)
 * - Bundle-only rules (not sold individually)
 * - Real-time availability evaluation
 * - Connect to scheduling module
 */

import { useState, useMemo, useCallback } from 'react';

import Clock from 'lucide-react/dist/esm/icons/clock';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import Package from 'lucide-react/dist/esm/icons/package';
import Boxes from 'lucide-react/dist/esm/icons/boxes';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Edit2 from 'lucide-react/dist/esm/icons/edit-2';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';
import Check from 'lucide-react/dist/esm/icons/check';
import X from 'lucide-react/dist/esm/icons/x';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Info from 'lucide-react/dist/esm/icons/info';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  useMenuProductAvailabilityRules,
  useCreateAvailabilityRule,
  useUpdateAvailabilityRule,
  useDeleteAvailabilityRule,
  useResetRuleQuantities,
  type AvailabilityRule,
  type AvailabilityRuleType,
  type CreateRuleInput,
} from '@/hooks/useMenuProductAvailability';
import {
  evaluateProductAvailability,
  getRuleSummary,
  getRemainingQuantity,
} from '@/lib/menus/availabilityEngine';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

// Types
interface MenuProduct {
  id: string;
  productId: string;
  name: string;
  price: number;
  imageUrl?: string;
  category?: string;
}

interface MenuProductAvailabilityProps {
  menuId: string;
  menuProducts: MenuProduct[];
  className?: string;
}

interface RuleFormData {
  ruleType: AvailabilityRuleType;
  startHour: number | null;
  endHour: number | null;
  allowedDays: number[];
  maxQuantity: number | null;
  hideWhenUnavailable: boolean;
  unavailableMessage: string;
}

// Constants
const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun', fullLabel: 'Sunday' },
  { value: 1, label: 'Mon', fullLabel: 'Monday' },
  { value: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { value: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { value: 4, label: 'Thu', fullLabel: 'Thursday' },
  { value: 5, label: 'Fri', fullLabel: 'Friday' },
  { value: 6, label: 'Sat', fullLabel: 'Saturday' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`,
}));

const RULE_TYPES: { value: AvailabilityRuleType; label: string; icon: typeof Clock; description: string }[] = [
  {
    value: 'time_window',
    label: 'Time Window',
    icon: Clock,
    description: 'Available only during specific hours',
  },
  {
    value: 'day_of_week',
    label: 'Days Available',
    icon: Calendar,
    description: 'Available only on certain days',
  },
  {
    value: 'quantity_limit',
    label: 'Quantity Limit',
    icon: Package,
    description: 'Limited quantity per menu session',
  },
  {
    value: 'bundle_only',
    label: 'Bundle Only',
    icon: Boxes,
    description: 'Only available as part of a bundle',
  },
];

// Helper to get rule type info
const getRuleTypeInfo = (ruleType: AvailabilityRuleType) => {
  return RULE_TYPES.find((r) => r.value === ruleType) || RULE_TYPES[0];
};

// Rule Icon Component
function RuleIcon({ ruleType, className }: { ruleType: AvailabilityRuleType; className?: string }) {
  const info = getRuleTypeInfo(ruleType);
  const IconComponent = info.icon;
  return <IconComponent className={className} />;
}

// Product Rule Card
function ProductRuleCard({
  product,
  rules,
  onAddRule,
  onEditRule,
  onDeleteRule,
  onToggleRule,
}: {
  product: MenuProduct;
  rules: AvailabilityRule[];
  onAddRule: (productId: string) => void;
  onEditRule: (rule: AvailabilityRule) => void;
  onDeleteRule: (ruleId: string) => void;
  onToggleRule: (rule: AvailabilityRule) => void;
}) {
  // Evaluate current availability
  const availability = useMemo(() => {
    return evaluateProductAvailability(rules);
  }, [rules]);

  return (
    <Card className={cn(!availability.isAvailable && 'border-amber-500/50 bg-amber-50/30')}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-12 h-12 rounded-lg object-cover shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm truncate">{product.name}</CardTitle>
              {availability.isAvailable ? (
                <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-50 shrink-0">
                  <Check className="w-3 h-3 mr-1" />
                  Available
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-50 shrink-0">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {availability.hideProduct ? 'Hidden' : 'Unavailable'}
                </Badge>
              )}
            </div>
            {product.category && (
              <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
            )}
            {!availability.isAvailable && availability.unavailableReason && (
              <p className="text-xs text-amber-600 mt-1">{availability.unavailableReason}</p>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={() => onAddRule(product.productId)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Rule
          </Button>
        </div>
      </CardHeader>

      {rules.length > 0 && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {rules.map((rule) => {
              const remaining = getRemainingQuantity(rule);

              return (
                <div
                  key={rule.id}
                  className={cn(
                    'flex items-center gap-3 p-2.5 rounded-lg border transition-colors',
                    rule.isActive
                      ? 'bg-background border-border'
                      : 'bg-muted/50 border-muted text-muted-foreground'
                  )}
                >
                  <div className="shrink-0">
                    <RuleIcon
                      ruleType={rule.ruleType}
                      className={cn('w-4 h-4', rule.isActive ? 'text-primary' : 'text-muted-foreground')}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {getRuleTypeInfo(rule.ruleType).label}
                      </span>
                      {!rule.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          Disabled
                        </Badge>
                      )}
                      {rule.hideWhenUnavailable && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <EyeOff className="w-3 h-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>Hidden when unavailable</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {getRuleSummary(rule)}
                    </p>
                    {remaining !== null && rule.isActive && (
                      <div className="flex items-center gap-1 mt-1">
                        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              remaining === 0
                                ? 'bg-red-500'
                                : remaining <= (rule.maxQuantity || 0) * 0.2
                                  ? 'bg-amber-500'
                                  : 'bg-green-500'
                            )}
                            style={{
                              width: `${Math.max(0, (remaining / (rule.maxQuantity || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {remaining} left
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11"
                            onClick={() => onToggleRule(rule)}
                          >
                            {rule.isActive ? (
                              <X className="w-3.5 h-3.5" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {rule.isActive ? 'Disable rule' : 'Enable rule'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11"
                            onClick={() => onEditRule(rule)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit rule</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-destructive hover:text-destructive"
                            onClick={() => onDeleteRule(rule.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete rule</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Rule Form Dialog
function RuleFormDialog({
  isOpen,
  onClose,
  productId: _productId,
  productName,
  existingRule,
  onSave,
  isSaving,
}: {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  existingRule?: AvailabilityRule;
  onSave: (data: RuleFormData) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<RuleFormData>(() => ({
    ruleType: existingRule?.ruleType || 'time_window',
    startHour: existingRule?.startHour ?? 9,
    endHour: existingRule?.endHour ?? 17,
    allowedDays: existingRule?.allowedDays || [1, 2, 3, 4, 5], // Weekdays by default
    maxQuantity: existingRule?.maxQuantity ?? 10,
    hideWhenUnavailable: existingRule?.hideWhenUnavailable ?? false,
    unavailableMessage: existingRule?.unavailableMessage || '',
  }));

  const handleSave = () => {
    onSave(formData);
  };

  const toggleDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      allowedDays: prev.allowedDays.includes(day)
        ? prev.allowedDays.filter((d) => d !== day)
        : [...prev.allowedDays, day].sort(),
    }));
  };

  const selectPresetDays = (preset: 'weekdays' | 'weekends' | 'all') => {
    if (preset === 'weekdays') {
      setFormData((prev) => ({ ...prev, allowedDays: [1, 2, 3, 4, 5] }));
    } else if (preset === 'weekends') {
      setFormData((prev) => ({ ...prev, allowedDays: [0, 6] }));
    } else {
      setFormData((prev) => ({ ...prev, allowedDays: [0, 1, 2, 3, 4, 5, 6] }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {existingRule ? 'Edit Availability Rule' : 'Add Availability Rule'}
          </DialogTitle>
          <DialogDescription>
            Configure when <strong>{productName}</strong> is available on this menu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Rule Type Selection */}
          {!existingRule && (
            <div className="space-y-3">
              <Label>Rule Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {RULE_TYPES.map((type) => {
                  const IconComponent = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, ruleType: type.value }))}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors',
                        formData.ruleType === type.value
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      )}
                    >
                      <IconComponent className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{type.label}</p>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Separator />

          {/* Time Window Configuration */}
          {formData.ruleType === 'time_window' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Product will only be available during these hours</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Select
                    value={String(formData.startHour)}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, startHour: parseInt(v) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Start time" />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((hour) => (
                        <SelectItem key={hour.value} value={String(hour.value)}>
                          {hour.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Select
                    value={String(formData.endHour)}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, endHour: parseInt(v) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="End time" />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((hour) => (
                        <SelectItem key={hour.value} value={String(hour.value)}>
                          {hour.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Day of Week Configuration */}
          {formData.ruleType === 'day_of_week' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Product will only be available on selected days</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      'px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors',
                      formData.allowedDays.includes(day.value)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted hover:border-primary/50'
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectPresetDays('weekdays')}
                >
                  Weekdays
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectPresetDays('weekends')}
                >
                  Weekends
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectPresetDays('all')}
                >
                  All Days
                </Button>
              </div>
            </div>
          )}

          {/* Quantity Limit Configuration */}
          {formData.ruleType === 'quantity_limit' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="w-4 h-4" />
                <span>Limit how many can be sold per menu session</span>
              </div>

              <div className="space-y-2">
                <Label>Maximum Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  max={9999}
                  value={formData.maxQuantity || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      maxQuantity: e.target.value ? parseInt(e.target.value) : null,
                    }))
                  }
                  placeholder="e.g., 10"
                />
                <p className="text-xs text-muted-foreground">
                  Once this quantity is ordered, the product will show as sold out.
                </p>
              </div>
            </div>
          )}

          {/* Bundle Only Configuration */}
          {formData.ruleType === 'bundle_only' && (
            <div className="space-y-4">
              <Alert>
                <Boxes className="w-4 h-4" />
                <AlertTitle>Bundle Only</AlertTitle>
                <AlertDescription>
                  This product will not be available for individual purchase on this menu.
                  Customers can only get it as part of a bundle or deal.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <Separator />

          {/* Display Settings */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Display Settings</Label>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Hide when unavailable</Label>
                <p className="text-xs text-muted-foreground">
                  Completely hide the product instead of showing as unavailable
                </p>
              </div>
              <Switch
                checked={formData.hideWhenUnavailable}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, hideWhenUnavailable: checked }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Custom unavailable message (optional)</Label>
              <Textarea
                value={formData.unavailableMessage}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, unavailableMessage: e.target.value }))
                }
                placeholder="e.g., Available during lunch hours only"
                rows={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {existingRule ? 'Update Rule' : 'Add Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Component
export function MenuProductAvailability({
  menuId,
  menuProducts,
  className,
}: MenuProductAvailabilityProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // State
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<AvailabilityRule | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  // Data fetching
  const { data: allRules = [], isLoading } = useMenuProductAvailabilityRules(menuId, tenantId);

  // Mutations
  const createRule = useCreateAvailabilityRule();
  const updateRule = useUpdateAvailabilityRule();
  const deleteRule = useDeleteAvailabilityRule();
  const resetQuantities = useResetRuleQuantities();

  // Group rules by product
  const rulesByProduct = useMemo(() => {
    const map = new Map<string, AvailabilityRule[]>();
    for (const rule of allRules) {
      const existing = map.get(rule.productId) ?? [];
      existing.push(rule);
      map.set(rule.productId, existing);
    }
    return map;
  }, [allRules]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    menuProducts.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [menuProducts]);

  // Filter products by category
  const filteredProducts = useMemo(() => {
    if (filterCategory === 'all') return menuProducts;
    return menuProducts.filter((p) => p.category === filterCategory);
  }, [menuProducts, filterCategory]);

  // Count unavailable products
  const unavailableCount = useMemo(() => {
    let count = 0;
    for (const product of menuProducts) {
      const rules = rulesByProduct.get(product.productId) ?? [];
      const result = evaluateProductAvailability(rules);
      if (!result.isAvailable) count++;
    }
    return count;
  }, [menuProducts, rulesByProduct]);

  // Handlers
  const handleAddRule = useCallback((productId: string) => {
    setSelectedProductId(productId);
    setEditingRule(null);
    setIsFormOpen(true);
  }, []);

  const handleEditRule = useCallback((rule: AvailabilityRule) => {
    setSelectedProductId(rule.productId);
    setEditingRule(rule);
    setIsFormOpen(true);
  }, []);

  const handleConfirmDeleteRule = useCallback(
    async () => {
      if (!tenantId || !ruleToDelete) return;
      await deleteRule.mutateAsync({ id: ruleToDelete, tenantId });
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    },
    [tenantId, deleteRule, ruleToDelete]
  );

  const handleDeleteRule = useCallback(
    (ruleId: string) => {
      setRuleToDelete(ruleId);
      setDeleteDialogOpen(true);
    },
    []
  );

  const handleToggleRule = useCallback(
    async (rule: AvailabilityRule) => {
      if (!tenantId) return;
      await updateRule.mutateAsync({
        id: rule.id,
        tenantId,
        isActive: !rule.isActive,
      });
    },
    [tenantId, updateRule]
  );

  const handleSaveRule = useCallback(
    async (formData: RuleFormData) => {
      if (!tenantId || !selectedProductId) return;

      try {
        if (editingRule) {
          await updateRule.mutateAsync({
            id: editingRule.id,
            tenantId,
            ...formData,
            allowedDays: formData.ruleType === 'day_of_week' ? formData.allowedDays : null,
          });
        } else {
          const input: CreateRuleInput = {
            menuId,
            productId: selectedProductId,
            tenantId,
            ruleType: formData.ruleType,
            hideWhenUnavailable: formData.hideWhenUnavailable,
            unavailableMessage: formData.unavailableMessage || undefined,
          };

          if (formData.ruleType === 'time_window') {
            input.startHour = formData.startHour;
            input.endHour = formData.endHour;
          } else if (formData.ruleType === 'day_of_week') {
            input.allowedDays = formData.allowedDays;
          } else if (formData.ruleType === 'quantity_limit') {
            input.maxQuantity = formData.maxQuantity;
          }

          await createRule.mutateAsync(input);
        }

        setIsFormOpen(false);
        setSelectedProductId(null);
        setEditingRule(null);
      } catch (error) {
        logger.error('Failed to save rule', { error });
      }
    },
    [tenantId, selectedProductId, menuId, editingRule, createRule, updateRule]
  );

  const handleResetQuantities = useCallback(async () => {
    if (!tenantId) return;
    await resetQuantities.mutateAsync({ menuId, tenantId });
  }, [tenantId, menuId, resetQuantities]);

  // Get selected product for dialog
  const selectedProduct = menuProducts.find((p) => p.productId === selectedProductId);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Check if there are any quantity limit rules
  const hasQuantityRules = allRules.some((r) => r.ruleType === 'quantity_limit');

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Product Availability Rules</h2>
          <p className="text-sm text-muted-foreground">
            Control when products are available on this menu
          </p>
        </div>

        {hasQuantityRules && (
          <Button
            variant="outline"
            onClick={handleResetQuantities}
            disabled={resetQuantities.isPending}
          >
            {resetQuantities.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4 mr-2" />
            )}
            Reset Quantities
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm">
            <strong>{menuProducts.length}</strong> products
          </span>
        </div>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <span className="text-sm">
            <strong>{unavailableCount}</strong> currently unavailable
          </span>
        </div>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" />
          <span className="text-sm">
            <strong>{allRules.length}</strong> active rules
          </span>
        </div>
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground shrink-0">Filter by category:</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Products List */}
      <ScrollArea className="h-[600px] pr-4">
        <div className="space-y-4">
          {filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No products in this menu</p>
              </CardContent>
            </Card>
          ) : (
            filteredProducts.map((product) => (
              <ProductRuleCard
                key={product.id}
                product={product}
                rules={rulesByProduct.get(product.productId) ?? []}
                onAddRule={handleAddRule}
                onEditRule={handleEditRule}
                onDeleteRule={handleDeleteRule}
                onToggleRule={handleToggleRule}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Rule Form Dialog */}
      {isFormOpen && selectedProduct && (
        <RuleFormDialog
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setSelectedProductId(null);
            setEditingRule(null);
          }}
          productId={selectedProduct.productId}
          productName={selectedProduct.name}
          existingRule={editingRule || undefined}
          onSave={handleSaveRule}
          isSaving={createRule.isPending || updateRule.isPending}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDeleteRule}
        itemType="availability rule"
        isLoading={deleteRule.isPending}
      />
    </div>
  );
}

export default MenuProductAvailability;
