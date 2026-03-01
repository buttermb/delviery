import { logger } from '@/lib/logger';
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "@/components/unsaved-changes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useSearchParams } from "react-router-dom";
import { useTenantNavigate } from "@/hooks/useTenantNavigate";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";
import { useOptimisticList } from "@/hooks/useOptimisticUpdate";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { useOptimisticLock } from "@/hooks/useOptimisticLock";
import { useProductMutations } from "@/hooks/useProductMutations";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sanitizeSearchInput } from "@/lib/sanitizeSearch";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Barcode,
  Copy,
  DollarSign,
  LayoutGrid,
  List,
  Filter,
  Printer,
  MoreVertical,
  Store,
} from "lucide-react";
import { TooltipGuide } from '@/components/shared/TooltipGuide';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductCard } from "@/components/admin/ProductCard";
import { Toggle } from "@/components/ui/toggle";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductLabel } from "@/components/admin/ProductLabel";
import { BarcodeScanner } from "@/components/admin/BarcodeScanner";
import { BatchPanel } from "@/components/admin/BatchPanel";
import { BulkPriceEditor } from "@/components/admin/BulkPriceEditor";
import { BatchCategoryEditor } from "@/components/admin/BatchCategoryEditor";
import { ProductImportDialog } from "@/components/admin/ProductImportDialog";
import { ProductForm, type ProductFormData } from "@/components/admin/products/ProductForm";
import { useProductDuplicate } from "@/hooks/useProductDuplicate";
import { useEncryption } from "@/lib/hooks/useEncryption";
import type { Database } from "@/integrations/supabase/types";
import { Checkbox } from "@/components/ui/checkbox";
import { InventoryStatusBadge } from "@/components/admin/InventoryStatusBadge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import CopyButton from "@/components/CopyButton";
import { ExportButton } from "@/components/ui/ExportButton";
import { InlineEditableCell } from "@/components/admin/products/InlineEditableCell";
import { ProductMarginBadge } from "@/components/admin/products/ProductMarginBadge";
import { ColumnVisibilityControl } from "@/components/admin/ColumnVisibilityControl";
import { AdminToolbar } from "@/components/admin/shared/AdminToolbar";
import { AdminDataTable } from "@/components/admin/shared/AdminDataTable";

type Product = Database['public']['Tables']['products']['Row'] & {
  // Add fields that might be missing from generated types or are dynamic
  metrc_retail_id?: string | null;
  exclude_from_discounts?: boolean;
  minimum_price?: number;
  version?: number;
};

const mapProductToForm = (product: Product): ProductFormData => ({
  name: product.name || "",
  sku: product.sku || "",
  category: product.category || "flower",
  vendor_name: product.vendor_name || "",
  strain_name: product.strain_name || "",
  strain_type: product.strain_type || "",
  thc_percent: product.thc_percent?.toString() || "",
  cbd_percent: product.cbd_percent?.toString() || "",
  batch_number: product.batch_number || "",
  cost_per_unit: product.cost_per_unit?.toString() || "",
  wholesale_price: product.wholesale_price?.toString() || "",
  retail_price: product.retail_price?.toString() || "",
  available_quantity: product.available_quantity?.toString() || "",
  description: product.description || "",
  image_url: product.image_url || "",

  low_stock_alert: product.low_stock_alert?.toString() || "10",
  metrc_retail_id: product.metrc_retail_id || "",

  exclude_from_discounts: product.exclude_from_discounts ?? false,
  minimum_price: product.minimum_price?.toString() || "",
});

export default function ProductManagement() {
  const navigateTenant = useTenantNavigate();
  const [searchParams] = useSearchParams();
  const { tenant, loading: tenantLoading } = useTenantAdminAuth();
  const { canEdit, canDelete, canExport } = usePermissions();
  useEncryption();
  const queryClient = useQueryClient();
  const { invalidateProductCaches } = useProductMutations();

  // Product duplication hook with callback to open edit dialog
  const { duplicateProduct, isPending: isDuplicating } = useProductDuplicate({
    onSuccess: (newProduct) => {
      // Add to local state and open edit dialog
      setProducts(prev => [newProduct, ...prev]);
      setEditingProduct(newProduct);
      setIsDialogOpen(true);
    },
  });

  // Read URL search params for filtering
  const urlSearch = searchParams.get('search') ?? '';
  const urlNewProduct = searchParams.get('new') === 'true';

  // Use optimistic list for products
  const {
    items: products,
    optimisticIds,
    addOptimistic: _addOptimistic,
    updateOptimistic,
    deleteOptimistic,
    setItems: setProducts,
  } = useOptimisticList<Product>([]);

  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Warn on navigation when product dialog is open
  const { showBlockerDialog, confirmLeave, cancelLeave } = useUnsavedChanges({
    isDirty: isDialogOpen,
  });

  // Table preferences persistence
  const { preferences, savePreferences } = useTablePreferences('products', {
    sortBy: 'name',
    customFilters: { category: 'all', stockStatus: 'all' }
  });

  // Selection state
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // Filters - initialize from saved preferences
  const [categoryFilter, setCategoryFilter] = useState<string>(String(preferences.customFilters?.category || "all"));
  const [stockStatusFilter, setStockStatusFilter] = useState<string>(String(preferences.customFilters?.stockStatus || "all"));
  const [sortBy, setSortBy] = useState<string>(preferences.sortBy || "name");

  // Column visibility - margin column hidden by default
  const availableColumns = [
    { id: "image", label: "Image" },
    { id: "name", label: "Product Details" },
    { id: "category", label: "Category" },
    { id: "price", label: "Price" },
    { id: "margin", label: "Margin" },
    { id: "stock", label: "Stock" },
  ];
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    () => (preferences.customFilters?.visibleColumns as string[]) || ["image", "name", "category", "price", "stock"]
  );

  // Margin threshold for alerts (default 20%)
  const marginThreshold = 20;

  // Auto-open create dialog when ?new=true is in URL
  useEffect(() => {
    if (urlNewProduct) {
      setEditingProduct(null);
      setIsDialogOpen(true);
    }
  }, [urlNewProduct]);

  // Fetch store settings for potency alerts
  useQuery({
    queryKey: queryKeys.storeSettingsPotency.all,
    queryFn: async () => {
      // Find the marketplace profile for this tenant
      const { data: profile } = await supabase
        .from('marketplace_profiles')
        .select('*')
        .eq('tenant_id', tenant?.id)
        .maybeSingle();

      if (!profile) return null;

      // Get store settings
      const { data: store } = await supabase
        .from('marketplace_stores')
        .select('potency_limit_thc, potency_limit_cbd')
        .eq('id', profile.id)
        .maybeSingle();

      return store;
    },
    enabled: !!tenant?.id
  });

  // Track previous filter values to avoid unnecessary saves
  const prevFiltersRef = useRef({ sortBy, categoryFilter, stockStatusFilter, visibleColumns });

  // Toggle column visibility
  const handleToggleColumn = (columnId: string) => {
    setVisibleColumns(prev => {
      const newColumns = prev.includes(columnId)
        ? prev.filter(c => c !== columnId)
        : [...prev, columnId];
      return newColumns;
    });
  };

  // Persist filter changes - only when values actually change
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const columnsChanged = JSON.stringify(prev.visibleColumns) !== JSON.stringify(visibleColumns);
    if (prev.sortBy !== sortBy || prev.categoryFilter !== categoryFilter || prev.stockStatusFilter !== stockStatusFilter || columnsChanged) {
      prevFiltersRef.current = { sortBy, categoryFilter, stockStatusFilter, visibleColumns };
      savePreferences({
        sortBy,
        customFilters: { category: categoryFilter, stockStatus: stockStatusFilter, visibleColumns }
      });
    }
  }, [sortBy, categoryFilter, stockStatusFilter, visibleColumns, savePreferences]);

  // Other state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [batchScanMode, setBatchScanMode] = useState(false);
  const [batchProducts, setBatchProducts] = useState<Product[]>([]);
  const [bulkPriceEditorOpen, setBulkPriceEditorOpen] = useState(false);
  const [batchCategoryEditorOpen, setBatchCategoryEditorOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Optimistic locking for concurrent edit protection
  const { updateWithLock } = useOptimisticLock('products', tenant?.id);

  // Batch delete confirmation dialog
  const { dialogState: batchDeleteDialogState, confirm: confirmBatchDelete, closeDialog: closeBatchDeleteDialog, setLoading: setBatchDeleteLoading } = useConfirmDialog();

  // Fetch store for publishing
  const { data: store } = useQuery({
    queryKey: queryKeys.marketplaceStore.byTenant(tenant?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('*')
        .eq('tenant_id', tenant?.id)
        .maybeSingle();
      if (error) {
        logger.error('Failed to fetch store for sync', error);
        return null;
      }
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch products via useQuery
  const { data: productsData, isLoading: productsLoading, isError: productsError, refetch: refetchProductsQuery } = useQuery({
    queryKey: queryKeys.products.list(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('name');
      if (error) {
        logger.error('Failed to fetch products', { error });
        throw error;
      }
      return (data ?? []) as Product[];
    },
    enabled: !!tenant?.id,
  });

  // Sync query data into optimistic list
  useEffect(() => {
    if (productsData) {
      setProducts(productsData);
    }
  }, [productsData, setProducts]);

  // Refetch products helper
  const refetchProducts = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.products.list(tenant?.id) });
  }, [queryClient, tenant?.id]);

  // Alias for external usage
  const loadProducts = refetchProducts;

  // Derived state for categories
  const categories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];
  }, [products]);

  // Derived filtered products
  const filteredProducts = useMemo(() => {
    const searchLower = sanitizeSearchInput(debouncedSearchTerm).toLowerCase();
    const applyCategoryFilter = categoryFilter !== "all";
    const applyStockFilter = stockStatusFilter !== "all";

    return products
      .filter((p) => {
        // Search filter
        const matchesSearch = !searchLower ||
          p.name?.toLowerCase().includes(searchLower) ||
          p.sku?.toLowerCase().includes(searchLower) ||
          p.category?.toLowerCase().includes(searchLower);

        // Category filter
        const matchesCategory = !applyCategoryFilter || p.category === categoryFilter;

        // Stock Status filter
        let matchesStock = true;
        if (applyStockFilter) {
          const qty = p.available_quantity ?? 0;
          const lowStockLimit = p.low_stock_alert || 10;
          if (stockStatusFilter === "in_stock") matchesStock = qty > 0;
          else if (stockStatusFilter === "out_of_stock") matchesStock = qty <= 0;
          else if (stockStatusFilter === "low_stock") matchesStock = qty > 0 && qty <= lowStockLimit;
        }

        return matchesSearch && matchesCategory && matchesStock;
      })
      .sort((a, b) => {
        // Helper for profit margin
        const profitMargin = (cost: number, price: number) => {
          if (!price) return 0;
          return ((price - cost) / price) * 100;
        };

        switch (sortBy) {
          case "name":
            return (a.name || "").localeCompare(b.name || "");
          case "price":
            return (b.wholesale_price ?? 0) - (a.wholesale_price ?? 0);
          case "stock":
            return (b.available_quantity ?? 0) - (a.available_quantity ?? 0);
          case "margin": {
            const marginA = profitMargin(a.cost_per_unit ?? 0, a.wholesale_price ?? 0);
            const marginB = profitMargin(b.cost_per_unit ?? 0, b.wholesale_price ?? 0);
            return Number(marginB) - Number(marginA);
          }
          default:
            return 0;
        }
      });
  }, [products, debouncedSearchTerm, categoryFilter, sortBy, stockStatusFilter]);

  // Combined batch products (scanned + selected)
  const combinedBatchProducts = useMemo(() => {
    const selectedProductObjects = products.filter(p => selectedProducts.includes(p.id));
    // Avoid duplicates if a product is both scanned and selected (though unlikely to happen usually)
    const uniqueMap = new Map();
    [...batchProducts, ...selectedProductObjects].forEach(p => uniqueMap.set(p.id, p));
    return Array.from(uniqueMap.values());
  }, [batchProducts, selectedProducts, products]);

  // Validate product form data
  const validateProductData = (data: ProductFormData): string | null => {
    // Price validation (must be >= 0)
    const costPerUnit = data.cost_per_unit ? parseFloat(data.cost_per_unit) : 0;
    const wholesalePrice = data.wholesale_price ? parseFloat(data.wholesale_price) : 0;
    const retailPrice = data.retail_price ? parseFloat(data.retail_price) : 0;

    if (costPerUnit < 0) return 'Cost per unit must be 0 or greater';
    if (wholesalePrice < 0) return 'Wholesale price must be 0 or greater';
    if (retailPrice < 0) return 'Retail price must be 0 or greater';

    // Stock quantity validation (must be integer >= 0)
    const quantity = data.available_quantity ? parseFloat(data.available_quantity) : 0;
    if (quantity < 0) return 'Stock quantity must be 0 or greater';
    if (!Number.isInteger(quantity)) return 'Stock quantity must be a whole number';

    // THC/CBD percentage validation (0-100)
    const thcPercent = data.thc_percent ? parseFloat(data.thc_percent) : null;
    const cbdPercent = data.cbd_percent ? parseFloat(data.cbd_percent) : null;

    if (thcPercent !== null && (thcPercent < 0 || thcPercent > 100)) {
      return 'THC percentage must be between 0 and 100';
    }
    if (cbdPercent !== null && (cbdPercent < 0 || cbdPercent > 100)) {
      return 'CBD percentage must be between 0 and 100';
    }

    return null;
  };

  // Check SKU uniqueness within tenant
  const checkSkuUniqueness = async (sku: string, excludeProductId?: string): Promise<boolean> => {
    if (!sku || !tenant?.id) return true;

    let query = supabase
      .from('products')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('sku', sku);

    if (excludeProductId) {
      query = query.neq('id', excludeProductId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logger.error('Error checking SKU uniqueness:', { error: error.message });
      return true; // Allow submission on error, let DB handle constraint
    }

    return data === null;
  };

  // Check product name uniqueness within tenant
  const checkNameUniqueness = async (name: string, excludeProductId?: string): Promise<boolean> => {
    if (!name || !tenant?.id) return true;

    let query = supabase
      .from('products')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('name', name.trim());

    if (excludeProductId) {
      query = query.neq('id', excludeProductId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logger.error('Error checking product name uniqueness:', { error: error.message });
      return true; // Allow submission on error, let DB handle constraint
    }

    return data === null;
  };

  // Handlers
  const handleProductSubmit = async (data: ProductFormData) => {
    // Validate tenant context first
    if (!tenant?.id) {
      toast.error('Tenant not found. Please refresh.');
      return;
    }

    // Validate form data
    const validationError = validateProductData(data);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsGenerating(true);
    try {
      // Check SKU uniqueness (if SKU provided)
      if (data.sku) {
        const isSkuUnique = await checkSkuUniqueness(data.sku, editingProduct?.id);
        if (!isSkuUnique) {
          toast.error('SKU already exists. Please use a unique SKU.');
          setIsGenerating(false);
          return;
        }
      }

      // Check product name uniqueness
      if (data.name) {
        const isNameUnique = await checkNameUniqueness(data.name, editingProduct?.id);
        if (!isNameUnique) {
          toast.error('A product with this name already exists');
          setIsGenerating(false);
          return;
        }
      }

      // Ensure all required fields for DB are present
      const productData = {
        tenant_id: tenant.id,
        name: data.name,
        sku: data.sku,
        category: data.category,
        vendor_name: data.vendor_name,
        strain_name: data.strain_name,
        strain_type: data.strain_type,
        thc_percent: data.thc_percent ? parseFloat(data.thc_percent) : null,
        cbd_percent: data.cbd_percent ? parseFloat(data.cbd_percent) : null,
        batch_number: data.batch_number,
        cost_per_unit: data.cost_per_unit ? parseFloat(data.cost_per_unit) : null,
        wholesale_price: data.wholesale_price ? parseFloat(data.wholesale_price) : null,
        retail_price: data.retail_price ? parseFloat(data.retail_price) : null,
        available_quantity: data.available_quantity ? Math.floor(parseFloat(data.available_quantity)) : 0,
        description: data.description,
        image_url: data.image_url,
        low_stock_alert: data.low_stock_alert ? parseInt(data.low_stock_alert) : 10,
        // Add missing required fields with defaults
        price: data.wholesale_price ? parseFloat(data.wholesale_price) : 0, // Legacy field sync
        thca_percentage: null,
        metrc_retail_id: data.metrc_retail_id || null,
        exclude_from_discounts: data.exclude_from_discounts,
        minimum_price: data.minimum_price ? parseFloat(data.minimum_price) : 0,
      };

      if (editingProduct) {
        if (!tenant?.id) throw new Error('No tenant context');

        // Use optimistic locking to prevent concurrent edit conflicts
        const expectedVersion = editingProduct.version || 1;
        const result = await updateWithLock(editingProduct.id, productData, expectedVersion);

        if (!result.success) {
          if (result.conflictDetected) {
            toast.error("This product was modified by another user. Please refresh and try again.");
            return;
          }
          throw new Error(result.error || 'Failed to update product');
        }

        toast.success("Product updated");
        // Update state with new version
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...productData, version: expectedVersion + 1 } : p));

        // Warn if price changed and product is on active menus
        const priceChanged =
          productData.wholesale_price !== editingProduct.wholesale_price ||
          productData.retail_price !== editingProduct.retail_price ||
          productData.cost_per_unit !== editingProduct.cost_per_unit;

        if (priceChanged) {
          try {
            const now = new Date().toISOString();
            const { count } = await supabase
              .from('disposable_menu_products')
              .select('menu_id, disposable_menus!inner(id)', { count: 'exact', head: true })
              .eq('product_id', editingProduct.id)
              .eq('disposable_menus.status', 'active')
              .is('disposable_menus.burned_at', null)
              .or(`never_expires.eq.true,expiration_date.gt.${now}`, { referencedTable: 'disposable_menus' });

            if (count && count > 0) {
              toast.warning(
                `This product is on ${count} active menu${count > 1 ? 's' : ''}. Menu prices won't update automatically.`
              );
            }
          } catch (menuCheckError) {
            // Non-blocking — don't let menu check failure affect product save
            logger.warn('Failed to check active menus for price change warning', { error: menuCheckError });
          }
        }

        // Invalidate all product caches so storefront reflects changes instantly
        invalidateProductCaches({
          tenantId: tenant.id,
          storeId: store?.id || undefined,
          productId: editingProduct.id,
          category: productData.category || undefined,
          action: 'updated',
        });
      } else {
        const { data: newProduct, error } = await supabase.from('products').insert(productData).select().maybeSingle();
        if (error) throw error;
        toast.success("Product created");
        // Manually update state
        setProducts(prev => [newProduct, ...prev]);

        // Sync to marketplace if store exists (auto-trigger handles marketplace_product_settings,
        // this handles marketplace_products with additional fields like slug)
        if (store?.id && newProduct) {
          const { error: syncError } = await (supabase.rpc as (fn: string, params: Record<string, string>) => ReturnType<typeof supabase.rpc>)('sync_product_to_marketplace', {
            p_product_id: newProduct.id,
            p_store_id: store.id,
          });
          if (syncError) {
            // Don't block on sync error - product was created successfully
            logger.warn('Product sync to marketplace failed', { error: syncError, productId: newProduct.id });
          }
        }

        // Invalidate all product caches so storefront reflects changes instantly
        invalidateProductCaches({
          tenantId: tenant.id,
          storeId: store?.id || undefined,
          productId: newProduct.id,
          category: productData.category || undefined,
          action: 'created',
        });
      }
      setIsDialogOpen(false);
      setEditingProduct(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save product');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = (id: string) => {
    const product = products.find(p => p.id === id);
    if (product) {
      setProductToDelete(product);
      setDeleteDialogOpen(true);
    }
  }

  const confirmDelete = async () => {
    if (!productToDelete) return;
    if (!tenant?.id) {
      toast.error('Tenant not found. Please refresh.');
      return;
    }
    setIsDeleting(true);
    try {
      // Check if product is used in any orders (must happen before optimistic delete)
      const { count: orderItemCount } = await supabase
        .from('order_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productToDelete.id);

      const { count: wholesaleCount } = await supabase
        .from('wholesale_order_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_name', productToDelete.name);

      const totalUsage = (orderItemCount ?? 0) + (wholesaleCount ?? 0);

      if (totalUsage > 0) {
        toast.error("Cannot delete product", {
          description: `This product is used in ${totalUsage} order(s). Consider marking it as inactive instead.`
        });
        setDeleteDialogOpen(false);
        setProductToDelete(null);
        return;
      }

      const deletedCategory = productToDelete.category;
      const tenantId = tenant.id;

      // Optimistic delete: remove from list immediately, sync in background
      setDeleteDialogOpen(false);
      setProductToDelete(null);

      await deleteOptimistic(
        productToDelete.id,
        async () => {
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productToDelete.id)
            .eq('tenant_id', tenantId);
          if (error) throw error;

          // Invalidate all product caches so storefront reflects deletion
          invalidateProductCaches({
            tenantId,
            storeId: store?.id || undefined,
            productId: productToDelete.id,
            category: deletedCategory || undefined,
            action: 'deleted',
          });
        }
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  }

  const handleCombinedBatchRemove = (id: string) => {
    // Remove from selectedProducts
    if (selectedProducts.includes(id)) {
      handleToggleSelect(id);
    }
  };

  const handleCombinedBatchClear = () => {
    setSelectedProducts([]);
    setBatchProducts([]);
  };

  const handleCombinedBatchDelete = () => {
    if (combinedBatchProducts.length === 0) return;
    if (!tenant?.id) {
      toast.error('Tenant not found. Please refresh.');
      return;
    }

    confirmBatchDelete({
      title: 'Delete Products',
      description: `Are you sure you want to delete ${combinedBatchProducts.length} products? This action cannot be undone.`,
      itemType: 'products',
      onConfirm: async () => {
        setBatchDeleteLoading(true);
        try {
          const ids = combinedBatchProducts.map(p => p.id);
          const names = combinedBatchProducts.map(p => p.name);

          // Check for products used in orders
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('product_id')
            .in('product_id', ids);

          const { data: wholesaleItems } = await supabase
            .from('wholesale_order_items')
            .select('product_name')
            .in('product_name', names);

          const usedProductIds = new Set(orderItems?.map(i => i.product_id) ?? []);
          const usedProductNames = new Set(wholesaleItems?.map(i => i.product_name) ?? []);

          // Filter out products that are used in orders
          const deletableIds = ids.filter(id => {
            const product = combinedBatchProducts.find(p => p.id === id);
            return !usedProductIds.has(id) && (!product || !usedProductNames.has(product.name));
          });

          const skippedCount = ids.length - deletableIds.length;

          if (deletableIds.length === 0) {
            toast.error("Cannot delete products", {
              description: "All selected products are used in existing orders."
            });
            closeBatchDeleteDialog();
            return;
          }

          const { error } = await supabase.from('products').delete().in('id', deletableIds).eq('tenant_id', tenant.id);
          if (error) throw error;

          if (skippedCount > 0) {
            toast.warning(`Deleted ${deletableIds.length} products, skipped ${skippedCount}`, {
              description: `${skippedCount} ${skippedCount === 1 ? 'product' : 'products'} with existing orders not deleted.`
            });
          } else {
            toast.success(`${deletableIds.length} ${deletableIds.length === 1 ? 'product' : 'products'} deleted`);
          }

          setProducts(prev => prev.filter(p => !deletableIds.includes(p.id)));

          // Invalidate all product caches so storefront reflects batch deletion
          invalidateProductCaches({
            tenantId: tenant.id,
            storeId: store?.id || undefined,
            action: 'deleted',
          });

          handleCombinedBatchClear();
          closeBatchDeleteDialog();
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Failed to delete products');
        } finally {
          setBatchDeleteLoading(false);
        }
      }
    });
  };

  const handleCombinedBatchCategory = () => {
    setBatchProducts(combinedBatchProducts);
    setBatchCategoryEditorOpen(true);
  };

  const handleCombinedBatchPrice = () => {
    setBatchProducts(combinedBatchProducts);
    setBulkPriceEditorOpen(true);
  };

  const handleBulkPriceUpdate = async (_updates: unknown) => {
    // Component handles the DB update; we refresh and invalidate caches
    await loadProducts();
    invalidateProductCaches({
      tenantId: tenant?.id || undefined,
      storeId: store?.id || undefined,
      action: 'updated',
    });
    setBulkPriceEditorOpen(false);
  }

  const handleBulkCategoryUpdate = async () => {
    await loadProducts();
    invalidateProductCaches({
      tenantId: tenant?.id || undefined,
      storeId: store?.id || undefined,
      action: 'updated',
    });
    setBatchCategoryEditorOpen(false);
  }


  const handleScanSuccess = async (code: string) => {
    // Logic to find product by barcode or SKU and add to batch
    const product = products.find(p => p.sku === code || p.id === code); // Simplified matching
    if (product) {
      setBatchProducts(prev => [...prev, product]);
      toast.success(`Scanned: ${product.name}`);
    } else {
      toast.error("Product not found");
    }
  }

  const startBatchScan = () => {
    setBatchScanMode(true);
    setScannerOpen(true);
  }

  const handlePublish = async (productId: string) => {
    if (!store?.id) {
      toast.error("Storefront not configured. Please set up your store first.");
      return;
    }
    setIsPublishing(true);
    try {
      const { data, error } = await (supabase.rpc as (fn: string, params: Record<string, string>) => ReturnType<typeof supabase.rpc>)('sync_product_to_marketplace', {
        p_product_id: productId,
        p_store_id: store.id
      });

      if (error) throw error;

      const result = data as Record<string, unknown> | null;
      if (result?.success) {
        toast.success("Product published to storefront");
        // Invalidate storefront caches so the new product appears instantly
        invalidateProductCaches({
          tenantId: tenant?.id || undefined,
          storeId: store?.id || undefined,
          productId,
          action: 'updated',
        });
      } else {
        toast.error((result?.error as string) || "Failed to publish product");
      }
    } catch (err: unknown) {
      logger.error('Failed to publish product', err);
      toast.error(err instanceof Error ? err.message : "Failed to publish product");
    } finally {
      setIsPublishing(false);
    }
  };

  // Inline quick edit handler — uses optimistic update for instant UI feedback
  const handleInlineUpdate = async (productId: string, field: keyof Product, value: string) => {
    if (!tenant?.id) {
      toast.error('Tenant not found. Please refresh.');
      return;
    }

    let updateValue: number | string | null = value;

    // Validate and parse numeric fields
    if (field === 'wholesale_price' || field === 'retail_price') {
      const numValue = value ? parseFloat(value) : null;
      if (numValue !== null && numValue < 0) {
        toast.error('Price must be 0 or greater');
        return;
      }
      updateValue = numValue;
    } else if (field === 'available_quantity') {
      const numValue = value ? parseFloat(value) : null;
      if (numValue !== null) {
        if (numValue < 0) {
          toast.error('Quantity must be 0 or greater');
          return;
        }
        if (!Number.isInteger(numValue)) {
          toast.error('Quantity must be a whole number');
          return;
        }
      }
      updateValue = numValue !== null ? Math.floor(numValue) : null;
    }

    // Optimistic update: show change immediately, sync in background
    await updateOptimistic(
      productId,
      { [field]: updateValue } as Partial<Product>,
      async () => {
        const { data: updated, error } = await supabase
          .from('products')
          .update({ [field]: updateValue } as Record<string, unknown>)
          .eq('id', productId)
          .eq('tenant_id', tenant.id)
          .select()
          .maybeSingle();

        if (error) throw error;

        // Warn if price changed and product is on active menus (non-blocking)
        if (field === 'wholesale_price' || field === 'retail_price' || field === 'cost_per_unit') {
          try {
            const now = new Date().toISOString();
            const { count } = await supabase
              .from('disposable_menu_products')
              .select('menu_id, disposable_menus!inner(id)', { count: 'exact', head: true })
              .eq('product_id', productId)
              .eq('disposable_menus.status', 'active')
              .is('disposable_menus.burned_at', null)
              .or(`never_expires.eq.true,expiration_date.gt.${now}`, { referencedTable: 'disposable_menus' });

            if (count && count > 0) {
              toast.warning(
                `This product is on ${count} active menu${count > 1 ? 's' : ''}. Menu prices won't update automatically.`
              );
            }
          } catch (menuCheckError) {
            logger.warn('Failed to check active menus for price change warning', { error: menuCheckError });
          }
        }

        // Invalidate storefront caches for instant sync
        invalidateProductCaches({
          tenantId: tenant.id,
          storeId: store?.id || undefined,
          productId,
          action: field === 'available_quantity' ? 'stock_adjusted' : 'updated',
        });

        return updated as Product;
      }
    );
  };

  // --- Table Columns Definition ---
  const columns: any[] = [
    {
      header: (
        <Checkbox
          checked={filteredProducts.length > 0 && selectedProducts.length === filteredProducts.length}
          onCheckedChange={handleSelectAll}
          aria-label="Select all"
        />
      ),
      className: "w-[50px]",
      cell: (product) => (
        <Checkbox
          checked={selectedProducts.includes(product.id)}
          onCheckedChange={() => handleToggleSelect(product.id)}
          onClick={(e) => e.stopPropagation()}
        />
      )
    },
    {
      header: "Image",
      accessorKey: "image_url",
      cell: (product) => (
        <img
          src={product.image_url || "/placeholder.svg"}
          alt={product.name}
          className="h-10 w-10 rounded-md object-cover border"
          loading="lazy"
        />
      )
    },
    {
      header: "Product Details",
      accessorKey: "name",
      cell: (product) => (
        <div className="flex flex-col">
          <InlineEditableCell
            value={product.name}
            onSave={(v) => handleInlineUpdate(product.id, 'name', v)}
            type="text"
            className="font-medium text-foreground"
          />
          {product.sku && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              SKU: {product.sku}
              <CopyButton text={product.sku} label="SKU" showLabel={false} size="icon" variant="ghost" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          )}
        </div>
      )
    },
    {
      header: "Category",
      accessorKey: "category",
      cell: (product) => (
        <Badge variant="outline" className="capitalize">
          {product.category || 'Uncategorized'}
        </Badge>
      )
    },
    {
      header: "Price",
      accessorKey: "wholesale_price",
      className: "text-right",
      cell: (product) => (
        <InlineEditableCell
          value={product.wholesale_price}
          onSave={(v) => handleInlineUpdate(product.id, 'wholesale_price', v)}
          type="currency"
          displayValue={product.wholesale_price ? `$${product.wholesale_price}` : undefined}
          className="font-mono font-medium justify-end"
        />
      )
    },
    // Margin column - hidden by default, visible via column toggle
    ...(visibleColumns.includes("margin") ? [{
      header: "Margin",
      accessorKey: "cost_per_unit" as keyof Product,
      className: "text-center",
      cell: (product: Product) => (
        <ProductMarginBadge
          costPrice={product.cost_per_unit}
          sellingPrice={product.wholesale_price}
          marginThreshold={marginThreshold}
          size="sm"
        />
      )
    }] : []),
    {
      header: "Stock",
      accessorKey: "available_quantity",
      cell: (product) => (
        <div className="flex items-center gap-2">
          <InlineEditableCell
            value={product.available_quantity}
            onSave={(v) => handleInlineUpdate(product.id, 'available_quantity', v)}
            type="number"
            className="w-12"
          />
          <InventoryStatusBadge
            quantity={product.available_quantity ?? 0}
            lowStockThreshold={product.low_stock_alert || 10}
          />
        </div>
      )
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (product) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="More options">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEdit('products') && (
              <DropdownMenuItem disabled={isGenerating} onClick={() => { setEditingProduct(product); setIsDialogOpen(true); }}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
            )}
            {canEdit('products') && (
              <DropdownMenuItem disabled={isDuplicating} onClick={() => duplicateProduct(product)}>
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => { setLabelProduct(product); setLabelDialogOpen(true); }}>
              <Printer className="mr-2 h-4 w-4" /> Print Label
            </DropdownMenuItem>
            {canDelete('products') && (
              <DropdownMenuItem
                className="text-destructive focus-visible:text-destructive"
                disabled={isDeleting}
                onClick={() => handleDelete(product.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            )}
            {canEdit('products') && (
              <DropdownMenuItem disabled={isPublishing} onClick={() => handlePublish(product.id)}>
                <Store className="mr-2 h-4 w-4" /> Publish to Store
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const renderMobileProduct = (product: Product) => (
    <ProductCard
      product={product}
      onEdit={() => { setEditingProduct(product); setIsDialogOpen(true); }}
      onDelete={() => handleDelete(product.id)}
      onDuplicate={() => duplicateProduct(product)}
      onPrintLabel={() => { setLabelProduct(product); setLabelDialogOpen(true); }}
      onPublish={() => handlePublish(product.id)}
    />
  );


  if (tenantLoading) {
    return (
      <div className="w-full max-w-full px-4 sm:px-4 py-4 sm:py-4 space-y-4">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-7 sm:h-8 w-48 sm:w-64" />
            <Skeleton className="h-3 sm:h-4 w-64 sm:w-96" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-11 w-11 sm:w-32" />
            <Skeleton className="h-11 w-11 sm:w-32" />
          </div>
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-4">
                  <Skeleton className="h-6 w-6 sm:h-8 sm:w-8 rounded" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 sm:h-6 w-12 sm:w-16" />
                    <Skeleton className="h-3 sm:h-4 w-16 sm:w-24" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {[...Array(8)].map((_, i) => (
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

  const batchPanelOpen = combinedBatchProducts.length > 0;

  return (
    <div className="w-full max-w-full px-4 sm:px-4 py-4 sm:py-4 space-y-4 sm:space-y-4 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 sm:mb-2">
            <h1 className="text-xl font-bold truncate">Product Management</h1>
            {tenant?.id && (
              <TooltipGuide
                title="Product Management"
                content="Upload CSV to add 100+ products instantly. Products can be organized by category and tracked by batch numbers."
                placement="right"
                tenantId={tenant.id}
              />
            )}
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm md:text-base">
            Manage products, batches, and inventory packages
          </p>
        </div>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingProduct(null);
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <ProductForm
              initialData={editingProduct ? mapProductToForm(editingProduct) : undefined}
              onSubmit={handleProductSubmit}
              onCancel={() => setIsDialogOpen(false)}
              isLoading={isGenerating}
              isEditMode={!!editingProduct}
            />
          </div>
        </DialogContent>
      </Dialog>

      {canEdit('products') && (
        <ProductImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onSuccess={loadProducts}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">{products.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">
                  {products.reduce((sum, p) => sum + (p.available_quantity ?? 0), 0)}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Available Units</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">
                  {products.reduce((sum, p) => sum + (p.fronted_quantity ?? 0), 0)}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Fronted Units</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">
                  $
                  {products
                    .reduce(
                      (sum, p) =>
                        sum +
                        (p.available_quantity ?? 0) * (p.wholesale_price ?? 0),
                      0
                    )
                    .toFixed(0)}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Inventory Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AdminToolbar
        searchQuery={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search products, SKU, category..."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setBatchScanMode(false);
                setScannerOpen(true);
              }}
              className="min-h-[40px]"
            >
              <Barcode className="h-4 w-4 mr-2" />
              Scan
            </Button>
            <Button
              variant="outline"
              onClick={startBatchScan}
              className="min-h-[40px]"
            >
              <Barcode className="h-4 w-4 mr-2" />
              Batch
            </Button>
            {canExport('products') && (
              <ExportButton
                data={filteredProducts.map(p => ({
                  ...p,
                  margin_percent: p.wholesale_price && p.cost_per_unit
                    ? (((p.wholesale_price - p.cost_per_unit) / p.wholesale_price) * 100).toFixed(1)
                    : null,
                }))}
                filename="products"
                columns={[
                  { key: "name", label: "Name" },
                  { key: "sku", label: "SKU" },
                  { key: "category", label: "Category" },
                  { key: "cost_per_unit", label: "Cost" },
                  { key: "wholesale_price", label: "Price" },
                  { key: "margin_percent", label: "Margin %" },
                  { key: "available_quantity", label: "Stock" },
                  { key: "strain_name", label: "Strain" },
                  { key: "vendor_name", label: "Vendor" },
                ]}
              />
            )}
            {canEdit('products') && (
              <Button onClick={() => navigateTenant("/admin/generate-barcodes")} className="min-h-[40px] hidden sm:inline-flex" variant="outline">
                <Barcode className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Barcodes</span>
              </Button>
            )}
            {canEdit('products') && (
              <Button onClick={() => setImportDialogOpen(true)} className="min-h-[40px] hidden sm:inline-flex" variant="outline">
                Import
              </Button>
            )}
            {canEdit('products') && (
              <Button onClick={() => { setEditingProduct(null); setIsDialogOpen(true); }} className="min-h-[40px]">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            )}
          </>
        }
        filters={
          <>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px] sm:w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stockStatusFilter} onValueChange={setStockStatusFilter}>
              <SelectTrigger className="w-[140px] sm:w-[150px]">
                <SelectValue placeholder="Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Status</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px] sm:w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="price">Price (High-Low)</SelectItem>
                <SelectItem value="stock">Stock (High-Low)</SelectItem>
                <SelectItem value="margin">Margin (High-Low)</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        viewOptions={
          <>
            <ColumnVisibilityControl
              visibleColumns={visibleColumns}
              onToggleColumn={handleToggleColumn}
              availableColumns={availableColumns}
            />
            <div className="flex items-center gap-1 border rounded-md overflow-hidden bg-background">
              <Toggle
                pressed={viewMode === "grid"}
                onPressedChange={() => setViewMode("grid")}
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-0 rounded-none h-9 w-9 p-0"
              >
                <LayoutGrid className="h-4 w-4" />
              </Toggle>
              <Toggle
                pressed={viewMode === "list"}
                onPressedChange={() => setViewMode("list")}
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-0 rounded-none border-l h-9 w-9 p-0"
              >
                <List className="h-4 w-4" />
              </Toggle>
            </div>
          </>
        }
      />

      <AdminDataTable
        title={`Products (${filteredProducts.length})`}
        data={filteredProducts}
        columns={columns}
        isLoading={productsLoading}
        isError={productsError}
        onRetry={() => refetchProductsQuery()}
        viewMode={viewMode}
        renderGridItem={(product) => (
          <div className={optimisticIds.has(product.id) ? 'opacity-70 transition-opacity' : ''}>
            <ProductCard
              product={product}
              onEdit={() => { setEditingProduct(product); setIsDialogOpen(true); }}
              onDelete={() => handleDelete(product.id)}
              onDuplicate={() => duplicateProduct(product)}
              onPrintLabel={() => {
                setLabelProduct(product);
                setLabelDialogOpen(true);
              }}
              onPublish={() => handlePublish(product.id)}
            />
          </div>
        )}
        renderMobileItem={renderMobileProduct}
        emptyStateIcon={Package}
        emptyStateTitle={searchTerm || categoryFilter !== "all" ? "No products found" : "No products yet"}
        emptyStateDescription={
          searchTerm || categoryFilter !== "all"
            ? "Try adjusting your filters to find products"
            : "Add your inventory to start selling"
        }
        emptyStateAction={
          !searchTerm && categoryFilter === "all" && canEdit('products')
            ? {
              label: "Add Product",
              onClick: () => {
                setEditingProduct(null);
                setIsDialogOpen(true);
              },
              icon: Plus,
            }
            : undefined
        }
      />

      {/* Product Label Dialog */}
      {labelProduct && (
        <ProductLabel
          product={{ ...labelProduct, barcode_image_url: (labelProduct as unknown as Record<string, unknown>).barcode_image_url as string ?? null }}
          open={labelDialogOpen}
          onOpenChange={setLabelDialogOpen}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={productToDelete?.name}
        itemType="product"
        isLoading={isDeleting}
      />

      {/* Barcode Scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={(open) => {
          setScannerOpen(open);
          if (!open) {
            setBatchScanMode(false);
          }
        }}
        onScanSuccess={handleScanSuccess}
        batchMode={batchScanMode}
        scannedCount={batchProducts.length}
      />

      {/* Batch Operations Panel */}
      {batchPanelOpen && (
        <BatchPanel
          products={combinedBatchProducts}
          onRemove={handleCombinedBatchRemove}
          onClear={handleCombinedBatchClear}
          onBatchDelete={handleCombinedBatchDelete}
          onBatchEditPrice={handleCombinedBatchPrice}
          onBatchEditCategory={handleCombinedBatchCategory}
          isDeleting={isDeleting}
        />
      )}

      {/* Bulk Price Editor */}
      <BulkPriceEditor
        open={bulkPriceEditorOpen}
        onOpenChange={setBulkPriceEditorOpen}
        products={batchProducts}
        onApply={handleBulkPriceUpdate}
      />

      {/* Batch Category Editor */}
      <BatchCategoryEditor
        open={batchCategoryEditorOpen}
        onOpenChange={setBatchCategoryEditorOpen}
        products={batchProducts}
        onApply={handleBulkCategoryUpdate}
      />

      {/* Batch Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={batchDeleteDialogState.open}
        onOpenChange={(open) => !open && closeBatchDeleteDialog()}
        onConfirm={batchDeleteDialogState.onConfirm}
        title={batchDeleteDialogState.title}
        description={batchDeleteDialogState.description}
        itemType={batchDeleteDialogState.itemType}
        isLoading={batchDeleteDialogState.isLoading}
      />

      <UnsavedChangesDialog
        open={showBlockerDialog}
        onConfirmLeave={confirmLeave}
        onCancelLeave={cancelLeave}
      />
    </div>
  );
}
