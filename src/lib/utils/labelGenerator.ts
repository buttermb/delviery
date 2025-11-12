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

    // Background (white)
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, width, height, 'F');

    // Add border for professional look
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(1);
    pdf.rect(2, 2, width - 4, height - 4);

    let currentY = margin + 15;

    // Product Name (large, bold, top)
    pdf.setFontSize(size === 'small' ? 12 : size === 'standard' ? 16 : 18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(data.productName, width / 2, currentY, {
      align: 'center',
      maxWidth: width - 2 * margin,
    });
    currentY += size === 'small' ? 12 : 18;

    // Strain Name (if available)
    if (data.strainName) {
      pdf.setFontSize(fontSize + 1);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(60, 60, 60);
      pdf.text(data.strainName, width / 2, currentY, { align: 'center' });
      currentY += 12;
    }

    // Category, Vendor, Strain Type (horizontal layout)
    if (size !== 'small') {
      const topInfo = [];
      if (data.category) topInfo.push(`${data.category.toUpperCase()}`);
      if (data.strainType) topInfo.push(`${data.strainType}`);
      if (data.vendorName) topInfo.push(data.vendorName);
      
      if (topInfo.length > 0) {
        pdf.setFontSize(fontSize - 1);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(topInfo.join(' • '), width / 2, currentY, { align: 'center' });
        currentY += 10;
      }
    }

    // THC/CBD Percentages (highlighted)
    if (data.thcPercent !== undefined || data.cbdPercent !== undefined) {
      pdf.setFontSize(fontSize + 2);
      pdf.setFont('helvetica', 'bold');
      
      const cannabinoids = [];
      if (data.thcPercent !== undefined) {
        pdf.setTextColor(34, 197, 94); // Green
        cannabinoids.push(`THC: ${data.thcPercent}%`);
      }
      if (data.cbdPercent !== undefined && data.thcPercent !== undefined) {
        cannabinoids.push(' | ');
      }
      if (data.cbdPercent !== undefined) {
        pdf.setTextColor(59, 130, 246); // Blue
        if (data.thcPercent === undefined) cannabinoids.push(`CBD: ${data.cbdPercent}%`);
      }
      
      pdf.setTextColor(0, 0, 0);
      const thcCbd = [];
      if (data.thcPercent !== undefined) thcCbd.push(`THC: ${data.thcPercent}%`);
      if (data.cbdPercent !== undefined) thcCbd.push(`CBD: ${data.cbdPercent}%`);
      pdf.text(thcCbd.join(' | '), width / 2, currentY, { align: 'center' });
      currentY += 14;
    }

    // Batch Number and Price (if available)
    if (size !== 'small' && (data.batchNumber || data.price !== undefined)) {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      const extraInfo = [];
      if (data.batchNumber) extraInfo.push(`Batch: ${data.batchNumber}`);
      if (data.price !== undefined) extraInfo.push(`$${data.price.toFixed(2)}`);
      if (extraInfo.length > 0) {
        pdf.text(extraInfo.join(' | '), width / 2, currentY, { align: 'center' });
        currentY += 12;
      }
    }

    // Generate barcode using barcodeService
    const barcodeValue = data.barcodeValue || data.sku;
    let barcodeHeight = size === 'small' ? 35 : size === 'standard' ? 50 : 60;
    let barcodeWidth = size === 'small' ? 120 : size === 'standard' ? 200 : 240;
    
    try {
      const barcodeSvg = generateBarcodeSVG(barcodeValue, {
        width: 1.5,
        height: barcodeHeight,
        displayValue: true,
        format: 'CODE128',
      });
      
      // Convert SVG to data URL
      const svgBlob = new Blob([barcodeSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      
      // Draw barcode on canvas to get PNG
      const canvas = document.createElement('canvas');
      canvas.width = barcodeWidth * 3; // Higher resolution for clarity
      canvas.height = barcodeHeight * 3;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      
      const barcodeDataUrl = canvas.toDataURL('image/png', 1.0);
      URL.revokeObjectURL(url);
      
      // Add barcode to PDF centered
      const barcodeY = currentY + 5;
      const barcodeX = (width - barcodeWidth) / 2;
      
      pdf.addImage(
        barcodeDataUrl,
        'PNG',
        barcodeX,
        barcodeY,
        barcodeWidth,
        barcodeHeight
      );
      currentY = barcodeY + barcodeHeight + 8;
    } catch (error) {
      logger.warn('Failed to generate barcode, using text fallback', error, {
        component: 'labelGenerator',
      });
      // Fallback: Show as text
      pdf.setFontSize(fontSize + 2);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(barcodeValue, width / 2, currentY + 20, { align: 'center' });
      currentY += 35;
    }

    // Add QR Code for larger labels
    if (size === 'large' || size === 'sheet') {
      try {
        const qrData = JSON.stringify({
          sku: data.sku,
          name: data.productName,
          category: data.category,
          strain: data.strainName,
          thc: data.thcPercent,
          cbd: data.cbdPercent,
          batch: data.batchNumber,
        });
        
        const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
          width: 60,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        
        // Add QR code to bottom right
        pdf.addImage(
          qrCodeDataUrl,
          'PNG',
          width - 70,
          height - 70,
          60,
          60
        );
        
        pdf.setFontSize(6);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Scan for details', width - 40, height - 8, { align: 'center' });
      } catch (error) {
        logger.warn('Failed to generate QR code', error, {
          component: 'labelGenerator',
        });
      }
    }

    // Compliance warnings for larger labels
    if (size === 'large' || size === 'sheet') {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(150, 150, 150);
      const warnings = [
        '⚠ For adult use only (21+)',
        '🚫 Keep out of reach of children',
        `📅 Packaged: ${new Date().toLocaleDateString()}`,
      ];
      let warningY = height - 35;
      warnings.forEach(warning => {
        pdf.text(warning, margin, warningY);
        warningY += 8;
      });
    }

    // SKU at bottom
    pdf.setFontSize(fontSize - 1);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(120, 120, 120);
    pdf.text(`SKU: ${data.sku}`, width / 2, height - margin, {
      align: 'center',
    });

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

