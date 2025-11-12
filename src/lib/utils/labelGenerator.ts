/**
 * Product Label PDF Generator
 * Creates printable labels with product info and barcode
 */

import jsPDF from 'jspdf';
import { logger } from '@/lib/logger';
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
  price?: number;
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

    // Font size mapping to match Tailwind classes
    const fontSizes = {
      'text-base': size === 'small' ? 14 : 16,  // Product name
      'text-sm': size === 'small' ? 12 : 14,    // Strain name
      'text-xs': size === 'small' ? 10 : 12,    // SKU, labels, values
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
      currentY += fontSizes['text-base'] + 2;
    });
    currentY += 4;

    // Strain Name - text-sm font-medium text-primary (purple)
    if (data.strainName) {
      pdf.setFontSize(fontSizes['text-sm']);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(147, 51, 234); // text-primary purple
      pdf.text(data.strainName, width / 2, currentY, { align: 'center' });
      currentY += fontSizes['text-sm'] + 4;
    }

    // SKU - text-xs text-muted-foreground
    pdf.setFontSize(fontSizes['text-xs']);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(113, 113, 122); // text-muted-foreground
    pdf.text(`SKU: ${data.sku}`, width / 2, currentY, { align: 'center' });
    currentY += fontSizes['text-xs'] + 12;

    // Header bottom border
    pdf.setDrawColor(228, 228, 231); // border-border
    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, width - margin, currentY);
    currentY += 12;

    // ============ PRODUCT DETAILS GRID (grid-cols-2 gap-2) ============
    const leftX = margin + 4;
    const rightX = width / 2 + 8;
    const detailFontSize = fontSizes['text-xs'];
    const lineHeight = detailFontSize + 6;
    let leftY = currentY;
    let rightY = currentY;

    pdf.setFontSize(detailFontSize);

    // Helper to add a detail row
    const addDetail = (label: string, value: string, column: 'left' | 'right', valueColor?: [number, number, number]) => {
      const x = column === 'left' ? leftX : rightX;
      const y = column === 'left' ? leftY : rightY;
      
      // Label in muted color
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(113, 113, 122);
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
      addDetail('THC:', `${data.thcPercent}%`, 'left', [22, 163, 74]); // green-600
    }
    if (data.cbdPercent !== null && data.cbdPercent !== undefined) {
      addDetail('CBD:', `${data.cbdPercent}%`, 'right', [37, 99, 235]); // blue-600
    }
    if (data.price !== undefined) {
      addDetail('Wholesale:', `$${data.price.toFixed(2)}`, 'left');
    }

    currentY = Math.max(leftY, rightY) + 12;

    // ============ BARCODE & QR CODE SECTION (pt-4 border-t) ============
    // Top border
    pdf.setDrawColor(228, 228, 231);
    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, width - margin, currentY);
    currentY += 16;

    // "Barcode" label
    pdf.setFontSize(fontSizes['text-xs']);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(113, 113, 122);
    pdf.text('Barcode', width / 2, currentY, { align: 'center' });
    currentY += fontSizes['text-xs'] + 8;

    // Generate barcode
    const barcodeValue = data.barcodeValue || data.sku;
    try {
      logger.info('Generating barcode for PDF', { barcodeValue });
      
      const barcodeDataUrl = generateBarcodeSVG(barcodeValue, {
        width: 3,
        height: 50,
        displayValue: true,
        format: 'CODE128',
      });
      
      if (!barcodeDataUrl || !barcodeDataUrl.startsWith('data:image')) {
        throw new Error('Invalid barcode data URL');
      }
      
      // Match preview max-w-[300px] scaled to PDF
      const barcodeMaxWidth = Math.min(300 * (width / 384), contentWidth - 40);
      const barcodeHeight = 60; // Match preview maxHeight: '60px'
      const barcodeX = (width - barcodeMaxWidth) / 2;
      
      // White background
      pdf.setFillColor(255, 255, 255);
      pdf.rect(barcodeX - 8, currentY - 8, barcodeMaxWidth + 16, barcodeHeight + 16, 'F');
      
      pdf.addImage(barcodeDataUrl, 'PNG', barcodeX, currentY, barcodeMaxWidth, barcodeHeight);
      currentY += barcodeHeight + 16;
      
      logger.info('Barcode added to PDF successfully');
    } catch (error) {
      logger.error('Failed to generate barcode for PDF', error, {
        component: 'labelGenerator',
        barcodeValue,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      // Show barcode value as fallback text
      pdf.setFontSize(fontSizes['text-xs']);
      pdf.setFont('courier', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(barcodeValue, width / 2, currentY + 20, { align: 'center' });
      currentY += 40;
    }

    // QR Code (only for non-small labels)
    if (size !== 'small') {
      currentY += 8;
      
      // "Quick Scan" label
      pdf.setFontSize(fontSizes['text-xs']);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(113, 113, 122);
      pdf.text('Quick Scan', width / 2, currentY, { align: 'center' });
      currentY += fontSizes['text-xs'] + 8;

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
        
        const qrSize = 64; // Match preview size={64}
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
        currentY += qrSize + 8;

        // "Product Details" label
        pdf.setFontSize(fontSizes['text-xs']);
        pdf.setTextColor(113, 113, 122);
        pdf.text('Product Details', width / 2, currentY, { align: 'center' });
        currentY += fontSizes['text-xs'] + 12;
        
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
      currentY += 8;
      
      // Top border
      pdf.setDrawColor(228, 228, 231);
      pdf.setLineWidth(0.5);
      pdf.line(margin, currentY, width - margin, currentY);
      currentY += 12;

      pdf.setFontSize(fontSizes['text-xs']);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(113, 113, 122);
      
      const warnings = [
        '⚠️ For adult use only (21+)',
        '🚫 Keep out of reach of children',
        `📅 Packaged: ${new Date().toLocaleDateString()}`,
      ];
      
      warnings.forEach(warning => {
        pdf.text(warning, leftX, currentY);
        currentY += fontSizes['text-xs'] + 4;
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

