import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  flexRender,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  GripVertical, Edit, Copy, Trash2, Eye, EyeOff,
  Check, X, DollarSign, ArrowUpDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Search, Printer
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColumnVisibilityControl } from "./ColumnVisibilityControl";

interface Product {
  id: string;
  name: string;
  category?: string;
  price?: number;
  stock_quantity?: number;
  in_stock?: boolean;
  image_url?: string;
}

interface EnhancedProductTableProps {
  products: Product[];
  selectedProducts: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onUpdate: (id: string, updates: any) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onPrintLabel?: (product: Product) => void;
}

export function EnhancedProductTable({
  products,
  selectedProducts,
  onToggleSelect,
  onSelectAll,
  onUpdate,
  onDelete,
  onEdit,
  onDuplicate,
  onPrintLabel,
}: EnhancedProductTableProps) {
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

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

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        id: "select",
        size: 50,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => {
              table.toggleAllPageRowsSelected(!!value);
              if (value) {
                onSelectAll();
              }
            }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedProducts.includes(row.original.id)}
            onCheckedChange={() => onToggleSelect(row.original.id)}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: "drag",
        size: 50,
        header: "",
        cell: () => (
          <div className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "image_url",
        id: "image",
        header: "Image",
        cell: ({ row }) => (
          <img
            src={row.original.image_url || "/placeholder.svg"}
            alt={row.original.name}
            className="h-12 w-12 rounded object-cover"
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Product
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const isEditing = editingCell?.id === row.original.id && editingCell?.field === "name";

          if (isEditing) {
            return (
              <div className="flex items-center gap-1">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(row.original.id, "name");
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="h-8"
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={() => saveEdit(row.original.id, "name")}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          }

          return (
            <div
              className="cursor-pointer hover:bg-accent px-2 py-1 rounded"
              onClick={() => startEdit(row.original.id, "name", row.original.name)}
            >
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">{row.original.category || "uncategorized"}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "price",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Price
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const isEditing = editingCell?.id === row.original.id && editingCell?.field === "price";

          if (isEditing) {
            return (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(row.original.id, "price");
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="h-8"
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={() => saveEdit(row.original.id, "price")}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          }

          return (
            <div
              className="cursor-pointer hover:bg-accent px-2 py-1 rounded flex items-center gap-1"
              onClick={() => startEdit(row.original.id, "price", row.original.price)}
            >
              <DollarSign className="h-3 w-3" />
              <span className="font-semibold">{row.original.price || 0}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "stock_quantity",
        id: "stock",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Stock
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const isEditing = editingCell?.id === row.original.id && editingCell?.field === "stock_quantity";
          const stockQty = row.original.stock_quantity || 0;

          if (isEditing) {
            return (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(row.original.id, "stock_quantity");
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="h-8"
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={() => saveEdit(row.original.id, "stock_quantity")}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          }

          return (
            <div
              className="cursor-pointer hover:bg-accent px-2 py-1 rounded"
              onClick={() => startEdit(row.original.id, "stock_quantity", stockQty)}
            >
              <Badge
                variant={stockQty === 0 ? "destructive" : stockQty < 10 ? "secondary" : "default"}
              >
                {stockQty} units
              </Badge>
            </div>
          );
        },
      },
      {
        accessorKey: "in_stock",
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Button
            size="sm"
            variant={row.original.in_stock ? "default" : "outline"}
            onClick={() => onUpdate(row.original.id, { in_stock: !row.original.in_stock })}
          >
            {row.original.in_stock ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
            {row.original.in_stock ? "Active" : "Hidden"}
          </Button>
        ),
      },
      {
        id: "actions",
        size: 100,
        header: "Actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">•••</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(row.original.id)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(row.original.id)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              {onPrintLabel && (row.original as any).sku && (
                <DropdownMenuItem onClick={() => onPrintLabel(row.original)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print Label
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onDelete(row.original.id)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [editingCell, editValue, selectedProducts, onToggleSelect, onSelectAll, onUpdate, onEdit, onDuplicate, onDelete, onPrintLabel]
  );

  const table = useReactTable({
    data: products,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const availableColumns = [
    { id: "image", label: "Image" },
    { id: "name", label: "Product" },
    { id: "price", label: "Price" },
    { id: "stock", label: "Stock" },
    { id: "status", label: "Status" },
  ];

  const visibleColumns = availableColumns
    .filter((col) => table.getColumn(col.id)?.getIsVisible())
    .map((col) => col.id);

  return (
    <div className="space-y-4">
      {/* Filters and Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <ColumnVisibilityControl
          visibleColumns={visibleColumns}
          onToggleColumn={(columnId) => {
            const column = table.getColumn(columnId);
            column?.toggleVisibility(!column.getIsVisible());
          }}
          availableColumns={availableColumns}
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="group">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{" "}
            of {table.getFilteredRowModel().rows.length} products
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm">Rows per page</p>
            <Select
              value={table.getState().pagination.pageSize.toString()}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 50, 100].map((pageSize) => (
                  <SelectItem key={pageSize} value={pageSize.toString()}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 px-2">
              <span className="text-sm">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
