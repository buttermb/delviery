import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Calendar,
  Repeat,
  Package,
  Truck,
  Loader2,
  Play,
  Pause,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SafeModal } from "@/components/ui/safe-modal";
import { DialogFooterActions } from "@/components/ui/dialog-footer-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  useRecurringOrders,
  RecurringOrderItem,
  RecurringOrderSchedule,
  CreateRecurringOrderInput,
  RecurringOrderFrequency,
} from "@/hooks/useRecurringOrders";
import { useWholesaleClients, useWholesaleCouriers, useProductsForWholesale } from "@/hooks/useWholesaleData";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Schedule name is required"),
  client_id: z.string().min(1, "Client is required"),
  frequency: z.enum(["weekly", "biweekly", "monthly", "quarterly"]),
  next_order_date: z.string().min(1, "Start date is required"),
  day_of_week: z.number().nullable(),
  day_of_month: z.number().nullable(),
  auto_confirm: z.boolean(),
  auto_assign_runner: z.boolean(),
  preferred_runner_id: z.string().nullable(),
  delivery_address: z.string().nullable(),
  delivery_notes: z.string().nullable(),
  notes: z.string().nullable(),
});

type FormData = z.infer<typeof schema>;

interface RecurringOrderSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSchedule?: RecurringOrderSchedule;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const FREQUENCY_OPTIONS: { value: RecurringOrderFrequency; label: string; description: string }[] = [
  { value: "weekly", label: "Weekly", description: "Every week on the same day" },
  { value: "biweekly", label: "Bi-Weekly", description: "Every two weeks" },
  { value: "monthly", label: "Monthly", description: "Once per month" },
  { value: "quarterly", label: "Quarterly", description: "Every three months" },
];

function RecurringOrderSetupComponent({
  open,
  onOpenChange,
  editSchedule,
}: RecurringOrderSetupProps) {
  const { tenant } = useTenantAdminAuth();
  const { createSchedule, updateSchedule } = useRecurringOrders();
  const { data: clients = [] } = useWholesaleClients();
  const { data: couriers = [] } = useWholesaleCouriers();
  const { data: products = [] } = useProductsForWholesale();

  const [orderItems, setOrderItems] = useState<RecurringOrderItem[]>(
    editSchedule?.order_items || [{ product_name: "", quantity: 1, unit_price: 0 }]
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editSchedule
      ? {
          name: editSchedule.name,
          client_id: editSchedule.client_id,
          frequency: editSchedule.frequency,
          next_order_date: editSchedule.next_order_date.split("T")[0],
          day_of_week: editSchedule.day_of_week,
          day_of_month: editSchedule.day_of_month,
          auto_confirm: editSchedule.auto_confirm,
          auto_assign_runner: editSchedule.auto_assign_runner,
          preferred_runner_id: editSchedule.preferred_runner_id,
          delivery_address: editSchedule.delivery_address,
          delivery_notes: editSchedule.delivery_notes,
          notes: editSchedule.notes,
        }
      : {
          frequency: "weekly",
          auto_confirm: false,
          auto_assign_runner: false,
          next_order_date: new Date().toISOString().split("T")[0],
          day_of_week: null,
          day_of_month: null,
          preferred_runner_id: null,
          delivery_address: null,
          delivery_notes: null,
          notes: null,
        },
  });

  const frequency = watch("frequency");
  const clientId = watch("client_id");
  const autoAssignRunner = watch("auto_assign_runner");
  const isSubmitting = createSchedule.isPending || updateSchedule.isPending;

  // Get selected client details
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId]
  );

  // Update delivery address when client changes
  const handleClientChange = (id: string) => {
    setValue("client_id", id);
    const client = clients.find((c) => c.id === id) as any;
    // Use email as fallback since address may not exist on wholesale_clients
    if (!watch("delivery_address") && client) {
      setValue("delivery_address", client.email || '');
    }
  };

  // Order items management
  const addOrderItem = () => {
    setOrderItems([...orderItems, { product_name: "", quantity: 1, unit_price: 0 }]);
  };

  const updateOrderItem = (
    index: number,
    field: keyof RecurringOrderItem,
    value: string | number
  ) => {
    const updated = [...orderItems];
    updated[index] = { ...updated[index], [field]: value };
    setOrderItems(updated);
  };

  const handleProductSelect = (index: number, productName: string) => {
    const product = products.find((p: { product_name: string }) => p.product_name === productName);
    const updated = [...orderItems];
    updated[index] = {
      ...updated[index],
      product_name: productName,
      unit_price: product?.base_price || 0,
    };
    setOrderItems(updated);
  };

  const removeOrderItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter((_, i) => i !== index));
    }
  };

  const orderTotal = orderItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  const onSubmit = async (data: FormData) => {
    const validItems = orderItems.filter((item) => item.product_name);
    if (validItems.length === 0) {
      return;
    }

    const input: CreateRecurringOrderInput = {
      name: data.name,
      client_id: data.client_id,
      order_items: validItems,
      frequency: data.frequency,
      next_order_date: data.next_order_date,
      day_of_week: data.frequency === "weekly" || data.frequency === "biweekly"
        ? data.day_of_week
        : null,
      day_of_month: data.frequency === "monthly" || data.frequency === "quarterly"
        ? data.day_of_month
        : null,
      auto_confirm: data.auto_confirm,
      auto_assign_runner: data.auto_assign_runner,
      preferred_runner_id: data.auto_assign_runner ? data.preferred_runner_id : null,
      delivery_address: data.delivery_address,
      delivery_notes: data.delivery_notes,
      is_active: true,
      notes: data.notes,
    };

    if (editSchedule) {
      await updateSchedule.mutateAsync({ id: editSchedule.id, ...input });
    } else {
      await createSchedule.mutateAsync(input);
    }

    reset();
    setOrderItems([{ product_name: "", quantity: 1, unit_price: 0 }]);
    onOpenChange(false);
  };

  // Check if form has meaningful changes
  const hasOrderItemChanges = useMemo(() => {
    const validItems = orderItems.filter((item) => item.product_name);
    return validItems.length > 0;
  }, [orderItems]);

  return (
    <SafeModal
      open={open}
      onOpenChange={onOpenChange}
      isDirty={isDirty || hasOrderItemChanges}
      title={editSchedule ? "Edit Recurring Order" : "Create Recurring Order"}
      description="Set up a subscription-style order that automatically repeats on a schedule"
      className="max-w-3xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Schedule Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="e.g., Weekly Restock for ABC Dispensary"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Client <span className="text-destructive">*</span>
            </Label>
            <Select value={clientId} onValueChange={handleClientChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex items-center gap-2">
                      <span>{client.business_name}</span>
                      {client.outstanding_balance > 0 && (
                        <Badge variant="outline" className="text-xs text-yellow-600">
                          {formatCurrency(client.outstanding_balance)} owed
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.client_id && (
              <p className="text-sm text-destructive">{errors.client_id.message}</p>
            )}
          </div>
        </div>

        {/* Selected Client Info */}
        {selectedClient && (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Contact</span>
                  <p className="font-medium">{selectedClient.contact_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Credit Limit</span>
                  <p className="font-medium font-mono">
                    {formatCurrency(selectedClient.credit_limit)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Available</span>
                  <p className="font-medium font-mono text-emerald-600">
                    {formatCurrency(
                      selectedClient.credit_limit - selectedClient.outstanding_balance
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant={selectedClient.status === "active" ? "default" : "secondary"}
                    className="mt-1"
                  >
                    {selectedClient.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Schedule Settings */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            Schedule Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(v) => setValue("frequency", v as RecurringOrderFrequency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div>
                        <span>{opt.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({opt.description})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>First Order Date</Label>
              <Input type="date" {...register("next_order_date")} />
              {errors.next_order_date && (
                <p className="text-sm text-destructive">
                  {errors.next_order_date.message}
                </p>
              )}
            </div>
          </div>

          {/* Frequency-specific options */}
          {(frequency === "weekly" || frequency === "biweekly") && (
            <div className="space-y-2">
              <Label>Preferred Day of Week</Label>
              <Select
                value={watch("day_of_week")?.toString() || ""}
                onValueChange={(v) => setValue("day_of_week", v ? parseInt(v) : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No preference</SelectItem>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(frequency === "monthly" || frequency === "quarterly") && (
            <div className="space-y-2">
              <Label>Day of Month</Label>
              <Input
                type="number"
                min={1}
                max={28}
                placeholder="e.g., 1 for 1st of month"
                onChange={(e) =>
                  setValue("day_of_month", e.target.value ? parseInt(e.target.value) : null)
                }
                value={watch("day_of_month") || ""}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use the same day as the first order date
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Order Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Order Items
            </h3>
            <Badge variant="outline">{orderItems.length} items</Badge>
          </div>

          <div className="space-y-3">
            {orderItems.map((item, index) => (
              <Card key={index}>
                <CardContent className="p-3">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Select
                        value={item.product_name}
                        onValueChange={(v) => handleProductSelect(index, v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product: { id: string; product_name: string; base_price: number }) => (
                            <SelectItem key={product.id} value={product.product_name}>
                              <div className="flex items-center justify-between w-full">
                                <span>{product.product_name}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  {formatCurrency(product.base_price)}/unit
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) =>
                          updateOrderItem(index, "quantity", parseInt(e.target.value) || 1)
                        }
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Price"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateOrderItem(index, "unit_price", parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="col-span-1 text-right font-mono text-sm">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOrderItem(index)}
                        disabled={orderItems.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOrderItem}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Button>

            <div className="flex justify-end pt-2 border-t">
              <div className="text-right">
                <span className="text-sm text-muted-foreground">Order Total:</span>
                <p className="text-xl font-bold font-mono">{formatCurrency(orderTotal)}</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Delivery & Automation */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            Delivery & Automation
          </h3>

          <div className="space-y-2">
            <Label>Delivery Address</Label>
            <Input
              {...register("delivery_address")}
              placeholder="Enter delivery address or use client's default"
            />
            {(selectedClient as any)?.email && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setValue("delivery_address", (selectedClient as any).email)}
              >
                Use client's email: {(selectedClient as any).email}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label>Delivery Notes</Label>
            <Textarea
              {...register("delivery_notes")}
              placeholder="Special delivery instructions..."
              rows={2}
            />
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Confirm Orders</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically confirm orders when created
                </p>
              </div>
              <Switch
                checked={watch("auto_confirm")}
                onCheckedChange={(v) => setValue("auto_confirm", v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Assign Runner</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically assign to a preferred runner
                </p>
              </div>
              <Switch
                checked={autoAssignRunner}
                onCheckedChange={(v) => setValue("auto_assign_runner", v)}
              />
            </div>

            {autoAssignRunner && (
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                <Label>Preferred Runner</Label>
                <Select
                  value={watch("preferred_runner_id") || ""}
                  onValueChange={(v) => setValue("preferred_runner_id", v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select runner" />
                  </SelectTrigger>
                  <SelectContent>
                    {couriers.map((courier: { id: string; full_name: string; status?: string }) => (
                      <SelectItem key={courier.id} value={courier.id}>
                        <div className="flex items-center gap-2">
                          <span>{courier.full_name}</span>
                          {courier.status && (
                            <Badge
                              variant={courier.status === "available" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {courier.status}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Notes */}
        <div className="space-y-2">
          <Label>Internal Notes</Label>
          <Textarea
            {...register("notes")}
            placeholder="Notes about this recurring order schedule..."
            rows={2}
          />
        </div>

        {/* Summary Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Schedule Summary</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This order will automatically create a{" "}
                  <span className="font-medium">{formatCurrency(orderTotal)}</span> order{" "}
                  <span className="font-medium">
                    {frequency === "weekly" && "every week"}
                    {frequency === "biweekly" && "every two weeks"}
                    {frequency === "monthly" && "every month"}
                    {frequency === "quarterly" && "every three months"}
                  </span>
                  {selectedClient && (
                    <>
                      {" "}for{" "}
                      <span className="font-medium">{selectedClient.business_name}</span>
                    </>
                  )}
                  , starting from{" "}
                  <span className="font-medium">
                    {new Date(watch("next_order_date") || "").toLocaleDateString()}
                  </span>
                  .
                </p>
                {watch("auto_confirm") && (
                  <Badge variant="outline" className="mt-2 mr-2 text-xs">
                    Auto-confirms
                  </Badge>
                )}
                {autoAssignRunner && watch("preferred_runner_id") && (
                  <Badge variant="outline" className="mt-2 text-xs">
                    Auto-assigns runner
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <DialogFooterActions
          primaryLabel={editSchedule ? "Update Schedule" : "Create Schedule"}
          onPrimary={() => {}}
          primaryLoading={isSubmitting}
          primaryDisabled={!hasOrderItemChanges}
          secondaryLabel="Cancel"
          onSecondary={() => onOpenChange(false)}
        />
      </form>
    </SafeModal>
  );
}

export { RecurringOrderSetupComponent as RecurringOrderSetup };
