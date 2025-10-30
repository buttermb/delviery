import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Copy, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

interface ProductCardProps {
  product: any;
  isSelected: boolean;
  onToggleSelect: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}

export function ProductCard({
  product,
  isSelected,
  onToggleSelect,
  onToggleStatus,
  onDelete,
  onEdit,
  onDuplicate,
}: ProductCardProps) {
  const getPrice = () => {
    if (product.prices && typeof product.prices === 'object') {
      const prices = Object.values(product.prices);
      return prices[0] || product.price || 0;
    }
    return product.price || 0;
  };

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="absolute left-2 top-2 z-10 h-5 w-5"
          aria-label={`Select ${product.name}`}
          title={`Select ${product.name}`}
        />
        <div className="h-48 w-full overflow-hidden bg-muted">
          <img
            src={product.image_url || undefined}
            alt={product.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              // Silently handle missing images
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              if (target.parentElement) {
                target.parentElement.innerHTML = `
                  <div class="h-full w-full flex items-center justify-center bg-muted">
                    <div class="text-center">
                      <div class="w-12 h-12 mx-auto mb-2 bg-primary/10 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p class="text-xs text-muted-foreground">No Image</p>
                    </div>
                  </div>
                `;
              }
            }}
          />
        </div>
        <Badge
          className="absolute right-2 top-2"
          variant={product.in_stock ? "default" : "secondary"}
        >
          {product.in_stock ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="font-semibold line-clamp-1">{product.name}</h3>
          <p className="text-sm text-muted-foreground capitalize">
            {product.category || 'uncategorized'}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-lg font-bold">${getPrice()}</span>
          <Badge variant="outline">
            Stock: {product.in_stock ? "Available" : "Out"}
          </Badge>
        </div>

        <div className="flex gap-2">
          <Button onClick={onEdit} variant="outline" size="sm" className="flex-1">
            <Edit className="mr-1 h-4 w-4" />
            Edit
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleStatus}>
                {product.in_stock ? (
                  <>
                    <ToggleLeft className="mr-2 h-4 w-4" />
                    Set Inactive
                  </>
                ) : (
                  <>
                    <ToggleRight className="mr-2 h-4 w-4" />
                    Set Active
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
