/**
 * Product Label PDF Generator
 * Creates printable labels with product info and barcode
 */

import jsPDF from 'jspdf';
import { logger } from '@/lib/logger';

export interface ProductLabelData {
  productName: string;
  strainName?: string;
  strainType?: 'Sativa' | 'Indica' | 'Hybrid';
  sku: string;
  barcodeImageUrl?: string;
  barcodeValue?: string;
}

/**
 * Generate PDF label for product
 * Label size: 4" x 2" (standard product label)
 */
export async function generateProductLabelPDF(
  data: ProductLabelData
): Promise<Blob> {
  try {
    // Create PDF with label dimensions (4" x 2" at 72 DPI)
    // 4 inches = 288 points, 2 inches = 144 points
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: [288, 144], // 4" x 2"
    });

    const width = 288;
    const height = 144;
    const margin = 10;

    // Background (white)
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, width, height, 'F');

    // Product Name (large, bold, top)
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    const productNameY = margin + 20;
    pdf.text(data.productName, width / 2, productNameY, {
      align: 'center',
      maxWidth: width - 2 * margin,
    });

    // Strain Name (if available)
    let currentY = productNameY + 25;
    if (data.strainName) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Strain: ${data.strainName}`, width / 2, currentY, {
        align: 'center',
      });
      currentY += 18;
    }

    // Strain Type with color coding
    if (data.strainType) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      
      // Color coding: Indica = Red, Sativa = Blue, Hybrid = Purple
      const colorMap: Record<string, [number, number, number]> = {
        Indica: [220, 38, 38], // Red
        Sativa: [37, 99, 235], // Blue
        Hybrid: [147, 51, 234], // Purple
      };
      
      const color = colorMap[data.strainType] || [0, 0, 0];
      pdf.setTextColor(color[0], color[1], color[2]);
      pdf.text(`Type: ${data.strainType}`, width / 2, currentY, {
        align: 'center',
      });
      currentY += 20;
    }

    // Barcode (centered, below text)
    const barcodeY = currentY + 10;
    const barcodeHeight = 40;
    const barcodeWidth = 150;

    if (data.barcodeImageUrl) {
      try {
        // Load barcode image using fetch to handle CORS
        const response = await fetch(data.barcodeImageUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch barcode image');
        }
        const blob = await response.blob();
        const reader = new FileReader();
        
        const imageDataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        // Add image to PDF
        pdf.addImage(
          imageDataUrl,
          'PNG',
          (width - barcodeWidth) / 2,
          barcodeY,
          barcodeWidth,
          barcodeHeight
        );
      } catch (error) {
        logger.warn('Failed to load barcode image, using text fallback', error, {
          component: 'labelGenerator',
        });
        // Fallback: Show SKU as text
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'monospace');
        pdf.setTextColor(0, 0, 0);
        pdf.text(data.barcodeValue || data.sku, width / 2, barcodeY + barcodeHeight / 2, {
          align: 'center',
        });
      }
    } else if (data.barcodeValue) {
      // Show barcode value as text if no image
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'monospace');
      pdf.setTextColor(0, 0, 0);
      pdf.text(data.barcodeValue, width / 2, barcodeY + barcodeHeight / 2, {
        align: 'center',
      });
    }

    // SKU (bottom)
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
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
export async function downloadProductLabel(data: ProductLabelData): Promise<void> {
  try {
    const pdfBlob = await generateProductLabelPDF(data);
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `label-${data.sku}.pdf`;
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

