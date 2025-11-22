import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronsUpDown, Check } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import { useProducts } from "@/hooks/crm/useProducts";
import { LineItem } from "@/types/crm";

interface LineItemsEditorProps {
    items: LineItem[];
    onChange: (items: LineItem[]) => void;
}

export function LineItemsEditor({ items, onChange }: LineItemsEditorProps) {
    const { useProductsQuery } = useProducts();
    const { data: products, isLoading } = useProductsQuery();

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
                            <TableHead className="w-[40%]">Item / Description</TableHead>
                            <TableHead className="w-[15%]">Quantity</TableHead>
                            <TableHead className="w-[20%]">Unit Price</TableHead>
                            <TableHead className="w-[20%] text-right">Total</TableHead>
                            <TableHead className="w-[5%]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No items added. Click "Add Item" to start.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item, index) => (
                                <TableRow key={item.id || index}>
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
                                        <Input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleUpdateItem(index, "quantity", e.target.value)}
                                            className="h-9"
                                        />
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
                            ))
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
    products: any[];
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
                    {selectedProduct ? selectedProduct.name : "Select product..."}
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
                                        value={product.name} // Search by name
                                        onSelect={() => {
                                            onSelect(product.id);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === product.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col">
                                            <span>{product.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatCurrency(product.price)}
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
