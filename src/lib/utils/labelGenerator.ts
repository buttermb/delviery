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
    // Define dimensions for each size (width x height in points at 72 DPI)
    const dimensions = {
      small: [144, 72],    // 2" x 1"
      standard: [288, 144], // 4" x 2"
      large: [288, 216],    // 4" x 3"
      sheet: [288, 432],    // 4" x 6"
    };

    const [width, height] = dimensions[size];

    // Create PDF with label dimensions
    const pdf = new jsPDF({
      orientation: width > height ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [width, height],
    });
    const margin = 10;
    const fontSize = size === 'small' ? 8 : size === 'standard' ? 10 : 12;
    const contentWidth = width - 2 * margin;

    // Background (white)
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, width, height, 'F');

    // Add outer border
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(1);
    pdf.rect(2, 2, width - 4, height - 4);

    let currentY = margin + 10;

    // ============ HEADER SECTION ============
    // Product Name (bold, centered)
    pdf.setFontSize(size === 'small' ? 11 : size === 'standard' ? 14 : 16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(data.productName, width / 2, currentY, {
      align: 'center',
      maxWidth: contentWidth,
    });
    currentY += size === 'small' ? 10 : 14;

    // Strain Name (medium weight, centered)
    if (data.strainName) {
      pdf.setFontSize(fontSize + 1);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 50, 150); // Primary color
      pdf.text(data.strainName, width / 2, currentY, { 
        align: 'center',
        maxWidth: contentWidth 
      });
      currentY += 10;
    }

    // SKU (small, centered)
    pdf.setFontSize(fontSize - 1);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(120, 120, 120);
    pdf.text(`SKU: ${data.sku}`, width / 2, currentY, { align: 'center' });
    currentY += 12;

    // Header border
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, width - margin, currentY);
    currentY += 10;

    // ============ PRODUCT DETAILS GRID ============
    const leftCol = margin + 5;
    const rightCol = width / 2 + 5;
    const rowHeight = size === 'small' ? 8 : 10;
    let leftY = currentY;
    let rightY = currentY;

    pdf.setFontSize(fontSize - 1);

    // Helper function to add a detail row
    const addDetail = (label: string, value: string, column: 'left' | 'right', color?: number[]) => {
      const x = column === 'left' ? leftCol : rightCol;
      const y = column === 'left' ? leftY : rightY;
      
      // Label (muted)
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(120, 120, 120);
      pdf.text(label, x, y);
      
      // Value (bold or colored)
      pdf.setFont('helvetica', 'bold');
      if (color) {
        pdf.setTextColor(color[0], color[1], color[2]);
      } else {
        pdf.setTextColor(0, 0, 0);
      }
      pdf.text(value, x + pdf.getTextWidth(label) + 2, y);
      
      if (column === 'left') {
        leftY += rowHeight;
      } else {
        rightY += rowHeight;
      }
    };

    // Add details in grid format (matching preview order)
    if (data.category) {
      addDetail('Category:', data.category.toUpperCase(), 'left');
    }
    if (data.vendorName) {
      addDetail('Vendor:', data.vendorName, 'right');
    }
    if (data.strainType) {
      addDetail('Type:', data.strainType, 'left');
    }
    if (data.batchNumber) {
      addDetail('Batch:', data.batchNumber, 'right');
    }
    if (data.thcPercent !== null && data.thcPercent !== undefined) {
      addDetail('THC:', `${data.thcPercent}%`, 'left', [34, 197, 94]); // Green
    }
    if (data.cbdPercent !== null && data.cbdPercent !== undefined) {
      addDetail('CBD:', `${data.cbdPercent}%`, 'right', [59, 130, 246]); // Blue
    }
    if (data.price !== undefined) {
      addDetail('Wholesale:', `$${data.price.toFixed(2)}`, 'left');
    }

    // Update currentY to the max of left and right columns
    currentY = Math.max(leftY, rightY) + 8;

    // Divider line before barcode section
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, width - margin, currentY);
    currentY += 10;

    // ============ BARCODE SECTION ============
    // "Barcode" label
    pdf.setFontSize(fontSize - 2);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(120, 120, 120);
    pdf.text('Barcode', width / 2, currentY, { align: 'center' });
    currentY += 8;

    // Generate and center barcode with white background
    const barcodeValue = data.barcodeValue || data.sku;
    const barcodeGenerationHeight = 50;
    
    try {
      const barcodeDataUrl = generateBarcodeSVG(barcodeValue, {
        width: 3,
        height: barcodeGenerationHeight,
        displayValue: true,
        format: 'CODE128',
      });
      
      const naturalBarcodeWidth = size === 'small' ? 120 : size === 'standard' ? 200 : 240;
      const naturalBarcodeHeight = barcodeGenerationHeight;
      
      // Add white background for barcode
      const barcodeX = (width - naturalBarcodeWidth) / 2;
      pdf.setFillColor(255, 255, 255);
      pdf.rect(barcodeX - 4, currentY - 2, naturalBarcodeWidth + 8, naturalBarcodeHeight + 4, 'F');
      
      // Add barcode centered
      pdf.addImage(
        barcodeDataUrl,
        'PNG',
        barcodeX,
        currentY,
        naturalBarcodeWidth,
        naturalBarcodeHeight
      );
      currentY += naturalBarcodeHeight + 10;
    } catch (error) {
      logger.error('Failed to generate barcode for PDF', error, {
        component: 'labelGenerator',
        barcodeValue,
      });
      // Fallback: Show as text
      pdf.setFontSize(fontSize);
      pdf.setFont('courier', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(barcodeValue, width / 2, currentY + 15, { align: 'center' });
      currentY += 25;
    }

    // ============ QR CODE SECTION ============
    // Add centered QR code (not in corner) for non-small labels
    if (size !== 'small') {
      try {
        // "Quick Scan" label
        pdf.setFontSize(fontSize - 2);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(120, 120, 120);
        pdf.text('Quick Scan', width / 2, currentY, { align: 'center' });
        currentY += 8;

        const qrData = JSON.stringify({
          sku: data.sku,
          name: data.productName,
          category: data.category,
          strain: data.strainName,
          thc: data.thcPercent,
          cbd: data.cbdPercent,
          batch: data.batchNumber,
        });
        
        const qrSize = size === 'standard' ? 64 : 80;
        const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
          width: qrSize,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        
        // Center QR code with white background
        const qrX = (width - qrSize) / 2;
        pdf.setFillColor(255, 255, 255);
        pdf.rect(qrX - 2, currentY - 2, qrSize + 4, qrSize + 4, 'F');
        pdf.addImage(qrCodeDataUrl, 'PNG', qrX, currentY, qrSize, qrSize);
        currentY += qrSize + 6;

        // "Product Details" label
        pdf.setFontSize(fontSize - 2);
        pdf.setTextColor(120, 120, 120);
        pdf.text('Product Details', width / 2, currentY, { align: 'center' });
        currentY += 10;
      } catch (error) {
        logger.warn('Failed to generate QR code', error, {
          component: 'labelGenerator',
        });
      }
    }

    // ============ COMPLIANCE INFO ============
    // For large and sheet labels, add compliance warnings at bottom
    if (size === 'large' || size === 'sheet') {
      // Divider line
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.5);
      pdf.line(margin, currentY, width - margin, currentY);
      currentY += 8;

      pdf.setFontSize(fontSize - 2);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(150, 150, 150);
      
      const warnings = [
        '⚠️ For adult use only (21+)',
        '🚫 Keep out of reach of children',
        `📅 Packaged: ${new Date().toLocaleDateString()}`,
      ];
      
      warnings.forEach(warning => {
        pdf.text(warning, margin + 5, currentY);
        currentY += 8;
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

