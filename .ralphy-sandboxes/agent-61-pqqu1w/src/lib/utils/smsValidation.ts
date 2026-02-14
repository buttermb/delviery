/**
 * SMS Character Limit Validation Utilities
 * Handles SMS message validation, truncation, and splitting
 */

const SMS_CHAR_LIMIT = 160;
const SMS_MULTIPART_LIMIT = 153; // Each part of multipart SMS has 7 chars for header

export interface SMSValidationResult {
  isValid: boolean;
  originalLength: number;
  truncatedMessage?: string;
  splitMessages?: string[];
  warningMessage?: string;
  partCount: number;
}

/**
 * Validate SMS message and return validation result with suggestions
 */
export function validateSMS(message: string): SMSValidationResult {
  const originalLength = message.length;
  
  if (originalLength <= SMS_CHAR_LIMIT) {
    return {
      isValid: true,
      originalLength,
      partCount: 1,
    };
  }

  // Calculate how many parts this would need
  const partCount = Math.ceil(originalLength / SMS_MULTIPART_LIMIT);
  
  return {
    isValid: false,
    originalLength,
    truncatedMessage: truncateSMS(message),
    splitMessages: splitSMS(message),
    warningMessage: `Message exceeds ${SMS_CHAR_LIMIT} characters (${originalLength} chars). Will be sent as ${partCount} messages.`,
    partCount,
  };
}

/**
 * Truncate SMS to fit within single message limit
 */
export function truncateSMS(message: string, limit: number = SMS_CHAR_LIMIT - 3): string {
  if (message.length <= limit + 3) return message;
  return message.substring(0, limit) + '...';
}

/**
 * Split long SMS into multiple messages
 */
export function splitSMS(message: string): string[] {
  if (message.length <= SMS_CHAR_LIMIT) return [message];
  
  const messages: string[] = [];
  let remaining = message;
  let partNum = 1;
  const totalParts = Math.ceil(message.length / SMS_MULTIPART_LIMIT);
  
  while (remaining.length > 0) {
    const partLimit = SMS_MULTIPART_LIMIT - 10; // Leave room for part indicator
    let chunk = remaining.substring(0, partLimit);
    
    // Try to break at word boundary
    if (remaining.length > partLimit) {
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > partLimit * 0.7) {
        chunk = chunk.substring(0, lastSpace);
      }
    }
    
    messages.push(`(${partNum}/${totalParts}) ${chunk}`);
    remaining = remaining.substring(chunk.length).trim();
    partNum++;
  }
  
  return messages;
}

/**
 * Get character count info for SMS UI
 */
export function getSMSCharInfo(message: string): {
  current: number;
  limit: number;
  remaining: number;
  isOverLimit: boolean;
  partCount: number;
  colorClass: string;
} {
  const current = message.length;
  const remaining = SMS_CHAR_LIMIT - current;
  const isOverLimit = current > SMS_CHAR_LIMIT;
  const partCount = isOverLimit ? Math.ceil(current / SMS_MULTIPART_LIMIT) : 1;
  
  let colorClass = 'text-muted-foreground';
  if (remaining <= 20 && remaining > 0) colorClass = 'text-yellow-500';
  if (remaining <= 0) colorClass = 'text-destructive';
  
  return {
    current,
    limit: SMS_CHAR_LIMIT,
    remaining,
    isOverLimit,
    partCount,
    colorClass,
  };
}

/**
 * Sanitize SMS message - remove problematic characters
 */
export function sanitizeSMS(message: string): string {
  return message
    // Replace smart quotes with regular quotes
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Replace em/en dashes with regular dashes
    .replace(/[\u2013\u2014]/g, '-')
    // Replace ellipsis character with three dots
    .replace(/\u2026/g, '...')
    // Remove non-GSM characters that might cause issues
    .replace(/[^\x00-\x7F]/g, '');
}
