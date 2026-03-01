/**
 * OrderInvoiceGenerator Component
 * Generates professional PDF invoices from orders using jsPDF
 * Saves invoice records to database with order and customer links
 * Auto-generates invoice numbers from tenant sequence
 */

import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateOnEvent } from '@/lib/invalidation';
import { Button } from '@/components/ui/button';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Printer from 'lucide-react/dist/esm/icons/printer';
import FilePlus from 'lucide-react/dist/esm/icons/file-plus';
import type { OrderItem } from '@/types/order';

/**
 * Extended order data for invoice generation
 */
export interface OrderInvoiceData {
  /** Order ID */
  id: string;
  /** Order tracking code or order number */
  tracking_code: string;
  /** Order creation date */
  created_at: string;
  /** Order total amount */
  total_amount: number;
  /** Order status */
  status: string;
  /** Delivery address */
  delivery_address: string;
  /** Order items */
  order_items?: OrderItem[];
  /** Customer ID for linking invoice to customer */
  customer_id?: string;
  /** Customer information */
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  /** Merchant/Store information */
  merchants?: {
    business_name?: string;
    address?: string;
    phone?: string;
    email?: string;
  } | null;
  /** Payment method */
  payment_method?: string;
  /** Delivery method */
  delivery_method?: string;
  /** Optional subtotal (calculated if not provided) */
  subtotal?: number;
  /** Optional tax amount */
  tax?: number;
  /** Optional discount amount */
  discount?: number;
  /** Optional delivery fee */
  delivery_fee?: number;
  /** Optional notes */
  notes?: string;
  /** Amount already paid (for partial payments) */
  amount_paid?: number;
}

export interface OrderInvoiceGeneratorProps {
  /** Order data to generate invoice from */
  order: OrderInvoiceData;
  /** Company name for the invoice header */
  companyName?: string;
  /** Company address for the invoice header */
  companyAddress?: string;
  /** Company email for the invoice header */
  companyEmail?: string;
  /** Company phone for the invoice header */
  companyPhone?: string;
  /** Company logo URL (optional) */
  logoUrl?: string;
  /** Payment instructions/terms */
  paymentInstructions?: string;
  /** Invoice prefix (e.g., "INV-") */
  invoicePrefix?: string;
}

/**
 * Generate an invoice number from order tracking code
 */
function generateInvoiceNumber(trackingCode: string, prefix: string = 'INV-'): string {
  return `${prefix}${trackingCode}`;
}

/**
 * Calculate subtotal from order items if not provided
 */
function calculateSubtotal(items: OrderItem[] | undefined): number {
  if (!items || items.length === 0) return 0;
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

/**
 * Generate a professional PDF invoice from order data
 */
export async function generateOrderInvoicePDF({
  order,
  companyName = 'Your Company',
  companyAddress,
  companyEmail,
  companyPhone,
  logoUrl,
  paymentInstructions = 'Thank you for your order!',
  invoicePrefix = 'INV-',
}: OrderInvoiceGeneratorProps): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Brand color
  const brandColor = { r: 16, g: 185, b: 129 }; // FloraIQ green (#10b981)

  // Helper to add logo from URL
  const addLogo = async (logoUrlToAdd: string, x: number, y: number, maxWidth: number, maxHeight: number): Promise<number> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(0);
            return;
          }

          // Calculate dimensions maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const dataUrl = canvas.toDataURL('image/png');
          doc.addImage(dataUrl, 'PNG', x, y, width, height);
          resolve(height);
        } catch {
          resolve(0);
        }
      };
      img.onerror = () => resolve(0);
      img.src = logoUrlToAdd;
    });
  };

  // Add logo if available
  if (logoUrl) {
    const logoHeight = await addLogo(logoUrl, margin, yPosition, 40, 20);
    if (logoHeight > 0) {
      yPosition += logoHeight + 5;
    }
  }

  // Header with brand color
  doc.setFillColor(brandColor.r, brandColor.g, brandColor.b);
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Invoice Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('INVOICE', pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 12;

  // Company Information (right side)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);

  if (companyAddress) {
    const addressLines = doc.splitTextToSize(companyAddress, 70);
    doc.text(addressLines, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += addressLines.length * 4;
  }

  if (companyEmail) {
    doc.text(companyEmail, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 4;
  }

  if (companyPhone) {
    doc.text(companyPhone, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 4;
  }

  yPosition = Math.max(yPosition, 55);

  // Invoice Details Box
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(margin, yPosition, contentWidth / 2 - 5, 30, 2, 2, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('Invoice Details', margin + 5, yPosition + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const invoiceNumber = generateInvoiceNumber(order.tracking_code, invoicePrefix);
  doc.text(`Invoice #: ${invoiceNumber}`, margin + 5, yPosition + 16);
  doc.text(`Order Date: ${format(new Date(order.created_at), 'MMM d, yyyy')}`, margin + 5, yPosition + 22);
  doc.text(`Order #: ${order.tracking_code}`, margin + 5, yPosition + 28);

  // Bill To / Ship To Box
  const billToX = margin + contentWidth / 2 + 5;
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(billToX, yPosition, contentWidth / 2 - 5, 30, 2, 2, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To / Ship To', billToX + 5, yPosition + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const customerName = order.customer?.name || 'Customer';
  doc.text(customerName, billToX + 5, yPosition + 16);

  if (order.customer?.email) {
    doc.text(order.customer.email, billToX + 5, yPosition + 22);
  }

  if (order.delivery_address) {
    const addressLines = doc.splitTextToSize(order.delivery_address, 70);
    doc.text(addressLines, billToX + 5, yPosition + 28);
  }

  yPosition += 40;

  // Status Badge
  const statusColors: Record<string, { r: number; g: number; b: number }> = {
    delivered: { r: 34, g: 197, b: 94 },
    completed: { r: 34, g: 197, b: 94 },
    confirmed: { r: 59, g: 130, b: 246 },
    preparing: { r: 245, g: 158, b: 11 },
    pending: { r: 156, g: 163, b: 175 },
    in_transit: { r: 139, g: 92, b: 246 },
    cancelled: { r: 239, g: 68, b: 68 },
    rejected: { r: 239, g: 68, b: 68 },
  };
  const statusColor = statusColors[order.status] || statusColors.pending;

  doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
  const statusText = order.status.replace(/_/g, ' ').toUpperCase();
  const statusWidth = doc.getTextWidth(statusText) + 8;
  doc.roundedRect(margin, yPosition, statusWidth, 7, 1, 1, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(statusText, margin + 4, yPosition + 5);

  yPosition += 15;

  // Line Items Table
  const colWidths = {
    item: contentWidth * 0.4,
    qty: contentWidth * 0.15,
    price: contentWidth * 0.2,
    total: contentWidth * 0.25,
  };

  // Table Header
  doc.setFillColor(brandColor.r, brandColor.g, brandColor.b);
  doc.rect(margin, yPosition, contentWidth, 8, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Item', margin + 3, yPosition + 5.5);
  doc.text('Qty', margin + colWidths.item + 3, yPosition + 5.5);
  doc.text('Unit Price', margin + colWidths.item + colWidths.qty + 3, yPosition + 5.5);
  doc.text('Total', margin + colWidths.item + colWidths.qty + colWidths.price + 3, yPosition + 5.5);

  yPosition += 10;

  // Table Rows
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');

  const lineItems = order.order_items ?? [];
  let rowIndex = 0;

  for (const item of lineItems) {
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage();
      yPosition = margin;

      // Re-add header on new page
      doc.setFillColor(brandColor.r, brandColor.g, brandColor.b);
      doc.rect(margin, yPosition, contentWidth, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Item', margin + 3, yPosition + 5.5);
      doc.text('Qty', margin + colWidths.item + 3, yPosition + 5.5);
      doc.text('Unit Price', margin + colWidths.item + colWidths.qty + 3, yPosition + 5.5);
      doc.text('Total', margin + colWidths.item + colWidths.qty + colWidths.price + 3, yPosition + 5.5);
      yPosition += 10;
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'normal');
    }

    // Alternating row background
    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(margin, yPosition - 3, contentWidth, 8, 'F');
    }

    const itemName = item.product_name || item.products?.name || 'Item';
    const itemLines = doc.splitTextToSize(itemName, colWidths.item - 6);
    doc.text(itemLines, margin + 3, yPosition + 2);

    doc.text(String(item.quantity), margin + colWidths.item + 3, yPosition + 2);
    doc.text(formatCurrency(item.price), margin + colWidths.item + colWidths.qty + 3, yPosition + 2);
    doc.text(formatCurrency(item.price * item.quantity), margin + colWidths.item + colWidths.qty + colWidths.price + 3, yPosition + 2);

    yPosition += Math.max(itemLines.length * 5, 8);
    rowIndex++;
  }

  // If no line items, show a message
  if (lineItems.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('No line items', margin + 3, yPosition + 2);
    yPosition += 8;
  }

  yPosition += 10;

  // Totals Section
  const totalsX = margin + colWidths.item + colWidths.qty;

  // Calculate subtotal if not provided
  const subtotal = order.subtotal ?? calculateSubtotal(order.order_items);

  // Subtotal
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Subtotal:', totalsX, yPosition);
  doc.text(formatCurrency(subtotal), pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;

  // Delivery Fee
  if (order.delivery_fee && order.delivery_fee > 0) {
    doc.text('Delivery Fee:', totalsX, yPosition);
    doc.text(formatCurrency(order.delivery_fee), pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 6;
  }

  // Tax
  if (order.tax && order.tax > 0) {
    doc.text('Tax:', totalsX, yPosition);
    doc.text(formatCurrency(order.tax), pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 6;
  }

  // Discount
  if (order.discount && order.discount > 0) {
    doc.setTextColor(34, 197, 94); // Green for discount
    doc.text('Discount:', totalsX, yPosition);
    doc.text(`-${formatCurrency(order.discount)}`, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 6;
    doc.setTextColor(100, 100, 100);
  }

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(totalsX, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  // Total
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('Total:', totalsX, yPosition);
  doc.setTextColor(brandColor.r, brandColor.g, brandColor.b);
  doc.text(formatCurrency(order.total_amount), pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 10;

  // Partial payment indicator
  const amountPaid = order.amount_paid ?? 0;
  if (amountPaid > 0) {
    const balanceDue = Math.max(0, order.total_amount - amountPaid);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 197, 94); // Green
    doc.text('Amount Paid:', totalsX, yPosition);
    doc.text(formatCurrency(amountPaid), pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 6;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(totalsX, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(balanceDue > 0 ? 239 : 34, balanceDue > 0 ? 68 : 197, balanceDue > 0 ? 68 : 94);
    doc.text('Amount Due:', totalsX, yPosition);
    doc.text(formatCurrency(balanceDue), pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 10;
  }

  yPosition += 5;

  // Payment & Delivery Method Info
  if (order.payment_method || order.delivery_method) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Order Information', margin, yPosition);
    yPosition += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);

    if (order.payment_method) {
      doc.text(`Payment Method: ${order.payment_method}`, margin, yPosition);
      yPosition += 5;
    }

    if (order.delivery_method) {
      doc.text(`Delivery Method: ${order.delivery_method}`, margin, yPosition);
      yPosition += 5;
    }

    yPosition += 5;
  }

  // Notes
  if (order.notes) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Notes:', margin, yPosition);
    yPosition += 5;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const noteLines = doc.splitTextToSize(order.notes, contentWidth);
    doc.text(noteLines, margin, yPosition);
    yPosition += noteLines.length * 4 + 5;
  }

  // Payment Instructions
  if (paymentInstructions) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    const instructionLines = doc.splitTextToSize(paymentInstructions, contentWidth);
    doc.text(instructionLines, margin, yPosition);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(brandColor.r, brandColor.g, brandColor.b);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    // Thank you message
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Page number
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  return doc;
}

/**
 * Download order invoice as PDF
 */
export async function downloadOrderInvoice(props: OrderInvoiceGeneratorProps): Promise<void> {
  try {
    const doc = await generateOrderInvoicePDF(props);
    const invoiceNumber = generateInvoiceNumber(props.order.tracking_code, props.invoicePrefix);
    doc.save(`Invoice-${invoiceNumber}.pdf`);
  } catch (error: unknown) {
    logger.error('Failed to generate order invoice PDF', error, {
      component: 'OrderInvoiceGenerator',
      orderId: props.order.id
    });
    throw error;
  }
}

/**
 * Print order invoice
 */
export async function printOrderInvoice(props: OrderInvoiceGeneratorProps): Promise<void> {
  try {
    const doc = await generateOrderInvoicePDF(props);
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  } catch (error: unknown) {
    logger.error('Failed to print order invoice', error, {
      component: 'OrderInvoiceGenerator',
      orderId: props.order.id
    });
    throw error;
  }
}

/**
 * Hook for order invoice generation
 */
export function useOrderInvoiceGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = useCallback(async (props: OrderInvoiceGeneratorProps): Promise<jsPDF> => {
    setIsGenerating(true);
    try {
      return await generateOrderInvoicePDF(props);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const download = useCallback(async (props: OrderInvoiceGeneratorProps): Promise<void> => {
    setIsGenerating(true);
    try {
      await downloadOrderInvoice(props);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const print = useCallback(async (props: OrderInvoiceGeneratorProps): Promise<void> => {
    setIsGenerating(true);
    try {
      await printOrderInvoice(props);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    generatePDF,
    download,
    print,
    isGenerating,
  };
}

/**
 * OrderInvoiceDownloadButton component props
 */
export interface OrderInvoiceDownloadButtonProps extends OrderInvoiceGeneratorProps {
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Custom class name */
  className?: string;
  /** Button label */
  label?: string;
}

/**
 * Button component for downloading order invoice PDF
 */
export function OrderInvoiceDownloadButton({
  order,
  companyName,
  companyAddress,
  companyEmail,
  companyPhone,
  logoUrl,
  paymentInstructions,
  invoicePrefix,
  variant = 'outline',
  size = 'default',
  className,
  label = 'Download Invoice',
}: OrderInvoiceDownloadButtonProps) {
  const { download, isGenerating } = useOrderInvoiceGenerator();

  const handleDownload = async () => {
    try {
      await download({
        order,
        companyName,
        companyAddress,
        companyEmail,
        companyPhone,
        logoUrl,
        paymentInstructions,
        invoicePrefix,
      });
    } catch (error) {
      logger.error('Failed to download invoice', error, { component: 'OrderInvoiceDownloadButton' });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleDownload}
      disabled={isGenerating}
    >
      {isGenerating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <FileText className="mr-2 h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  );
}

/**
 * OrderInvoicePrintButton component props
 */
export interface OrderInvoicePrintButtonProps extends OrderInvoiceGeneratorProps {
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Custom class name */
  className?: string;
  /** Button label */
  label?: string;
}

/**
 * Button component for printing order invoice
 */
export function OrderInvoicePrintButton({
  order,
  companyName,
  companyAddress,
  companyEmail,
  companyPhone,
  logoUrl,
  paymentInstructions,
  invoicePrefix,
  variant = 'outline',
  size = 'default',
  className,
  label = 'Print Invoice',
}: OrderInvoicePrintButtonProps) {
  const { print, isGenerating } = useOrderInvoiceGenerator();

  const handlePrint = async () => {
    try {
      await print({
        order,
        companyName,
        companyAddress,
        companyEmail,
        companyPhone,
        logoUrl,
        paymentInstructions,
        invoicePrefix,
      });
    } catch (error) {
      logger.error('Failed to print invoice', error, { component: 'OrderInvoicePrintButton' });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handlePrint}
      disabled={isGenerating}
    >
      {isGenerating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Preparing...
        </>
      ) : (
        <>
          <Printer className="mr-2 h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  );
}

// ============================================================================
// DATABASE-LINKED INVOICE GENERATION
// ============================================================================

/**
 * Invoice line item for database storage
 */
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

/**
 * Saved invoice record from database
 */
export interface SavedInvoice {
  id: string;
  tenant_id: string;
  customer_id: string;
  invoice_number: string;
  order_id: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'unpaid' | 'paid' | 'overdue' | 'cancelled';
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * Input for creating an invoice from an order
 */
export interface CreateOrderInvoiceInput {
  order: OrderInvoiceData;
  customerId: string;
  dueDate?: string;
  notes?: string;
  paymentTerms?: string;
}

// Helper for untyped RPC calls not in generated types
const rpcClient = supabase as unknown as { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };

/**
 * Hook for generating and saving order invoices to database
 * Includes auto-generation of invoice numbers from tenant sequence
 */
export function useOrderInvoiceSave() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const createInvoiceMutation = useMutation({
    mutationFn: async (input: CreateOrderInvoiceInput) => {
      if (!tenant?.id) {
        throw new Error('Tenant ID required');
      }

      const { order, customerId, dueDate, notes, paymentTerms } = input;

      // Generate invoice number from tenant sequence using RPC
      let invoiceNumber = `INV-${order.tracking_code}-${Date.now()}`;
      try {
        const genResult = await rpcClient.rpc('generate_invoice_number', { tenant_id: tenant.id });
        if (!genResult.error && typeof genResult.data === 'string' && genResult.data.trim()) {
          invoiceNumber = genResult.data;
        }
      } catch (rpcError) {
        logger.warn('Failed to generate invoice number via RPC, using fallback', rpcError, {
          component: 'useOrderInvoiceSave',
          orderId: order.id,
        });
      }

      // Calculate subtotal from order items
      const subtotal = order.subtotal ?? calculateSubtotal(order.order_items);
      const tax = order.tax ?? 0;
      const discount = order.discount ?? 0;
      const total = order.total_amount;

      // Convert order items to invoice line items
      const lineItems: InvoiceLineItem[] = (order.order_items ?? []).map((item) => ({
        description: item.product_name || item.products?.name || 'Item',
        quantity: item.quantity,
        unit_price: item.price,
        total: item.price * item.quantity,
      }));

      // Prepare combined notes
      const combinedNotes = [
        paymentTerms ? `Payment Terms: ${paymentTerms}` : null,
        notes,
        order.notes ? `Order Notes: ${order.notes}` : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      // Insert invoice record into customer_invoices table
      const insertClient = supabase as unknown as {
        from: (table: string) => {
          insert: (data: Record<string, unknown>) => {
            select: (columns: string) => {
              maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
            };
          };
        };
      };
      const result = await insertClient.from('customer_invoices').insert({
        tenant_id: tenant.id,
        customer_id: customerId,
        invoice_number: invoiceNumber,
        order_id: order.id,
        subtotal,
        tax,
        discount,
        total,
        status: 'unpaid',
        due_date: dueDate || null,
        notes: combinedNotes || null,
        line_items: lineItems,
      }).select('id, tenant_id, customer_id, invoice_number, order_id, subtotal, tax, discount, total, status, due_date, paid_at, payment_method, notes, created_at').maybeSingle();

      if (result.error) {
        throw result.error;
      }

      logger.info('Invoice created and linked to order', {
        component: 'useOrderInvoiceSave',
        invoiceNumber,
        orderId: order.id,
        customerId,
        tenantId: tenant.id,
      });

      return result.data as unknown as SavedInvoice;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.customerInvoices.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });

      // Cross-panel invalidation — finance hub, dashboard, collections
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'INVOICE_CREATED', tenant.id, {
          invoiceId: (data as SavedInvoice)?.id,
          customerId: (data as SavedInvoice)?.customer_id,
        });
      }

      const invoice = data as SavedInvoice;
      toast.success('Invoice created successfully', {
        description: `Invoice ${invoice.invoice_number} has been created and linked to the order.`,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to create invoice from order', error, {
        component: 'useOrderInvoiceSave',
      });
      toast.error('Failed to create invoice', {
        description: humanizeError(error),
      });
    },
  });

  return {
    createInvoice: createInvoiceMutation.mutateAsync,
    isCreating: createInvoiceMutation.isPending,
  };
}

/**
 * Props for GenerateAndSaveInvoiceButton
 */
export interface GenerateAndSaveInvoiceButtonProps {
  /** Order data to generate invoice from */
  order: OrderInvoiceData;
  /** Customer ID to link invoice to */
  customerId?: string;
  /** Due date for the invoice */
  dueDate?: string;
  /** Additional notes */
  notes?: string;
  /** Payment terms */
  paymentTerms?: string;
  /** Whether to also download PDF after saving */
  downloadPdf?: boolean;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Custom class name */
  className?: string;
  /** Button label */
  label?: string;
  /** Callback when invoice is created */
  onInvoiceCreated?: (invoice: SavedInvoice) => void;
}

/**
 * Button component that generates invoice, saves to database, and optionally downloads PDF
 * Uses tenant context for business info and auto-generates invoice number from sequence
 */
export function GenerateAndSaveInvoiceButton({
  order,
  customerId,
  dueDate,
  notes,
  paymentTerms = 'Payment due upon receipt',
  downloadPdf = true,
  variant = 'default',
  size = 'default',
  className,
  label = 'Generate Invoice',
  onInvoiceCreated,
}: GenerateAndSaveInvoiceButtonProps) {
  const { tenant } = useTenantAdminAuth();
  const { createInvoice, isCreating } = useOrderInvoiceSave();
  const { download, isGenerating } = useOrderInvoiceGenerator();
  const [isBusy, setIsBusy] = useState(false);

  // Resolve customer ID from order data if not provided
  const resolvedCustomerId = customerId || order.customer_id || order.customer?.id;

  const handleGenerateInvoice = async () => {
    if (!resolvedCustomerId) {
      toast.error('Customer ID required', {
        description: 'Cannot create invoice without a customer ID.',
      });
      return;
    }

    setIsBusy(true);
    try {
      // Step 1: Save invoice to database
      const savedInvoice = await createInvoice({
        order,
        customerId: resolvedCustomerId,
        dueDate,
        notes,
        paymentTerms,
      });

      // Step 2: Optionally download PDF with tenant business info
      if (downloadPdf && savedInvoice) {
        await download({
          order,
          companyName: tenant?.business_name || 'Business',
          invoicePrefix: '', // Invoice number already generated from sequence
          paymentInstructions: paymentTerms,
        });
      }

      // Step 3: Callback
      if (onInvoiceCreated && savedInvoice) {
        onInvoiceCreated(savedInvoice);
      }
    } catch (error) {
      logger.error('Failed to generate and save invoice', error, {
        component: 'GenerateAndSaveInvoiceButton',
        orderId: order.id,
      });
    } finally {
      setIsBusy(false);
    }
  };

  const isLoading = isBusy || isCreating || isGenerating;

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleGenerateInvoice}
      disabled={isLoading || !resolvedCustomerId}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {isCreating ? 'Saving...' : 'Generating...'}
        </>
      ) : (
        <>
          <FilePlus className="mr-2 h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  );
}

/**
 * Hook that combines PDF generation with database saving
 * Provides full invoice workflow: save to DB + generate PDF
 */
export function useFullOrderInvoice() {
  const { tenant } = useTenantAdminAuth();
  const { createInvoice, isCreating } = useOrderInvoiceSave();
  const { download, print, generatePDF, isGenerating } = useOrderInvoiceGenerator();

  const generateAndSave = useCallback(
    async (
      input: CreateOrderInvoiceInput,
      options?: { downloadPdf?: boolean; printPdf?: boolean }
    ): Promise<SavedInvoice | null> => {
      try {
        // Save to database
        const savedInvoice = await createInvoice(input);

        // Generate PDF with tenant info
        const pdfProps: OrderInvoiceGeneratorProps = {
          order: input.order,
          companyName: tenant?.business_name || 'Business',
          paymentInstructions: input.paymentTerms,
        };

        if (options?.downloadPdf) {
          await download(pdfProps);
        }

        if (options?.printPdf) {
          await print(pdfProps);
        }

        return savedInvoice;
      } catch (error) {
        logger.error('Failed in generateAndSave workflow', error, {
          component: 'useFullOrderInvoice',
        });
        return null;
      }
    },
    [createInvoice, download, print, tenant]
  );

  return {
    generateAndSave,
    createInvoice,
    download,
    print,
    generatePDF,
    isCreating,
    isGenerating,
    isLoading: isCreating || isGenerating,
  };
}
