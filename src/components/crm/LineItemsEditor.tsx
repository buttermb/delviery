import { useState, useCallback, useMemo } from "react";
import { Plus, Trash2, ChevronsUpDown, Check, AlertTriangle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatCurrency } from "@/utils/formatters";
import { useProducts } from "@/hooks/crm/useProducts";
import type { Product } from "@/hooks/crm/useProducts";
import type { LineItem } from "@/types/crm";

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

export function LineItemsEditor({ items, onChange, onValidationChange }: LineItemsEditorProps) {
    const { data: products = [], isLoading } = useProducts();

    // Create a map of product ID to product for quick lookups
    const productMap = useMemo(() => {
        const map = new Map<string, Product>();
        products.forEach((p) => map.set(p.id, p));
        return map;
    }, [products]);

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
    }, [items, products, validateInventory, onValidationChange]);

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

    const handleUpdateItem = (index: number, field: keyof LineItem, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        if (field === "quantity") {
            item.quantity = Number(value);
        } else if (field === "unit_price") {
            item.unit_price = Number(value);
        } else if (field === "description") {
            item.description = value;
        } else if (field === "item_id") {
            // When product is selected
            const product = products?.find((p) => p.id === value);
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

    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[35%]">Item / Description</TableHead>
                            <TableHead className="w-[12%]">Stock</TableHead>
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

                                return (
                                    <TableRow
                                        key={item.id || index}
                                        className={cn(hasStockIssue && "bg-destructive/5")}
                                    >
                                        <TableCell>
                                            <div className="flex flex-col gap-2">
                                                <ProductSelector
                                                    value={item.item_id}
                                                    onSelect={(productId) => handleUpdateItem(index, "item_id", productId)}
                                                    products={products || []}
                                                    isLoading={isLoading}
                                                />
                                                <Input
                                                    placeholder="Description (optional)"
                                                    value={item.description}
                                                    onChange={(e) => handleUpdateItem(index, "description", e.target.value)}
                                                    className="h-8 text-xs"
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
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => handleUpdateItem(index, "quantity", e.target.value)}
                                                    className={cn(
                                                        "h-9",
                                                        hasStockIssue && "border-destructive focus-visible:ring-destructive"
                                                    )}
                                                />
                                                {stockInfo?.isInsufficientStock && !stockInfo.isOutOfStock && (
                                                    <span className="text-[10px] text-amber-600 font-medium">
                                                        Max: {stockInfo.available}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="relative">
                                                <span className="absolute left-2 top-2.5 text-muted-foreground">$</span>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.unit_price}
                                                    onChange={(e) => handleUpdateItem(index, "unit_price", e.target.value)}
                                                    className="pl-6 h-9"
                                                />
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
}

function ProductSelector({ value, onSelect, products, isLoading }: ProductSelectorProps) {
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
                        !value && "text-muted-foreground"
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
                                <CommandItem disabled>Loading...</CommandItem>
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
