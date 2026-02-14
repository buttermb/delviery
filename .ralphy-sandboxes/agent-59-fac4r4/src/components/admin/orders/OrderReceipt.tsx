/**
 * OrderReceipt Component
 * Generates printable receipt for an order with business info from tenant settings
 * Includes print dialog and PDF export functionality
 */

import { useRef, useState, useCallback, forwardRef } from 'react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import Printer from 'lucide-react/dist/esm/icons/printer';
import Download from 'lucide-react/dist/esm/icons/download';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import { toast } from 'sonner';
import type { OrderItem } from '@/types/order';

/**
 * Receipt item data structure
 */
export interface ReceiptItem {
  product_name: string;
  quantity: number;
  price: number;
  sku?: string;
}

/**
 * Order data for receipt generation
 */
export interface OrderReceiptData {
  id: string;
  order_number: string;
  tracking_code?: string;
  created_at: string;
  status: string;
  subtotal?: number;
  tax_amount?: number;
  discount_amount?: number;
  delivery_fee?: number;
  total_amount: number;
  payment_method?: string;
  payment_status?: string;
  notes?: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  items: ReceiptItem[];
}

/**
 * Business information for receipt header
 */
export interface ReceiptBusinessInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  license?: string;
}

interface OrderReceiptProps {
  order: OrderReceiptData;
  businessInfo?: ReceiptBusinessInfo;
  className?: string;
  showActions?: boolean;
}

/**
 * Printable receipt layout component
 */
const ReceiptContent = forwardRef<HTMLDivElement, {
  order: OrderReceiptData;
  businessInfo: ReceiptBusinessInfo;
  className?: string;
}>(function ReceiptContent({ order, businessInfo, className }, ref) {
  const orderNumber = order.order_number || order.tracking_code || order.id.slice(0, 8);
  const subtotal = order.subtotal ?? order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxAmount = order.tax_amount ?? 0;
  const discountAmount = order.discount_amount ?? 0;
  const deliveryFee = order.delivery_fee ?? 0;

  return (
    <div
      ref={ref}
      className={cn(
        'bg-white text-black p-6 font-sans print:p-4',
        'w-full max-w-md mx-auto',
        className
      )}
    >
      {/* Business Header */}
      <div className="text-center mb-4 print:mb-3">
        <h1 className="text-xl font-bold print:text-lg">{businessInfo.name}</h1>
        {businessInfo.address && (
          <p className="text-sm text-gray-600 print:text-xs">{businessInfo.address}</p>
        )}
        {businessInfo.phone && (
          <p className="text-sm text-gray-600 print:text-xs">Tel: {businessInfo.phone}</p>
        )}
        {businessInfo.email && (
          <p className="text-sm text-gray-600 print:text-xs">{businessInfo.email}</p>
        )}
        {businessInfo.license && (
          <p className="text-xs text-gray-500 print:text-[10px]">License: {businessInfo.license}</p>
        )}
      </div>

      <Separator className="my-3 print:my-2 border-dashed" />

      {/* Receipt Title & Order Info */}
      <div className="text-center mb-4 print:mb-3">
        <h2 className="text-lg font-bold print:text-base">RECEIPT</h2>
        <p className="text-sm font-mono print:text-xs">Order #{orderNumber}</p>
        <p className="text-sm text-gray-600 print:text-xs">
          {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
        </p>
      </div>

      <Separator className="my-3 print:my-2 border-dashed" />

      {/* Customer Information */}
      <div className="mb-4 print:mb-3">
        <h3 className="text-sm font-semibold mb-1 print:text-xs">Customer</h3>
        <p className="text-sm print:text-xs">{order.customer.name}</p>
        {order.customer.phone && (
          <p className="text-sm text-gray-600 print:text-xs">{order.customer.phone}</p>
        )}
        {order.customer.email && (
          <p className="text-sm text-gray-600 print:text-xs">{order.customer.email}</p>
        )}
        {order.customer.address && (
          <p className="text-sm text-gray-600 print:text-xs">{order.customer.address}</p>
        )}
      </div>

      <Separator className="my-3 print:my-2 border-dashed" />

      {/* Line Items */}
      <div className="mb-4 print:mb-3">
        <h3 className="text-sm font-semibold mb-2 print:text-xs print:mb-1">Items</h3>
        <div className="space-y-2 print:space-y-1">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm print:text-xs">
              <div className="flex-1 pr-2">
                <span>{item.quantity}x {item.product_name}</span>
                {item.sku && (
                  <span className="text-xs text-gray-500 ml-1">({item.sku})</span>
                )}
              </div>
              <span className="font-mono whitespace-nowrap">
                {formatCurrency(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Separator className="my-3 print:my-2" />

      {/* Totals */}
      <div className="space-y-1 print:space-y-0.5">
        <div className="flex justify-between text-sm print:text-xs">
          <span>Subtotal</span>
          <span className="font-mono">{formatCurrency(subtotal)}</span>
        </div>

        {discountAmount > 0 && (
          <div className="flex justify-between text-sm text-green-600 print:text-xs">
            <span>Discount</span>
            <span className="font-mono">-{formatCurrency(discountAmount)}</span>
          </div>
        )}

        {taxAmount > 0 && (
          <div className="flex justify-between text-sm print:text-xs">
            <span>Tax</span>
            <span className="font-mono">{formatCurrency(taxAmount)}</span>
          </div>
        )}

        {deliveryFee > 0 && (
          <div className="flex justify-between text-sm print:text-xs">
            <span>Delivery Fee</span>
            <span className="font-mono">{formatCurrency(deliveryFee)}</span>
          </div>
        )}

        <Separator className="my-2 print:my-1" />

        <div className="flex justify-between text-base font-bold print:text-sm">
          <span>TOTAL</span>
          <span className="font-mono">{formatCurrency(order.total_amount)}</span>
        </div>
      </div>

      <Separator className="my-3 print:my-2 border-dashed" />

      {/* Payment Info */}
      <div className="mb-4 print:mb-3">
        <div className="flex justify-between text-sm print:text-xs">
          <span className="text-gray-600">Payment Method:</span>
          <span className="font-medium capitalize">{order.payment_method || 'N/A'}</span>
        </div>
        {order.payment_status && (
          <div className="flex justify-between text-sm print:text-xs">
            <span className="text-gray-600">Payment Status:</span>
            <span className="font-medium capitalize">{order.payment_status}</span>
          </div>
        )}
      </div>

      {/* Order Notes */}
      {order.notes && (
        <>
          <Separator className="my-3 print:my-2 border-dashed" />
          <div className="mb-4 print:mb-3">
            <h3 className="text-sm font-semibold mb-1 print:text-xs">Notes</h3>
            <p className="text-sm text-gray-600 print:text-xs">{order.notes}</p>
          </div>
        </>
      )}

      <Separator className="my-3 print:my-2 border-dashed" />

      {/* Footer */}
      <div className="text-center text-sm text-gray-600 print:text-xs">
        <p className="font-medium">Thank you for your order!</p>
        <p className="text-xs mt-2 print:text-[10px]">
          Printed: {format(new Date(), 'MMM d, yyyy h:mm a')}
        </p>
      </div>
    </div>
  );
});

/**
 * Generate PDF from order receipt data
 */
async function generateReceiptPDF(
  order: OrderReceiptData,
  businessInfo: ReceiptBusinessInfo
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200], // Receipt paper width, initial height
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 5;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper for centered text
  const centerText = (text: string, yPos: number, fontSize: number = 10) => {
    doc.setFontSize(fontSize);
    doc.text(text, pageWidth / 2, yPos, { align: 'center' });
  };

  // Helper for left-right text
  const leftRightText = (left: string, right: string, yPos: number, fontSize: number = 9) => {
    doc.setFontSize(fontSize);
    doc.text(left, margin, yPos);
    doc.text(right, pageWidth - margin, yPos, { align: 'right' });
  };

  // Business Header
  doc.setFont('helvetica', 'bold');
  centerText(businessInfo.name, y, 12);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (businessInfo.address) {
    centerText(businessInfo.address, y, 8);
    y += 3;
  }
  if (businessInfo.phone) {
    centerText(`Tel: ${businessInfo.phone}`, y, 8);
    y += 3;
  }
  if (businessInfo.license) {
    centerText(`License: ${businessInfo.license}`, y, 7);
    y += 3;
  }

  y += 2;
  doc.setDrawColor(100);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // Receipt Title
  const orderNumber = order.order_number || order.tracking_code || order.id.slice(0, 8);
  doc.setFont('helvetica', 'bold');
  centerText('RECEIPT', y, 11);
  y += 4;
  doc.setFont('helvetica', 'normal');
  centerText(`Order #${orderNumber}`, y, 9);
  y += 4;
  centerText(format(new Date(order.created_at), 'MMM d, yyyy h:mm a'), y, 8);
  y += 4;

  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // Customer Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Customer', margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(order.customer.name, margin, y);
  y += 3;
  if (order.customer.phone) {
    doc.text(order.customer.phone, margin, y);
    y += 3;
  }
  if (order.customer.email) {
    doc.text(order.customer.email, margin, y);
    y += 3;
  }

  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // Line Items
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Items', margin, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (const item of order.items) {
    const itemText = `${item.quantity}x ${item.product_name}`;
    const priceText = formatCurrency(item.price * item.quantity);

    // Truncate long item names
    const maxWidth = contentWidth - 20;
    const truncatedText = doc.splitTextToSize(itemText, maxWidth)[0];

    leftRightText(truncatedText, priceText, y, 8);
    y += 4;
  }

  y += 2;
  doc.setLineDashPattern([], 0);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // Totals
  const subtotal = order.subtotal ?? order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  leftRightText('Subtotal', formatCurrency(subtotal), y, 8);
  y += 4;

  if (order.discount_amount && order.discount_amount > 0) {
    leftRightText('Discount', `-${formatCurrency(order.discount_amount)}`, y, 8);
    y += 4;
  }

  if (order.tax_amount && order.tax_amount > 0) {
    leftRightText('Tax', formatCurrency(order.tax_amount), y, 8);
    y += 4;
  }

  if (order.delivery_fee && order.delivery_fee > 0) {
    leftRightText('Delivery', formatCurrency(order.delivery_fee), y, 8);
    y += 4;
  }

  y += 1;
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  leftRightText('TOTAL', formatCurrency(order.total_amount), y, 10);
  y += 5;

  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // Payment Info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (order.payment_method) {
    leftRightText('Payment:', order.payment_method, y, 8);
    y += 4;
  }
  if (order.payment_status) {
    leftRightText('Status:', order.payment_status, y, 8);
    y += 4;
  }

  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Footer
  doc.setFont('helvetica', 'italic');
  centerText('Thank you for your order!', y, 9);
  y += 5;
  doc.setFontSize(7);
  centerText(`Printed: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, y);

  return doc;
}

/**
 * OrderReceipt Component
 * Displays a printable receipt with print and PDF export options
 */
export function OrderReceipt({
  order,
  businessInfo: providedBusinessInfo,
  className,
  showActions = true,
}: OrderReceiptProps) {
  const { tenant, loading: authLoading } = useTenantAdminAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Use provided business info or fall back to tenant info
  const businessInfo: ReceiptBusinessInfo = providedBusinessInfo || {
    name: tenant?.business_name || 'Business',
  };

  const handlePrint = useCallback(() => {
    if (!printRef.current) {
      toast.error('Receipt content not available');
      return;
    }

    setIsPrinting(true);
    logger.info('Opening print dialog for order receipt', {
      component: 'OrderReceipt',
      orderId: order.id,
    });

    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=400,height=600');

    if (!printWindow) {
      setIsPrinting(false);
      toast.error('Could not open print window. Please check popup settings.');
      logger.warn('Print window blocked', { component: 'OrderReceipt' });
      return;
    }

    const printStyles = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
          padding: 10mm;
          max-width: 80mm;
          margin: 0 auto;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-sm { font-size: 0.875rem; }
        .text-xs { font-size: 0.75rem; }
        .text-lg { font-size: 1.125rem; }
        .text-xl { font-size: 1.25rem; }
        .font-bold { font-weight: bold; }
        .font-semibold { font-weight: 600; }
        .font-medium { font-weight: 500; }
        .font-mono { font-family: 'Courier New', monospace; }
        .text-gray-500 { color: #6b7280; }
        .text-gray-600 { color: #4b5563; }
        .text-green-600 { color: #059669; }
        .capitalize { text-transform: capitalize; }
        .whitespace-nowrap { white-space: nowrap; }
        .mb-1 { margin-bottom: 0.25rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-3 { margin-bottom: 0.75rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mt-2 { margin-top: 0.5rem; }
        .ml-1 { margin-left: 0.25rem; }
        .my-2 { margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .my-3 { margin-top: 0.75rem; margin-bottom: 0.75rem; }
        .pr-2 { padding-right: 0.5rem; }
        .p-6 { padding: 1.5rem; }
        .space-y-1 > * + * { margin-top: 0.25rem; }
        .space-y-2 > * + * { margin-top: 0.5rem; }
        .flex { display: flex; }
        .flex-1 { flex: 1; }
        .justify-between { justify-content: space-between; }
        hr {
          border: none;
          border-top: 1px dashed #ccc;
          margin: 0.75rem 0;
        }
        hr:not(.border-dashed) {
          border-top-style: solid;
        }
        @media print {
          body { padding: 0; }
          @page { margin: 5mm; size: 80mm auto; }
        }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - Order #${order.order_number || order.id.slice(0, 8)}</title>
          ${printStyles}
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);

    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        setIsPrinting(false);
        toast.success('Print dialog opened');
        logger.info('Print dialog opened successfully', {
          component: 'OrderReceipt',
          orderId: order.id,
        });
      }, 250);
    };
  }, [order]);

  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
    logger.info('Exporting order receipt as PDF', {
      component: 'OrderReceipt',
      orderId: order.id,
    });

    try {
      const doc = await generateReceiptPDF(order, businessInfo);
      const filename = `Receipt-${order.order_number || order.id.slice(0, 8)}.pdf`;
      doc.save(filename);
      toast.success('Receipt exported as PDF');
      logger.info('PDF export successful', {
        component: 'OrderReceipt',
        orderId: order.id,
        filename,
      });
    } catch (error) {
      logger.error('Failed to export receipt PDF', error, {
        component: 'OrderReceipt',
        orderId: order.id,
      });
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  }, [order, businessInfo]);

  if (authLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      {showActions && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Receipt</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Print</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">PDF</span>
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent className={cn(!showActions && 'pt-6')}>
        <div className="border rounded-lg bg-white print:border-0">
          <ReceiptContent
            ref={printRef}
            order={order}
            businessInfo={businessInfo}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Hook for using order receipt functionality
 */
export function useOrderReceipt() {
  const { tenant } = useTenantAdminAuth();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const getBusinessInfo = useCallback((): ReceiptBusinessInfo => {
    return {
      name: tenant?.business_name || 'Business',
    };
  }, [tenant]);

  const printReceipt = useCallback(async (order: OrderReceiptData, businessInfo?: ReceiptBusinessInfo) => {
    setIsPrinting(true);
    const info = businessInfo || getBusinessInfo();

    try {
      const doc = await generateReceiptPDF(order, info);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl);

      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      logger.info('Receipt printed', {
        component: 'useOrderReceipt',
        orderId: order.id,
      });
    } catch (error) {
      logger.error('Failed to print receipt', error, {
        component: 'useOrderReceipt',
        orderId: order.id,
      });
      throw error;
    } finally {
      setIsPrinting(false);
    }
  }, [getBusinessInfo]);

  const exportReceiptPDF = useCallback(async (order: OrderReceiptData, businessInfo?: ReceiptBusinessInfo) => {
    setIsExporting(true);
    const info = businessInfo || getBusinessInfo();

    try {
      const doc = await generateReceiptPDF(order, info);
      const filename = `Receipt-${order.order_number || order.id.slice(0, 8)}.pdf`;
      doc.save(filename);

      logger.info('Receipt exported as PDF', {
        component: 'useOrderReceipt',
        orderId: order.id,
        filename,
      });
    } catch (error) {
      logger.error('Failed to export receipt PDF', error, {
        component: 'useOrderReceipt',
        orderId: order.id,
      });
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, [getBusinessInfo]);

  return {
    printReceipt,
    exportReceiptPDF,
    isPrinting,
    isExporting,
    getBusinessInfo,
  };
}

export default OrderReceipt;
