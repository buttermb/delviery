import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  GripVertical, Edit, Copy, Trash2, Eye, EyeOff, 
  Check, X, DollarSign, Package, Image as ImageIcon 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProductTableViewProps {
  products: any[];
  selectedProducts: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onUpdate: (id: string, updates: any) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  visibleColumns: string[];
}

export function ProductTableView({
  products,
  selectedProducts,
  onToggleSelect,
  onSelectAll,
  onUpdate,
  onDelete,
  onEdit,
  onDuplicate,
  visibleColumns,
}: ProductTableViewProps) {
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (id: string, field: string, currentValue: any) => {
    setEditingCell({ id, field });
    setEditValue(currentValue?.toString() || "");
  };

  const saveEdit = (id: string, field: string) => {
    let value: any = editValue;
    
    if (field === "price" || field === "stock_quantity") {
      value = parseFloat(editValue);
      if (isNaN(value) || value < 0) return;
    }
    
    onUpdate(id, { [field]: value });
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const getCellContent = (product: any, field: string) => {
    const isEditing = editingCell?.id === product.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit(product.id, field);
              if (e.key === "Escape") cancelEdit();
            }}
            className="h-8 w-full"
            autoFocus
          />
          <Button size="sm" variant="ghost" onClick={() => saveEdit(product.id, field)}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={cancelEdit}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    switch (field) {
      case "name":
        return (
          <div
            className="cursor-pointer hover:bg-accent px-2 py-1 rounded"
            onClick={() => startEdit(product.id, field, product[field])}
          >
            <p className="font-medium">{product.name}</p>
            <p className="text-xs text-muted-foreground">{(product.category || 'uncategorized')}</p>
          </div>
        );
      case "price":
        return (
          <div
            className="cursor-pointer hover:bg-accent px-2 py-1 rounded flex items-center gap-1"
            onClick={() => startEdit(product.id, field, product[field])}
          >
            <DollarSign className="h-3 w-3" />
            <span className="font-semibold">{product.price || 0}</span>
          </div>
        );
      case "stock_quantity":
        return (
          <div
            className="cursor-pointer hover:bg-accent px-2 py-1 rounded"
            onClick={() => startEdit(product.id, field, product[field])}
          >
            <Badge
              variant={
                (product.stock_quantity || 0) === 0
                  ? "destructive"
                  : (product.stock_quantity || 0) < 10
                  ? "secondary"
                  : "default"
              }
            >
              {product.stock_quantity || 0} units
            </Badge>
          </div>
        );
      case "status":
        return (
          <Button
            size="sm"
            variant={product.in_stock ? "default" : "outline"}
            onClick={() => onUpdate(product.id, { in_stock: !product.in_stock })}
          >
            {product.in_stock ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
            {product.in_stock ? "Active" : "Hidden"}
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={selectedProducts.length === products.length}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead className="w-[50px]"></TableHead>
            {visibleColumns.includes("image") && <TableHead>Image</TableHead>}
            {visibleColumns.includes("name") && <TableHead>Product</TableHead>}
            {visibleColumns.includes("price") && <TableHead>Price</TableHead>}
            {visibleColumns.includes("stock") && <TableHead>Stock</TableHead>}
            {visibleColumns.includes("status") && <TableHead>Status</TableHead>}
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id} className="group">
              <TableCell>
                <Checkbox
                  checked={selectedProducts.includes(product.id)}
                  onCheckedChange={() => onToggleSelect(product.id)}
                />
              </TableCell>
              <TableCell>
                <div className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
              </TableCell>
              {visibleColumns.includes("image") && (
                <TableCell>
                  <img
                    src={product.image_url || "/placeholder.svg"}
                    alt={product.name}
                    className="h-12 w-12 rounded object-cover"
                  />
                </TableCell>
              )}
              {visibleColumns.includes("name") && (
                <TableCell>{getCellContent(product, "name")}</TableCell>
              )}
              {visibleColumns.includes("price") && (
                <TableCell>{getCellContent(product, "price")}</TableCell>
              )}
              {visibleColumns.includes("stock") && (
                <TableCell>{getCellContent(product, "stock_quantity")}</TableCell>
              )}
              {visibleColumns.includes("status") && (
                <TableCell>{getCellContent(product, "status")}</TableCell>
              )}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">•••</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(product.id)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(product.id)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(product.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
