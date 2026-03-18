import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronsUpDown, Check, AlertTriangle, Package, Radio, Loader2, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Product } from "@/hooks/crm/useProducts";
import type { LineItem } from "@/types/crm";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput, IntegerInput } from "@/components/ui/currency-input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { useProducts } from "@/hooks/crm/useProducts";
import { useRealTimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useAccountIdSafe } from "@/hooks/crm/useAccountId";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/queryKeys";

export interface InventoryValidationResult {
    isValid: boolean;
    hasOutOfStock: boolean;
    hasInsufficientStock: boolean;
    errors: Array<{
        itemId: string;
        productName: string;
        requested: number;
        available: number;
        type: 'out_of_stock' | 'insufficient_stock';
    }>;
}

interface LineItemsEditorProps {
    items: LineItem[];
    onChange: (items: LineItem[]) => void;
    onValidationChange?: (validation: InventoryValidationResult) => void;
}

interface LineItemError {
    product?: string;
    quantity?: string;
    price?: string;
}

// Interface for tracking stock changes
interface StockChangeWarning {
    productId: string;
    productName: string;
    previousStock: number;
    currentStock: number;
    requestedQuantity: number;
}

export function LineItemsEditor({ items, onChange, onValidationChange }: LineItemsEditorProps) {
    const { data: products = [], isLoading, isError, refetch } = useProducts();
    const accountId = useAccountIdSafe();
    const queryClient = useQueryClient();

    // Track previous stock levels to detect changes
    const previousStockRef = useRef<Map<string, number>>(new Map());
    // Stock change warnings
    const [stockWarnings, setStockWarnings] = useState<StockChangeWarning[]>([]);
    // Per-item field touch state for inline validation on blur
    const [touchedFields, setTouchedFields] = useState<Map<string, Set<string>>>(new Map());

    const markFieldTouched = useCallback((itemId: string, field: string) => {
        setTouchedFields((prev) => {
            const next = new Map(prev);
            const fields = new Set(next.get(itemId) ?? []);
            fields.add(field);
            next.set(itemId, fields);
            return next;
        });
    }, []);

    const isFieldTouched = useCallback((itemId: string, field: string) => {
        return touchedFields.get(itemId)?.has(field) ?? false;
    }, [touchedFields]);

    const getItemErrors = useCallback((item: LineItem): LineItemError => {
        const errors: LineItemError = {};
        if (!item.item_id) errors.product = "Select a product";
        if (item.quantity < 1) errors.quantity = "Min 1";
        if (item.unit_price < 0) errors.price = "Must be 0 or more";
        return errors;
    }, []);

    // Real-time subscription to products table for live stock updates
    const { status: realtimeStatus } = useRealTimeSubscription({
        table: 'products',
        tenantId: accountId,
        filterColumn: 'account_id',
        event: 'UPDATE',
        enabled: !!accountId && items.length > 0,
        callback: (payload) => {
            logger.debug('[LineItemsEditor] Product update received', {
                productId: payload.new?.id,
                eventType: payload.eventType,
            });

            // Invalidate and refetch products to get updated stock
            queryClient.invalidateQueries({ queryKey: queryKeys.crm.products.lists() });
            refetch();
        },
    });

    // Create a map of product ID to product for quick lookups
    const productMap = useMemo(() => {
        const map = new Map<string, Product>();
        products.forEach((p) => map.set(p.id, p));
        return map;
    }, [products]);

    // Check for stock changes that affect current line items
    useEffect(() => {
        if (products.length === 0 || items.length === 0) return;

        const newWarnings: StockChangeWarning[] = [];
        const currentStockMap = new Map<string, number>();

        // Build current stock map and check for problematic changes
        products.forEach((product) => {
            currentStockMap.set(product.id, product.stockQuantity);
            const previousStock = previousStockRef.current.get(product.id);

            // Only check if we have a previous value (not first load)
            if (previousStock !== undefined && previousStock !== product.stockQuantity) {
                // Check if this product is in our line items
                const lineItem = items.find((item) => item.item_id === product.id);
                if (lineItem) {
                    // Stock decreased and now below requested quantity
                    if (product.stockQuantity < previousStock && product.stockQuantity < lineItem.quantity) {
                        newWarnings.push({
                            productId: product.id,
                            productName: product.name,
                            previousStock,
                            currentStock: product.stockQuantity,
                            requestedQuantity: lineItem.quantity,
                        });

                        // Show toast notification for the stock drop
                        toast.warning(
                            `Stock Alert: ${product.name}`,
                            {
                                description: `Stock dropped from ${previousStock} to ${product.stockQuantity}. You requested ${lineItem.quantity}.`,
                                duration: 5000,
                            }
                        );

                        logger.warn('[LineItemsEditor] Stock dropped below requested quantity', {
                            productId: product.id,
                            productName: product.name,
                            previousStock,
                            currentStock: product.stockQuantity,
                            requestedQuantity: lineItem.quantity,
                        });
                    }
                }
            }
        });

        // Update warnings state
        setStockWarnings(newWarnings);

        // Update previous stock reference for next comparison
        previousStockRef.current = currentStockMap;
    }, [products, items]);

    // Validate inventory for all line items
    const validateInventory = useCallback((): InventoryValidationResult => {
        const errors: InventoryValidationResult['errors'] = [];

        items.forEach((item) => {
            if (!item.item_id) return;

            const product = productMap.get(item.item_id);
            if (!product) return;

            if (product.isOutOfStock) {
                errors.push({
                    itemId: item.item_id,
                    productName: product.name,
                    requested: item.quantity,
                    available: 0,
                    type: 'out_of_stock',
                });
            } else if (item.quantity > product.stockQuantity) {
                errors.push({
                    itemId: item.item_id,
                    productName: product.name,
                    requested: item.quantity,
                    available: product.stockQuantity,
                    type: 'insufficient_stock',
                });
            }
        });

        return {
            isValid: errors.length === 0,
            hasOutOfStock: errors.some((e) => e.type === 'out_of_stock'),
            hasInsufficientStock: errors.some((e) => e.type === 'insufficient_stock'),
            errors,
        };
    }, [items, productMap]);

    // Get stock info for a specific line item
    const getStockInfo = useCallback((item: LineItem) => {
        if (!item.item_id) return null;
        const product = productMap.get(item.item_id);
        if (!product) return null;

        const isInsufficientStock = item.quantity > product.stockQuantity;
        const isOutOfStock = product.isOutOfStock;
        const isLowStock = product.isLowStock;

        return {
            available: product.stockQuantity,
            isInsufficientStock,
            isOutOfStock,
            isLowStock,
        };
    }, [productMap]);

    // Notify parent of validation changes whenever items or products change
    useMemo(() => {
        if (onValidationChange && products.length > 0) {
            const validation = validateInventory();
            onValidationChange(validation);
        }
    }, [products, validateInventory, onValidationChange]);

    const handleAddItem = () => {
        const newItem: LineItem = {
            id: crypto.randomUUID(), // Temporary ID for UI key
            description: "",
            quantity: 1,
            unit_price: 0,
            line_total: 0,
        };
        onChange([...items, newItem]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        onChange(newItems);
    };

    const handleUpdateItem = (index: number, field: keyof LineItem, value: string | number) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        if (field === "quantity") {
            item.quantity = Number(value);
        } else if (field === "unit_price") {
            item.unit_price = Number(value);
        } else if (field === "description") {
            item.description = String(value);
        } else if (field === "item_id") {
            // When product is selected
            const product = products?.find((p) => p.id === String(value));
            if (product) {
                item.item_id = product.id;
                item.description = product.name;
                item.unit_price = product.price;
            }
        }

        // Recalculate total
        item.line_total = item.quantity * item.unit_price;
        newItems[index] = item;
        onChange(newItems);
    };

    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);

    // Check if any current items have stock warnings
    const hasActiveWarnings = stockWarnings.length > 0;

    // Dismiss a specific stock warning
    const dismissWarning = useCallback((productId: string) => {
        setStockWarnings((prev) => prev.filter((w) => w.productId !== productId));
    }, []);

    return (
        <div className="space-y-4">
            {/* Real-time status indicator */}
            {items.length > 0 && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Radio className={cn(
                            "h-3 w-3",
                            realtimeStatus === 'connected' && "text-green-500 animate-pulse",
                            realtimeStatus === 'connecting' && "text-amber-500",
                            realtimeStatus === 'error' && "text-destructive",
                            realtimeStatus === 'disconnected' && "text-muted-foreground"
                        )} />
                        <span>
                            {realtimeStatus === 'connected' && "Live stock updates"}
                            {realtimeStatus === 'connecting' && "Connecting..."}
                            {realtimeStatus === 'error' && "Connection error"}
                            {realtimeStatus === 'disconnected' && "Stock updates paused"}
                        </span>
                    </div>
                </div>
            )}

            {/* Stock change warning banner */}
            {hasActiveWarnings && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 p-3">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div className="flex-1 space-y-2">
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                Stock Changed While Editing
                            </p>
                            {stockWarnings.map((warning) => (
                                <div
                                    key={warning.productId}
                                    className="flex items-center justify-between text-sm text-amber-700 dark:text-amber-300"
                                >
                                    <span>
                                        <strong>{warning.productName}</strong>: Stock dropped from {warning.previousStock} to{" "}
                                        {warning.currentStock} (you requested {warning.requestedQuantity})
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => dismissWarning(warning.productId)}
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                            ))}
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                Please adjust quantities or another order may have taken this stock.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[35%]">Item / Description</TableHead>
                            <TableHead className="w-[12%]">
                                <div className="flex items-center gap-1">
                                    Stock
                                    {realtimeStatus === 'connected' && (
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                        </span>
                                    )}
                                </div>
                            </TableHead>
                            <TableHead className="w-[12%]">Quantity</TableHead>
                            <TableHead className="w-[16%]">Unit Price</TableHead>
                            <TableHead className="w-[18%] text-right">Total</TableHead>
                            <TableHead className="w-[7%]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No items added. Click "Add Item" to start.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item, index) => {
                                const stockInfo = getStockInfo(item);
                                const hasStockIssue = stockInfo && (stockInfo.isOutOfStock || stockInfo.isInsufficientStock);
                                const itemId = item.id || String(index);
                                const errors = getItemErrors(item);

                                return (
                                    <TableRow
                                        key={item.id || index}
                                        className={cn(hasStockIssue && "bg-destructive/5")}
                                    >
                                        <TableCell>
                                            <div className="flex flex-col gap-2">
                                                <div
                                                    onBlur={() => markFieldTouched(itemId, "product")}
                                                >
                                                    <ProductSelector
                                                        value={item.item_id}
                                                        onSelect={(productId) => handleUpdateItem(index, "item_id", productId)}
                                                        products={products ?? []}
                                                        isLoading={isLoading}
                                                        isError={isError}
                                                        onRetry={() => refetch()}
                                                        hasError={isFieldTouched(itemId, "product") && !!errors.product}
                                                    />
                                                    {isFieldTouched(itemId, "product") && errors.product && (
                                                        <p className="text-[11px] text-destructive mt-1">{errors.product}</p>
                                                    )}
                                                </div>
                                                <Input
                                                    placeholder="Description (optional)"
                                                    value={item.description}
                                                    onChange={(e) => handleUpdateItem(index, "description", e.target.value)}
                                                    className="h-8 text-xs"
                                                    aria-label="Item description"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {stockInfo ? (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex items-center gap-1.5">
                                                                <Package className={cn(
                                                                    "h-3.5 w-3.5",
                                                                    stockInfo.isOutOfStock && "text-destructive",
                                                                    stockInfo.isInsufficientStock && !stockInfo.isOutOfStock && "text-amber-500",
                                                                    stockInfo.isLowStock && !stockInfo.isInsufficientStock && "text-amber-500",
                                                                    !stockInfo.isOutOfStock && !stockInfo.isInsufficientStock && !stockInfo.isLowStock && "text-muted-foreground"
                                                                )} />
                                                                <span className={cn(
                                                                    "text-sm font-medium",
                                                                    stockInfo.isOutOfStock && "text-destructive",
                                                                    stockInfo.isInsufficientStock && !stockInfo.isOutOfStock && "text-amber-600",
                                                                    stockInfo.isLowStock && !stockInfo.isInsufficientStock && "text-amber-600"
                                                                )}>
                                                                    {stockInfo.available}
                                                                </span>
                                                                {stockInfo.isOutOfStock && (
                                                                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                                                )}
                                                                {stockInfo.isInsufficientStock && !stockInfo.isOutOfStock && (
                                                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                                                )}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            {stockInfo.isOutOfStock ? (
                                                                <p className="text-destructive font-medium">Out of stock</p>
                                                            ) : stockInfo.isInsufficientStock ? (
                                                                <p className="text-amber-600 font-medium">
                                                                    Insufficient stock: {stockInfo.available} available, {item.quantity} requested
                                                                </p>
                                                            ) : stockInfo.isLowStock ? (
                                                                <p className="text-amber-600">Low stock warning</p>
                                                            ) : (
                                                                <p>{stockInfo.available} units available</p>
                                                            )}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <IntegerInput
                                                    min={1}
                                                    value={item.quantity}
                                                    onChange={(e) => handleUpdateItem(index, "quantity", e.target.value)}
                                                    onBlur={() => markFieldTouched(itemId, "quantity")}
                                                    className={cn(
                                                        "h-9",
                                                        hasStockIssue && "border-destructive focus-visible:ring-destructive",
                                                        isFieldTouched(itemId, "quantity") && errors.quantity && "border-destructive focus-visible:ring-destructive"
                                                    )}
                                                />
                                                {isFieldTouched(itemId, "quantity") && errors.quantity && (
                                                    <span className="text-[11px] text-destructive">{errors.quantity}</span>
                                                )}
                                                {stockInfo?.isInsufficientStock && !stockInfo.isOutOfStock && (
                                                    <span className="text-[10px] text-amber-600 font-medium">
                                                        Max: {stockInfo.available}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <CurrencyInput
                                                    value={item.unit_price}
                                                    onChange={(e) => handleUpdateItem(index, "unit_price", e.target.value)}
                                                    onBlur={() => markFieldTouched(itemId, "price")}
                                                    className={cn(
                                                        "h-9",
                                                        isFieldTouched(itemId, "price") && errors.price && "border-destructive focus-visible:ring-destructive"
                                                    )}
                                                />
                                                {isFieldTouched(itemId, "price") && errors.price && (
                                                    <span className="text-[11px] text-destructive">{errors.price}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {formatCurrency(item.line_total)}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveItem(index)}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                aria-label="Remove line item"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between">
                <Button variant="outline" onClick={handleAddItem} type="button">
                    <Plus className="mr-2 h-4 w-4" /> Add Item
                </Button>
                <div className="flex items-center gap-4 text-sm font-medium">
                    <span>Subtotal:</span>
                    <span className="text-lg">{formatCurrency(subtotal)}</span>
                </div>
            </div>
        </div>
    );
}

interface ProductSelectorProps {
    value?: string;
    onSelect: (value: string) => void;
    products: Product[];
    isLoading: boolean;
    isError?: boolean;
    onRetry?: () => void;
    hasError?: boolean;
}

function ProductSelector({ value, onSelect, products, isLoading, isError, onRetry, hasError }: ProductSelectorProps) {
    const [open, setOpen] = useState(false);

    const selectedProduct = products.find((p) => p.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between h-9",
                        !value && "text-muted-foreground",
                        hasError && "border-destructive focus-visible:ring-destructive"
                    )}
                >
                    <span className="flex items-center gap-1.5 truncate">
                        {selectedProduct ? (
                            <>
                                {selectedProduct.name}
                                {selectedProduct.isOutOfStock && (
                                    <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                                )}
                            </>
                        ) : "Select product..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search products..." />
                    <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    <span className="ml-2 text-sm text-muted-foreground">Loading products...</span>
                                </div>
                            ) : isError ? (
                                <div className="flex flex-col items-center gap-2 py-6 px-4">
                                    <AlertTriangle className="h-5 w-5 text-destructive" />
                                    <p className="text-sm text-destructive">Failed to load products</p>
                                    {onRetry && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={onRetry}
                                        >
                                            <RefreshCw className="mr-2 h-3 w-3" />
                                            Retry
                                        </Button>
                                    )}
                                </div>
                            ) : products.length === 0 ? (
                                <div className="py-6 px-4 text-center">
                                    <Package className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                                    <p className="text-sm text-muted-foreground">No products available</p>
                                </div>
                            ) : (
                                products.map((product) => (
                                    <CommandItem
                                        key={product.id}
                                        value={product.name}
                                        disabled={product.isOutOfStock}
                                        onSelect={() => {
                                            if (!product.isOutOfStock) {
                                                onSelect(product.id);
                                                setOpen(false);
                                            }
                                        }}
                                        className={cn(
                                            product.isOutOfStock && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === product.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span>{product.name}</span>
                                                {product.isOutOfStock && (
                                                    <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                                                        Out of Stock
                                                    </Badge>
                                                )}
                                                {product.isLowStock && !product.isOutOfStock && (
                                                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 text-amber-600">
                                                        Low Stock
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {formatCurrency(product.price)}
                                                {!product.isOutOfStock && (
                                                    <span className="ml-1">
                                                        ({product.stockQuantity} available)
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </CommandItem>
                                ))
                            )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
