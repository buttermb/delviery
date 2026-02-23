import { useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { useTenantNavigate } from "@/hooks/useTenantNavigate";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2, ArrowRight } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useConvertPreOrderToInvoice } from "@/hooks/crm/usePreOrders";
import { useLogActivity } from "@/hooks/crm/useActivityLog";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

const formSchema = z.object({
    issue_date: z.date(),
    due_date: z.date(),
});

type FormValues = z.infer<typeof formSchema>;

interface ConvertPreOrderDialogProps {
    preOrder: any;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function ConvertPreOrderDialog({ preOrder, trigger, open: controlledOpen, onOpenChange: setControlledOpen }: ConvertPreOrderDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const navigate = useTenantNavigate();
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const convertPreOrder = useConvertPreOrderToInvoice();
    const logActivity = useLogActivity();

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            issue_date: new Date(),
            due_date: addDays(new Date(), 7),
        },
    });

    const onSubmit = async (values: FormValues) => {
        try {
            const { invoice } = await convertPreOrder.mutateAsync({
                preOrderId: preOrder.id,
                invoiceData: {
                    invoice_date: values.issue_date.toISOString().slice(0, 10),
                    due_date: values.due_date.toISOString().slice(0, 10),
                },
            });

            // Log activity
            logActivity.mutate({
                client_id: preOrder.client_id,
                activity_type: "invoice_created",
                description: `Pre-order #${preOrder.pre_order_number} converted to Invoice #${invoice.invoice_number}`,
                reference_id: invoice.id,
                reference_type: "crm_invoices",
            });

            toast.success("Pre-order converted to invoice");
            setOpen(false);
            navigate(`/${tenantSlug}/admin/crm/invoices/${invoice.id}`);
        } catch (error: unknown) {
            logger.error('Failed to convert pre-order to invoice', error, { 
                component: 'ConvertPreOrderDialog',
                preOrderId: preOrder?.id 
            });
            // Error also handled by hook
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Convert to Invoice</DialogTitle>
                    <DialogDescription>
                        Create an invoice from this pre-order. You can review and edit the invoice after creation.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="issue_date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Issue Date</FormLabel>
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
                                    <FormLabel>Due Date</FormLabel>
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
                        <DialogFooter>
                            <Button type="submit" disabled={convertPreOrder.isPending}>
                                {convertPreOrder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <ArrowRight className="mr-2 h-4 w-4" />
                                Convert & View Invoice
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
