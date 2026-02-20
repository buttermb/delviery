import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { CreateOrderForm } from "@/components/crm/CreateOrderForm";
import { useCreateCRMOrder } from "@/hooks/crm/useCreateCRMOrder";
import { useLogActivity } from "@/hooks/crm/useActivityLog";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";

export function CreateOrderPage() {
    const { tenant, loading: tenantLoading } = useTenantAdminAuth();
    const { navigateToAdmin, navigate } = useTenantNavigation();
    const createOrder = useCreateCRMOrder();
    const logActivity = useLogActivity();

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
                <Button onClick={() => navigateToAdmin('orders')}>Go Back</Button>
            </div>
        );
    }

    const handleSubmit = async (data: {
        client_id: string;
        order_type: "standard" | "pre_order" | "invoice";
        line_items: Array<{
            id?: string;
            item_id?: string;
            product_name?: string;
            description?: string;
            quantity: number;
            unit_price: number;
            line_total: number;
        }>;
        subtotal: number;
        tax: number;
        total: number;
        expected_date?: Date;
        notes?: string;
    }) => {
        const result = await createOrder.mutateAsync(data);

        // Log activity
        if (result.type === 'pre_order') {
            const preOrder = result.data as { id: string; pre_order_number: string };
            logActivity.mutate({
                client_id: data.client_id,
                activity_type: "pre_order_created",
                description: `Order #${preOrder.pre_order_number} created`,
                reference_id: preOrder.id,
                reference_type: "crm_pre_orders",
            });

            // Check if it's a standard order
            if (data.order_type === 'standard') {
                navigate(`/${tenantSlug}/admin/orders/${preOrder.id}`);
            } else {
                navigate(`/${tenantSlug}/admin/crm/pre-orders/${preOrder.id}`);
            }
        } else {
            const invoice = result.data as { id: string; invoice_number: string };
            logActivity.mutate({
                client_id: data.client_id,
                activity_type: "invoice_created",
                description: `Invoice #${invoice.invoice_number} created`,
                reference_id: invoice.id,
                reference_type: "crm_invoices",
            });
            navigate(`/${tenantSlug}/admin/crm/invoices/${invoice.id}`);
        }
    };

    const handleCancel = () => {
        navigateToAdmin('orders');
    };

    return (
        <div className="space-y-6 p-6 pb-16 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigateToAdmin('orders')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Create Order</h1>
                    <p className="text-muted-foreground">
                        Create a new order for a customer with products from your inventory.
                    </p>
                </div>
            </div>

            <CreateOrderForm
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                isSubmitting={createOrder.isPending}
                showOrderTypeSelector={true}
                title="Order Details"
                submitLabel="Create Order"
            />
        </div>
    );
}
