import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, ArrowLeft, Loader2, Save, AlertTriangle } from "lucide-react";
import { format, addDays } from "date-fns";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { cn } from "@/lib/utils";
import { useCreatePreOrder } from "@/hooks/crm/usePreOrders";
import { useLogActivity } from "@/hooks/crm/useActivityLog";
import { ClientSelector } from "@/components/crm/ClientSelector";
import { LineItemsEditor } from "@/components/crm/LineItemsEditor";
import { LineItem } from "@/types/crm";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/formatters";

const formSchema = z.object({
    client_id: z.string().min(1, "Client is required"),
    expected_date: z.date().optional(),
    notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreatePreOrderPage() {
    const { tenant, loading: tenantLoading } = useTenantAdminAuth();
    const navigate = useNavigate();
    const createPreOrder = useCreatePreOrder();
    const logActivity = useLogActivity();
    const [lineItems, setLineItems] = useState<LineItem[]>([]);

    // useForm must be called before any early returns to satisfy React hooks rules
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            expected_date: addDays(new Date(), 7),
            notes: "",
        },
    });

    const tenantSlug = tenant?.slug;
    const isContextReady = !tenantLoading && !!tenant?.id && !!tenantSlug;
    const contextError = !tenantLoading && (!tenant?.id || !tenantSlug)
        ? 'Tenant context not available. Please refresh the page or contact support.'
        : null;

    // Show loading state while context initializes
    if (tenantLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Show error if context not available
    if (!isContextReady || contextError) {
        return (
            <div className="space-y-6 p-6 max-w-5xl mx-auto">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        {contextError || 'Unable to load tenant context. Please refresh the page.'}
                    </AlertDescription>
                </Alert>
                <Button onClick={() => navigate(-1)}>Go Back</Button>
            </div>
        );
    }

    // Calculate total
    const total = lineItems.reduce((sum, item) => sum + item.line_total, 0);

    const onSubmit = async (values: FormValues) => {
        if (lineItems.length === 0) {
            toast.error("Please add at least one line item");
            return;
        }

        try {
            const preOrder = await createPreOrder.mutateAsync({
                client_id: values.client_id,
                status: "pending",
                line_items: lineItems,
                subtotal: total,
                tax: 0,
                total,
            });

            // Log activity
            logActivity.mutate({
                client_id: values.client_id,
                activity_type: "pre_order_created",
                description: `Pre-order #${preOrder.pre_order_number} created`,
                reference_id: preOrder.id,
                reference_type: "crm_pre_orders",
            });

            toast.success("Pre-order created successfully");
            // Use validated tenantSlug (guaranteed to exist at this point)
            navigate(`/${tenantSlug}/admin/crm/pre-orders/${preOrder.id}`);
        } catch {
            // Error handled by hook
        }
    };

    return (
        <div className="space-y-6 p-6 pb-16 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Create Pre-Order</h1>
                    <p className="text-muted-foreground">
                        Create a new pre-order for a client.
                    </p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Client & Dates */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Order Details</CardTitle>
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

                                <FormField
                                    control={form.control}
                                    name="expected_date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Expected Date (Optional)</FormLabel>
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
                            </CardContent>
                        </Card>

                        {/* Notes */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Additional Info</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Notes</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Add any notes or special instructions..."
                                                    className="min-h-[120px]"
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
                                <div className="flex justify-between w-48 pt-2 border-t font-bold text-lg">
                                    <span>Total:</span>
                                    <span>{formatCurrency(total)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-4">
                        <Button variant="outline" type="button" onClick={() => navigate(-1)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createPreOrder.isPending}>
                            {createPreOrder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Create Pre-Order
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
