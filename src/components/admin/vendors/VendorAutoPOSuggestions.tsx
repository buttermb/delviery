/**
 * Vendor Auto-PO Suggestions Component
 *
 * Based on inventory forecasting, auto-generates PO suggestions.
 * When multiple products from the same vendor are approaching reorder point,
 * suggests a consolidated PO.
 *
 * Features:
 * - Shows estimated cost and recommended quantities based on sales velocity
 * - One-click to create draft PO
 * - Daily check triggered by dashboard load
 * - Groups products by vendor for consolidated ordering
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  ShoppingCart,
  TrendingDown,
} from 'lucide-react';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useVendorPOSuggestions, type VendorPOSuggestion } from '@/hooks/useVendorPOSuggestions';
import { cn } from '@/lib/utils';
import { formatSmartDate } from '@/lib/formatters';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ============================================================================
// Types
// ============================================================================

interface VendorAutoPOSuggestionsProps {
  /** Maximum suggestions to show in compact mode */
  maxVisible?: number;
  /** Show as full page or widget */
  variant?: 'full' | 'widget';
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function VendorAutoPOSuggestions({
  maxVisible = 5,
  variant = 'full',
  className,
}: VendorAutoPOSuggestionsProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, loading: authLoading } = useTenantAdminAuth();

  const {
    suggestions,
    totalSuggestions,
    criticalCount,
    warningCount,
    totalEstimatedCost,
    isLoading,
    error,
    refetch,
    createDraftPO,
    isCreatingPO,
  } = useVendorPOSuggestions();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<VendorPOSuggestion | null>(null);
  const [creatingVendorId, setCreatingVendorId] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleCreatePO = async (suggestion: VendorPOSuggestion) => {
    setCreatingVendorId(suggestion.vendorId);
    const poId = await createDraftPO(suggestion.vendorId);
    setCreatingVendorId(null);

    if (poId && tenantSlug) {
      // Navigate to the created PO
      navigate(`/${tenantSlug}/admin/purchase-orders/${poId}`);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return formatSmartDate(date);
  };

  const getUrgencyBadge = (level: VendorPOSuggestion['urgencyLevel']) => {
    switch (level) {
      case 'critical':
        return (
          <Badge variant="destructive" className="text-xs">
            Critical
          </Badge>
        );
      case 'warning':
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">Warning</Badge>
        );
      case 'soon':
        return (
          <Badge variant="secondary" className="text-xs">
            Soon
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            Monitor
          </Badge>
        );
    }
  };

  // Loading state
  if (authLoading || isLoading) {
    return (
      <Card className={cn('border-none shadow-sm', className)}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn('border-none shadow-sm', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium">Failed to Load Suggestions</h3>
          <p className="text-muted-foreground text-sm mt-1">{error.message}</p>
          <Button variant="outline" onClick={handleRefresh} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No tenant
  if (!tenant) {
    return null;
  }

  // Empty state
  if (suggestions.length === 0) {
    return (
      <Card className={cn('border-none shadow-sm', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Auto-PO Suggestions
          </CardTitle>
          <CardDescription>
            Suggested purchase orders based on inventory forecasting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No Suggestions Needed</h3>
            <p className="text-muted-foreground mt-1 max-w-sm">
              All products have healthy stock levels. Check back later or review your inventory
              thresholds.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate(`/${tenantSlug}/admin/inventory`)}
              className="mt-4"
            >
              View Inventory
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayedSuggestions =
    variant === 'widget' ? suggestions.slice(0, maxVisible) : suggestions;

  return (
    <>
      <Card className={cn('border-none shadow-sm', className)}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Auto-PO Suggestions
              {totalSuggestions > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {totalSuggestions}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              Suggested purchase orders based on inventory forecasting
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh suggestions"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
        </CardHeader>

        {/* Summary stats */}
        <CardContent className="pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{totalSuggestions}</div>
              <div className="text-xs text-muted-foreground">Vendors</div>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {criticalCount}
              </div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {warningCount}
              </div>
              <div className="text-xs text-muted-foreground">Warning</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{formatCurrency(totalEstimatedCost)}</div>
              <div className="text-xs text-muted-foreground">Est. Total</div>
            </div>
          </div>

          {/* Suggestions list */}
          <ScrollArea className={variant === 'widget' ? 'max-h-[400px]' : 'max-h-[600px]'}>
            <Accordion
              type="multiple"
              defaultValue={displayedSuggestions.slice(0, 3).map((s) => s.vendorId)}
            >
              {displayedSuggestions.map((suggestion) => (
                <AccordionItem key={suggestion.vendorId} value={suggestion.vendorId}>
                  <AccordionTrigger className="hover:no-underline px-2">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'p-2 rounded-lg',
                            suggestion.urgencyLevel === 'critical'
                              ? 'bg-red-100 dark:bg-red-900'
                              : suggestion.urgencyLevel === 'warning'
                                ? 'bg-yellow-100 dark:bg-yellow-900'
                                : 'bg-muted'
                          )}
                        >
                          <Building2
                            className={cn(
                              'h-4 w-4',
                              suggestion.urgencyLevel === 'critical'
                                ? 'text-red-600 dark:text-red-400'
                                : suggestion.urgencyLevel === 'warning'
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : 'text-muted-foreground'
                            )}
                          />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">{suggestion.vendorName}</div>
                          <div className="text-xs text-muted-foreground">
                            {suggestion.totalProducts} product
                            {suggestion.totalProducts !== 1 ? 's' : ''}
                          </div>
                        </div>
                        {getUrgencyBadge(suggestion.urgencyLevel)}
                      </div>

                      <div className="flex items-center gap-4">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatDate(suggestion.recommendedOrderDate)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Recommended order date</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <div className="font-medium text-sm">
                          {formatCurrency(suggestion.totalEstimatedCost)}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-2">
                    <div className="space-y-4">
                      {/* Product table */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead className="text-right">Velocity</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Est. Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {suggestion.products.map((product) => (
                            <TableRow key={product.productId}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="font-medium text-sm">{product.productName}</div>
                                    {product.sku && (
                                      <div className="text-xs text-muted-foreground">
                                        {product.sku}
                                      </div>
                                    )}
                                  </div>
                                  {product.warningLevel === 'critical' && (
                                    <AlertTriangle className="h-3 w-3 text-red-500" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {product.currentStock <= 0 ? (
                                    <span className="text-red-600 font-medium">Out</span>
                                  ) : (
                                    <>
                                      <span>{product.currentStock}</span>
                                      {product.currentStock <= product.reorderPoint && (
                                        <TrendingDown className="h-3 w-3 text-red-500" />
                                      )}
                                    </>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {product.salesVelocity.toFixed(1)}/day
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {product.recommendedQuantity}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(product.estimatedCost)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {/* Summary row */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Avg {suggestion.avgDaysUntilStockout} days until stockout
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            Total: {formatCurrency(suggestion.totalEstimatedCost)}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedSuggestion(suggestion)}
                          >
                            View Details
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleCreatePO(suggestion)}
                            disabled={isCreatingPO}
                          >
                            {creatingVendorId === suggestion.vendorId ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4 mr-2" />
                            )}
                            Create Draft PO
                          </Button>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>

          {/* View all link for widget */}
          {variant === 'widget' && suggestions.length > maxVisible && (
            <div className="pt-4 border-t mt-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate(`/${tenantSlug}/admin/vendors/po-suggestions`)}
              >
                View All {totalSuggestions} Suggestions
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!selectedSuggestion} onOpenChange={() => setSelectedSuggestion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              PO Suggestion: {selectedSuggestion?.vendorName}
            </DialogTitle>
            <DialogDescription>
              {selectedSuggestion?.totalProducts} product
              {selectedSuggestion?.totalProducts !== 1 ? 's' : ''} need restocking
            </DialogDescription>
          </DialogHeader>

          {selectedSuggestion && (
            <div className="space-y-4">
              {/* Urgency and dates */}
              <div className="flex items-center gap-4">
                {getUrgencyBadge(selectedSuggestion.urgencyLevel)}
                <span className="text-sm text-muted-foreground">
                  Recommended order by: {formatDate(selectedSuggestion.recommendedOrderDate)}
                </span>
              </div>

              {/* Products */}
              <ScrollArea className="max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="text-right">Reorder Pt</TableHead>
                      <TableHead className="text-right">Order Qty</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSuggestion.products.map((product) => (
                      <TableRow key={product.productId}>
                        <TableCell>
                          <div className="font-medium">{product.productName}</div>
                          {product.sku && (
                            <div className="text-xs text-muted-foreground">{product.sku}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              product.currentStock <= product.reorderPoint && 'text-red-600'
                            )}
                          >
                            {product.currentStock}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{product.reorderPoint}</TableCell>
                        <TableCell className="text-right font-medium">
                          {product.recommendedQuantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(product.unitCost)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(product.estimatedCost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Total */}
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="font-medium">Estimated Total:</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(selectedSuggestion.totalEstimatedCost)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSuggestion(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (selectedSuggestion) {
                  handleCreatePO(selectedSuggestion);
                  setSelectedSuggestion(null);
                }
              }}
              disabled={isCreatingPO}
            >
              {isCreatingPO ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Draft PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default VendorAutoPOSuggestions;
