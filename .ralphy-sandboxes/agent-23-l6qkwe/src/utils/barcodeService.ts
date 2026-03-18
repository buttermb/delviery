import { logger } from '@/lib/logger';
/**
 * Advanced Barcode & QR Code Generation Service
 * Supports Code128 barcodes and QR codes with full tracking data
 */

import JsBarcode from 'jsbarcode';

// Barcode types
export type BarcodeType = 'CODE128' | 'EAN13' | 'EAN8' | 'CODE39';

// QR Code data structure for packages
export interface PackageQRData {
  type: 'package';
  id: string;
  package_number: string;
  product: {
    id: string;
    name: string;
    strain_type?: string;
  };
  batch: {
    id: string;
    batch_number: string;
    harvest_date?: string;
    test_results?: {
      thc?: number;
      cbd?: number;
      lab?: string;
      test_date?: string;
    };
  };
  weight: number;
  unit: string;
  packaged_date: string;
  expiration_date?: string;
  location: {
    id: string;
    name: string;
  };
  chain_of_custody: Array<{
    action: string;
    location: string;
    timestamp: string;
    performed_by: string;
  }>;
  verification_url: string;
  generated_at: string;
}

// QR Code data for transfers
export interface TransferQRData {
  type: 'transfer';
  id: string;
  transfer_number: string;
  from_location: {
    id: string;
    name: string;
  };
  to_location: {
    id: string;
    name: string;
  };
  packages: Array<{
    package_id: string;
    package_number: string;
    product_name: string;
    quantity_lbs: number;
  }>;
  total_quantity_lbs: number;
  total_value: number;
  runner: {
    id: string;
    name: string;
  };
  scheduled_at: string;
  status: string;
  tracking_url: string;
  generated_at: string;
}

// QR Code data for batches
export interface BatchQRData {
  type: 'batch';
  id: string;
  batch_number: string;
  product: {
    id: string;
    name: string;
    strain_type?: string;
  };
  received_date: string;
  total_quantity_lbs: number;
  remaining_quantity_lbs: number;
  supplier_name?: string;
  harvest_date?: string;
  test_results?: {
    thc?: number;
    cbd?: number;
    lab?: string;
    test_date?: string;
  };
  expiration_date?: string;
  status: string;
  generated_at: string;
}

export type QRCodeData = PackageQRData | TransferQRData | BatchQRData;

/**
 * Generate barcode SVG element (Code128)
 */
export function generateBarcodeSVG(
  barcodeText: string,
  options: {
    width?: number;
    height?: number;
    displayValue?: boolean;
    format?: BarcodeType;
  } = {}
): string {
  const canvas = document.createElement('canvas');
  const width = options.width || 2;
  const height = options.height || 100;
  const displayValue = options.displayValue !== false;
  const format = options.format || 'CODE128';
  const margin = 10;

  try {
    // Validate barcode text
    if (!barcodeText || barcodeText.trim().length === 0) {
      throw new Error('Barcode text cannot be empty');
    }

    // Calculate required canvas dimensions
    const barcodeTextLength = barcodeText.length;
    const calculatedWidth = (barcodeTextLength * width * 11) + (margin * 2) + 50;
    const calculatedHeight = height + (displayValue ? 40 : 0) + (margin * 2);

    // Set canvas dimensions BEFORE rendering
    canvas.width = calculatedWidth;
    canvas.height = calculatedHeight;

    JsBarcode(canvas, barcodeText, {
      format,
      width,
      height,
      displayValue,
      background: '#ffffff',
      lineColor: '#000000',
      margin,
    });

    // Validate canvas has content
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas dimensions are invalid');
    }

    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/png');
    
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      throw new Error('Failed to generate valid data URL from canvas');
    }

    return dataUrl;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Import logger at the top of the file if not already imported
    logger.error('Barcode generation error:', {
      barcodeText,
      width,
      height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      error: errorMessage,
    });
    throw new Error(`Failed to generate barcode: ${errorMessage}`);
  }
}

/**
 * Generate barcode as data URL (for images)
 */
export async function generateBarcodeDataURL(
  barcodeText: string,
  options: {
    width?: number;
    height?: number;
    displayValue?: boolean;
    format?: BarcodeType;
  } = {}
): Promise<string> {
  return generateBarcodeSVG(barcodeText, options);
}

/**
 * Generate QR code data URL
 * Note: Use QRCodeSVG from 'qrcode.react' for browser rendering.
 * This function is kept for compatibility but QR codes should be rendered
 * using React components in the UI.
 */
export async function generateQRCodeDataURL(
  data: QRCodeData,
  _options: {
    size?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  } = {}
): Promise<string> {
  // For browser rendering, use QRCodeSVG component from qrcode.react
  // This function can be used server-side if qrcode package is installed
  // data is used to build the QR code content - currently throws as browser rendering should use React component
  void data;

  // Return data string - actual rendering should use QRCodeSVG component
  // To get actual data URL, you'd need to:
  // 1. Render QRCodeSVG to canvas
  // 2. Convert canvas to data URL
  // This is better done in the component itself

  throw new Error('Use QRCodeSVG component from qrcode.react for QR code rendering in browser');
}

/**
 * Create package QR code data structure
 */
export function createPackageQRData(params: {
  packageId: string;
  packageNumber: string;
  productId: string;
  productName: string;
  strainType?: string;
  batchId: string;
  batchNumber: string;
  harvestDate?: string;
  testResults?: {
    thc?: number;
    cbd?: number;
    lab?: string;
    testDate?: string;
  };
  weight: number;
  unit: string;
  packagedDate: string;
  expirationDate?: string;
  locationId: string;
  locationName: string;
  chainOfCustody: Array<{
    action: string;
    location: string;
    timestamp: string;
    performedBy: string;
  }>;
  baseUrl?: string;
}): PackageQRData {
  const verificationUrl = params.baseUrl
    ? `${params.baseUrl}/verify/${params.packageNumber}`
    : `${window.location.origin}/verify/${params.packageNumber}`;

  return {
    type: 'package',
    id: params.packageId,
    package_number: params.packageNumber,
    product: {
      id: params.productId,
      name: params.productName,
      strain_type: params.strainType,
    },
    batch: {
      id: params.batchId,
      batch_number: params.batchNumber,
      harvest_date: params.harvestDate,
      test_results: params.testResults,
    },
    weight: params.weight,
    unit: params.unit,
    packaged_date: params.packagedDate,
    expiration_date: params.expirationDate,
    location: {
      id: params.locationId,
      name: params.locationName,
    },
    chain_of_custody: params.chainOfCustody.map((coc) => ({
      action: coc.action,
      location: coc.location,
      timestamp: coc.timestamp,
      performed_by: coc.performedBy,
    })),
    verification_url: verificationUrl,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Create transfer QR code data structure
 */
export function createTransferQRData(params: {
  transferId: string;
  transferNumber: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  packages: Array<{
    packageId: string;
    packageNumber: string;
    productName: string;
    quantityLbs: number;
  }>;
  totalQuantityLbs: number;
  totalValue: number;
  runnerId: string;
  runnerName: string;
  scheduledAt: string;
  status: string;
  baseUrl?: string;
}): TransferQRData {
  const trackingUrl = params.baseUrl
    ? `${params.baseUrl}/track/${params.transferNumber}`
    : `${window.location.origin}/track/${params.transferNumber}`;

  return {
    type: 'transfer',
    id: params.transferId,
    transfer_number: params.transferNumber,
    from_location: {
      id: params.fromLocationId,
      name: params.fromLocationName,
    },
    to_location: {
      id: params.toLocationId,
      name: params.toLocationName,
    },
    packages: params.packages.map((pkg) => ({
      package_id: pkg.packageId,
      package_number: pkg.packageNumber,
      product_name: pkg.productName,
      quantity_lbs: pkg.quantityLbs,
    })),
    total_quantity_lbs: params.totalQuantityLbs,
    total_value: params.totalValue,
    runner: {
      id: params.runnerId,
      name: params.runnerName,
    },
    scheduled_at: params.scheduledAt,
    status: params.status,
    tracking_url: trackingUrl,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Create batch QR code data structure
 */
export function createBatchQRData(params: {
  batchId: string;
  batchNumber: string;
  productId: string;
  productName: string;
  strainType?: string;
  receivedDate: string;
  totalQuantityLbs: number;
  remainingQuantityLbs: number;
  supplierName?: string;
  harvestDate?: string;
  testResults?: {
    thc?: number;
    cbd?: number;
    lab?: string;
    testDate?: string;
  };
  expirationDate?: string;
  status: string;
}): BatchQRData {
  return {
    type: 'batch',
    id: params.batchId,
    batch_number: params.batchNumber,
    product: {
      id: params.productId,
      name: params.productName,
      strain_type: params.strainType,
    },
    received_date: params.receivedDate,
    total_quantity_lbs: params.totalQuantityLbs,
    remaining_quantity_lbs: params.remainingQuantityLbs,
    supplier_name: params.supplierName,
    harvest_date: params.harvestDate,
    test_results: params.testResults,
    expiration_date: params.expirationDate,
    status: params.status,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Scan QR code and parse data
 */
export function parseQRCodeData(qrDataString: string): QRCodeData {
  try {
    const data = JSON.parse(qrDataString);
    
    // Validate structure
    if (!data.type || !data.id) {
      throw new Error('Invalid QR code data structure');
    }
    
    return data as QRCodeData;
  } catch (error) {
    logger.error('QR code parsing error:', error);
    throw new Error(`Failed to parse QR code data: ${error}`);
  }
}

/**
 * Validate barcode format
 */
export function validateBarcode(barcode: string, type: BarcodeType = 'CODE128'): boolean {
  if (!barcode || barcode.trim().length === 0) {
    return false;
  }

  switch (type) {
    case 'CODE128':
      // CODE128 can encode ASCII characters
      // eslint-disable-next-line no-control-regex
      return /^[\x00-\x7F]+$/.test(barcode);
    case 'CODE39':
      // CODE39: alphanumeric + some special chars
      return /^[A-Z0-9\-.$/+%]+$/.test(barcode.toUpperCase());
    case 'EAN13':
      // EAN13: 13 digits
      return /^\d{13}$/.test(barcode);
    case 'EAN8':
      // EAN8: 8 digits
      return /^\d{8}$/.test(barcode);
    default:
      return false;
  }
}

/**
 * Format package number for barcode
 * Ensures consistent format for scanning
 */
export function formatPackageBarcode(packageNumber: string): string {
  // Remove PKG- prefix for barcode if present, keep just the identifier
  return packageNumber.replace(/^PKG-/, '');
}

/**
 * Generate unique barcode for package
 */
export function generatePackageBarcode(
  packageNumber: string,
  productId: string
): string {
  // Format: First 3 chars of product ID + package number without prefix
  const productPrefix = productId.substring(0, 3).toUpperCase();
  const packageSuffix = packageNumber.replace(/^PKG-/, '');
  return `${productPrefix}-${packageSuffix}`;
}

