import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SafeModal } from "@/components/ui/safe-modal";
import { DialogFooterActions } from "@/components/ui/dialog-footer-actions";
import { Card, CardContent } from "@/components/ui/card";
import { useRecurringInvoices, RecurringLineItem, RecurringSchedule, CreateScheduleInput } from "@/hooks/useRecurringInvoices";
import { useClients } from "@/hooks/crm/useClients";
import { formatCurrency } from "@/lib/utils/formatCurrency";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name must be 200 characters or less"),
  client_id: z.string().min(1, "Client is required"),
  frequency: z.enum(["weekly", "biweekly", "monthly", "quarterly", "yearly"]),
  next_run_date: z.string().min(1, "Start date is required"),
  day_of_month: z.number().optional(),
  auto_send_email: z.boolean(),
  notes: z.string().max(1000, "Notes must be 1000 characters or less").optional(),
});

type FormData = z.infer<typeof schema>;

interface RecurringInvoiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSchedule?: RecurringSchedule;
}

export function RecurringInvoiceForm({ open, onOpenChange, editSchedule }: RecurringInvoiceFormProps) {
  const { createSchedule, updateSchedule } = useRecurringInvoices();
  const [lineItems, setLineItems] = useState<RecurringLineItem[]>(
    editSchedule?.line_items || [{ description: "", quantity: 1, unit_price: 0 }]
  );

  const { data: clients = [], isLoading: clientsLoading, isError: clientsError, refetch: refetchClients } = useClients();

  const { register, handleSubmit, watch, setValue, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editSchedule ? {
      name: editSchedule.name,
      client_id: editSchedule.client_id,
      frequency: editSchedule.frequency,
      next_run_date: editSchedule.next_run_date,
      day_of_month: editSchedule.day_of_month,
      auto_send_email: editSchedule.auto_send_email,
      notes: editSchedule.notes || "",
    } : {
      frequency: "monthly",
      auto_send_email: false,
      next_run_date: new Date().toISOString().split("T")[0],
    }
  });

  const frequency = watch("frequency");
  const isSubmitting = createSchedule.isPending || updateSchedule.isPending;

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unit_price: 0 }]);
  };

  const updateLineItem = (index: number, field: keyof RecurringLineItem, value: string | number) => {
    const updated = [...lineItems];
    let safeValue = value;
    if (field === 'quantity') safeValue = Math.max(1, Number(value));
    if (field === 'unit_price') safeValue = Math.max(0, Number(value));
    updated[index] = { ...updated[index], [field]: safeValue };
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const total = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const onSubmit = async (data: FormData) => {
    const input: CreateScheduleInput = {
      name: data.name,
      client_id: data.client_id,
      frequency: data.frequency,
      next_run_date: data.next_run_date,
      line_items: lineItems.filter(item => item.description),
      template_id: null,
      is_active: true,
      day_of_month: data.day_of_month || null,
      auto_send_email: data.auto_send_email,
      notes: data.notes || null,
    };

    if (editSchedule) {
      await updateSchedule.mutateAsync({ id: editSchedule.id, ...input });
    } else {
      await createSchedule.mutateAsync(input);
    }
    onOpenChange(false);
  };

  return (
    <SafeModal
      open={open}
      onOpenChange={onOpenChange}
      isDirty={isDirty}
      title={editSchedule ? "Edit Recurring Invoice" : "Create Recurring Invoice"}
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Schedule Name <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
              <Input {...register("name")} placeholder="Monthly Retainer" maxLength={200} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Client <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
              {clientsLoading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading clients...</span>
                </div>
              ) : clientsError ? (
                <div className="flex items-center gap-2 py-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">Failed to load clients</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => refetchClients()}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Retry
                  </Button>
                </div>
              ) : clients.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No clients found. Create a client first.</p>
              ) : (
                <Select
                  value={watch("client_id")}
                  onValueChange={(v) => setValue("client_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.client_id && <p className="text-sm text-destructive">{errors.client_id.message}</p>}
            </div>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frequency <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
              <Select
                value={frequency}
                onValueChange={(v) => setValue("frequency", v as FormData["frequency"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              {errors.frequency && <p className="text-sm text-destructive">{errors.frequency.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>First Invoice Date <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
              <Input type="date" {...register("next_run_date")} />
              {errors.next_run_date && <p className="text-sm text-destructive">{errors.next_run_date.message}</p>}
            </div>
          </div>

          {frequency === "monthly" && (
            <div className="space-y-2">
              <Label>Day of Month (optional)</Label>
              <Input
                type="number"
                min={1}
                max={28}
                placeholder="e.g., 1 for 1st of month"
                onChange={(e) => setValue("day_of_month", parseInt(e.target.value) || undefined)}
              />
            </div>
          )}

          {/* Line Items */}
          <div className="space-y-3">
            <Label>Line Items</Label>
            {lineItems.map((item, index) => (
              <Card key={index}>
                <CardContent className="p-3">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, "quantity", parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Price"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                        disabled={lineItems.length === 1}
                        aria-label="Remove line item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
            <div className="text-right font-semibold">
              Total per Invoice: {formatCurrency(total)}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-send Email</Label>
                <p className="text-sm text-muted-foreground">Automatically email invoice when generated</p>
              </div>
              <Switch
                checked={watch("auto_send_email")}
                onCheckedChange={(v) => setValue("auto_send_email", v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea {...register("notes")} placeholder="Internal notes about this schedule..." maxLength={1000} />
              {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
            </div>
          </div>

          <DialogFooterActions
            primaryLabel={editSchedule ? "Update Schedule" : "Create Schedule"}
            onPrimary={() => {}}
            primaryLoading={isSubmitting}
            secondaryLabel="Cancel"
            onSecondary={() => onOpenChange(false)}
          />
        </form>
    </SafeModal>
  );
}
