/**
 * InventoryAudit Page
 * Physical inventory audit workflow with count entry, discrepancy highlighting,
 * adjustment submission, and PDF report generation.
 * Permission-gated to admin role.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import ClipboardCheck from 'lucide-react/dist/esm/icons/clipboard-check';
import Save from 'lucide-react/dist/esm/icons/save';
import FileDown from 'lucide-react/dist/esm/icons/file-down';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Search from 'lucide-react/dist/esm/icons/search';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import History from 'lucide-react/dist/esm/icons/history';
import Package from 'lucide-react/dist/esm/icons/package';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { invalidateOnEvent } from '@/lib/invalidation';

interface Product {
  id: string;
  tenant_id: string;
  name: string;
  sku: string | null;
  available_quantity: number;
  category: string | null;
}

interface AuditEntry {
  productId: string;
  productName: string;
  productSku: string | null;
  expectedQuantity: number;
  actualQuantity: number | null;
  discrepancy: number;
  notes: string;
}

interface AuditHistoryRecord {
  id: string;
  tenant_id: string;
  created_at: string;
  performed_by: string | null;
  total_products: number;
  discrepancies_count: number;
  notes: string | null;
  status: 'completed' | 'pending';
}

export default function InventoryAudit() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Audit state
  const [auditEntries, setAuditEntries] = useState<Map<string, AuditEntry>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [auditNotes, setAuditNotes] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'audit' | 'history'>('audit');

  // Fetch products for audit
  const { data: products, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: queryKeys.products.list(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, tenant_id, name, sku, available_quantity, category')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (error) {
        logger.error('Failed to fetch products for audit', { error, tenantId: tenant.id });
        throw error;
      }

      return (data || []) as Product[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch audit history
  const { data: auditHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['inventory-audits', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      // Query inventory_history for audit entries grouped by date
      const { data, error } = await (supabase as any)
        .from('inventory_history')
        .select('id, tenant_id, created_at, performed_by, notes')
        .eq('tenant_id', tenant.id)
        .eq('reason', 'audit')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.error('Failed to fetch audit history', { error, tenantId: tenant.id });
        return [];
      }

      // Group by date to show audit sessions
      const auditSessions = new Map<string, AuditHistoryRecord>();
      for (const entry of (data || []) as any[]) {
        const dateKey = format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm');
        if (!auditSessions.has(dateKey)) {
          auditSessions.set(dateKey, {
            id: entry.id,
            tenant_id: entry.tenant_id,
            created_at: entry.created_at,
            performed_by: entry.performed_by,
            total_products: 1,
            discrepancies_count: 1,
            notes: entry.notes,
            status: 'completed',
          });
        } else {
          const existing = auditSessions.get(dateKey);
          if (existing) {
            existing.total_products += 1;
            existing.discrepancies_count += 1;
          }
        }
      }

      return Array.from(auditSessions.values());
    },
    enabled: !!tenant?.id,
  });

  // Initialize audit entry for a product
  const initializeAuditEntry = useCallback((product: Product): AuditEntry => ({
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    expectedQuantity: product.available_quantity,
    actualQuantity: null,
    discrepancy: 0,
    notes: '',
  }), []);

  // Update actual count for a product
  const updateActualCount = useCallback((productId: string, actualCount: string, product: Product) => {
    const numValue = actualCount === '' ? null : parseFloat(actualCount);

    setAuditEntries(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(productId) || initializeAuditEntry(product);

      const discrepancy = numValue !== null ? numValue - existing.expectedQuantity : 0;

      newMap.set(productId, {
        ...existing,
        actualQuantity: numValue,
        discrepancy,
      });

      return newMap;
    });
  }, [initializeAuditEntry]);

  // Update notes for a product
  const updateNotes = useCallback((productId: string, notes: string, product: Product) => {
    setAuditEntries(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(productId) || initializeAuditEntry(product);

      newMap.set(productId, {
        ...existing,
        notes,
      });

      return newMap;
    });
  }, [initializeAuditEntry]);

  // Filter products by search term
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchTerm) return products;

    const searchLower = searchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(searchLower) ||
      p.sku?.toLowerCase().includes(searchLower) ||
      p.category?.toLowerCase().includes(searchLower)
    );
  }, [products, searchTerm]);

  // Calculate audit statistics
  const auditStats = useMemo(() => {
    const entries = Array.from(auditEntries.values());
    const counted = entries.filter(e => e.actualQuantity !== null);
    const withDiscrepancy = counted.filter(e => e.discrepancy !== 0);
    const totalDiscrepancy = counted.reduce((sum, e) => sum + e.discrepancy, 0);

    return {
      totalProducts: products?.length || 0,
      counted: counted.length,
      withDiscrepancy: withDiscrepancy.length,
      totalDiscrepancy,
    };
  }, [auditEntries, products?.length]);

  // Submit audit mutation
  const submitAuditMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id || !admin?.userId) {
        throw new Error('Missing tenant or admin context');
      }

      const entries = Array.from(auditEntries.values()).filter(e => e.actualQuantity !== null && e.discrepancy !== 0);

      if (entries.length === 0) {
        throw new Error('No discrepancies to record');
      }

      // Create inventory_history entries for each discrepancy
      const historyEntries = entries.map(entry => ({
        tenant_id: tenant.id,
        product_id: entry.productId,
        change_type: entry.discrepancy > 0 ? 'increase' : 'decrease',
        previous_quantity: entry.expectedQuantity,
        new_quantity: entry.actualQuantity as number,
        change_amount: entry.discrepancy,
        reason: 'audit',
        notes: entry.notes || `Audit adjustment: ${entry.discrepancy > 0 ? '+' : ''}${entry.discrepancy.toFixed(2)}`,
        performed_by: admin.userId,
        reference_type: 'audit',
      }));

      // Insert history entries
      const { error: historyError } = await (supabase as any)
        .from('inventory_history')
        .insert(historyEntries);

      if (historyError) {
        logger.error('Failed to create audit history entries', { error: historyError, tenantId: tenant.id });
        throw historyError;
      }

      // Update product quantities
      for (const entry of entries) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            available_quantity: entry.actualQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', entry.productId)
          .eq('tenant_id', tenant.id);

        if (updateError) {
          logger.error('Failed to update product quantity', {
            error: updateError,
            productId: entry.productId,
            tenantId: tenant.id
          });
          // Continue with other products
        }
      }

      return entries.length;
    },
    onSuccess: (count) => {
      toast.success('Audit Completed', {
        description: `${count} inventory adjustments recorded`,
      });

      // Invalidate related queries
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenant.id);
        queryClient.invalidateQueries({ queryKey: ['inventory-audits', tenant.id] });
        queryClient.invalidateQueries({ queryKey: queryKeys.products.list(tenant.id) });
      }

      // Reset audit state
      setAuditEntries(new Map());
      setAuditNotes('');
      setShowConfirmDialog(false);
    },
    onError: (error: unknown) => {
      logger.error('Audit submission failed', { error, tenantId: tenant?.id });
      toast.error('Audit Failed', {
        description: error instanceof Error ? error.message : 'Failed to submit audit',
      });
    },
  });

  // Generate PDF report
  const generatePdfReport = useCallback(() => {
    const entries = Array.from(auditEntries.values()).filter(e => e.actualQuantity !== null);

    if (entries.length === 0) {
      toast.error('No entries to export', {
        description: 'Please count at least one product before generating a report',
      });
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Inventory Audit Report', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Date and business info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, 20, yPos);
    yPos += 5;
    doc.text(`Business: ${tenant?.business_name || 'Unknown'}`, 20, yPos);
    yPos += 5;
    doc.text(`Auditor: ${admin?.email || 'Unknown'}`, 20, yPos);
    yPos += 10;

    // Summary stats
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 20, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Products Counted: ${entries.length}`, 20, yPos);
    yPos += 5;
    doc.text(`Discrepancies Found: ${auditStats.withDiscrepancy}`, 20, yPos);
    yPos += 5;
    doc.text(`Net Adjustment: ${auditStats.totalDiscrepancy >= 0 ? '+' : ''}${auditStats.totalDiscrepancy.toFixed(2)}`, 20, yPos);
    yPos += 10;

    // Notes
    if (auditNotes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Notes:', 20, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      const splitNotes = doc.splitTextToSize(auditNotes, pageWidth - 40);
      doc.text(splitNotes, 20, yPos);
      yPos += splitNotes.length * 5 + 5;
    }

    // Table header
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(20, yPos - 4, pageWidth - 40, 8, 'F');
    doc.text('Product', 22, yPos);
    doc.text('Expected', 90, yPos);
    doc.text('Actual', 120, yPos);
    doc.text('Variance', 150, yPos);
    yPos += 8;

    // Table rows
    doc.setFont('helvetica', 'normal');
    for (const entry of entries) {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      const hasDiscrepancy = entry.discrepancy !== 0;

      doc.text(entry.productName.substring(0, 30), 22, yPos);
      doc.text(entry.expectedQuantity.toFixed(2), 90, yPos);
      doc.text((entry.actualQuantity ?? 0).toFixed(2), 120, yPos);

      if (hasDiscrepancy) {
        doc.setTextColor(entry.discrepancy > 0 ? 34 : 220, entry.discrepancy > 0 ? 139 : 53, entry.discrepancy > 0 ? 34 : 69);
      }
      doc.text(`${entry.discrepancy > 0 ? '+' : ''}${entry.discrepancy.toFixed(2)}`, 150, yPos);
      doc.setTextColor(0, 0, 0);

      yPos += 6;
    }

    // Footer
    yPos += 10;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated on ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 20, yPos);

    // Save the PDF
    const filename = `inventory-audit-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
    doc.save(filename);

    logger.info('Generated inventory audit PDF report', {
      tenantId: tenant?.id,
      entryCount: entries.length,
      discrepancies: auditStats.withDiscrepancy,
    });

    toast.success('Report Generated', {
      description: `Saved as ${filename}`,
    });
  }, [auditEntries, auditNotes, auditStats, tenant?.business_name, tenant?.id, admin?.email]);

  // Reset audit
  const resetAudit = useCallback(() => {
    setAuditEntries(new Map());
    setAuditNotes('');
    setSearchTerm('');
  }, []);

  // Loading state
  if (productsLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Error state
  if (productsError) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Card>
          <CardContent className="py-12">
            <EnhancedEmptyState
              icon={AlertTriangle}
              title="Failed to Load Products"
              description="Unable to load products for audit. Please try again."
              primaryAction={{
                label: 'Retry',
                onClick: () => queryClient.invalidateQueries({ queryKey: queryKeys.products.list(tenant?.id) }),
              }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Inventory Audit</h1>
            <p className="text-sm text-muted-foreground">
              Physical count verification and adjustment workflow
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={resetAudit}
            disabled={auditEntries.size === 0}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            variant="outline"
            onClick={generatePdfReport}
            disabled={auditStats.counted === 0}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={auditStats.withDiscrepancy === 0 || submitAuditMutation.isPending}
          >
            {submitAuditMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Submit Audit
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'audit' | 'history')}>
        <TabsList>
          <TabsTrigger value="audit" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Current Audit
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Audit History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-6 mt-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{auditStats.totalProducts}</div>
                <p className="text-sm text-muted-foreground">Total Products</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{auditStats.counted}</div>
                <p className="text-sm text-muted-foreground">Counted</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className={cn(
                  "text-2xl font-bold",
                  auditStats.withDiscrepancy > 0 && "text-amber-600"
                )}>
                  {auditStats.withDiscrepancy}
                </div>
                <p className="text-sm text-muted-foreground">Discrepancies</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className={cn(
                  "text-2xl font-bold font-mono",
                  auditStats.totalDiscrepancy > 0 && "text-green-600",
                  auditStats.totalDiscrepancy < 0 && "text-red-600"
                )}>
                  {auditStats.totalDiscrepancy >= 0 ? '+' : ''}{auditStats.totalDiscrepancy.toFixed(2)}
                </div>
                <p className="text-sm text-muted-foreground">Net Change</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search products by name, SKU, or category"
              placeholder="Search products by name, SKU, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Count Entry
              </CardTitle>
              <CardDescription>
                Enter actual counts for each product. Discrepancies will be highlighted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredProducts.length === 0 ? (
                <EnhancedEmptyState
                  icon={Package}
                  title={searchTerm ? 'No Matching Products' : 'No Products Found'}
                  description={
                    searchTerm
                      ? 'Try adjusting your search term'
                      : 'Add products to your inventory to begin auditing'
                  }
                />
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Product</TableHead>
                        <TableHead className="text-right w-[120px]">Expected</TableHead>
                        <TableHead className="text-right w-[120px]">Actual Count</TableHead>
                        <TableHead className="text-right w-[100px]">Variance</TableHead>
                        <TableHead className="w-[60px]">Status</TableHead>
                        <TableHead className="min-w-[150px]">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => {
                        const entry = auditEntries.get(product.id);
                        const hasDiscrepancy = entry && entry.discrepancy !== 0;
                        const isCounted = entry && entry.actualQuantity !== null;

                        return (
                          <TableRow
                            key={product.id}
                            className={cn(
                              hasDiscrepancy && "bg-amber-50 dark:bg-amber-950/20"
                            )}
                          >
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{product.name}</span>
                                {product.sku && (
                                  <span className="text-xs text-muted-foreground">
                                    SKU: {product.sku}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {product.available_quantity.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Enter count"
                                value={entry?.actualQuantity ?? ''}
                                onChange={(e) => updateActualCount(product.id, e.target.value, product)}
                                className="w-full text-right font-mono"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              {isCounted && (
                                <span className={cn(
                                  "font-mono font-semibold",
                                  entry.discrepancy > 0 && "text-green-600 dark:text-green-400",
                                  entry.discrepancy < 0 && "text-red-600 dark:text-red-400"
                                )}>
                                  {entry.discrepancy >= 0 ? '+' : ''}{entry.discrepancy.toFixed(2)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isCounted && (
                                hasDiscrepancy ? (
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Diff
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    OK
                                  </Badge>
                                )
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="Optional notes"
                                value={entry?.notes ?? ''}
                                onChange={(e) => updateNotes(product.id, e.target.value, product)}
                                className="text-sm"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Audit Notes</CardTitle>
              <CardDescription>
                Add any general notes about this audit session
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter any notes about this audit (e.g., observations, issues found, etc.)"
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Audit History
              </CardTitle>
              <CardDescription>
                Previous inventory audit sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : !auditHistory || auditHistory.length === 0 ? (
                <EnhancedEmptyState
                  icon={History}
                  title="No Audit History"
                  description="Completed audits will appear here"
                />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Products</TableHead>
                        <TableHead className="text-right">Adjustments</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditHistory.map((audit) => (
                        <TableRow key={audit.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {format(new Date(audit.created_at), 'MMM d, yyyy')}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(audit.created_at), 'h:mm a')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {audit.total_products}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {audit.discrepancies_count}
                          </TableCell>
                          <TableCell>
                            <Badge variant={audit.status === 'completed' ? 'default' : 'secondary'}>
                              {audit.status === 'completed' ? (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              ) : (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              )}
                              {audit.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {audit.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Audit Submission</DialogTitle>
            <DialogDescription>
              This will create inventory adjustments for all discrepancies found.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Products Counted</p>
                <p className="text-lg font-bold">{auditStats.counted}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Discrepancies</p>
                <p className="text-lg font-bold text-amber-600">{auditStats.withDiscrepancy}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Net Adjustment</p>
                <p className={cn(
                  "text-lg font-bold font-mono",
                  auditStats.totalDiscrepancy > 0 && "text-green-600",
                  auditStats.totalDiscrepancy < 0 && "text-red-600"
                )}>
                  {auditStats.totalDiscrepancy >= 0 ? '+' : ''}{auditStats.totalDiscrepancy.toFixed(2)} units
                </p>
              </div>
            </div>
            {auditNotes && (
              <div>
                <Label className="text-sm text-muted-foreground">Notes</Label>
                <p className="text-sm mt-1">{auditNotes}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={submitAuditMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => submitAuditMutation.mutate()}
              disabled={submitAuditMutation.isPending}
            >
              {submitAuditMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Confirm & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
