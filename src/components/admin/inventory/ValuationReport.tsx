import { useState, useMemo, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import Download from 'lucide-react/dist/esm/icons/download';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import Package from 'lucide-react/dist/esm/icons/package';
import Layers from 'lucide-react/dist/esm/icons/layers';
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

interface ProductValuation {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  stock_quantity: number;
  price: number;
  cost_per_unit: number | null;
  retail_value: number;
  cost_value: number | null;
  margin: number | null;
  margin_percent: number | null;
}

interface CategoryValuation {
  category: string;
  products: ProductValuation[];
  total_units: number;
  total_retail_value: number;
  total_cost_value: number | null;
  product_count: number;
}

interface ValuationSummary {
  total_products: number;
  total_units: number;
  total_retail_value: number;
  total_cost_value: number | null;
  total_margin: number | null;
  margin_percent: number | null;
  categories: CategoryValuation[];
}

interface PeriodComparison {
  current: ValuationSummary;
  previous: ValuationSummary | null;
  retail_change: number | null;
  retail_change_percent: number | null;
  cost_change: number | null;
  cost_change_percent: number | null;
  units_change: number | null;
  units_change_percent: number | null;
}

type ViewMode = 'summary' | 'by_category' | 'by_product';

interface ValuationReportProps {
  className?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function ValuationReport({ className }: ValuationReportProps) {
  const { tenant } = useTenantAdminAuth();

  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Fetch current inventory valuation
  const { data: valuationData, isLoading, error: queryError } = useQuery({
    queryKey: [...queryKeys.inventory.summary(tenant?.id), 'valuation'],
    queryFn: async (): Promise<PeriodComparison> => {
      if (!tenant?.id) {
        return {
          current: {
            total_products: 0,
            total_units: 0,
            total_retail_value: 0,
            total_cost_value: null,
            total_margin: null,
            margin_percent: null,
            categories: [],
          },
          previous: null,
          retail_change: null,
          retail_change_percent: null,
          cost_change: null,
          cost_change_percent: null,
          units_change: null,
          units_change_percent: null,
        };
      }

      // Fetch current products with stock
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, sku, category, stock_quantity, price, cost_per_unit')
        .eq('tenant_id', tenant.id)
        .gt('stock_quantity', 0)
        .order('category')
        .order('name');

      if (error) {
        logger.error('Failed to fetch products for valuation', { error, tenantId: tenant.id });
        throw error;
      }

      // Calculate current valuation
      const currentSummary = calculateValuationSummary(products || []);

      // Fetch previous period inventory history for comparison
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data: historyData, error: historyError } = await (supabase as any)
        .from('inventory_history')
        .select('product_id, previous_quantity, created_at')
        .eq('tenant_id', tenant.id)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: true });

      if (historyError) {
        logger.warn('Could not fetch inventory history for comparison', { error: historyError });
      }

      // Estimate previous period value based on first recorded quantities
      let previousSummary: ValuationSummary | null = null;
      if (historyData && historyData.length > 0) {
        // Get earliest recorded quantity for each product
        const earliestQuantities = new Map<string, number>();
        for (const entry of historyData) {
          if (!earliestQuantities.has(entry.product_id)) {
            earliestQuantities.set(entry.product_id, entry.previous_quantity);
          }
        }

        // Create estimated previous products list
        const previousProducts = (products || []).map(p => ({
          ...p,
          stock_quantity: earliestQuantities.get(p.id) ?? p.stock_quantity,
        }));

        previousSummary = calculateValuationSummary(previousProducts);
      }

      // Calculate changes
      const retailChange = previousSummary
        ? currentSummary.total_retail_value - previousSummary.total_retail_value
        : null;
      const retailChangePercent = previousSummary && previousSummary.total_retail_value > 0
        ? ((currentSummary.total_retail_value - previousSummary.total_retail_value) / previousSummary.total_retail_value) * 100
        : null;

      const costChange = previousSummary?.total_cost_value !== null && currentSummary.total_cost_value !== null
        ? currentSummary.total_cost_value - previousSummary.total_cost_value
        : null;
      const costChangePercent = previousSummary?.total_cost_value !== null && previousSummary.total_cost_value > 0 && costChange !== null
        ? (costChange / previousSummary.total_cost_value) * 100
        : null;

      const unitsChange = previousSummary
        ? currentSummary.total_units - previousSummary.total_units
        : null;
      const unitsChangePercent = previousSummary && previousSummary.total_units > 0
        ? ((currentSummary.total_units - previousSummary.total_units) / previousSummary.total_units) * 100
        : null;

      return {
        current: currentSummary,
        previous: previousSummary,
        retail_change: retailChange,
        retail_change_percent: retailChangePercent,
        cost_change: costChange,
        cost_change_percent: costChangePercent,
        units_change: unitsChange,
        units_change_percent: unitsChangePercent,
      };
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Calculate valuation summary from products
  function calculateValuationSummary(products: Array<{
    id: string;
    name: string;
    sku: string | null;
    category: string;
    stock_quantity: number | null;
    price: number;
    cost_per_unit: number | null;
  }>): ValuationSummary {
    const categoryMap = new Map<string, ProductValuation[]>();

    let totalUnits = 0;
    let totalRetailValue = 0;
    let totalCostValue = 0;
    let hasCostData = false;

    for (const product of products) {
      const quantity = product.stock_quantity || 0;
      const retailValue = quantity * product.price;
      const costValue = product.cost_per_unit !== null ? quantity * product.cost_per_unit : null;
      const margin = costValue !== null ? retailValue - costValue : null;
      const marginPercent = margin !== null && retailValue > 0 ? (margin / retailValue) * 100 : null;

      const valuation: ProductValuation = {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category || 'Uncategorized',
        stock_quantity: quantity,
        price: product.price,
        cost_per_unit: product.cost_per_unit,
        retail_value: retailValue,
        cost_value: costValue,
        margin,
        margin_percent: marginPercent,
      };

      const categoryProducts = categoryMap.get(valuation.category) || [];
      categoryProducts.push(valuation);
      categoryMap.set(valuation.category, categoryProducts);

      totalUnits += quantity;
      totalRetailValue += retailValue;
      if (costValue !== null) {
        totalCostValue += costValue;
        hasCostData = true;
      }
    }

    const categories: CategoryValuation[] = Array.from(categoryMap.entries()).map(([category, prods]) => {
      const catTotalUnits = prods.reduce((sum, p) => sum + p.stock_quantity, 0);
      const catTotalRetail = prods.reduce((sum, p) => sum + p.retail_value, 0);
      const catCostValues = prods.filter(p => p.cost_value !== null);
      const catTotalCost = catCostValues.length > 0
        ? catCostValues.reduce((sum, p) => sum + (p.cost_value || 0), 0)
        : null;

      return {
        category,
        products: prods,
        total_units: catTotalUnits,
        total_retail_value: catTotalRetail,
        total_cost_value: catTotalCost,
        product_count: prods.length,
      };
    }).sort((a, b) => b.total_retail_value - a.total_retail_value);

    const finalCostValue = hasCostData ? totalCostValue : null;
    const totalMargin = finalCostValue !== null ? totalRetailValue - finalCostValue : null;
    const marginPercent = totalMargin !== null && totalRetailValue > 0
      ? (totalMargin / totalRetailValue) * 100
      : null;

    return {
      total_products: products.length,
      total_units: totalUnits,
      total_retail_value: totalRetailValue,
      total_cost_value: finalCostValue,
      total_margin: totalMargin,
      margin_percent: marginPercent,
      categories,
    };
  }

  // Filter categories based on selection
  const filteredCategories = useMemo(() => {
    if (!valuationData?.current.categories) return [];
    if (categoryFilter === 'all') return valuationData.current.categories;
    return valuationData.current.categories.filter(c => c.category === categoryFilter);
  }, [valuationData, categoryFilter]);

  // Toggle category expansion
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Export to CSV
  const exportToCSV = useCallback(() => {
    if (!valuationData?.current.categories.length) return;

    const headers = ['Category', 'Product', 'SKU', 'Quantity', 'Unit Price', 'Unit Cost', 'Retail Value', 'Cost Value', 'Margin', 'Margin %'];
    const rows: string[][] = [];

    for (const category of valuationData.current.categories) {
      for (const product of category.products) {
        rows.push([
          product.category,
          product.name,
          product.sku || '',
          String(product.stock_quantity),
          product.price.toFixed(2),
          product.cost_per_unit?.toFixed(2) || '',
          product.retail_value.toFixed(2),
          product.cost_value?.toFixed(2) || '',
          product.margin?.toFixed(2) || '',
          product.margin_percent?.toFixed(1) || '',
        ]);
      }
    }

    // Add summary rows
    rows.push([]);
    rows.push(['SUMMARY', '', '', '', '', '', '', '', '', '']);
    rows.push(['Total Products', String(valuationData.current.total_products), '', '', '', '', '', '', '', '']);
    rows.push(['Total Units', String(valuationData.current.total_units), '', '', '', '', '', '', '', '']);
    rows.push(['Total Retail Value', '', '', '', '', '', formatCurrency(valuationData.current.total_retail_value), '', '', '']);
    if (valuationData.current.total_cost_value !== null) {
      rows.push(['Total Cost Value', '', '', '', '', '', '', formatCurrency(valuationData.current.total_cost_value), '', '']);
      rows.push(['Total Margin', '', '', '', '', '', '', '', formatCurrency(valuationData.current.total_margin || 0), `${valuationData.current.margin_percent?.toFixed(1)}%`]);
    }

    if (valuationData.previous) {
      rows.push([]);
      rows.push(['PERIOD COMPARISON (vs 30 days ago)', '', '', '', '', '', '', '', '', '']);
      rows.push(['Retail Value Change', formatPercent(valuationData.retail_change_percent), '', '', '', '', '', '', '', '']);
      rows.push(['Units Change', formatPercent(valuationData.units_change_percent), '', '', '', '', '', '', '', '']);
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    link.setAttribute('download', `inventory-valuation-${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.info('Exported valuation report to CSV', {
      tenantId: tenant?.id,
      productCount: valuationData.current.total_products,
    });
  }, [valuationData, tenant?.id]);

  if (queryError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Inventory Valuation Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-destructive py-4">
            Failed to load valuation report. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <DollarSign className="h-5 w-5" />
              Inventory Valuation Report
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Total value of current inventory by product and category
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(v: ViewMode) => setViewMode(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Summary</SelectItem>
                <SelectItem value="by_category">By Category</SelectItem>
                <SelectItem value="by_product">By Product</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={!valuationData?.current.categories.length}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        ) : !valuationData?.current.total_products ? (
          <EnhancedEmptyState
            icon={Package}
            title="No Inventory Data"
            description="Add products with stock quantities to see valuation data."
          />
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Retail Value</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(valuationData.current.total_retail_value)}
                    </p>
                    {valuationData.retail_change_percent !== null && (
                      <div className={cn(
                        'flex items-center gap-1 text-xs mt-1',
                        valuationData.retail_change_percent >= 0 ? 'text-green-600' : 'text-red-600'
                      )}>
                        {valuationData.retail_change_percent >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {formatPercent(valuationData.retail_change_percent)} vs 30d ago
                      </div>
                    )}
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground opacity-50" />
                </div>
              </Card>

              {valuationData.current.total_cost_value !== null && (
                <Card className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Cost Value</p>
                      <p className="text-2xl font-bold mt-1">
                        {formatCurrency(valuationData.current.total_cost_value)}
                      </p>
                      {valuationData.cost_change_percent !== null && (
                        <div className={cn(
                          'flex items-center gap-1 text-xs mt-1',
                          valuationData.cost_change_percent >= 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                          {valuationData.cost_change_percent >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {formatPercent(valuationData.cost_change_percent)} vs 30d ago
                        </div>
                      )}
                    </div>
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground opacity-50" />
                  </div>
                </Card>
              )}

              <Card className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Units</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatNumber(valuationData.current.total_units)}
                    </p>
                    {valuationData.units_change_percent !== null && (
                      <div className={cn(
                        'flex items-center gap-1 text-xs mt-1',
                        valuationData.units_change_percent >= 0 ? 'text-green-600' : 'text-red-600'
                      )}>
                        {valuationData.units_change_percent >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {formatPercent(valuationData.units_change_percent)} vs 30d ago
                      </div>
                    )}
                  </div>
                  <Package className="h-8 w-8 text-muted-foreground opacity-50" />
                </div>
              </Card>

              {valuationData.current.margin_percent !== null && (
                <Card className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Margin</p>
                      <p className="text-2xl font-bold mt-1">
                        {valuationData.current.margin_percent.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(valuationData.current.total_margin || 0)} total
                      </p>
                    </div>
                    <Layers className="h-8 w-8 text-muted-foreground opacity-50" />
                  </div>
                </Card>
              )}
            </div>

            {/* Category Filter */}
            {viewMode !== 'summary' && (
              <div className="flex items-center gap-3">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[200px]">
                    <Layers className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {valuationData.current.categories.map(cat => (
                      <SelectItem key={cat.category} value={cat.category}>
                        {cat.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline">
                  {filteredCategories.length} {filteredCategories.length === 1 ? 'category' : 'categories'}
                </Badge>
              </div>
            )}

            {/* Summary View */}
            {viewMode === 'summary' && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Products</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Retail Value</TableHead>
                      <TableHead className="text-right">Cost Value</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {valuationData.current.categories.map(category => {
                      const percentOfTotal = valuationData.current.total_retail_value > 0
                        ? (category.total_retail_value / valuationData.current.total_retail_value) * 100
                        : 0;

                      return (
                        <TableRow key={category.category}>
                          <TableCell className="font-medium">{category.category}</TableCell>
                          <TableCell className="text-right">{category.product_count}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatNumber(category.total_units)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(category.total_retail_value)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {category.total_cost_value !== null
                              ? formatCurrency(category.total_cost_value)
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="font-mono">
                              {percentOfTotal.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{valuationData.current.total_products}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(valuationData.current.total_units)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(valuationData.current.total_retail_value)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {valuationData.current.total_cost_value !== null
                          ? formatCurrency(valuationData.current.total_cost_value)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">100%</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}

            {/* Category View with Collapsible Products */}
            {viewMode === 'by_category' && (
              <div className="space-y-3">
                {filteredCategories.map(category => (
                  <Collapsible
                    key={category.category}
                    open={expandedCategories.has(category.category)}
                    onOpenChange={() => toggleCategory(category.category)}
                  >
                    <Card>
                      <CollapsibleTrigger asChild>
                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/50 transition-colors">
                          <div className="flex items-center gap-3">
                            {expandedCategories.has(category.category) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <div>
                              <h4 className="font-semibold">{category.category}</h4>
                              <p className="text-sm text-muted-foreground">
                                {category.product_count} products • {formatNumber(category.total_units)} units
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(category.total_retail_value)}</p>
                            {category.total_cost_value !== null && (
                              <p className="text-sm text-muted-foreground">
                                Cost: {formatCurrency(category.total_cost_value)}
                              </p>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Cost</TableHead>
                                <TableHead className="text-right">Value</TableHead>
                                <TableHead className="text-right">Margin</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {category.products.map(product => (
                                <TableRow key={product.id}>
                                  <TableCell>
                                    <div>
                                      <span className="font-medium">{product.name}</span>
                                      {product.sku && (
                                        <span className="text-xs text-muted-foreground ml-2">
                                          {product.sku}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {product.stock_quantity}
                                  </TableCell>
                                  <TableCell className="text-right font-mono">
                                    {formatCurrency(product.price)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-muted-foreground">
                                    {product.cost_per_unit !== null
                                      ? formatCurrency(product.cost_per_unit)
                                      : '-'}
                                  </TableCell>
                                  <TableCell className="text-right font-mono font-medium">
                                    {formatCurrency(product.retail_value)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {product.margin_percent !== null ? (
                                      <Badge
                                        variant={product.margin_percent >= 30 ? 'default' : 'secondary'}
                                        className="font-mono"
                                      >
                                        {product.margin_percent.toFixed(1)}%
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}

            {/* Flat Product View */}
            {viewMode === 'by_product' && (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Retail Value</TableHead>
                      <TableHead className="text-right">Cost Value</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategories.flatMap(cat => cat.products).map(product => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{product.name}</span>
                            {product.sku && (
                              <p className="text-xs text-muted-foreground">{product.sku}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {product.stock_quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(product.price)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {product.cost_per_unit !== null
                            ? formatCurrency(product.cost_per_unit)
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(product.retail_value)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {product.cost_value !== null
                            ? formatCurrency(product.cost_value)
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.margin_percent !== null ? (
                            <Badge
                              variant={product.margin_percent >= 30 ? 'default' : 'secondary'}
                              className="font-mono"
                            >
                              {product.margin_percent.toFixed(1)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={2}>
                        Total ({filteredCategories.reduce((sum, c) => sum + c.product_count, 0)} products)
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(filteredCategories.reduce((sum, c) => sum + c.total_units, 0))}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(filteredCategories.reduce((sum, c) => sum + c.total_retail_value, 0))}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {filteredCategories.some(c => c.total_cost_value !== null)
                          ? formatCurrency(filteredCategories.reduce((sum, c) => sum + (c.total_cost_value || 0), 0))
                          : '-'}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
