import { useState, useCallback } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Save from "lucide-react/dist/esm/icons/save";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Receipt from "lucide-react/dist/esm/icons/receipt";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { ClientSelector } from "./ClientSelector";
import { LineItemsEditor, type InventoryValidationResult } from "./LineItemsEditor";
import type { LineItem, CRMClient } from "@/types/crm";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/formatCurrency";

const formSchema = z.object({
    client_id: z.string().min(1, "Customer is required"),
    order_type: z.enum(["standard", "pre_order", "invoice"]),
    expected_date: z.date({ required_error: "Date is required" }).optional(),
    notes: z.string().max(1000, "Notes must be under 1000 characters").optional(),
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
    const [lineItemsError, setLineItemsError] = useState<string | null>(null);
    const [lineItemsTouched, setLineItemsTouched] = useState(false);
    const [inventoryValidation, setInventoryValidation] = useState<InventoryValidationResult>({
        isValid: true,
        hasOutOfStock: false,
        hasInsufficientStock: false,
        errors: [],
    });

    const handleInventoryValidationChange = useCallback((validation: InventoryValidationResult) => {
        setInventoryValidation(validation);
    }, []);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        mode: "onTouched",
        defaultValues: {
            client_id: selectedClient?.id || "",
            order_type: defaultOrderType,
            expected_date: addDays(new Date(), 7),
            notes: "",
        },
    });

    const orderType = form.watch("order_type");

    // Validate line items inline
    const validateLineItems = useCallback((items: LineItem[]): string | null => {
        if (items.length === 0) return "At least one item is required";
        for (const item of items) {
            if (!item.item_id) return "All items must have a product selected";
            if (item.quantity < 1) return "All items must have a quantity of at least 1";
            if (item.unit_price < 0) return "Unit price cannot be negative";
        }
        return null;
    }, []);

    const handleLineItemsChange = useCallback((items: LineItem[]) => {
        setLineItems(items);
        setLineItemsTouched(true);
        const error = validateLineItems(items);
        setLineItemsError(error);
    }, [validateLineItems]);

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const taxRate = 0; // Can be made configurable
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    // Check if submission should be blocked due to inventory or validation issues
    const hasInventoryIssues = !inventoryValidation.isValid;
    const hasLineItemErrors = validateLineItems(lineItems) !== null;
    const canSubmit = !hasLineItemErrors && !hasInventoryIssues && !isSubmitting;

    const handleFormSubmit = async (values: FormValues) => {
        setLineItemsTouched(true);
        const itemError = validateLineItems(lineItems);
        setLineItemsError(itemError);

        if (itemError) {
            toast.error(itemError);
            return;
        }

        // Block submission if there are inventory issues
        if (hasInventoryIssues) {
            if (inventoryValidation.hasOutOfStock) {
                toast.error("Cannot submit order: Some items are out of stock");
            } else if (inventoryValidation.hasInsufficientStock) {
                toast.error("Cannot submit order: Some items exceed available inventory");
            }
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
        } catch {
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
                                        <FormLabel>Customer <span className="text-destructive">*</span></FormLabel>
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
                                            <FormLabel>Order Type <span className="text-destructive">*</span></FormLabel>
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
                        <CardTitle>Products <span className="text-destructive">*</span></CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Inventory validation warnings */}
                        {hasInventoryIssues && (
                            <Alert
                                variant={inventoryValidation.hasOutOfStock ? "destructive" : "default"}
                                className={cn(
                                    "mb-4",
                                    !inventoryValidation.hasOutOfStock && "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
                                )}
                            >
                                {inventoryValidation.hasOutOfStock ? (
                                    <XCircle className="h-4 w-4" />
                                ) : (
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                )}
                                <AlertDescription>
                                    {inventoryValidation.hasOutOfStock ? (
                                        <div>
                                            <span className="font-semibold">Cannot submit order:</span> The following items are out of stock:
                                            <ul className="mt-1 list-disc list-inside text-sm">
                                                {inventoryValidation.errors
                                                    .filter((e) => e.type === 'out_of_stock')
                                                    .map((e) => (
                                                        <li key={e.itemId}>{e.productName}</li>
                                                    ))}
                                            </ul>
                                        </div>
                                    ) : (
                                        <div>
                                            <span className="font-semibold">Insufficient inventory:</span> Reduce quantities or choose alternatives:
                                            <ul className="mt-1 list-disc list-inside text-sm">
                                                {inventoryValidation.errors
                                                    .filter((e) => e.type === 'insufficient_stock')
                                                    .map((e) => (
                                                        <li key={e.itemId}>
                                                            {e.productName}: requested {e.requested}, only {e.available} available
                                                        </li>
                                                    ))}
                                            </ul>
                                        </div>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}

                        <LineItemsEditor
                            items={lineItems}
                            onChange={handleLineItemsChange}
                            onValidationChange={handleInventoryValidationChange}
                        />

                        {lineItemsTouched && lineItemsError && (
                            <p className="text-sm text-destructive mt-2">{lineItemsError}</p>
                        )}

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
                    <Button type="submit" disabled={!canSubmit}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {hasInventoryIssues ? (
                            <AlertTriangle className="mr-2 h-4 w-4" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        {hasInventoryIssues ? "Fix Inventory Issues" : submitLabel}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
