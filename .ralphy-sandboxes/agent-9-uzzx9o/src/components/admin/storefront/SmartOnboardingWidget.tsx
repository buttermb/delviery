
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';

interface SmartOnboardingWidgetProps {
    productCount: number;
    className?: string;
}

export function SmartOnboardingWidget({ productCount, className }: SmartOnboardingWidgetProps) {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();

    const addSampleProductMutation = useMutation({
        mutationFn: async () => {
            if (!tenant?.id) throw new Error("No tenant context");

            const sampleProduct = {
                tenant_id: tenant.id,
                name: "Blue Dream (Sample)",
                sku: `SAMPLE-${Math.floor(Math.random() * 1000)}`,
                category: "flower",
                vendor_name: "FloraIQ Genetics",
                strain_name: "Blue Dream",
                strain_type: "sativa",
                thc_percent: 24.5,
                cbd_percent: 0.5,
                batch_number: "BATCH-001",
                cost_per_unit: 15.00,
                wholesale_price: 35.00,
                retail_price: 45.00,
                available_quantity: 100,
                description: "This is a sample product to help you visualize your inventory. You can edit or delete this later.",
                low_stock_alert: 10,
                price: 35.00, // Legacy field
                minimum_price: 30.00,
                exclude_from_discounts: false,
                image_url: "https://images.unsplash.com/photo-1595964267688-6cdd9c750e33?q=80&w=800&auto=format&fit=crop" // Generic flower image
            };

            const { data, error } = await (supabase
                .from('products')
                .insert(sampleProduct)
                .select()
                .maybeSingle());

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceProductSettings.stats() });
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all }); // Invalidate main product list too
            toast.success("Sample product added!", {
                description: "You can now see how it looks in your store."
            });
        },
        onError: (error: Error) => {
            logger.error("Failed to add sample product", error);
            toast.error("Failed to add sample product", {
                description: humanizeError(error)
            });
        }
    });

    // If products exist, don't show the widget (must be after all hooks)
    if (productCount > 0) return null;

    return (
        <Card className={`border-dashed border-2 bg-muted/20 ${className}`}>
            <CardContent className="flex flex-col md:flex-row items-center justify-between p-6 gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Sparkles className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            Setup Step 1: Add your first product
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Takes 30s</span>
                        </h3>
                        <p className="text-muted-foreground">
                            Your store is empty. Add a sample product to see how everything looks instantly.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {/* Maybe a secondary button to go to manual creation? */}
                    {/* For now just the one-tap action */}
                    <Button
                        size="lg"
                        onClick={() => addSampleProductMutation.mutate()}
                        disabled={addSampleProductMutation.isPending}
                        className="shadow-md"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        {addSampleProductMutation.isPending ? "Adding..." : "Add Sample Product"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
