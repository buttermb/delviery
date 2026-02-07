/**
 * Label Printing Service
 * Generates printable labels for products, packages, batches, and transfers
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PackageQRData, TransferQRData, BatchQRData } from './barcodeService';

export type LabelType = 'product' | 'batch' | 'package' | 'transfer_manifest' | 'small_package';
export type LabelSize = '4x6' | '2x1' | 'standard';

interface LabelPrintOptions {
  size?: LabelSize;
  copies?: number;
  printerName?: string;
}

/**
 * Generate product label HTML
 */
export function generateProductLabelHTML(data: {
  companyName: string;
  productName: string;
  strainType?: string;
  thcPercent?: number;
  cbdPercent?: number;
  weight: number;
  unit: string;
  batchNumber: string;
  packageNumber: string;
  packagedDate: string;
  expirationDate?: string;
  barcodeDataUrl: string;
  qrCodeDataUrl: string;
}): string {
  return `
    <div style="
      width: 4in;
      height: 6in;
      padding: 0.25in;
      font-family: Arial, sans-serif;
      border: 1px solid #000;
      box-sizing: border-box;
    ">
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 0.1in; margin-bottom: 0.15in;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${data.companyName}</h1>
      </div>

      <!-- Product Info -->
      <div style="text-align: center; margin-bottom: 0.2in;">
        <h2 style="margin: 0; font-size: 32px; font-weight: bold;">${data.productName}</h2>
        ${data.strainType ? `<p style="margin: 0.1in 0; font-size: 16px; color: #666;">Type: ${data.strainType}</p>` : ''}
      </div>

      <!-- Details -->
      <div style="margin-bottom: 0.2in; font-size: 14px;">
        ${data.thcPercent ? `<p style="margin: 0.05in 0;"><strong>THC:</strong> ${data.thcPercent}%</p>` : ''}
        ${data.cbdPercent ? `<p style="margin: 0.05in 0;"><strong>CBD:</strong> ${data.cbdPercent}%</p>` : ''}
        <p style="margin: 0.05in 0;"><strong>Weight:</strong> ${data.weight} ${data.unit}</p>
        <p style="margin: 0.05in 0;"><strong>Batch:</strong> ${data.batchNumber}</p>
      </div>

      <!-- Barcode -->
      <div style="text-align: center; margin: 0.2in 0; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 0.15in 0;">
        <div style="font-family: monospace; font-size: 16px; margin-bottom: 0.1in;">${data.packageNumber}</div>
        <img src="${data.barcodeDataUrl}" style="max-width: 100%; height: auto;" alt="Barcode" />
      </div>

      <!-- QR Code -->
      <div style="text-align: center; margin: 0.2in 0;">
        <img src="${data.qrCodeDataUrl}" style="width: 1.5in; height: 1.5in;" alt="QR Code" />
      </div>

      <!-- Footer -->
      <div style="font-size: 12px; text-align: center; margin-top: 0.2in; padding-top: 0.1in; border-top: 1px solid #ccc;">
        <p style="margin: 0.05in 0;"><strong>Pkg:</strong> ${new Date(data.packagedDate).toLocaleDateString()}</p>
        ${data.expirationDate ? `<p style="margin: 0.05in 0;"><strong>Exp:</strong> ${new Date(data.expirationDate).toLocaleDateString()}</p>` : ''}
      </div>
    </div>
  `;
}

/**
 * Generate small package label HTML
 */
export function generateSmallPackageLabelHTML(data: {
  productName: string;
  weight: number;
  unit: string;
  thcPercent?: number;
  packageNumber: string;
  qrCodeDataUrl: string;
}): string {
  return `
    <div style="
      width: 2in;
      height: 1in;
      padding: 0.1in;
      font-family: Arial, sans-serif;
      border: 1px solid #000;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: space-between;
    ">
      <div style="flex: 1;">
        <div style="font-size: 12px; font-weight: bold; margin-bottom: 0.05in;">${data.productName}</div>
        <div style="font-size: 10px;">
          ${data.weight} ${data.unit}
          ${data.thcPercent ? ` | ${data.thcPercent}%` : ''}
        </div>
        <div style="font-size: 9px; font-family: monospace; margin-top: 0.05in;">${data.packageNumber}</div>
      </div>
      <div>
        <img src="${data.qrCodeDataUrl}" style="width: 0.75in; height: 0.75in;" alt="QR Code" />
      </div>
    </div>
  `;
}

/**
 * Generate batch label HTML
 */
export function generateBatchLabelHTML(data: {
  companyName: string;
  batchNumber: string;
  productName: string;
  receivedDate: string;
  quantity: number;
  unit: string;
  supplierName?: string;
  harvestDate?: string;
  thcPercent?: number;
  cbdPercent?: number;
  labName?: string;
  qrCodeDataUrl: string;
}): string {
  return `
    <div style="
      width: 4in;
      height: 6in;
      padding: 0.25in;
      font-family: Arial, sans-serif;
      border: 1px solid #000;
      box-sizing: border-box;
    ">
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 0.1in; margin-bottom: 0.15in;">
        <h1 style="margin: 0; font-size: 20px; font-weight: bold;">BATCH INFORMATION</h1>
      </div>

      <!-- Batch Details -->
      <div style="margin-bottom: 0.2in;">
        <p style="margin: 0.1in 0; font-size: 18px;"><strong>Batch:</strong> ${data.batchNumber}</p>
        <p style="margin: 0.1in 0; font-size: 18px;"><strong>Product:</strong> ${data.productName}</p>
      </div>

      <div style="border-top: 1px solid #ccc; padding-top: 0.15in; margin-bottom: 0.2in;">
        <p style="margin: 0.05in 0; font-size: 14px;"><strong>Received:</strong> ${new Date(data.receivedDate).toLocaleDateString()}</p>
        <p style="margin: 0.05in 0; font-size: 14px;"><strong>Quantity:</strong> ${data.quantity} ${data.unit}</p>
        ${data.supplierName ? `<p style="margin: 0.05in 0; font-size: 14px;"><strong>Supplier:</strong> ${data.supplierName}</p>` : ''}
        ${data.harvestDate ? `<p style="margin: 0.05in 0; font-size: 14px;"><strong>Harvest:</strong> ${new Date(data.harvestDate).toLocaleDateString()}</p>` : ''}
      </div>

      ${data.thcPercent || data.cbdPercent || data.labName ? `
      <div style="border-top: 1px solid #ccc; padding-top: 0.15in; margin-bottom: 0.2in;">
        ${data.thcPercent ? `<p style="margin: 0.05in 0; font-size: 14px;"><strong>THC:</strong> ${data.thcPercent}%</p>` : ''}
        ${data.cbdPercent ? `<p style="margin: 0.05in 0; font-size: 14px;"><strong>CBD:</strong> ${data.cbdPercent}%</p>` : ''}
        ${data.labName ? `<p style="margin: 0.05in 0; font-size: 14px;"><strong>Lab:</strong> ${data.labName}</p>` : ''}
      </div>
      ` : ''}

      <!-- QR Code -->
      <div style="text-align: center; margin: 0.3in 0;">
        <img src="${data.qrCodeDataUrl}" style="width: 2in; height: 2in;" alt="QR Code" />
        <p style="font-size: 12px; margin-top: 0.1in;">Scan for full data</p>
      </div>
    </div>
  `;
}

/**
 * Generate transfer manifest HTML
 */
export function generateTransferManifestHTML(data: {
  companyName: string;
  transferNumber: string;
  fromLocation: string;
  toLocation: string;
  items: Array<{
    packageNumber: string;
    productName: string;
    quantity: number;
    unit: string;
  }>;
  totalQuantity: number;
  unit: string;
  totalValue: number;
  runnerName: string;
  vehicleInfo?: string;
  scheduledDate: string;
  qrCodeDataUrl: string;
}): string {
  return `
    <div style="
      width: 4in;
      height: 6in;
      padding: 0.25in;
      font-family: Arial, sans-serif;
      border: 1px solid #000;
      box-sizing: border-box;
    ">
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 0.1in; margin-bottom: 0.15in;">
        <h1 style="margin: 0; font-size: 20px; font-weight: bold;">🚗 TRANSFER MANIFEST</h1>
        <p style="margin: 0.05in 0; font-size: 16px; font-weight: bold;">${data.transferNumber}</p>
      </div>

      <!-- Locations -->
      <div style="margin-bottom: 0.2in;">
        <p style="margin: 0.1in 0; font-size: 14px;"><strong>FROM:</strong> ${data.fromLocation}</p>
        <p style="text-align: center; font-size: 20px; margin: 0.05in 0;">↓</p>
        <p style="margin: 0.1in 0; font-size: 14px;"><strong>TO:</strong> ${data.toLocation}</p>
      </div>

      <div style="border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 0.1in 0; margin: 0.15in 0;"></div>

      <!-- Items -->
      <div style="margin-bottom: 0.15in;">
        <p style="font-size: 14px; font-weight: bold; margin-bottom: 0.1in;">ITEMS (${data.items.length} packages):</p>
        ${data.items.map(item => `
          <p style="margin: 0.05in 0; font-size: 12px;">
            • ${item.packageNumber} - ${item.productName} (${item.quantity} ${item.unit})
          </p>
        `).join('')}
      </div>

      <div style="border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 0.1in 0; margin: 0.15in 0;"></div>

      <div style="margin-bottom: 0.15in;">
        <p style="margin: 0.05in 0; font-size: 14px;"><strong>TOTAL:</strong> ${data.totalQuantity} ${data.unit} | Value: $${data.totalValue.toLocaleString()}</p>
      </div>

      <div style="border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 0.1in 0; margin: 0.15in 0;"></div>

      <!-- Runner Info -->
      <div style="margin-bottom: 0.2in; font-size: 14px;">
        <p style="margin: 0.05in 0;"><strong>Runner:</strong> ${data.runnerName}</p>
        ${data.vehicleInfo ? `<p style="margin: 0.05in 0;"><strong>Vehicle:</strong> ${data.vehicleInfo}</p>` : ''}
        <p style="margin: 0.05in 0;"><strong>Scheduled:</strong> ${new Date(data.scheduledDate).toLocaleString()}</p>
      </div>

      <!-- QR Code -->
      <div style="text-align: center; margin: 0.2in 0;">
        <img src="${data.qrCodeDataUrl}" style="width: 1.5in; height: 1.5in;" alt="QR Code" />
        <p style="font-size: 11px; margin-top: 0.05in;">Scan to track transfer status</p>
      </div>

      <!-- Signatures -->
      <div style="border-top: 1px solid #ccc; padding-top: 0.1in; margin-top: 0.2in; font-size: 12px;">
        <p style="margin: 0.05in 0;"><strong>Released By:</strong> ____________________</p>
        <p style="margin: 0.05in 0;">Date/Time: ____________________</p>
        <p style="margin: 0.15in 0 0.05in 0;"><strong>Received By:</strong> ____________________</p>
        <p style="margin: 0.05in 0;">Date/Time: ____________________</p>
      </div>
    </div>
  `;
}

/**
 * Print label to PDF
 */
export async function printLabelToPDF(
  htmlContent: string,
  options: LabelPrintOptions = {}
): Promise<Blob> {
  // Create a temporary container
  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  try {
    // Convert HTML to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      logging: false,
      useCORS: true,
    });

    // Calculate PDF dimensions based on label size
    const width = options.size === '2x1' ? 2 : 4;
    const height = options.size === '2x1' ? 1 : 6;
    
    const pdf = new jsPDF({
      orientation: width > height ? 'landscape' : 'portrait',
      unit: 'in',
      format: [width, height],
    });

    // Add canvas to PDF
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, width, height);

    // Generate multiple copies if specified
    const copies = options.copies || 1;
    const finalPdf = new jsPDF({
      orientation: width > height ? 'landscape' : 'portrait',
      unit: 'in',
      format: [width, height],
    });

    for (let i = 0; i < copies; i++) {
      if (i > 0) {
        finalPdf.addPage([width, height], width > height ? 'landscape' : 'portrait');
      }
      finalPdf.addImage(imgData, 'PNG', 0, 0, width, height);
    }

    // Generate blob
    const blob = finalPdf.output('blob');
    return blob;
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}

/**
 * Print label (opens print dialog)
 */
export async function printLabel(
  htmlContent: string,
  options: LabelPrintOptions = {}
): Promise<void> {
  // Create print window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Unable to open print window. Please allow popups.');
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Label Print</title>
        <style>
          @media print {
            @page {
              size: ${options.size === '2x1' ? '2in 1in' : '4in 6in'};
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);

  printWindow.document.close();

  // Wait for content to load, then print
  setTimeout(() => {
    printWindow.print();
    // Close after printing (optional)
    // printWindow.close();
  }, 250);
}

/**
 * Download label as PDF
 */
export async function downloadLabelPDF(
  htmlContent: string,
  filename: string,
  options: LabelPrintOptions = {}
): Promise<void> {
  const blob = await printLabelToPDF(htmlContent, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

