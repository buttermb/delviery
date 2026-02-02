import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar-icon";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Save from "lucide-react/dist/esm/icons/save";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Receipt from "lucide-react/dist/esm/icons/receipt";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { ClientSelector } from "./ClientSelector";
import { LineItemsEditor } from "./LineItemsEditor";
import type { LineItem, CRMClient } from "@/types/crm";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/formatters";

const formSchema = z.object({
    client_id: z.string().min(1, "Customer is required"),
    order_type: z.enum(["standard", "pre_order", "invoice"]),
    expected_date: z.date().optional(),
    notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export interface CreateOrderFormProps {
    onSubmit: (data: {
        client_id: string;
        order_type: "standard" | "pre_order" | "invoice";
        line_items: LineItem[];
        subtotal: number;
        tax: number;
        total: number;
        expected_date?: Date;
        notes?: string;
    }) => Promise<void>;
    onCancel: () => void;
    isSubmitting?: boolean;
    defaultOrderType?: "standard" | "pre_order" | "invoice";
    showOrderTypeSelector?: boolean;
    selectedClient?: CRMClient | null;
    title?: string;
    submitLabel?: string;
}

export function CreateOrderForm({
    onSubmit,
    onCancel,
    isSubmitting = false,
    defaultOrderType = "standard",
    showOrderTypeSelector = true,
    selectedClient,
    title = "Create Order",
    submitLabel = "Create Order",
}: CreateOrderFormProps) {
    const [lineItems, setLineItems] = useState<LineItem[]>([]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            client_id: selectedClient?.id || "",
            order_type: defaultOrderType,
            expected_date: addDays(new Date(), 7),
            notes: "",
        },
    });

    const orderType = form.watch("order_type");

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const taxRate = 0; // Can be made configurable
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    const handleFormSubmit = async (values: FormValues) => {
        if (lineItems.length === 0) {
            toast.error("Please add at least one item to the order");
            return;
        }

        try {
            await onSubmit({
                client_id: values.client_id,
                order_type: values.order_type,
                line_items: lineItems,
                subtotal,
                tax,
                total,
                expected_date: values.expected_date,
                notes: values.notes,
            });
        } catch (error) {
            // Error should be handled by parent
        }
    };

    const getOrderTypeIcon = (type: string) => {
        switch (type) {
            case "pre_order":
                return <ShoppingCart className="h-4 w-4" />;
            case "invoice":
                return <Receipt className="h-4 w-4" />;
            default:
                return <FileText className="h-4 w-4" />;
        }
    };

    const getOrderTypeDescription = (type: string) => {
        switch (type) {
            case "pre_order":
                return "Create a pre-order that can be converted to an invoice later";
            case "invoice":
                return "Create an invoice directly for immediate billing";
            default:
                return "Create a standard order for the customer";
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Customer & Order Type */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {getOrderTypeIcon(orderType)}
                                {title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="client_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Customer *</FormLabel>
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

                            {showOrderTypeSelector && (
                                <FormField
                                    control={form.control}
                                    name="order_type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Order Type</FormLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select order type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="standard">
                                                        <div className="flex items-center gap-2">
                                                            <FileText className="h-4 w-4" />
                                                            Standard Order
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="pre_order">
                                                        <div className="flex items-center gap-2">
                                                            <ShoppingCart className="h-4 w-4" />
                                                            Pre-Order
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="invoice">
                                                        <div className="flex items-center gap-2">
                                                            <Receipt className="h-4 w-4" />
                                                            Invoice
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {getOrderTypeDescription(field.value)}
                                            </p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            {(orderType === "pre_order" || orderType === "invoice") && (
                                <FormField
                                    control={form.control}
                                    name="expected_date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>
                                                {orderType === "pre_order" ? "Expected Date" : "Due Date"}
                                            </FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
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
                            )}
                        </CardContent>
                    </Card>

                    {/* Notes */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Additional Information</CardTitle>
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

                            {/* Order Summary */}
                            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                <h4 className="font-medium text-sm">Order Summary</h4>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Items</span>
                                        <span>{lineItems.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span>{formatCurrency(subtotal)}</span>
                                    </div>
                                    {tax > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                                            <span>{formatCurrency(tax)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between pt-2 border-t font-bold">
                                        <span>Total</span>
                                        <span className="text-lg">{formatCurrency(total)}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Line Items */}
                <Card>
                    <CardHeader>
                        <CardTitle>Products</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <LineItemsEditor items={lineItems} onChange={setLineItems} />

                        <div className="mt-6 flex flex-col items-end gap-2 text-sm">
                            <div className="flex justify-between w-48">
                                <span className="text-muted-foreground">Subtotal:</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            {tax > 0 && (
                                <div className="flex justify-between w-48">
                                    <span className="text-muted-foreground">Tax:</span>
                                    <span>{formatCurrency(tax)}</span>
                                </div>
                            )}
                            <div className="flex justify-between w-48 pt-2 border-t font-bold text-lg">
                                <span>Total:</span>
                                <span>{formatCurrency(total)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                    <Button
                        variant="outline"
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || lineItems.length === 0}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        {submitLabel}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
