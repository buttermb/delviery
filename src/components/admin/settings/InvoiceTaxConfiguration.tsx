import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { Receipt, Loader2, Plus, Trash2 } from "lucide-react";

const taxConfigSchema = z.object({
  default_tax_rate: z.number().min(0).max(100),
  tax_name: z.string().max(100),
  tax_number: z.string().max(100).optional(),
  tax_inclusive: z.boolean(),
  apply_tax_to_shipping: z.boolean(),
  compound_tax: z.boolean(),
});

type TaxConfigFormData = z.infer<typeof taxConfigSchema>;

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  description?: string;
}

interface InvoiceTaxConfigurationProps {
  tenantId: string;
  currentConfig?: Partial<TaxConfigFormData>;
  customRates?: TaxRate[];
  onSave?: (config: TaxConfigFormData) => Promise<void>;
  onAddCustomRate?: (rate: Omit<TaxRate, "id">) => Promise<void>;
  onDeleteCustomRate?: (rateId: string) => Promise<void>;
}

/**
 * Task 306: Add invoice tax configuration per tenant
 * Configure default tax rates, tax-inclusive pricing, and custom tax rates
 */
export function InvoiceTaxConfiguration({
  tenantId,
  currentConfig,
  customRates = [],
  onSave,
  onAddCustomRate,
  onDeleteCustomRate,
}: InvoiceTaxConfigurationProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showAddRate, setShowAddRate] = useState(false);
  const [newRate, setNewRate] = useState({ name: "", rate: 0, description: "" });

  const form = useForm<TaxConfigFormData>({
    resolver: zodResolver(taxConfigSchema),
    defaultValues: {
      default_tax_rate: currentConfig?.default_tax_rate || 0,
      tax_name: currentConfig?.tax_name || "Tax",
      tax_number: currentConfig?.tax_number || "",
      tax_inclusive: currentConfig?.tax_inclusive || false,
      apply_tax_to_shipping: currentConfig?.apply_tax_to_shipping || false,
      compound_tax: currentConfig?.compound_tax || false,
    },
  });

  const onSubmit = async (data: TaxConfigFormData) => {
    setIsSaving(true);
    try {
      await onSave?.(data);
      logger.info("Tax configuration updated", { tenantId, data });
      toast.success("Tax configuration saved");
    } catch (error) {
      logger.error("Failed to save tax configuration", { error });
      toast.error("Failed to save tax configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCustomRate = async () => {
    if (!newRate.name || newRate.rate <= 0) {
      toast.error("Please enter a valid rate name and percentage");
      return;
    }

    try {
      await onAddCustomRate?.({
        name: newRate.name,
        rate: newRate.rate,
        description: newRate.description,
      });
      toast.success("Custom tax rate added");
      setNewRate({ name: "", rate: 0, description: "" });
      setShowAddRate(false);
    } catch (error) {
      logger.error("Failed to add custom rate", { error });
      toast.error("Failed to add custom rate");
    }
  };

  const handleDeleteRate = async (rateId: string) => {
    if (!confirm("Delete this tax rate?")) return;

    try {
      await onDeleteCustomRate?.(rateId);
      toast.success("Tax rate deleted");
    } catch (error) {
      logger.error("Failed to delete tax rate", { error });
      toast.error("Failed to delete tax rate");
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Tax Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            Invoice Tax Configuration
          </CardTitle>
          <CardDescription>
            Configure default tax settings for invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tax_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Name</FormLabel>
                      <FormControl>
                        <Input placeholder="GST, VAT, Sales Tax" maxLength={100} {...field} />
                      </FormControl>
                      <FormDescription>Display name on invoices</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="default_tax_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Tax Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>Applied to all new invoices</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="tax_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Number (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="ABN, VAT Number, EIN" maxLength={100} {...field} />
                    </FormControl>
                    <FormDescription>Your business tax registration number</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3 border-t pt-4">
                <FormField
                  control={form.control}
                  name="tax_inclusive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Tax-Inclusive Pricing</FormLabel>
                        <FormDescription>
                          Prices already include tax (tax is extracted from total)
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apply_tax_to_shipping"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Tax on Shipping</FormLabel>
                        <FormDescription>
                          Apply tax to delivery/shipping charges
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="compound_tax"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Compound Tax</FormLabel>
                        <FormDescription>
                          Apply tax on top of other taxes (rare)
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Custom Tax Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom Tax Rates</CardTitle>
          <CardDescription>
            Create multiple tax rates for different products or regions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {customRates.length > 0 && (
            <div className="space-y-2">
              {customRates.map((rate) => (
                <div
                  key={rate.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-semibold">{rate.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {rate.rate}%{rate.description && ` • ${rate.description}`}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDeleteRate(rate.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {showAddRate ? (
            <div className="space-y-3 p-4 border rounded-lg">
              <Input
                placeholder="Rate Name (e.g., Reduced Rate)"
                value={newRate.name}
                onChange={(e) => setNewRate({ ...newRate, name: e.target.value })}
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="Rate %"
                value={newRate.rate || ""}
                onChange={(e) => setNewRate({ ...newRate, rate: Number(e.target.value) })}
              />
              <Input
                placeholder="Description (optional)"
                value={newRate.description}
                onChange={(e) => setNewRate({ ...newRate, description: e.target.value })}
              />
              <div className="flex gap-2">
                <Button onClick={handleAddCustomRate} size="sm">
                  Add Rate
                </Button>
                <Button
                  onClick={() => setShowAddRate(false)}
                  size="sm"
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setShowAddRate(true)} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Custom Rate
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
