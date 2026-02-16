import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import Download from "lucide-react/dist/esm/icons/download";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import FileSpreadsheet from "lucide-react/dist/esm/icons/file-spreadsheet";
import FileText from "lucide-react/dist/esm/icons/file-text";
import FileJson from "lucide-react/dist/esm/icons/file-json";
import {
  exportToCSV,
  exportToJSON,
  generateExportFilename,
  type ExportColumn
} from '@/lib/utils/exportUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

export interface ProductExportField {
  key: keyof Product;
  label: string;
  description?: string;
  group: 'basic' | 'pricing' | 'inventory' | 'cannabis' | 'lab' | 'marketing' | 'metadata';
  type?: 'string' | 'number' | 'currency' | 'percent' | 'date' | 'boolean';
  recommended?: boolean;
}

const PRODUCT_EXPORT_FIELDS: ProductExportField[] = [
  // Basic Information
  { key: 'name', label: 'Product Name', group: 'basic', type: 'string', recommended: true },
  { key: 'sku', label: 'SKU', group: 'basic', type: 'string', recommended: true },
  { key: 'barcode', label: 'Barcode', group: 'basic', type: 'string' },
  { key: 'category', label: 'Category', group: 'basic', type: 'string', recommended: true },
  { key: 'description', label: 'Description', group: 'basic', type: 'string' },

  // Pricing & Costs
  { key: 'cost_per_unit', label: 'Cost Per Unit', group: 'pricing', type: 'currency' },
  { key: 'wholesale_price', label: 'Wholesale Price', group: 'pricing', type: 'currency', recommended: true },
  { key: 'retail_price', label: 'Retail Price', group: 'pricing', type: 'currency' },
  { key: 'sale_price', label: 'Sale Price', group: 'pricing', type: 'currency' },
  { key: 'price_per_lb', label: 'Price Per Pound', group: 'pricing', type: 'currency' },

  // Inventory
  { key: 'available_quantity', label: 'Available Quantity', group: 'inventory', type: 'number', recommended: true },
  { key: 'reserved_quantity', label: 'Reserved Quantity', group: 'inventory', type: 'number' },
  { key: 'fronted_quantity', label: 'Fronted Quantity', group: 'inventory', type: 'number' },
  { key: 'total_quantity', label: 'Total Quantity', group: 'inventory', type: 'number' },
  { key: 'stock_quantity', label: 'Stock Quantity', group: 'inventory', type: 'number' },
  { key: 'low_stock_alert', label: 'Low Stock Alert Threshold', group: 'inventory', type: 'number' },
  { key: 'in_stock', label: 'In Stock', group: 'inventory', type: 'boolean' },

  // Cannabis-Specific
  { key: 'strain_name', label: 'Strain Name', group: 'cannabis', type: 'string', recommended: true },
  { key: 'strain_type', label: 'Strain Type', group: 'cannabis', type: 'string' },
  { key: 'strain_info', label: 'Strain Info', group: 'cannabis', type: 'string' },
  { key: 'strain_lineage', label: 'Strain Lineage', group: 'cannabis', type: 'string' },
  { key: 'vendor_name', label: 'Vendor Name', group: 'cannabis', type: 'string', recommended: true },
  { key: 'batch_number', label: 'Batch Number', group: 'cannabis', type: 'string' },
  { key: 'is_concentrate', label: 'Is Concentrate', group: 'cannabis', type: 'boolean' },
  { key: 'weight_grams', label: 'Weight (Grams)', group: 'cannabis', type: 'number' },

  // Lab & Potency
  { key: 'thc_percent', label: 'THC %', group: 'lab', type: 'number', recommended: true },
  { key: 'thc_content', label: 'THC Content', group: 'lab', type: 'number' },
  { key: 'thca_percentage', label: 'THCA %', group: 'lab', type: 'number' },
  { key: 'cbd_percent', label: 'CBD %', group: 'lab', type: 'number' },
  { key: 'cbd_content', label: 'CBD Content', group: 'lab', type: 'number' },
  { key: 'test_date', label: 'Test Date', group: 'lab', type: 'date' },
  { key: 'lab_name', label: 'Lab Name', group: 'lab', type: 'string' },
  { key: 'coa_url', label: 'COA URL', group: 'lab', type: 'string' },
  { key: 'coa_pdf_url', label: 'COA PDF URL', group: 'lab', type: 'string' },
  { key: 'lab_results_url', label: 'Lab Results URL', group: 'lab', type: 'string' },

  // Marketing & Display
  { key: 'image_url', label: 'Image URL', group: 'marketing', type: 'string' },
  { key: 'menu_visibility', label: 'Menu Visibility', group: 'marketing', type: 'boolean' },
  { key: 'average_rating', label: 'Average Rating', group: 'marketing', type: 'number' },
  { key: 'review_count', label: 'Review Count', group: 'marketing', type: 'number' },

  // Metadata
  { key: 'id', label: 'Product ID', group: 'metadata', type: 'string' },
  { key: 'created_at', label: 'Created Date', group: 'metadata', type: 'date' },
  { key: 'version', label: 'Version', group: 'metadata', type: 'number' },
];

const FIELD_GROUPS = [
  { id: 'basic', label: 'Basic Information', icon: '📋' },
  { id: 'pricing', label: 'Pricing & Costs', icon: '💰' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'cannabis', label: 'Cannabis-Specific', icon: '🌿' },
  { id: 'lab', label: 'Lab & Potency', icon: '🔬' },
  { id: 'marketing', label: 'Marketing & Display', icon: '🎨' },
  { id: 'metadata', label: 'Metadata', icon: '🏷️' },
] as const;

type ExportFormat = 'csv' | 'excel' | 'json';

interface ProductBulkExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
}

export function ProductBulkExportDialog({
  open,
  onOpenChange,
  products,
}: ProductBulkExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');

  // Initialize with recommended fields
  const [selectedFields, setSelectedFields] = useState<Set<keyof Product>>(() => {
    const recommended = PRODUCT_EXPORT_FIELDS
      .filter(f => f.recommended)
      .map(f => f.key);
    return new Set(recommended);
  });

  // Group fields by category
  const fieldsByGroup = useMemo(() => {
    const groups: Record<string, ProductExportField[]> = {};
    for (const field of PRODUCT_EXPORT_FIELDS) {
      if (!groups[field.group]) {
        groups[field.group] = [];
      }
      groups[field.group].push(field);
    }
    return groups;
  }, []);

  // Toggle field selection
  const toggleField = useCallback((key: keyof Product) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Toggle entire group
  const toggleGroup = useCallback((groupId: string) => {
    const groupFields = fieldsByGroup[groupId];
    if (!groupFields) return;

    const groupKeys = groupFields.map(f => f.key);
    const allSelected = groupKeys.every(k => selectedFields.has(k));

    setSelectedFields(prev => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all in group
        groupKeys.forEach(k => next.delete(k));
      } else {
        // Select all in group
        groupKeys.forEach(k => next.add(k));
      }
      return next;
    });
  }, [fieldsByGroup, selectedFields]);

  // Select/deselect actions
  const selectAll = useCallback(() => {
    setSelectedFields(new Set(PRODUCT_EXPORT_FIELDS.map(f => f.key)));
  }, []);

  const selectNone = useCallback(() => {
    setSelectedFields(new Set());
  }, []);

  const selectRecommended = useCallback(() => {
    const recommended = PRODUCT_EXPORT_FIELDS
      .filter(f => f.recommended)
      .map(f => f.key);
    setSelectedFields(new Set(recommended));
  }, []);

  // Check if group is fully/partially selected
  const getGroupState = useCallback((groupId: string): 'all' | 'some' | 'none' => {
    const groupFields = fieldsByGroup[groupId];
    if (!groupFields) return 'none';

    const selectedCount = groupFields.filter(f => selectedFields.has(f.key)).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === groupFields.length) return 'all';
    return 'some';
  }, [fieldsByGroup, selectedFields]);

  // Build export columns from selected fields
  const buildExportColumns = useCallback((): ExportColumn<Product>[] => {
    return PRODUCT_EXPORT_FIELDS
      .filter(f => selectedFields.has(f.key))
      .map(f => ({
        key: f.key,
        header: f.label,
        type: f.type || 'string',
      }));
  }, [selectedFields]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (selectedFields.size === 0) {
      toast.error('Please select at least one field to export');
      return;
    }

    if (products.length === 0) {
      toast.error('No products to export');
      return;
    }

    setIsExporting(true);

    try {
      const columns = buildExportColumns();
      const filename = generateExportFilename('products', exportFormat === 'excel' ? 'xlsx' : exportFormat);

      if (exportFormat === 'json') {
        // For JSON, only include selected fields
        const selectedKeys = Array.from(selectedFields);
        const filteredData = products.map(product => {
          const filtered: Record<string, unknown> = {};
          for (const key of selectedKeys) {
            filtered[key] = product[key];
          }
          return filtered;
        });
        exportToJSON(filteredData, filename);
      } else if (exportFormat === 'excel') {
        // Dynamic import for Excel
        const XLSX = await import('xlsx');
        const headers = columns.map(c => c.header);
        const keys = columns.map(c => c.key);

        const wsData = [
          headers,
          ...products.map(row => keys.map(key => {
            const value = row[key];
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);
          }))
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Products');
        XLSX.writeFile(wb, filename);
      } else {
        // CSV export
        exportToCSV(products, columns, filename);
      }

      toast.success(`Exported ${products.length} products to ${exportFormat.toUpperCase()}`);
      onOpenChange(false);
    } catch {
      toast.error('Failed to export products');
    } finally {
      setIsExporting(false);
    }
  }, [selectedFields, products, exportFormat, buildExportColumns, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Export Products</DialogTitle>
          <DialogDescription>
            Select the fields you want to include in your export.
            <span className="block mt-1">
              <Badge variant="secondary" className="font-mono">
                {products.length} {products.length === 1 ? 'product' : 'products'}
              </Badge>
              {' will be exported with '}
              <Badge variant="outline" className="font-mono">
                {selectedFields.size} {selectedFields.size === 1 ? 'field' : 'fields'}
              </Badge>
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Quick select:</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={selectRecommended}
            className="h-7 text-xs"
          >
            Recommended
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="h-7 text-xs"
          >
            All
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={selectNone}
            className="h-7 text-xs"
          >
            None
          </Button>
        </div>

        <Separator />

        {/* Field Selection */}
        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-4 pb-4">
            {FIELD_GROUPS.map(group => {
              const groupState = getGroupState(group.id);
              const groupFields = fieldsByGroup[group.id] || [];

              return (
                <div key={group.id} className="space-y-2">
                  {/* Group Header */}
                  <div
                    className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded-md p-1.5 -mx-1.5"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <Checkbox
                      checked={groupState === 'all'}
                      ref={(el) => {
                        if (el) {
                          (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = groupState === 'some';
                        }
                      }}
                      onCheckedChange={() => toggleGroup(group.id)}
                      className="mr-1"
                    />
                    <span className="text-base">{group.icon}</span>
                    <span className="font-medium text-sm">{group.label}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {groupFields.filter(f => selectedFields.has(f.key)).length}/{groupFields.length}
                    </Badge>
                  </div>

                  {/* Group Fields */}
                  <div className="grid grid-cols-2 gap-1 pl-8">
                    {groupFields.map(field => (
                      <div
                        key={field.key}
                        className={cn(
                          'flex items-center gap-2 p-1.5 rounded-md cursor-pointer',
                          'hover:bg-accent/50 transition-colors',
                          field.recommended && 'bg-primary/5'
                        )}
                        onClick={() => toggleField(field.key)}
                      >
                        <Checkbox
                          checked={selectedFields.has(field.key)}
                          onCheckedChange={() => toggleField(field.key)}
                        />
                        <Label className="text-sm cursor-pointer flex-1">
                          {field.label}
                          {field.recommended && (
                            <span className="text-xs text-primary ml-1">★</span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <Separator />

        {/* Export Format Selection */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Format:</span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant={exportFormat === 'csv' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setExportFormat('csv')}
              className="h-8"
            >
              <FileText className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button
              type="button"
              variant={exportFormat === 'excel' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setExportFormat('excel')}
              className="h-8"
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Excel
            </Button>
            <Button
              type="button"
              variant={exportFormat === 'json' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setExportFormat('json')}
              className="h-8"
            >
              <FileJson className="h-4 w-4 mr-1" />
              JSON
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedFields.size === 0}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export {exportFormat.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
