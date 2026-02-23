/**
 * Label Printing Service
 * Generates printable labels for products, packages, batches, and transfers
 * Supports multiple label sizes and formats for cannabis compliance
 */

import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';

// ============================================================================
// TYPES
// ============================================================================

export type LabelType = 'product' | 'batch' | 'package' | 'transfer_manifest' | 'small_package' | 'shelf';
export type LabelSize = '4x6' | '4x3' | '2x1' | '1x1' | 'standard';

export interface LabelPrintOptions {
  size?: LabelSize;
  copies?: number;
  showBorder?: boolean;
  darkMode?: boolean;
}

export interface ProductLabelData {
  companyName: string;
  productName: string;
  strainType?: 'Indica' | 'Sativa' | 'Hybrid' | 'CBD';
  thcPercent?: number;
  cbdPercent?: number;
  weight: number;
  unit: string;
  batchNumber: string;
  packageNumber: string;
  packagedDate: string;
  expirationDate?: string;
  barcodeDataUrl?: string;
  qrCodeDataUrl?: string;
  licenseNumber?: string;
  warnings?: string[];
}

export interface BatchLabelData {
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
  labTestDate?: string;
  qrCodeDataUrl?: string;
}

export interface SmallPackageLabelData {
  productName: string;
  weight: number;
  unit: string;
  thcPercent?: number;
  cbdPercent?: number;
  packageNumber: string;
  qrCodeDataUrl?: string;
}

export interface ShelfLabelData {
  productName: string;
  sku: string;
  price: number;
  unit: string;
  category?: string;
  barcodeDataUrl?: string;
}

export interface TransferManifestData {
  companyName: string;
  manifestNumber: string;
  originFacility: string;
  originLicense: string;
  destinationFacility: string;
  destinationLicense: string;
  departureDate: string;
  estimatedArrival: string;
  vehicleInfo?: string;
  driverName: string;
  driverLicense?: string;
  items: Array<{
    packageNumber: string;
    productName: string;
    quantity: number;
    unit: string;
  }>;
  qrCodeDataUrl?: string;
}

// ============================================================================
// LABEL SIZE DIMENSIONS (in inches)
// ============================================================================

const LABEL_DIMENSIONS: Record<LabelSize, { width: string; height: string }> = {
  '4x6': { width: '4in', height: '6in' },
  '4x3': { width: '4in', height: '3in' },
  '2x1': { width: '2in', height: '1in' },
  '1x1': { width: '1in', height: '1in' },
  standard: { width: '3.5in', height: '5in' },
};

// ============================================================================
// COMMON STYLES
// ============================================================================

const getBaseStyles = (size: LabelSize, options: LabelPrintOptions = {}) => {
  const { width, height } = LABEL_DIMENSIONS[size];
  const border = options.showBorder ? '1px solid #000' : 'none';
  const bg = options.darkMode ? '#1a1a1a' : '#fff';
  const text = options.darkMode ? '#fff' : '#000';

  return `
    width: ${width};
    height: ${height};
    padding: 0.15in;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.3;
    color: ${text};
    background: ${bg};
    border: ${border};
    box-sizing: border-box;
    overflow: hidden;
  `;
};

// ============================================================================
// PRODUCT LABEL (4x6)
// ============================================================================

export function generateProductLabelHTML(data: ProductLabelData, options: LabelPrintOptions = {}): string {
  const size = options.size || '4x6';
  const strainColors: Record<string, string> = {
    Indica: '#6b21a8',
    Sativa: '#ea580c',
    Hybrid: '#16a34a',
    CBD: '#0ea5e9',
  };
  const strainColor = data.strainType ? strainColors[data.strainType] || '#666' : '#666';

  return `
    <div style="${getBaseStyles(size, options)}">
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 0.1in; margin-bottom: 0.1in;">
        <div style="font-size: 18px; font-weight: bold; letter-spacing: 1px;">${escapeHtml(data.companyName)}</div>
        ${data.licenseNumber ? `<div style="font-size: 9px; color: #666;">License: ${escapeHtml(data.licenseNumber)}</div>` : ''}
      </div>

      <!-- Product Name & Strain -->
      <div style="text-align: center; margin-bottom: 0.15in;">
        <div style="font-size: 22px; font-weight: bold; margin-bottom: 0.05in;">${escapeHtml(data.productName)}</div>
        ${data.strainType ? `
          <span style="
            display: inline-block;
            background: ${strainColor};
            color: white;
            padding: 2px 12px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
          ">${data.strainType}</span>
        ` : ''}
      </div>

      <!-- Cannabinoid Content -->
      <div style="display: flex; justify-content: center; gap: 0.3in; margin-bottom: 0.15in; font-size: 14px;">
        ${data.thcPercent !== undefined ? `
          <div style="text-align: center;">
            <div style="font-size: 20px; font-weight: bold;">${data.thcPercent}%</div>
            <div style="font-size: 10px; color: #666;">THC</div>
          </div>
        ` : ''}
        ${data.cbdPercent !== undefined ? `
          <div style="text-align: center;">
            <div style="font-size: 20px; font-weight: bold;">${data.cbdPercent}%</div>
            <div style="font-size: 10px; color: #666;">CBD</div>
          </div>
        ` : ''}
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: bold;">${data.weight}</div>
          <div style="font-size: 10px; color: #666;">${escapeHtml(data.unit)}</div>
        </div>
      </div>

      <!-- Details Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.05in; font-size: 11px; margin-bottom: 0.15in;">
        <div><strong>Batch:</strong> ${escapeHtml(data.batchNumber)}</div>
        <div><strong>Pkg:</strong> ${new Date(data.packagedDate).toLocaleDateString()}</div>
        ${data.expirationDate ? `<div style="grid-column: span 2;"><strong>Exp:</strong> ${new Date(data.expirationDate).toLocaleDateString()}</div>` : ''}
      </div>

      <!-- Barcode Section -->
      <div style="text-align: center; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 0.1in 0; margin-bottom: 0.1in;">
        <div style="font-family: monospace; font-size: 12px; letter-spacing: 2px; margin-bottom: 0.05in;">${escapeHtml(data.packageNumber)}</div>
        ${data.barcodeDataUrl ? `<img src="${data.barcodeDataUrl}" style="max-width: 100%; height: 0.5in;" alt="Barcode" />` : ''}
      </div>

      <!-- QR Code -->
      ${data.qrCodeDataUrl ? `
        <div style="text-align: center; margin-bottom: 0.1in;">
          <img src="${data.qrCodeDataUrl}" style="width: 1in; height: 1in;" alt="QR Code" />
          <div style="font-size: 8px; color: #666;">Scan for lab results</div>
        </div>
      ` : ''}

      <!-- Warnings -->
      ${data.warnings && data.warnings.length > 0 ? `
        <div style="font-size: 8px; color: #666; border-top: 1px solid #ccc; padding-top: 0.05in;">
          ${data.warnings.map(w => `<div>⚠️ ${escapeHtml(w)}</div>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================================================
// SMALL PACKAGE LABEL (2x1)
// ============================================================================

export function generateSmallPackageLabelHTML(data: SmallPackageLabelData, options: LabelPrintOptions = {}): string {
  const size = options.size || '2x1';

  return `
    <div style="${getBaseStyles(size, options)} display: flex; align-items: center; justify-content: space-between; padding: 0.05in;">
      <div style="flex: 1; overflow: hidden;">
        <div style="font-size: 10px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(data.productName)}</div>
        <div style="font-size: 9px; color: #666;">
          ${data.weight}${data.unit}
          ${data.thcPercent !== undefined ? ` | THC: ${data.thcPercent}%` : ''}
          ${data.cbdPercent !== undefined ? ` | CBD: ${data.cbdPercent}%` : ''}
        </div>
        <div style="font-size: 8px; font-family: monospace;">${escapeHtml(data.packageNumber)}</div>
      </div>
      ${data.qrCodeDataUrl ? `
        <div style="flex-shrink: 0; margin-left: 0.05in;">
          <img src="${data.qrCodeDataUrl}" style="width: 0.7in; height: 0.7in;" alt="QR Code" />
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================================================
// BATCH LABEL (4x6)
// ============================================================================

export function generateBatchLabelHTML(data: BatchLabelData, options: LabelPrintOptions = {}): string {
  const size = options.size || '4x6';

  return `
    <div style="${getBaseStyles(size, options)}">
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 0.1in; margin-bottom: 0.15in;">
        <div style="font-size: 16px; font-weight: bold;">${escapeHtml(data.companyName)}</div>
        <div style="font-size: 12px; color: #666;">BATCH LABEL</div>
      </div>

      <!-- Batch Number (Large) -->
      <div style="text-align: center; margin-bottom: 0.2in;">
        <div style="font-size: 11px; color: #666;">Batch Number</div>
        <div style="font-size: 28px; font-weight: bold; font-family: monospace; letter-spacing: 2px;">${escapeHtml(data.batchNumber)}</div>
      </div>

      <!-- Product Info -->
      <div style="background: #f5f5f5; padding: 0.1in; border-radius: 4px; margin-bottom: 0.15in;">
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 0.05in;">${escapeHtml(data.productName)}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.05in; font-size: 11px;">
          <div><strong>Qty:</strong> ${data.quantity} ${escapeHtml(data.unit)}</div>
          <div><strong>Received:</strong> ${new Date(data.receivedDate).toLocaleDateString()}</div>
          ${data.supplierName ? `<div><strong>Supplier:</strong> ${escapeHtml(data.supplierName)}</div>` : ''}
          ${data.harvestDate ? `<div><strong>Harvest:</strong> ${new Date(data.harvestDate).toLocaleDateString()}</div>` : ''}
        </div>
      </div>

      <!-- Lab Results -->
      ${data.thcPercent !== undefined || data.cbdPercent !== undefined ? `
        <div style="display: flex; justify-content: center; gap: 0.4in; margin-bottom: 0.15in;">
          ${data.thcPercent !== undefined ? `
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold;">${data.thcPercent}%</div>
              <div style="font-size: 10px; color: #666;">THC</div>
            </div>
          ` : ''}
          ${data.cbdPercent !== undefined ? `
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold;">${data.cbdPercent}%</div>
              <div style="font-size: 10px; color: #666;">CBD</div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- Lab Info -->
      ${data.labName ? `
        <div style="font-size: 10px; color: #666; text-align: center; margin-bottom: 0.1in;">
          Tested by: ${escapeHtml(data.labName)}
          ${data.labTestDate ? ` on ${new Date(data.labTestDate).toLocaleDateString()}` : ''}
        </div>
      ` : ''}

      <!-- QR Code -->
      ${data.qrCodeDataUrl ? `
        <div style="text-align: center;">
          <img src="${data.qrCodeDataUrl}" style="width: 1.2in; height: 1.2in;" alt="QR Code" />
          <div style="font-size: 8px; color: #666;">Scan for full batch info</div>
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================================================
// SHELF LABEL (2x1)
// ============================================================================

export function generateShelfLabelHTML(data: ShelfLabelData, options: LabelPrintOptions = {}): string {
  const size = options.size || '2x1';

  return `
    <div style="${getBaseStyles(size, options)} display: flex; align-items: center; justify-content: space-between; padding: 0.05in;">
      <div style="flex: 1;">
        <div style="font-size: 11px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(data.productName)}</div>
        <div style="font-size: 8px; color: #666;">SKU: ${escapeHtml(data.sku)}</div>
        ${data.category ? `<div style="font-size: 8px; color: #666;">${escapeHtml(data.category)}</div>` : ''}
      </div>
      <div style="text-align: right;">
        <div style="font-size: 16px; font-weight: bold;">${formatCurrency(data.price)}</div>
        <div style="font-size: 8px; color: #666;">/ ${escapeHtml(data.unit)}</div>
      </div>
    </div>
  `;
}

// ============================================================================
// TRANSFER MANIFEST (Full Page)
// ============================================================================

export function generateTransferManifestHTML(data: TransferManifestData, _options: LabelPrintOptions = {}): string {
  return `
    <div style="
      width: 8.5in;
      min-height: 11in;
      padding: 0.5in;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.4;
    ">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 0.2in; margin-bottom: 0.3in;">
        <div>
          <div style="font-size: 24px; font-weight: bold;">${escapeHtml(data.companyName)}</div>
          <div style="font-size: 14px; color: #666;">TRANSFER MANIFEST</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: bold;">Manifest #${escapeHtml(data.manifestNumber)}</div>
          <div style="font-size: 10px; color: #666;">Generated: ${new Date().toLocaleString()}</div>
        </div>
      </div>

      <!-- Origin & Destination -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5in; margin-bottom: 0.3in;">
        <div style="border: 1px solid #ccc; padding: 0.15in; border-radius: 4px;">
          <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 0.05in;">Origin Facility</div>
          <div style="font-size: 14px; font-weight: bold;">${escapeHtml(data.originFacility)}</div>
          <div style="font-size: 10px;">License: ${escapeHtml(data.originLicense)}</div>
        </div>
        <div style="border: 1px solid #ccc; padding: 0.15in; border-radius: 4px;">
          <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 0.05in;">Destination Facility</div>
          <div style="font-size: 14px; font-weight: bold;">${escapeHtml(data.destinationFacility)}</div>
          <div style="font-size: 10px;">License: ${escapeHtml(data.destinationLicense)}</div>
        </div>
      </div>

      <!-- Transport Info -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.2in; margin-bottom: 0.3in; font-size: 10px;">
        <div>
          <div style="color: #666;">Departure</div>
          <div style="font-weight: bold;">${new Date(data.departureDate).toLocaleString()}</div>
        </div>
        <div>
          <div style="color: #666;">Est. Arrival</div>
          <div style="font-weight: bold;">${new Date(data.estimatedArrival).toLocaleString()}</div>
        </div>
        <div>
          <div style="color: #666;">Driver</div>
          <div style="font-weight: bold;">${escapeHtml(data.driverName)}</div>
          ${data.driverLicense ? `<div style="font-size: 9px;">License: ${escapeHtml(data.driverLicense)}</div>` : ''}
        </div>
        ${data.vehicleInfo ? `
          <div>
            <div style="color: #666;">Vehicle</div>
            <div style="font-weight: bold;">${escapeHtml(data.vehicleInfo)}</div>
          </div>
        ` : ''}
      </div>

      <!-- Items Table -->
      <div style="margin-bottom: 0.3in;">
        <div style="font-size: 12px; font-weight: bold; margin-bottom: 0.1in;">Package Contents</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th scope="col" style="border: 1px solid #ccc; padding: 0.1in; text-align: left;">Package #</th>
              <th scope="col" style="border: 1px solid #ccc; padding: 0.1in; text-align: left;">Product</th>
              <th scope="col" style="border: 1px solid #ccc; padding: 0.1in; text-align: right;">Quantity</th>
              <th scope="col" style="border: 1px solid #ccc; padding: 0.1in; text-align: left;">Unit</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td style="border: 1px solid #ccc; padding: 0.1in; font-family: monospace;">${escapeHtml(item.packageNumber)}</td>
                <td style="border: 1px solid #ccc; padding: 0.1in;">${escapeHtml(item.productName)}</td>
                <td style="border: 1px solid #ccc; padding: 0.1in; text-align: right;">${item.quantity}</td>
                <td style="border: 1px solid #ccc; padding: 0.1in;">${escapeHtml(item.unit)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold;">
              <td colspan="2" style="border: 1px solid #ccc; padding: 0.1in;">Total Packages: ${data.items.length}</td>
              <td style="border: 1px solid #ccc; padding: 0.1in; text-align: right;">${data.items.reduce((sum, i) => sum + i.quantity, 0)}</td>
              <td style="border: 1px solid #ccc; padding: 0.1in;"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Signatures -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5in; margin-top: 0.5in;">
        <div>
          <div style="border-bottom: 1px solid #000; height: 0.4in; margin-bottom: 0.05in;"></div>
          <div style="font-size: 10px;">Origin Signature & Date</div>
        </div>
        <div>
          <div style="border-bottom: 1px solid #000; height: 0.4in; margin-bottom: 0.05in;"></div>
          <div style="font-size: 10px;">Destination Signature & Date</div>
        </div>
      </div>

      <!-- QR Code -->
      ${data.qrCodeDataUrl ? `
        <div style="position: absolute; bottom: 0.5in; right: 0.5in; text-align: center;">
          <img src="${data.qrCodeDataUrl}" style="width: 1in; height: 1in;" alt="QR Code" />
          <div style="font-size: 8px; color: #666;">Scan to verify</div>
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================================================
// PRINT FUNCTIONS
// ============================================================================

/**
 * Print label(s) in a new window
 */
export function printLabel(html: string, options: LabelPrintOptions = {}): void {
  const { copies = 1 } = options;

  const printWindow = window.open('', '_blank', 'width=600,height=800');
  if (!printWindow) {
    logger.error('Failed to open print window - popup blocked?');
    throw new Error('Could not open print window. Please allow popups.');
  }

  const content = Array(copies).fill(html).join('<div style="page-break-after: always;"></div>');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Label</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            @page { margin: 0; }
          }
          body {
            margin: 0;
            padding: 0.25in;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.25in;
          }
        </style>
      </head>
      <body>
        ${content}
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

/**
 * Download label as PDF (requires jsPDF)
 */
export async function downloadLabelAsPDF(
  html: string,
  filename: string = 'label.pdf',
  options: LabelPrintOptions = {}
): Promise<void> {
  try {
    // Dynamic import to reduce bundle size
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);

    // Create temporary container
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    const size = options.size || '4x6';
    const { width, height } = LABEL_DIMENSIONS[size];

    const pdf = new jsPDF({
      orientation: parseFloat(width) > parseFloat(height) ? 'landscape' : 'portrait',
      unit: 'in',
      format: [parseFloat(width), parseFloat(height)],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, parseFloat(width), parseFloat(height));
    pdf.save(filename);
  } catch (error) {
    logger.error('Failed to generate PDF', error as Error);
    throw error;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Generate multiple labels at once
 */
export function generateBatchLabels(
  items: ProductLabelData[],
  options: LabelPrintOptions = {}
): string {
  return items.map(item => generateProductLabelHTML(item, options)).join('\n');
}

/**
 * Preview label in a container
 */
export function previewLabel(containerId: string, html: string): void {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = html;
  }
}
