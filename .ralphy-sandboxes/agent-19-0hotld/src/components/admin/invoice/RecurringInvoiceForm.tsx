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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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

  const form = useForm<FormData>({
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

  const frequency = form.watch("frequency");
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
      isDirty={form.formState.isDirty}
      title={editSchedule ? "Edit Recurring Invoice" : "Create Recurring Invoice"}
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Schedule Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Monthly Retainer" maxLength={200} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Client</FormLabel>
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
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
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
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Frequency</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="next_run_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>First Invoice Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {frequency === "monthly" && (
              <FormField
                control={form.control}
                name="day_of_month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of Month (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={28}
                        placeholder="e.g., 1 for 1st of month"
                        value={field.value ?? ""}
                        onChange={(e) => { const parsed = parseInt(e.target.value, 10); field.onChange(Number.isNaN(parsed) ? undefined : parsed); }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <FormField
                control={form.control}
                name="auto_send_email"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div>
                      <FormLabel>Auto-send Email</FormLabel>
                      <p className="text-sm text-muted-foreground">Automatically email invoice when generated</p>
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
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Internal notes about this schedule..." maxLength={1000} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooterActions
              primaryLabel={editSchedule ? "Update Schedule" : "Create Schedule"}
              onPrimary={() => {}}
              primaryLoading={isSubmitting}
              secondaryLabel="Cancel"
              onSecondary={() => onOpenChange(false)}
            />
          </form>
        </Form>
    </SafeModal>
  );
}
