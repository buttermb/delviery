import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "@/components/unsaved-changes";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { useCRMSettings, useUpdateCRMSettings } from "@/hooks/crm/useCRMSettings";
import { ShortcutHint, useModifierKey } from "@/components/ui/shortcut-hint";
import { useFormKeyboardShortcuts } from "@/hooks/useFormKeyboardShortcuts";

const formSchema = z.object({
    invoice_prefix: z.string().min(1, "Prefix is required"),
    default_payment_terms: z.coerce.number().min(0),
    default_tax_rate: z.coerce.number().min(0).max(100),
    company_name: z.string().optional(),
    company_address: z.string().optional(),
    company_email: z.string().email().optional().or(z.literal("")),
    company_phone: z.string().regex(/^[\d\s\-+()]+$/, "Invalid phone number").min(7, "Phone number must be at least 7 characters").max(20, "Phone number must be 20 characters or less").optional().or(z.literal('')),
    logo_url: z.string().url().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

export default function CRMSettingsPage() {
    const { data: settings, isLoading } = useCRMSettings();
    const updateSettings = useUpdateCRMSettings();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            invoice_prefix: "INV-",
            default_payment_terms: 7,
            default_tax_rate: 0,
            company_name: "",
            company_address: "",
            company_email: "",
            company_phone: "",
            logo_url: "",
        },
    });

    const { showBlockerDialog, confirmLeave, cancelLeave } = useUnsavedChanges({
        isDirty: form.formState.isDirty,
    });

    const mod = useModifierKey();

    useFormKeyboardShortcuts({
        onSave: () => form.handleSubmit(onSubmit)(),
    });

    useEffect(() => {
        if (settings) {
            form.reset({
                invoice_prefix: settings.invoice_prefix || "INV-",
                default_payment_terms: settings.default_payment_terms || 7,
                default_tax_rate: settings.default_tax_rate ?? 0,
                company_name: settings.company_name || "",
                company_address: settings.company_address || "",
                company_email: settings.company_email || "",
                company_phone: settings.company_phone || "",
                logo_url: settings.logo_url || "",
            });
        }
    }, [settings, form]);

    const onSubmit = (values: FormValues) => {
        updateSettings.mutate(values);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4 pb-16 max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">CRM Settings</h1>
                <p className="text-muted-foreground">
                    Configure your invoice settings and company details.
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>General Settings</CardTitle>
                            <CardDescription>
                                Configure defaults for new invoices and pre-orders.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-3">
                                <FormField
                                    control={form.control}
                                    name="invoice_prefix"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Invoice Prefix</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormDescription>
                                                e.g., INV-2024-001
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="default_payment_terms"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Days Until Payment Due</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormDescription>
                                                How many days clients have to pay their invoice
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="default_tax_rate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Default Sales Tax (%)</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" {...field} />
                                            </FormControl>
                                            <FormDescription>
                                                Applied automatically to new invoices
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Company Information</CardTitle>
                            <CardDescription>
                                These details will appear on your invoices.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="company_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="company_email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Email</FormLabel>
                                            <FormControl>
                                                <Input type="email" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="company_phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Company Phone</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="logo_url"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Logo URL</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="company_address"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Company Address</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <ShortcutHint keys={[mod, "S"]} label="Save">
                            <Button type="submit" disabled={updateSettings.isPending}>
                                {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="mr-2 h-4 w-4" />
                                Save Settings
                            </Button>
                        </ShortcutHint>
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
