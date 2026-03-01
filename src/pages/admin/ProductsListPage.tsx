/**
 * ProductsListPage
 * Clean, focused products list page with grid and table view toggle.
 * Part of the Products Hub functionality.
 */

import { useState, useMemo, useCallback, useRef, useEffect, useTransition } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { triggerHaptic } from '@/lib/utils/mobile';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { useDebounce } from '@/hooks/useDebounce';
import { useTablePreferences } from '@/hooks/useTablePreferences';
import { useProductArchive } from '@/hooks/useProductArchive';
import { useProductMutations } from '@/hooks/useProductMutations';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { cn } from '@/lib/utils';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Toggle } from '@/components/ui/toggle';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Shared Components
import { SearchInput } from '@/components/shared/SearchInput';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { TruncatedText } from '@/components/shared/TruncatedText';
import { InventoryStatusBadge } from '@/components/admin/InventoryStatusBadge';
import { ProductCard } from '@/components/admin/ProductCard';
import {
  ProductAdvancedFilters,
  type ProductFilters,
  defaultProductFilters,
} from '@/components/admin/products/ProductAdvancedFilters';

// Icons
import Package from "lucide-react/dist/esm/icons/package";
import Plus from "lucide-react/dist/esm/icons/plus";
import LayoutGrid from "lucide-react/dist/esm/icons/layout-grid";
import List from "lucide-react/dist/esm/icons/list";
import MoreVertical from "lucide-react/dist/esm/icons/more-vertical";
import Edit from "lucide-react/dist/esm/icons/edit";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Printer from "lucide-react/dist/esm/icons/printer";
import Store from "lucide-react/dist/esm/icons/store";
import Eye from "lucide-react/dist/esm/icons/eye";
import EyeOff from "lucide-react/dist/esm/icons/eye-off";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Archive from "lucide-react/dist/esm/icons/archive";
import ArchiveRestore from "lucide-react/dist/esm/icons/archive-restore";
import GitCompare from "lucide-react/dist/esm/icons/git-compare";
import ArrowUp from "lucide-react/dist/esm/icons/arrow-up";
import ArrowDown from "lucide-react/dist/esm/icons/arrow-down";
import ArrowUpDown from "lucide-react/dist/esm/icons/arrow-up-down";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

import type { Database } from '@/integrations/supabase/types';

import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { ProductComparison } from '@/components/admin/products/ProductComparison';
import { usePagination } from '@/hooks/usePagination';
import { StandardPagination } from '@/components/shared/StandardPagination';

type ProductRow = Database['public']['Tables']['products']['Row'];
// Extended product type to include archived_at field (added via migration)
type Product = ProductRow & { archived_at?: string | null };

type ViewMode = 'grid' | 'table';
type SortOption = 'name' | 'price' | 'stock' | 'category';
type SortOrder = 'asc' | 'desc';

export function ProductsListPage() {
  const { tenant, loading: tenantLoading } = useTenantAdminAuth();
  const navigateTenant = useTenantNavigate();
  const queryClient = useQueryClient();

  // Archive hook
  const { archiveProduct, unarchiveProduct, isLoading: isArchiveLoading } = useProductArchive();

  // Product cache invalidation
  const { invalidateProductCaches } = useProductMutations();

  // Storefront visibility toggle mutation
  const toggleStorefrontVisibility = useMutation({
    mutationFn: async ({ productId, currentVisibility }: { productId: string; currentVisibility: boolean }) => {
      if (!tenant?.id) throw new Error('Tenant required');

      const { error } = await supabase
        .from('products')
        .update({ menu_visibility: !currentVisibility })
        .eq('id', productId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      return !currentVisibility;
    },
    onSuccess: (newVisibility) => {
      invalidateProductCaches({ tenantId: tenant?.id });
      toast.success(newVisibility ? 'Product visible on storefront' : 'Product hidden from storefront');
    },
    onError: (error) => {
      logger.error('Failed to toggle storefront visibility', { error });
      toast.error('Failed to update visibility', { description: humanizeError(error) });
    },
  });

  // Table preferences for filter persistence
  const { preferences, savePreferences } = useTablePreferences('products-list', {
    sortBy: 'name',
    customFilters: {
      advancedFilters: defaultProductFilters,
    },
  });

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Advanced filters state - initialized from persisted preferences
  const [advancedFilters, setAdvancedFilters] = useState<ProductFilters>(() => {
    const saved = preferences.customFilters?.advancedFilters;
    if (saved) {
      // Parse dates back from strings
      return {
        ...defaultProductFilters,
        ...(saved as Record<string, unknown>),
        createdAfter: (saved as Record<string, unknown>).createdAfter ? new Date((saved as Record<string, unknown>).createdAfter as string) : null,
        createdBefore: (saved as Record<string, unknown>).createdBefore ? new Date((saved as Record<string, unknown>).createdBefore as string) : null,
      };
    }
    return defaultProductFilters;
  });

  // Sort option - initialized from persisted preferences
  const [sortBy, setSortBy] = useState<SortOption>(
    (preferences.sortBy as SortOption) || 'name'
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Selection state
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // Comparison dialog state
  const [showComparison, setShowComparison] = useState(false);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  // Persist filter changes
  const prevFiltersRef = useRef({ advancedFilters, sortBy });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged =
      JSON.stringify(prev.advancedFilters) !== JSON.stringify(advancedFilters) ||
      prev.sortBy !== sortBy;

    if (filtersChanged) {
      prevFiltersRef.current = { advancedFilters, sortBy };
      savePreferences({
        sortBy,
        customFilters: {
          advancedFilters: {
            ...advancedFilters,
            // Convert dates to ISO strings for storage
            createdAfter: advancedFilters.createdAfter?.toISOString() ?? null,
            createdBefore: advancedFilters.createdBefore?.toISOString() ?? null,
          },
        },
      });
    }
  }, [advancedFilters, sortBy, savePreferences]);

  // Use transition for filter changes to keep UI responsive during heavy filtering
  const [isFilterPending, startFilterTransition] = useTransition();

  // Handle advanced filter changes
  const handleAdvancedFiltersChange = useCallback((newFilters: ProductFilters) => {
    startFilterTransition(() => {
      setAdvancedFilters(newFilters);
    });
  }, []);

  // Virtual scrolling ref for grid view
  const gridParentRef = useRef<HTMLDivElement>(null);

  // Fetch products
  const {
    data: products = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: queryKeys.products.byTenant(tenant?.id ?? ''),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('Tenant required');

      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, category, vendor_name, description, image_url, wholesale_price, retail_price, cost_per_unit, available_quantity, low_stock_alert, menu_visibility, coa_url, lab_results_url, archived_at, created_at, tenant_id')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (error) {
        logger.error('Failed to fetch products', { error });
        throw error;
      }

      return data as Product[];
    },
    enabled: !!tenant?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!tenant?.id) throw new Error('Tenant required');

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success('Product deleted');
    },
    onError: (error) => {
      logger.error('Failed to delete product', { error });
      toast.error('Failed to delete product', { description: humanizeError(error) });
    },
  });

  // Derived: unique categories
  const categories = useMemo(() => {
    const cats = products
      .map((p) => p.category)
      .filter((c): c is string => Boolean(c));
    return Array.from(new Set(cats)).sort();
  }, [products]);

  // Derived: unique vendors
  const vendors = useMemo(() => {
    const vends = products
      .map((p) => p.vendor_name)
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set(vends)).sort();
  }, [products]);

  // Derived: max price for filter slider
  const maxPrice = useMemo(() => {
    return Math.max(...products.map((p) => p.wholesale_price ?? 0), 100);
  }, [products]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();

    return products
      .filter((product) => {
        // Text search filter - across name, SKU, and description
        if (searchLower) {
          const matchesSearch =
            product.name?.toLowerCase().includes(searchLower) ||
            product.sku?.toLowerCase().includes(searchLower) ||
            product.description?.toLowerCase().includes(searchLower);
          if (!matchesSearch) return false;
        }

        // Category filter
        if (
          advancedFilters.category !== 'all' &&
          product.category !== advancedFilters.category
        ) {
          return false;
        }

        // Vendor filter
        if (
          advancedFilters.vendor !== 'all' &&
          product.vendor_name !== advancedFilters.vendor
        ) {
          return false;
        }

        // Stock status filter
        const qty = product.available_quantity ?? 0;
        const lowThreshold = product.low_stock_alert ?? 10;

        if (advancedFilters.stockStatus === 'in_stock' && qty <= 0) return false;
        if (advancedFilters.stockStatus === 'out_of_stock' && qty > 0) return false;
        if (
          advancedFilters.stockStatus === 'low_stock' &&
          (qty <= 0 || qty > lowThreshold)
        )
          return false;

        // Price range filter
        const price = product.wholesale_price ?? 0;
        if (advancedFilters.priceMin !== null && price < advancedFilters.priceMin) {
          return false;
        }
        if (advancedFilters.priceMax !== null && price > advancedFilters.priceMax) {
          return false;
        }

        // Compliance status filter (based on COA/lab results presence)
        if (advancedFilters.complianceStatus !== 'all') {
          const hasCoa = Boolean(product.coa_url || product.lab_results_url);
          if (advancedFilters.complianceStatus === 'compliant' && !hasCoa) {
            return false;
          }
          if (advancedFilters.complianceStatus === 'non_compliant' && hasCoa) {
            return false;
          }
          // 'pending' is treated as products without COA that need review
          if (advancedFilters.complianceStatus === 'pending' && hasCoa) {
            return false;
          }
        }

        // Menu status filter (listed/unlisted)
        if (advancedFilters.menuStatus !== 'all') {
          const isListed = product.menu_visibility === true;
          if (advancedFilters.menuStatus === 'listed' && !isListed) {
            return false;
          }
          if (advancedFilters.menuStatus === 'unlisted' && isListed) {
            return false;
          }
        }

        // Archive status filter
        const isArchived = Boolean(product.archived_at);
        if (advancedFilters.archiveStatus === 'active' && isArchived) {
          return false;
        }
        if (advancedFilters.archiveStatus === 'archived' && !isArchived) {
          return false;
        }
        // 'all' shows both active and archived products

        // Created date range filter
        if (advancedFilters.createdAfter && product.created_at) {
          const createdDate = new Date(product.created_at);
          if (createdDate < advancedFilters.createdAfter) {
            return false;
          }
        }
        if (advancedFilters.createdBefore && product.created_at) {
          const createdDate = new Date(product.created_at);
          if (createdDate > advancedFilters.createdBefore) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case 'name':
            cmp = (a.name ?? '').localeCompare(b.name ?? '');
            break;
          case 'price':
            cmp = (a.wholesale_price ?? 0) - (b.wholesale_price ?? 0);
            break;
          case 'stock':
            cmp = (a.available_quantity ?? 0) - (b.available_quantity ?? 0);
            break;
          case 'category':
            cmp = (a.category ?? '').localeCompare(b.category ?? '');
            break;
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [products, debouncedSearch, advancedFilters, sortBy, sortOrder]);

  // Check if any advanced filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      advancedFilters.category !== 'all' ||
      advancedFilters.vendor !== 'all' ||
      advancedFilters.stockStatus !== 'all' ||
      advancedFilters.priceMin !== null ||
      advancedFilters.priceMax !== null ||
      advancedFilters.complianceStatus !== 'all' ||
      advancedFilters.menuStatus !== 'all' ||
      advancedFilters.archiveStatus !== 'active' ||
      advancedFilters.createdAfter !== null ||
      advancedFilters.createdBefore !== null
    );
  }, [advancedFilters]);

  // Pagination
  const {
    paginatedItems,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    goToPage,
    changePageSize,
    pageSizeOptions,
  } = usePagination(filteredProducts, {
    defaultPageSize: 25,
    persistInUrl: false,
  });

  // Stats
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalUnits = products.reduce(
      (sum, p) => sum + (p.available_quantity ?? 0),
      0
    );
    const inventoryValue = products.reduce(
      (sum, p) =>
        sum + (p.available_quantity ?? 0) * (p.wholesale_price ?? 0),
      0
    );
    const lowStockCount = products.filter((p) => {
      const qty = p.available_quantity ?? 0;
      const threshold = p.low_stock_alert ?? 10;
      return qty > 0 && qty <= threshold;
    }).length;

    return { totalProducts, totalUnits, inventoryValue, lowStockCount };
  }, [products]);

  // Handlers
  const handleEdit = useCallback(
    (productId: string) => {
      navigateTenant(`/admin/inventory-hub?tab=products&edit=${productId}`);
    },
    [navigateTenant]
  );

  const handleDelete = useCallback(
    (productId: string) => {
      setProductToDelete(productId);
      setDeleteDialogOpen(true);
    },
    []
  );

  const handleAddProduct = useCallback(() => {
    navigateTenant('/admin/inventory-hub?tab=products&new=true');
  }, [navigateTenant]);

  const handleToggleSelect = useCallback((productId: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedProducts.length === paginatedItems.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(paginatedItems.map((p) => p.id));
    }
  }, [selectedProducts.length, paginatedItems]);

  const handleRefresh = useCallback(async () => {
    await refetch();
    triggerHaptic('light');
  }, [refetch]);

  // Sort handler for clickable column headers
  const handleSort = useCallback((field: SortOption) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'price' || field === 'stock' ? 'desc' : 'asc');
    }
  }, [sortBy]);

  // Sortable header component for table columns
  const SortableHeader = useCallback(({ field, label }: { field: SortOption; label: string }) => {
    const isActive = sortBy === field;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 hover:bg-transparent"
        onClick={() => handleSort(field)}
      >
        <span>{label}</span>
        {isActive ? (
          sortOrder === 'asc' ? <ArrowUp className="ml-1 h-3.5 w-3.5" /> : <ArrowDown className="ml-1 h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Button>
    );
  }, [sortBy, sortOrder, handleSort]);

  // Virtual scrolling for grid view
  // Calculate items per row dynamically based on viewport
  const getColumnsPerRow = () => {
    if (typeof window === 'undefined') return 4;
    const width = window.innerWidth;
    if (width < 768) return 1; // mobile
    if (width < 1024) return 2; // tablet
    if (width < 1280) return 3; // desktop
    return 4; // xl
  };

  const columnsPerRow = getColumnsPerRow();
  const gridRowCount = Math.ceil(paginatedItems.length / columnsPerRow);

  const gridVirtualizer = useVirtualizer({
    count: gridRowCount,
    getScrollElement: () => gridParentRef.current,
    estimateSize: () => 400, // Estimated height of each row (card height + gap)
    overscan: 2, // Render 2 extra rows above/below viewport
  });

  // Table columns
  const columns: ResponsiveColumn<Product>[] = [
    {
      header: (
        <Checkbox
          checked={
            paginatedItems.length > 0 &&
            selectedProducts.length === paginatedItems.length
          }
          onCheckedChange={handleSelectAll}
          aria-label="Select all"
        />
      ),
      className: 'w-[50px]',
      cell: (product) => (
        <Checkbox
          checked={selectedProducts.includes(product.id)}
          onCheckedChange={() => handleToggleSelect(product.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      header: 'Image',
      accessorKey: 'image_url',
      className: 'hidden lg:table-cell',
      cell: (product) => (
        <img
          src={product.image_url || '/placeholder.svg'}
          alt={product.name}
          className="h-10 w-10 rounded-md object-cover border"
          loading="lazy"
        />
      ),
    },
    {
      header: <SortableHeader field="name" label="Product" />,
      accessorKey: 'name',
      className: 'max-w-[200px]',
      cell: (product) => (
        <div className="flex flex-col max-w-[200px] min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <TruncatedText text={product.name} className="font-medium" />
            {product.archived_at && (
              <Badge variant="secondary" className="text-xs shrink-0">
                Archived
              </Badge>
            )}
          </div>
          {product.sku && (
            <TruncatedText
              text={`SKU: ${product.sku}`}
              className="text-xs text-muted-foreground"
              maxWidthClass="max-w-[200px]"
            />
          )}
        </div>
      ),
    },
    {
      header: <SortableHeader field="category" label="Category" />,
      accessorKey: 'category',
      className: 'max-w-[150px] hidden lg:table-cell',
      cell: (product) => (
        <Badge variant="outline" className="capitalize max-w-[140px] inline-flex overflow-hidden">
          <TruncatedText
            text={product.category || 'Uncategorized'}
            maxWidthClass="max-w-[120px]"
          />
        </Badge>
      ),
    },
    {
      header: <SortableHeader field="price" label="Price" />,
      accessorKey: 'wholesale_price',
      className: 'text-right',
      cell: (product) => (
        <span className="font-mono font-medium">
          {product.wholesale_price ? `$${product.wholesale_price}` : '-'}
        </span>
      ),
    },
    {
      header: <SortableHeader field="stock" label="Stock" />,
      accessorKey: 'available_quantity',
      cell: (product) => (
        <div className="flex items-center gap-2">
          <span className="font-mono">{product.available_quantity ?? 0}</span>
          <InventoryStatusBadge
            quantity={product.available_quantity ?? 0}
            lowStockThreshold={product.low_stock_alert ?? 10}
          />
        </div>
      ),
    },
    {
      header: 'Storefront',
      className: 'hidden md:table-cell',
      cell: (product) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={product.menu_visibility === true}
            disabled={toggleStorefrontVisibility.isPending}
            onCheckedChange={() =>
              toggleStorefrontVisibility.mutate({
                productId: product.id,
                currentVisibility: product.menu_visibility === true,
              })
            }
            aria-label={`Toggle storefront visibility for ${product.name}`}
          />
          <span className="text-xs text-muted-foreground">
            {product.menu_visibility ? 'Visible' : 'Hidden'}
          </span>
        </div>
      accessorKey: 'menu_visibility',
      className: 'text-center hidden lg:table-cell',
      cell: (product) => (
        <Badge
          variant="outline"
          className={product.menu_visibility
            ? "text-green-700 border-green-300 bg-green-50 dark:text-green-400 dark:border-green-700 dark:bg-green-950 gap-1"
            : "text-muted-foreground border-muted bg-muted/30 gap-1"
          }
        >
          {product.menu_visibility
            ? <><Eye className="h-3 w-3" /> Listed</>
            : <><EyeOff className="h-3 w-3" /> Unlisted</>
          }
        </Badge>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (product) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="More options">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(product.id)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const printWindow = window.open('', '_blank', 'noopener,noreferrer');
              if (printWindow) {
                printWindow.document.write(`
                  <html><head><title>Label: ${product.name}</title>
                  <style>body{font-family:Arial,sans-serif;padding:20px;text-align:center}
                  .label{border:2px solid #000;padding:20px;max-width:300px;margin:0 auto}
                  .name{font-size:18px;font-weight:bold;margin-bottom:8px}
                  .sku{font-size:14px;color:#555;margin-bottom:4px}
                  .price{font-size:16px;font-weight:bold;margin-top:8px}</style></head>
                  <body><div class="label">
                  <div class="name">${product.name}</div>
                  ${product.sku ? `<div class="sku">SKU: ${product.sku}</div>` : ''}
                  ${product.category ? `<div class="sku">${product.category}</div>` : ''}
                  <div class="price">${product.wholesale_price ? `$${product.wholesale_price}` : ''}</div>
                  </div></body></html>`);
                printWindow.document.close();
                printWindow.print();
              }
            }}>
              <Printer className="mr-2 h-4 w-4" /> Print Label
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigateTenant(`/admin/inventory-hub?tab=products&edit=${product.id}`)}>
              <Store className="mr-2 h-4 w-4" /> Publish to Store
            </DropdownMenuItem>
            {product.archived_at ? (
              <DropdownMenuItem
                onClick={() => unarchiveProduct(product.id)}
                disabled={isArchiveLoading}
              >
                <ArchiveRestore className="mr-2 h-4 w-4" /> Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => archiveProduct(product.id)}
                disabled={isArchiveLoading}
              >
                <Archive className="mr-2 h-4 w-4" /> Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus-visible:text-destructive"
              onClick={() => handleDelete(product.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Mobile card renderer
  const renderMobileProduct = (product: Product) => (
    <ProductCard
      product={{
        id: product.id,
        name: product.name,
        category: product.category || undefined,
        image_url: product.image_url || undefined,
        sku: product.sku || undefined,
        available_quantity: product.available_quantity ?? 0,
        low_stock_alert: product.low_stock_alert ?? 10,
        wholesale_price: product.wholesale_price ?? 0,
        cost_per_unit: product.cost_per_unit ?? 0,
        menu_visibility: product.menu_visibility,
      }}
      onEdit={() => handleEdit(product.id)}
      onDelete={() => handleDelete(product.id)}
      onToggleStorefrontVisibility={(id) =>
        toggleStorefrontVisibility.mutate({
          productId: id,
          currentVisibility: product.menu_visibility === true,
        })
      }
      isTogglingVisibility={toggleStorefrontVisibility.isPending}
    />
  );

  // Loading state
  if (tenantLoading || isLoading) {
    return (
      <div className="w-full max-w-full px-4 sm:px-4 py-4 sm:py-4 space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Products grid skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="border rounded-lg p-4 space-y-3">
                  <Skeleton className="h-32 w-full rounded" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex justify-between">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="w-full max-w-full px-4 sm:px-4 py-4 sm:py-4 space-y-4 sm:space-y-4 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-bold">Products</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your product catalog
          </p>
        </div>
        <Button onClick={handleAddProduct}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Stats Cards — hidden when error with no cached data (zeros are misleading) */}
      {!(isError && products.length === 0) && <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.totalProducts}</p>
                <p className="text-sm text-muted-foreground">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Package className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalUnits}</p>
                <p className="text-sm text-muted-foreground">Available Units</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <DollarSign className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">
                  ${stats.inventoryValue.toFixed(0)}
                </p>
                <p className="text-sm text-muted-foreground">Inventory Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Package className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats.lowStockCount}</p>
                <p className="text-sm text-muted-foreground">Low Stock Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>}

      {/* Error State — no cached data */}
      {isError && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <p className="font-semibold text-destructive">Failed to load products</p>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Something went wrong while fetching your products. Please try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Retrying...' : 'Try Again'}
          </Button>
        </div>
      )}

      {/* Error banner — cached data still available */}
      {isError && products.length > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive bg-destructive/5 px-4 py-3">
          <p className="text-destructive text-sm">
            Failed to refresh products. Showing cached data.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </div>
      )}

      {/* Search, Filters, and Products — hidden when error with no data */}
      {!(isError && products.length === 0) && <>
      <div className="flex flex-col gap-3">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="w-full sm:flex-1">
            <SearchInput
              placeholder="Search by name, SKU, or description..."
              onSearch={setSearchTerm}
              defaultValue={searchTerm}
              className="w-full"
            />
          </div>

          {/* Sort Dropdown and View Toggle */}
          <div className="flex items-center gap-2">
            <Select
              value={sortBy}
              onValueChange={(v) => {
                const field = v as SortOption;
                setSortBy(field);
                setSortOrder(field === 'price' || field === 'stock' ? 'desc' : 'asc');
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="stock">Stock</SelectItem>
                <SelectItem value="category">Category</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 border rounded-md overflow-hidden bg-background">
              <Toggle
                pressed={viewMode === 'grid'}
                onPressedChange={() => setViewMode('grid')}
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-0 rounded-none h-9 w-9 p-0"
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Toggle>
              <Toggle
                pressed={viewMode === 'table'}
                onPressedChange={() => setViewMode('table')}
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-0 rounded-none border-l h-9 w-9 p-0"
                aria-label="Table view"
              >
                <List className="h-4 w-4" />
              </Toggle>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        <ProductAdvancedFilters
          filters={advancedFilters}
          onFiltersChange={handleAdvancedFiltersChange}
          categories={categories}
          vendors={vendors}
          maxPrice={maxPrice}
        />
      </div>

      {/* Products Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Products ({filteredProducts.length})</CardTitle>
            {selectedProducts.length > 0 && (
              <div className="flex items-center gap-2">
                {selectedProducts.length >= 2 && selectedProducts.length <= 4 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowComparison(true)}
                  >
                    <GitCompare className="h-4 w-4 mr-2" />
                    Compare ({selectedProducts.length})
                  </Button>
                )}
                <Badge variant="secondary">
                  {selectedProducts.length} selected
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className={cn("p-0 sm:p-6 transition-opacity", isFilterPending && "opacity-60")}>
          {paginatedItems.length > 0 ? (
            viewMode === 'grid' ? (
              <div
                ref={gridParentRef}
                className="overflow-auto p-4 sm:p-0"
                style={{ height: '600px' }}
              >
                <div
                  style={{
                    height: `${gridVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {gridVirtualizer.getVirtualItems().map((virtualRow) => {
                    const startIndex = virtualRow.index * columnsPerRow;
                    const rowProducts = paginatedItems.slice(
                      startIndex,
                      startIndex + columnsPerRow
                    );

                    return (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {rowProducts.map((product) => (
                            <ProductCard
                              key={product.id}
                              product={{
                                id: product.id,
                                name: product.name,
                                category: product.category || undefined,
                                image_url: product.image_url || undefined,
                                sku: product.sku || undefined,
                                available_quantity: product.available_quantity ?? 0,
                                low_stock_alert: product.low_stock_alert ?? 10,
                                wholesale_price: product.wholesale_price ?? 0,
                                cost_per_unit: product.cost_per_unit ?? 0,
                                menu_visibility: product.menu_visibility,
                              }}
                              onEdit={() => handleEdit(product.id)}
                              onDelete={() => handleDelete(product.id)}
                              onToggleStorefrontVisibility={(id) =>
                                toggleStorefrontVisibility.mutate({
                                  productId: id,
                                  currentVisibility: product.menu_visibility === true,
                                })
                              }
                              isTogglingVisibility={toggleStorefrontVisibility.isPending}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="-mx-4 sm:mx-0">
                <ResponsiveTable
                  columns={columns}
                  data={paginatedItems}
                  keyExtractor={(item) => item.id}
                  isLoading={false}
                  mobileRenderer={renderMobileProduct}
                  virtualize={true}
                  virtualizeHeight={600}
                  virtualizeRowHeight={73}
                  virtualizeThreshold={10}
                />
              </div>
            )
          ) : (
            <EnhancedEmptyState
              type="no_products"
              title={
                searchTerm || hasActiveFilters
                  ? 'No products found'
                  : undefined
              }
              description={
                searchTerm || hasActiveFilters
                  ? 'Try adjusting your search or filters to find products'
                  : undefined
              }
              primaryAction={
                !searchTerm && !hasActiveFilters
                  ? {
                      label: 'Add Product',
                      onClick: handleAddProduct,
                      icon: <Plus className="h-4 w-4" />,
                    }
                  : undefined
              }
              designSystem="tenant-admin"
            />
          )}
        </CardContent>

        {/* Pagination */}
        {filteredProducts.length > 0 && (
          <StandardPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            pageSizeOptions={pageSizeOptions}
            onPageChange={goToPage}
            onPageSizeChange={changePageSize}
          />
        )}
      </Card>
      </>}

      {/* Product Comparison Dialog */}
      <ProductComparison
        productIds={selectedProducts}
        open={showComparison}
        onClose={() => setShowComparison(false)}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (productToDelete) {
            deleteMutation.mutate(productToDelete);
            setDeleteDialogOpen(false);
            setProductToDelete(null);
          }
        }}
        itemType="product"
        isLoading={deleteMutation.isPending}
      />
    </div>
    </PullToRefresh>
  );
}

export default ProductsListPage;
