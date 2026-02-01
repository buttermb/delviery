/**
 * Generate a unique barcode for a product
 */
export function generateBarcode(prefix: string = 'PRD'): string {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${timestamp}${random}`;
}

/**
 * Validate barcode format
 */
export function validateBarcode(barcode: string): boolean {
  // Basic validation - can be enhanced based on specific formats
  return barcode.length >= 5 && /^[A-Z0-9-]+$/.test(barcode);
}

/**
 * Format barcode for display
 */
export function formatBarcode(barcode: string): string {
  return barcode.toUpperCase().replace(/\s+/g, '-');
}

/**
 * Generate multiple barcodes for bulk creation
 */
export function generateBulkBarcodes(count: number, prefix: string = 'PRD'): string[] {
  const barcodes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Add small delay to ensure uniqueness
    const barcode = generateBarcode(prefix);
    barcodes.push(barcode);
  }
  return barcodes;
}

/**
 * Calculate expected profit for fronted inventory
 */
export function calculateExpectedProfit(
  quantity: number,
  costPerUnit: number,
  pricePerUnit: number
): {
  expectedRevenue: number;
  totalCost: number;
  expectedProfit: number;
  profitMargin: number;
} {
  const expectedRevenue = quantity * pricePerUnit;
  const totalCost = quantity * costPerUnit;
  const expectedProfit = expectedRevenue - totalCost;
  const profitMargin = totalCost > 0 ? (expectedProfit / totalCost) * 100 : 0;

  return {
    expectedRevenue,
    totalCost,
    expectedProfit,
    profitMargin
  };
}

/**
 * Check if payment is overdue
 */
export function isPaymentOverdue(dueDate: string | Date, paymentStatus: string): boolean {
  if (paymentStatus === 'paid') return false;
  return new Date(dueDate) < new Date();
}

/**
 * Calculate days until due or overdue
 */
export function calculateDaysDifference(dueDate: string | Date): {
  days: number;
  isOverdue: boolean;
} {
  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return {
    days: Math.abs(diffDays),
    isOverdue: diffDays < 0
  };
}
