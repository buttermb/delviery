import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Edit, Trash2, Copy, Eye, MoreVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface InlineProductEditProps {
  product: any;
  onUpdate: (id: string, updates: any) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  isSelected: boolean;
  onToggleSelect: () => void;
}

export function InlineProductEdit({
  product,
  onUpdate,
  onDelete,
  onEdit,
  onDuplicate,
  isSelected,
  onToggleSelect,
}: InlineProductEditProps) {
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [isEditingStock, setIsEditingStock] = useState(false);
  const [editPrice, setEditPrice] = useState(product.price?.toString() || "");
  const [editStock, setEditStock] = useState(product.stock_quantity?.toString() || "0");

  const handlePriceSave = () => {
    const price = parseFloat(editPrice);
    if (!isNaN(price) && price > 0) {
      onUpdate(product.id, { price });
      setIsEditingPrice(false);
    }
  };

  const handleStockSave = () => {
    const stock = parseInt(editStock);
    if (!isNaN(stock) && stock >= 0) {
      onUpdate(product.id, { stock_quantity: stock, in_stock: stock > 0 });
      setIsEditingStock(false);
    }
  };

  const getStockBadge = () => {
    const stock = product.stock_quantity || 0;
    if (stock === 0) return <Badge variant="destructive">Out</Badge>;
    if (stock < 10) return <Badge className="bg-yellow-600">Low</Badge>;
    return <Badge className="bg-green-600">In Stock</Badge>;
  };

  return (
    <div
      className={`group relative flex items-center gap-4 p-4 border rounded-lg transition-all hover:shadow-md ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        className="h-4 w-4 rounded"
      />

      {/* Product Image */}
      <img
        src={product.image_url || "/placeholder.svg"}
        alt={product.name}
        className="h-20 w-20 rounded object-cover"
      />

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold truncate">{product.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{(product.category || 'uncategorized')}</Badge>
              {product.strain_type && (
                <Badge variant="secondary">{(product.strain_type || 'unknown')}</Badge>
              )}
            </div>
          </div>

          {/* Stock Status */}
          <div className="flex items-center gap-2">
            {getStockBadge()}
          </div>
        </div>

        {/* Quick Edit Fields */}
        <div className="grid grid-cols-2 gap-4 mt-3">
          {/* Price */}
          <div>
            <label className="text-xs text-muted-foreground">Price</label>
            {isEditingPrice ? (
              <div className="flex items-center gap-1 mt-1">
                <Input
                  type="number"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePriceSave();
                    if (e.key === "Escape") setIsEditingPrice(false);
                  }}
                />
                <Button size="sm" variant="ghost" onClick={handlePriceSave}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingPrice(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 mt-1 cursor-pointer hover:bg-accent rounded px-2 py-1"
                onClick={() => {
                  setEditPrice(product.price?.toString() || "");
                  setIsEditingPrice(true);
                }}
              >
                <span className="font-semibold">${product.price || 0}</span>
                <Edit className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          {/* Stock */}
          <div>
            <label className="text-xs text-muted-foreground">Stock</label>
            {isEditingStock ? (
              <div className="flex items-center gap-1 mt-1">
                <Input
                  type="number"
                  value={editStock}
                  onChange={(e) => setEditStock(e.target.value)}
                  className="h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleStockSave();
                    if (e.key === "Escape") setIsEditingStock(false);
                  }}
                />
                <Button size="sm" variant="ghost" onClick={handleStockSave}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingStock(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 mt-1 cursor-pointer hover:bg-accent rounded px-2 py-1"
                onClick={() => {
                  setEditStock(product.stock_quantity?.toString() || "0");
                  setIsEditingStock(true);
                }}
              >
                <span className="font-semibold">{product.stock_quantity || 0} units</span>
                <Edit className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Switch
          checked={product.in_stock}
          onCheckedChange={(checked) => onUpdate(product.id, { in_stock: checked })}
        />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(product.id)}>
              <Edit className="mr-2 h-4 w-4" />
              Full Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(product.id)}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(product.id)}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
