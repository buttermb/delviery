import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Tag, Trash2, Calendar, Loader2, RefreshCw, TicketPercent } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/formatters";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";
import { humanizeError } from "@/lib/humanizeError";

interface CouponRow {
    id: string;
    store_id: string;
    code: string;
    discount_type: string;
    discount_value: number;
    usage_limit: number | null;
    used_count: number | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean | null;
    created_at: string | null;
    min_order_amount: number | null;
    max_discount_amount: number | null;
    description: string | null;
}

const couponFormSchema = z.object({
    code: z.string().min(1, "Coupon code is required").max(50, "Code must be 50 characters or less"),
    discount_type: z.enum(["percentage", "fixed_amount"]),
    discount_value: z.coerce.number().min(0.01, "Discount value must be greater than 0"),
    usage_limit: z.coerce.number().int().min(1).optional().or(z.literal("")),
    end_date: z.string().optional().or(z.literal("")),
});

type CouponFormValues = z.infer<typeof couponFormSchema>;

function CouponManagerSkeleton() {
    return (
        <div className="space-y-4 h-full p-4 md:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-10 w-36" />
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-56" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex gap-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={`header-col-${i}`} className="h-4 w-20" />
                            ))}
                        </div>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={`skeleton-row-${i}`} className="flex gap-4 items-center py-3">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-6 w-16 rounded-full" />
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-8 w-8 rounded" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function CouponManager() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [couponToDelete, setCouponToDelete] = useState<CouponRow | null>(null);

    const form = useForm<CouponFormValues>({
        resolver: zodResolver(couponFormSchema),
        defaultValues: {
            code: "",
            discount_type: "percentage",
            discount_value: 0,
            usage_limit: "",
            end_date: "",
        },
    });

    // Fetch store for this tenant
    const { data: store } = useQuery({
        queryKey: queryKeys.marketplaceStore.byTenant(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return null;
            const { data, error } = await supabase
                .from("marketplace_stores")
                .select("id")
                .eq("tenant_id", tenant.id)
                .maybeSingle();
            if (error) {
                logger.error("Failed to fetch marketplace store", error);
                return null;
            }
            return data;
        },
        enabled: !!tenant?.id,
        staleTime: 60_000,
    });

    // Fetch coupons by store_id
    const { data: coupons, isLoading, isFetching } = useQuery({
        queryKey: queryKeys.marketplaceCoupons.byTenant(store?.id),
        queryFn: async () => {
            if (!store?.id) return [];
            const { data, error } = await supabase
                .from("marketplace_coupons")
                .select("id, store_id, code, discount_type, discount_value, usage_limit, used_count, start_date, end_date, is_active, created_at, min_order_amount, max_discount_amount, description")
                .eq("store_id", store.id)
                .order("created_at", { ascending: false });

            if (error) {
                logger.error("Failed to fetch coupons", error);
                throw error;
            }
            return data as CouponRow[];
        },
        enabled: !!store?.id,
        staleTime: 30_000,
        retry: 2,
    });

    // Create coupon mutation
    const createCoupon = useMutation({
        mutationFn: async (values: CouponFormValues) => {
            if (!store?.id) throw new Error("No store found");

            const payload = {
                store_id: store.id,
                code: values.code.toUpperCase(),
                discount_type: values.discount_type,
                discount_value: values.discount_value,
                usage_limit: values.usage_limit ? Number(values.usage_limit) : null,
                end_date: values.end_date || null,
                is_active: true,
            };

            const { error } = await supabase
                .from("marketplace_coupons")
                .insert([payload]);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceCoupons.all });
            setIsDialogOpen(false);
            form.reset();
            toast.success("Coupon created successfully");
        },
        onError: (error: unknown) => {
            logger.error("Failed to create coupon", error);
            toast.error("Failed to create coupon", {
                description: humanizeError(error),
            });
        },
    });

    // Delete coupon mutation
    const deleteCoupon = useMutation({
        mutationFn: async (id: string) => {
            if (!store?.id) throw new Error("No store found");
            const { error } = await supabase
                .from("marketplace_coupons")
                .delete()
                .eq("id", id)
                .eq("store_id", store.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceCoupons.all });
            toast.success("Coupon deleted");
        },
        onError: (error: unknown) => {
            logger.error("Failed to delete coupon", error);
            toast.error("Failed to delete coupon", {
                description: humanizeError(error),
            });
        },
    });

    const handleCreate = (values: CouponFormValues) => {
        createCoupon.mutate(values);
    };

    if (isLoading) return <CouponManagerSkeleton />;

    return (
        <div className="space-y-4 h-full p-4 md:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Coupons & Discounts</h1>
                    <p className="text-muted-foreground mt-1">
                        Create and manage discount codes for your store.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isFetching && !isLoading && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Refreshing...
                        </span>
                    )}
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) form.reset();
                    }}>
                        <DialogTrigger asChild>
                            <Button aria-label="Create new coupon">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Coupon
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New Coupon</DialogTitle>
                                <DialogDescription>
                                    Add a new discount code for your customers.
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4 py-4">
                                    <FormField
                                        control={form.control}
                                        name="code"
                                        render={({ field }) => (
                                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                                <FormLabel className="text-right">Code</FormLabel>
                                                <div className="col-span-3">
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                                            placeholder="SUMMER25"
                                                            className="uppercase"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="discount_type"
                                        render={({ field }) => (
                                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                                <FormLabel className="text-right">Type</FormLabel>
                                                <div className="col-span-3">
                                                    <Select value={field.value} onValueChange={field.onChange}>
                                                        <FormControl>
                                                            <SelectTrigger aria-label="Select discount type">
                                                                <SelectValue placeholder="Select type" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                                                            <SelectItem value="fixed_amount">Fixed Amount ($)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="discount_value"
                                        render={({ field }) => (
                                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                                <FormLabel className="text-right">Value</FormLabel>
                                                <div className="col-span-3">
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            {...field}
                                                            placeholder="20"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="usage_limit"
                                        render={({ field }) => (
                                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                                <FormLabel className="text-right">Limit</FormLabel>
                                                <div className="col-span-3">
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            {...field}
                                                            value={field.value ?? ""}
                                                            placeholder="Total uses (optional)"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="end_date"
                                        render={({ field }) => (
                                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                                <FormLabel className="text-right">Expires</FormLabel>
                                                <div className="col-span-3">
                                                    <FormControl>
                                                        <Input
                                                            type="date"
                                                            {...field}
                                                            value={field.value ?? ""}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                    <DialogFooter>
                                        <Button type="submit" disabled={createCoupon.isPending}>
                                            {createCoupon.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Create Coupon
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Active Coupons</CardTitle>
                    <CardDescription>Manage your running promotions.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Discount</TableHead>
                                <TableHead>Usage</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Expiry</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {coupons?.map((coupon) => (
                                <TableRow key={coupon.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Tag className="h-4 w-4 text-primary" />
                                            {coupon.code}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {coupon.discount_type === "percentage"
                                            ? `${coupon.discount_value}%`
                                            : formatCurrency(coupon.discount_value)}
                                    </TableCell>
                                    <TableCell>
                                        {coupon.used_count ?? 0} / {coupon.usage_limit ?? "\u221E"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={(coupon.is_active ?? false) ? "default" : "secondary"}>
                                            {(coupon.is_active ?? false) ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {coupon.end_date ? (
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(coupon.end_date), "MMM d, yyyy")}
                                            </div>
                                        ) : "Never"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            aria-label={`Delete coupon ${coupon.code}`}
                                            onClick={() => {
                                                setCouponToDelete(coupon);
                                                setDeleteDialogOpen(true);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {coupons?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <TicketPercent className="h-8 w-8 opacity-50" />
                                            <p className="font-medium">No coupons yet</p>
                                            <p className="text-sm">Create your first discount code to attract customers.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <ConfirmDeleteDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={() => couponToDelete && deleteCoupon.mutate(couponToDelete.id)}
                itemName={couponToDelete?.code ?? "this coupon"}
                isLoading={deleteCoupon.isPending}
            />
        </div>
    );
}
