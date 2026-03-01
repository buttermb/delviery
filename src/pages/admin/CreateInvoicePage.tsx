import { useState } from "react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useForm } from "react-hook-form";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "@/components/unsaved-changes";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, ArrowLeft, Loader2, Save } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useCreateInvoice } from "@/hooks/crm/useInvoices";
import { useLogActivity } from "@/hooks/crm/useActivityLog";
import { useAccount } from "@/contexts/AccountContext";
import { useCreditGatedAction } from "@/hooks/useCredits";
import { logger } from '@/lib/logger';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { ClientSelector } from "@/components/crm/ClientSelector";
import { DisabledTooltip } from "@/components/shared/DisabledTooltip";
import { LineItemsEditor } from "@/components/crm/LineItemsEditor";
import { LineItem } from "@/types/crm";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/formatCurrency";

const formSchema = z.object({
    client_id: z.string().min(1, "Client is required"),
    issue_date: z.date(),
    due_date: z.date(),
    status: z.enum(["draft", "sent", "paid"]),
    tax_rate: z.coerce.number().min(0, "Sales tax cannot be negative").max(100, "Sales tax cannot exceed 100%"),
    notes: z.string().max(1000, "Notes must be 1000 characters or less").optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateInvoicePage() {
    const { tenant } = useTenantAdminAuth();
    const { navigateToAdmin, navigate } = useTenantNavigation();
    const { account, loading: accountLoading } = useAccount();
    const accountId = account?.id ?? null;
    const isAccountReady = !accountLoading && !!accountId;
    const accountError = !accountLoading && !accountId
        ? 'Account context not available. Please refresh the page or contact support.'
        : null;
    const createInvoice = useCreateInvoice();
    const logActivity = useLogActivity();
    const [lineItems, setLineItems] = useState<LineItem[]>([]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            issue_date: new Date(),
            due_date: addDays(new Date(), 7),
            status: "draft",
            tax_rate: 0,
            notes: "",
        },
    });

    const { showBlockerDialog, confirmLeave, cancelLeave } = useUnsavedChanges({
        isDirty: form.formState.isDirty || lineItems.length > 0,
    });

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const taxRate = form.watch("tax_rate");
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const { execute: executeCreditAction } = useCreditGatedAction();

    const onSubmit = async (values: FormValues) => {
        if (!accountId) {
            toast.error('Account information not available');
            return;
        }

        if (lineItems.length === 0) {
            toast.error("Please add at least one line item");
            return;
        }

        await executeCreditAction('invoice_create', async () => {
            try {
                const invoice = await createInvoice.mutateAsync({
                    account_id: accountId,
                    client_id: values.client_id,
                    invoice_date: values.issue_date.toISOString().split('T')[0],
                    due_date: values.due_date.toISOString().split('T')[0],
                    status: values.status,
                    line_items: lineItems,
                    tax_rate: taxRate,
                    subtotal,
                    tax_amount: taxAmount,
                    total,
                    notes: values.notes,
                });

                // Log activity
                logActivity.mutate({
                    client_id: values.client_id,
                    activity_type: "invoice_created",
                    description: `Invoice #${invoice.invoice_number} created`,
                    reference_id: invoice.id,
                    reference_type: "crm_invoices",
                });

                toast.success("Invoice created successfully");
                if (tenant?.slug) {
                    navigate(`/${tenant.slug}/admin/crm/invoices/${invoice.id}`);
                }
            } catch (error: unknown) {
                logger.error('Failed to create invoice', error, {
                    component: 'CreateInvoicePage',
                    clientId: values.client_id
                });
                throw error; // Re-throw to be handled by executeCreditAction if desired, though hook handles generic errors, we might want to let toast propagate from here?
                // Actually the existing code had a try/catch logging error.
                // useCreditGatedAction catches unexpected errors.
                // But createInvoice hook might throw specific errors.
            }
        });
    };

    return (
        <div className="space-y-4 p-4 pb-16 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigateToAdmin('crm/invoices')} aria-label="Back to invoices">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Create Invoice</h1>
                    <p className="text-muted-foreground">
                        Create a new invoice for a client.
                    </p>
                </div>
            </div>

            {accountError && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{accountError}</AlertDescription>
                </Alert>
            )}

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Client & Dates */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Invoice Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="client_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel required>Client</FormLabel>
                                            <FormControl>
                                                <ClientSelector
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    error={form.formState.errors.client_id?.message}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="issue_date"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel required>Issue Date</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                                variant={"outline"}
                                                                className={cn(
                                                                    "w-full pl-3 text-left font-normal",
                                                                    !field.value && "text-muted-foreground"
                                                                )}
                                                            >
                                                                {field.value ? (
                                                                    format(field.value, "PPP")
                                                                ) : (
                                                                    <span>Pick a date</span>
                                                                )}
                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            selected={field.value}
                                                            onSelect={field.onChange}
                                                            disabled={(date) =>
                                                                date > new Date() || date < new Date("1900-01-01")
                                                            }
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="due_date"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel required>Due Date</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                                variant={"outline"}
                                                                className={cn(
                                                                    "w-full pl-3 text-left font-normal",
                                                                    !field.value && "text-muted-foreground"
                                                                )}
                                                            >
                                                                {field.value ? (
                                                                    format(field.value, "PPP")
                                                                ) : (
                                                                    <span>Pick a date</span>
                                                                )}
                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            selected={field.value}
                                                            onSelect={field.onChange}
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel required>Status</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="draft">Draft</SelectItem>
                                                    <SelectItem value="sent">Sent</SelectItem>
                                                    <SelectItem value="paid">Paid</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Notes & Settings */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Additional Info</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="tax_rate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Sales Tax (%)</FormLabel>
                                            <FormControl>
                                                <Input type="number" min="0" max="100" step="0.1" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Notes</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Add any notes or payment instructions..."
                                                    className="min-h-[120px]"
                                                    maxLength={1000}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Line Items */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Line Items</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <LineItemsEditor items={lineItems} onChange={setLineItems} />

                            <div className="mt-6 flex flex-col items-end gap-2 text-sm">
                                <div className="flex justify-between w-48">
                                    <span className="text-muted-foreground">Subtotal:</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between w-48">
                                    <span className="text-muted-foreground">Tax ({taxRate}%):</span>
                                    <span>{formatCurrency(taxAmount)}</span>
                                </div>
                                <div className="flex justify-between w-48 pt-2 border-t font-bold text-lg">
                                    <span>Total:</span>
                                    <span>{formatCurrency(total)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-4">
                        <Button variant="outline" type="button" onClick={() => navigateToAdmin('crm/invoices')}>
                            Cancel
                        </Button>
                        <DisabledTooltip disabled={!isAccountReady && !accountLoading && !createInvoice.isPending} reason="Account context not available">
                            <Button type="submit" disabled={createInvoice.isPending || !isAccountReady || accountLoading}>
                                {(createInvoice.isPending || accountLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4" />
                                {accountLoading ? 'Loading...' : 'Create Invoice'}
                            </Button>
                        </DisabledTooltip>
                    </div>
                </form>
            </Form>

            <UnsavedChangesDialog
                open={showBlockerDialog}
                onConfirmLeave={confirmLeave}
                onCancelLeave={cancelLeave}
            />
        </div>
    );
}
