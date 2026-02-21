import { logger } from '@/lib/logger';
/**
 * Product Label PDF Generator
 * Creates printable labels with product info and barcode
 */

import jsPDF from 'jspdf';
import { formatCurrency } from '@/lib/formatters';
import { generateBarcodeSVG } from '@/utils/barcodeService';
import QRCode from 'qrcode';

export type LabelSize = 'small' | 'standard' | 'large' | 'sheet';

export interface ProductLabelData {
  productName: string;
  category?: string;
  strainName?: string;
  strainType?: 'Sativa' | 'Indica' | 'Hybrid';
  vendorName?: string;
  batchNumber?: string;
  thcPercent?: number;
  cbdPercent?: number;
  price?: number; // Keep for backwards compatibility (wholesale)
  retailPrice?: number; // NEW
  availableQuantity?: number; // NEW
  sku: string;
  barcodeImageUrl?: string;
  barcodeValue?: string;
}

/**
 * Generate PDF label for product
 * Supports multiple label sizes
 */
export async function generateProductLabelPDF(
  data: ProductLabelData,
  size: LabelSize = 'standard'
): Promise<Blob> {
  try {
    // Define dimensions matching preview (96 DPI for screen-like rendering)
    const dimensions = {
      small: [192, 96],     // 2" x 1" at 96 DPI
      standard: [384, 192], // 4" x 2" at 96 DPI
      large: [384, 288],    // 4" x 3" at 96 DPI
      sheet: [384, 576],    // 4" x 6" at 96 DPI
    };

    const [width, height] = dimensions[size];

    // Create PDF
    const pdf = new jsPDF({
      orientation: width > height ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [width, height],
    });

    // Font size mapping to match Tailwind classes (fixed sizes, no scaling)
    const fontSizes = {
      'text-base': 16,  // Fixed: 1rem = 16px
      'text-sm': 14,     // Fixed: 0.875rem = 14px
      'text-xs': 12,     // Fixed: 0.75rem = 12px
    };

    // Spacing mapping to match Tailwind spacing classes
    const spacing = {
      1: 4,   // mt-1, mb-1, gap-1
      2: 8,   // gap-2
      3: 12,  // pb-3, pt-3, space-y-3
      4: 16,  // p-4, pt-4
    };

    const margin = 16; // Match preview padding
    const contentWidth = width - 2 * margin;

    // White background
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, width, height, 'F');

    // Outer border (2px dashed in preview, solid in PDF)
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(2);
    pdf.rect(4, 4, width - 8, height - 8);

    let currentY = margin + 12;

    // ============ HEADER SECTION (border-b pb-3) ============
    // Product Name - text-base font-bold
    pdf.setFontSize(fontSizes['text-base']);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    const nameLines = pdf.splitTextToSize(data.productName, contentWidth);
    nameLines.forEach((line: string) => {
      pdf.text(line, width / 2, currentY, { align: 'center' });
      currentY += fontSizes['text-base'] + spacing[1]; // mt-1 = 4px
    });
    currentY += spacing[1]; // Additional spacing after product name

    // Strain Name - text-sm font-medium text-primary (purple)
    if (data.strainName) {
      pdf.setFontSize(fontSizes['text-sm']);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(147, 51, 234); // text-primary purple-600: rgb(147, 51, 234)
      pdf.text(data.strainName, width / 2, currentY, { align: 'center' });
      currentY += fontSizes['text-sm'] + spacing[1]; // mt-1 = 4px
    }

    // SKU - text-xs text-muted-foreground
    pdf.setFontSize(fontSizes['text-xs']);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(113, 113, 122); // text-muted-foreground zinc-500: rgb(113, 113, 122)
    pdf.text(`SKU: ${data.sku}`, width / 2, currentY, { align: 'center' });
    currentY += fontSizes['text-xs'] + spacing[3]; // pb-3 = 12px

    // Header bottom border
    pdf.setDrawColor(228, 228, 231); // border-border zinc-200: rgb(228, 228, 231)
    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, width - margin, currentY);
    currentY += spacing[3]; // Space after border = 12px

    // ============ PRODUCT DETAILS GRID (grid-cols-2 gap-2) ============
    const gridGap = spacing[2]; // gap-2 = 8px
    const leftX = margin + 4; // Match p-4 from HTML preview
    const rightX = width / 2 + gridGap / 2; // Center the gap
    const detailFontSize = fontSizes['text-xs'];
    const lineHeight = detailFontSize + spacing[2]; // gap-2 = 8px
    let leftY = currentY;
    let rightY = currentY;

    pdf.setFontSize(detailFontSize);

    // Helper to add a detail row
    const addDetail = (label: string, value: string, column: 'left' | 'right', valueColor?: [number, number, number]) => {
      const x = column === 'left' ? leftX : rightX;
      const y = column === 'left' ? leftY : rightY;
      
      // Label in muted color
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(113, 113, 122); // text-muted-foreground zinc-500: rgb(113, 113, 122)
      pdf.text(label, x, y);
      
      // Value in foreground or custom color
      const labelWidth = pdf.getTextWidth(label);
      pdf.setFont('helvetica', 'bold');
      if (valueColor) {
        pdf.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
      } else {
        pdf.setTextColor(0, 0, 0);
      }
      pdf.text(value, x + labelWidth + 3, y);
      
      if (column === 'left') leftY += lineHeight;
      else rightY += lineHeight;
    };

    // Add details in exact preview order
    if (data.category) {
      addDetail('Category:', data.category.toUpperCase(), 'left');
    }
    if (data.vendorName) {
      addDetail('Vendor:', data.vendorName, 'right');
    }
    if (data.strainType) {
      addDetail('Type:', data.strainType.charAt(0).toUpperCase() + data.strainType.slice(1).toLowerCase(), 'left');
    }
    if (data.batchNumber) {
      addDetail('Batch:', data.batchNumber, 'right');
    }
    if (data.thcPercent !== null && data.thcPercent !== undefined) {
      addDetail('THC:', `${data.thcPercent}%`, 'left', [22, 163, 74]); // text-green-600: rgb(22, 163, 74)
    }
    if (data.cbdPercent !== null && data.cbdPercent !== undefined) {
      addDetail('CBD:', `${data.cbdPercent}%`, 'right', [37, 99, 235]); // text-blue-600: rgb(37, 99, 235)
    }
    if (data.price !== undefined) {
      addDetail('Wholesale:', formatCurrency(data.price), 'left');
    }
    // Match HTML preview: only show if truthy (not 0, null, or undefined)
    if (data.retailPrice) {
      addDetail('Retail:', formatCurrency(data.retailPrice), 'right');
    }
    if (data.availableQuantity !== null && data.availableQuantity !== undefined) {
      // Full width (col-span-2), so add on left and sync both columns
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(113, 113, 122); // text-muted-foreground zinc-500: rgb(113, 113, 122)
      pdf.text('In Stock:', leftX, Math.max(leftY, rightY));
      const labelWidth = pdf.getTextWidth('In Stock:');
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${data.availableQuantity} units`, leftX + labelWidth + 3, Math.max(leftY, rightY));
      const newY = Math.max(leftY, rightY) + lineHeight;
      leftY = newY;
      rightY = newY;
    }

    currentY = Math.max(leftY, rightY) + spacing[3]; // Space after details = 12px

    // Check if content exceeds available space
    const remainingSpace = height - currentY - margin;
    const minSpaceForBarcode = 100; // Minimum space needed for barcode section

    if (remainingSpace < minSpaceForBarcode) {
      logger.warn('Label content overflow detected', {
        currentY,
        remainingSpace,
        labelSize: size,
        height,
      });
      
      // For small/standard labels, skip QR code if space is tight
      if (size === 'small' || (size === 'standard' && remainingSpace < 150)) {
        // Will skip QR code later in code
      }
    }

    // ============ BARCODE & QR CODE SECTION (pt-4 border-t) ============
    // Top border
    pdf.setDrawColor(228, 228, 231); // border-border zinc-200: rgb(228, 228, 231)
    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, width - margin, currentY);
    currentY += spacing[4]; // pt-4 = 16px

    // "Barcode" label
    pdf.setFontSize(fontSizes['text-xs']);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(113, 113, 122); // text-muted-foreground zinc-500: rgb(113, 113, 122)
    pdf.text('Barcode', width / 2, currentY, { align: 'center' });
    currentY += fontSizes['text-xs'] + spacing[2]; // mb-2 = 8px

    // Generate barcode with multiple fallbacks
    const barcodeValue = data.barcodeValue || data.sku || `PROD-${Date.now().toString().slice(-8)}`;
    
    // Validate barcode value
    if (!barcodeValue || barcodeValue.trim().length === 0) {
      logger.error('Invalid barcode value - all fallbacks failed', { 
        barcodeValue, 
        sku: data.sku,
        productName: data.productName 
      });
      throw new Error('Barcode value is required but was empty after all fallbacks');
    }
    
    logger.debug('Using barcode value', { 
      barcodeValue, 
      source: data.barcodeValue ? 'barcodeValue' : (data.sku ? 'sku' : 'timestamp-fallback')
    });
    
    try {
      logger.info('Generating barcode for PDF', { 
        barcodeValue, 
        length: barcodeValue.length,
        productName: data.productName,
        sku: data.sku 
      });
      
      const barcodeDataUrl = generateBarcodeSVG(barcodeValue, {
        width: 3,
        height: 50,
        displayValue: true,
        format: 'CODE128',
      });
      
      logger.info('Barcode data URL generated', {
        urlLength: barcodeDataUrl.length,
        startsWithDataImage: barcodeDataUrl.startsWith('data:image'),
      });
      
      if (!barcodeDataUrl || !barcodeDataUrl.startsWith('data:image')) {
        throw new Error('Invalid barcode data URL - does not start with data:image');
      }
      
      // Barcode: 300px HTML → 225pt PDF (300 * 72/96 = 225)
      // But ensure it fits within content width (with 40pt margin for padding)
      const idealBarcodeWidth = 225; // Ideal size: 300px HTML → 225pt PDF
      const barcodeMaxWidth = Math.min(idealBarcodeWidth, contentWidth - 40);
      const barcodeHeight = 45; // 60px HTML → 45pt PDF (60 * 72/96)
      const barcodeX = (width - barcodeMaxWidth) / 2;
      
      // White background
      pdf.setFillColor(255, 255, 255);
      pdf.rect(barcodeX - 8, currentY - 8, barcodeMaxWidth + 16, barcodeHeight + 16, 'F');
      
      pdf.addImage(barcodeDataUrl, 'PNG', barcodeX, currentY, barcodeMaxWidth, barcodeHeight);
      currentY += barcodeHeight + spacing[4]; // Space after barcode = 16px (p-4)
      
      logger.info('Barcode added to PDF successfully', {
        barcodeX,
        currentY,
        barcodeMaxWidth,
        barcodeHeight,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to generate barcode for PDF', error, {
        component: 'labelGenerator',
        barcodeValue,
        errorMessage,
      });
      
      // Show error to user
      throw new Error(`Barcode generation failed: ${errorMessage}`);
    }

    // QR Code (only for non-small labels)
    if (size !== 'small') {
      currentY += spacing[2]; // Space before QR = 8px
      
      // "Quick Scan" label
      pdf.setFontSize(fontSizes['text-xs']);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(113, 113, 122); // text-muted-foreground zinc-500: rgb(113, 113, 122)
      pdf.text('Quick Scan', width / 2, currentY, { align: 'center' });
      currentY += fontSizes['text-xs'] + spacing[2]; // mb-2 = 8px

      try {
        logger.info('Generating QR code for PDF', { sku: data.sku });
        
        const qrData = JSON.stringify({
          sku: data.sku,
          name: data.productName,
          category: data.category,
          strain: data.strainName,
          thc: data.thcPercent,
          cbd: data.cbdPercent,
          batch: data.batchNumber,
        });
        
        const qrSize = 48; // 64px HTML → 48pt PDF (64 * 72/96)
        const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
          width: qrSize,
          margin: 0,
          color: { dark: '#000000', light: '#FFFFFF' },
        });
        
        if (!qrCodeDataUrl || !qrCodeDataUrl.startsWith('data:image')) {
          throw new Error('Invalid QR code data URL');
        }
        
        const qrX = (width - qrSize) / 2;
        
        // White background with padding
        pdf.setFillColor(255, 255, 255);
        pdf.rect(qrX - 8, currentY - 8, qrSize + 16, qrSize + 16, 'F');
        
        pdf.addImage(qrCodeDataUrl, 'PNG', qrX, currentY, qrSize, qrSize);
        currentY += qrSize + spacing[2]; // Space after QR = 8px

        // "Product Details" label
        pdf.setFontSize(fontSizes['text-xs']);
        pdf.setTextColor(113, 113, 122); // text-muted-foreground zinc-500: rgb(113, 113, 122)
        pdf.text('Product Details', width / 2, currentY, { align: 'center' });
        currentY += fontSizes['text-xs'] + spacing[3]; // mt-3 = 12px
        
        logger.info('QR code added to PDF successfully');
      } catch (error) {
        logger.warn('Failed to generate QR code for PDF', error, {
          component: 'labelGenerator',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ============ COMPLIANCE INFO (large/sheet only, pt-3 border-t) ============
    if (size === 'large' || size === 'sheet') {
      currentY += spacing[2]; // Space before compliance = 8px
      
      // Top border
      pdf.setDrawColor(228, 228, 231); // border-border zinc-200: rgb(228, 228, 231)
      pdf.setLineWidth(0.5);
      pdf.line(margin, currentY, width - margin, currentY);
      currentY += spacing[3]; // Space after border = 12px

      pdf.setFontSize(fontSizes['text-xs']);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(113, 113, 122); // text-muted-foreground zinc-500: rgb(113, 113, 122)
      
      const warnings = [
        '⚠️ For adult use only (21+)',
        '🚫 Keep out of reach of children',
        `📅 Packaged: ${new Date().toLocaleDateString()}`,
      ];
      
      warnings.forEach(warning => {
        pdf.text(warning, leftX, currentY);
        currentY += fontSizes['text-xs'] + spacing[1]; // space-y-1 = 4px
      });
    }

    // Generate blob
    const pdfBlob = pdf.output('blob');
    return pdfBlob;
  } catch (error) {
    logger.error('Label PDF generation failed', error, {
      component: 'labelGenerator',
    });
    throw error;
  }
}

/**
 * Download label PDF
 */
export async function downloadProductLabel(
  data: ProductLabelData,
  size: LabelSize = 'standard'
): Promise<void> {
  try {
    const pdfBlob = await generateProductLabelPDF(data, size);
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `label-${data.sku}-${size}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    logger.error('Label download failed', error, {
      component: 'labelGenerator',
    });
    throw error;
  }
}

