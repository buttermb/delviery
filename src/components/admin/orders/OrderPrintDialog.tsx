/**
 * OrderPrintDialog - Dialog for printing order receipts and packing slips
 * Provides layout selection, preview, and print functionality
 */

import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import Printer from "lucide-react/dist/esm/icons/printer";
import Receipt from "lucide-react/dist/esm/icons/receipt";
import Package from "lucide-react/dist/esm/icons/package";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  OrderPrintView,
  type OrderPrintData,
  type PrintLayout,
} from './OrderPrintView';

interface OrderPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderPrintData | null;
  defaultLayout?: PrintLayout;
}

const layoutOptions: {
  value: PrintLayout;
  label: string;
  description: string;
  icon: typeof Receipt;
}[] = [
  {
    value: 'thermal-58mm',
    label: '58mm Receipt',
    description: 'Compact thermal receipt (58mm width)',
    icon: Receipt,
  },
  {
    value: 'thermal-80mm',
    label: '80mm Receipt',
    description: 'Standard thermal receipt (80mm width)',
    icon: Receipt,
  },
  {
    value: 'packing-slip',
    label: 'Packing Slip',
    description: 'Full page packing slip for fulfillment',
    icon: Package,
  },
];

export function OrderPrintDialog({
  open,
  onOpenChange,
  order,
  defaultLayout = 'thermal-80mm',
}: OrderPrintDialogProps) {
  const [selectedLayout, setSelectedLayout] = useState<PrintLayout>(defaultLayout);
  const [showPrices, setShowPrices] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrintClick = useCallback(() => {
    if (!order) {
      toast.error('No order data available');
      return;
    }

    if (!printRef.current) {
      toast.error('Print content not available');
      return;
    }

    setIsPrinting(true);
    logger.info('Starting print job', {
      component: 'OrderPrintDialog',
      orderNumber: order.order_number,
      layout: selectedLayout,
    });

    // Open print window with the content
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=800,height=600');
    if (!printWindow) {
      setIsPrinting(false);
      toast.error('Could not open print window. Please check popup settings.');
      return;
    }

    // Get the print content HTML
    const printContent = printRef.current.innerHTML;

    // Build the print document with inline styles
    const printStyles = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; }

        /* Fonts */
        .font-mono { font-family: 'Courier New', Courier, monospace; }
        .font-sans { font-family: Arial, sans-serif; }
        .font-bold { font-weight: bold; }
        .font-semibold { font-weight: 600; }
        .font-medium { font-weight: 500; }

        /* Text alignment */
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }

        /* Text sizes */
        .text-\\[9px\\] { font-size: 9px; }
        .text-\\[10px\\] { font-size: 10px; }
        .text-xs { font-size: 0.75rem; }
        .text-sm { font-size: 0.875rem; }
        .text-base { font-size: 1rem; }
        .text-lg { font-size: 1.125rem; }
        .text-2xl { font-size: 1.5rem; }
        .text-3xl { font-size: 1.875rem; }

        /* Colors */
        .text-black { color: #000; }
        .text-gray-500 { color: #6b7280; }
        .text-gray-600 { color: #4b5563; }
        .text-red-600 { color: #dc2626; }
        .bg-white { background-color: #fff; }
        .bg-gray-50 { background-color: #f9fafb; }
        .bg-gray-100 { background-color: #f3f4f6; }
        .bg-gray-200 { background-color: #e5e7eb; }

        /* Text formatting */
        .italic { font-style: italic; }
        .uppercase { text-transform: uppercase; }
        .capitalize { text-transform: capitalize; }
        .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .whitespace-pre-wrap { white-space: pre-wrap; }
        .leading-tight { line-height: 1.25; }
        .tracking-tight { letter-spacing: -0.025em; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        /* Borders */
        .border { border: 1px solid #d1d5db; }
        .border-b { border-bottom: 1px solid #d1d5db; }
        .border-t { border-top: 1px solid #d1d5db; }
        .border-2 { border-width: 2px; }
        .border-black { border-color: #000; }
        .border-gray-300 { border-color: #d1d5db; }
        .border-gray-400 { border-color: #9ca3af; }
        .border-b-2 { border-bottom: 2px solid; }
        .border-t-2 { border-top: 2px solid; }
        .rounded { border-radius: 0.25rem; }
        .rounded-lg { border-radius: 0.5rem; }
        .border-collapse { border-collapse: collapse; }

        /* Spacing */
        .p-3 { padding: 0.75rem; }
        .p-4 { padding: 1rem; }
        .p-8 { padding: 2rem; }
        .pl-3 { padding-left: 0.75rem; }
        .pl-5 { padding-left: 1.25rem; }
        .pl-6 { padding-left: 1.5rem; }
        .pr-6 { padding-right: 1.5rem; }
        .pb-4 { padding-bottom: 1rem; }
        .pt-4 { padding-top: 1rem; }
        .mb-1 { margin-bottom: 0.25rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        .mt-1 { margin-top: 0.25rem; }
        .mt-2 { margin-top: 0.5rem; }
        .my-1 { margin-top: 0.25rem; margin-bottom: 0.25rem; }
        .mr-8 { margin-right: 2rem; }
        .space-y-1 > * + * { margin-top: 0.25rem; }
        .space-y-2 > * + * { margin-top: 0.5rem; }
        .space-y-3 > * + * { margin-top: 0.75rem; }
        .space-y-4 > * + * { margin-top: 1rem; }
        .gap-4 { gap: 1rem; }
        .gap-8 { gap: 2rem; }

        /* Flexbox */
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .flex-1 { flex: 1 1 0%; }
        .justify-between { justify-content: space-between; }
        .justify-center { justify-content: center; }
        .justify-end { justify-content: flex-end; }
        .items-start { align-items: flex-start; }
        .items-center { align-items: center; }
        .items-end { align-items: flex-end; }
        .shrink-0 { flex-shrink: 0; }

        /* Grid */
        .grid { display: grid; }
        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }

        /* Sizing */
        .w-full { width: 100%; }
        .w-6 { width: 1.5rem; }
        .w-20 { width: 5rem; }
        .w-24 { width: 6rem; }
        .w-48 { width: 12rem; }
        .w-64 { width: 16rem; }
        .h-6 { height: 1.5rem; }
        .h-8 { height: 2rem; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .min-h-\\[11in\\] { min-height: 11in; }

        /* Table styles */
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 0.75rem; }
        thead { background-color: #f3f4f6; }

        /* Print-specific styles */
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .no-print { display: none !important; }
          @page { margin: 0.5cm; }
        }

        /* Thermal receipt specific widths */
        [style*="width: 58mm"] { width: 58mm !important; }
        [style*="width: 80mm"] { width: 80mm !important; }
        [style*="width: 8.5in"] { width: 8.5in !important; }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order #${order.order_number}</title>
          ${printStyles}
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);

    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        setIsPrinting(false);
        toast.success('Print dialog opened');
        logger.info('Print job completed', {
          component: 'OrderPrintDialog',
          orderNumber: order.order_number,
        });
      }, 250);
    };
  }, [order, selectedLayout]);

  if (!order) {
    return null;
  }

  const getPreviewScale = () => {
    switch (selectedLayout) {
      case 'thermal-58mm':
        return 'scale-[2]';
      case 'thermal-80mm':
        return 'scale-[1.8]';
      case 'packing-slip':
        return 'scale-[0.5]';
      default:
        return 'scale-100';
    }
  };

  const getPreviewHeight = () => {
    switch (selectedLayout) {
      case 'thermal-58mm':
      case 'thermal-80mm':
        return 'h-[500px]';
      case 'packing-slip':
        return 'h-[600px]';
      default:
        return 'h-[400px]';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Order #{order.order_number}
          </DialogTitle>
          <DialogDescription>
            Select a print layout and preview before printing
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-[300px_1fr] gap-6 min-h-0">
          {/* Settings Panel */}
          <div className="space-y-6">
            {/* Layout Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Print Layout</Label>
              <Tabs
                value={selectedLayout}
                onValueChange={(value) => setSelectedLayout(value as PrintLayout)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-1 h-auto gap-1">
                  {layoutOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <TabsTrigger
                        key={option.value}
                        value={option.value}
                        className="flex items-start gap-3 p-3 justify-start text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      >
                        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs opacity-70">
                            {option.description}
                          </div>
                        </div>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Options</Label>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-prices" className="text-sm">
                    Show Prices
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Include item prices and totals
                  </p>
                </div>
                <Switch
                  id="show-prices"
                  checked={showPrices}
                  onCheckedChange={setShowPrices}
                />
              </div>
            </div>

            {/* Order Summary */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/50">
              <Label className="text-sm font-medium">Order Summary</Label>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">{order.customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items:</span>
                  <span className="font-medium">{order.items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium">
                    ${order.total_amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium capitalize">{order.status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="border rounded-lg bg-muted/30 overflow-hidden">
            <div className="bg-muted px-4 py-2 border-b flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">Preview</span>
            </div>
            <ScrollArea className={getPreviewHeight()}>
              <div className="p-4 flex justify-center">
                <div
                  className={`origin-top transition-transform ${getPreviewScale()}`}
                >
                  <div className="shadow-lg">
                    <OrderPrintView
                      ref={printRef}
                      order={order}
                      layout={selectedLayout}
                      showPrices={showPrices}
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePrintClick} disabled={isPrinting}>
            {isPrinting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Printing...
              </>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
