/**
 * Format Detection for Menu Migration
 * Detects input format: Excel, CSV, text, or image
 */

import type { InputFormat, FormatDetectionResult } from '@/types/migration';

// Magic bytes for file type detection
const FILE_SIGNATURES = {
  xlsx: [0x50, 0x4b, 0x03, 0x04], // PK.. (ZIP format)
  xls: [0xd0, 0xcf, 0x11, 0xe0], // OLE2
  png: [0x89, 0x50, 0x4e, 0x47],
  jpg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
} as const;

/**
 * Detect format from file extension
 */
function getFormatFromExtension(filename: string): InputFormat | null {
  const ext = filename.toLowerCase().split('.').pop();
  
  switch (ext) {
    case 'xlsx':
    case 'xls':
      return 'excel';
    case 'csv':
      return 'csv';
    case 'txt':
    case 'text':
      return 'text';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return 'image';
    case 'pdf':
      return 'pdf';
    default:
      return null;
  }
}

/**
 * Detect format from magic bytes
 */
function getFormatFromBytes(bytes: Uint8Array): InputFormat | null {
  const checkSignature = (signature: readonly number[]): boolean => {
    return signature.every((byte, index) => bytes[index] === byte);
  };

  if (checkSignature(FILE_SIGNATURES.xlsx) || checkSignature(FILE_SIGNATURES.xls)) {
    return 'excel';
  }
  if (checkSignature(FILE_SIGNATURES.png) || 
      checkSignature(FILE_SIGNATURES.jpg) || 
      checkSignature(FILE_SIGNATURES.gif)) {
    return 'image';
  }
  if (checkSignature(FILE_SIGNATURES.webp)) {
    // WebP has RIFF header, need to check for WEBP
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image';
    }
  }
  if (checkSignature(FILE_SIGNATURES.pdf)) {
    return 'pdf';
  }

  return null;
}

/**
 * Detect CSV format from content
 */
function isCSVContent(content: string): boolean {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return false;

  // Check for common delimiters
  const delimiters = [',', '\t', ';', '|'];
  
  for (const delimiter of delimiters) {
    const firstLineCount = (lines[0].match(new RegExp(`\\${delimiter}`, 'g')) ?? []).length;
    if (firstLineCount >= 2) {
      // Check if second line has similar structure
      const secondLineCount = (lines[1].match(new RegExp(`\\${delimiter}`, 'g')) ?? []).length;
      if (Math.abs(firstLineCount - secondLineCount) <= 1) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detect if content looks like a cannabis menu
 */
function looksLikeCannabisMenu(content: string): boolean {
  const cannabisKeywords = [
    /\b(strain|flower|indica|sativa|hybrid|thc|cbd|oz|ounce|lb|pound|qp|zip|eighth|quarter|half)\b/i,
    /\$\s*\d+/,
    /\d+\s*%\s*(thc|cbd)/i,
    /\b(indoor|outdoor|greenhouse|exotic|deps?|light\s*dep)\b/i,
    /\b(og|kush|haze|diesel|cookies|gelato|runtz|zkittlez)\b/i,
  ];

  const matchCount = cannabisKeywords.filter(regex => regex.test(content)).length;
  return matchCount >= 2;
}

/**
 * Calculate confidence score for format detection
 */
function calculateConfidence(
  format: InputFormat,
  hasExtension: boolean,
  hasMagicBytes: boolean,
  contentAnalysis: boolean
): number {
  let confidence = 0.5;

  if (hasMagicBytes) confidence += 0.3;
  if (hasExtension) confidence += 0.15;
  if (contentAnalysis) confidence += 0.05;

  return Math.min(confidence, 1);
}

/**
 * Detect the format of input data
 */
export async function detectFormat(input: File | string): Promise<FormatDetectionResult> {
  // Handle string input (pasted text)
  if (typeof input === 'string') {
    const trimmed = input.trim();
    
    // Check if it's a data URL (image)
    if (trimmed.startsWith('data:image/')) {
      return {
        format: 'image',
        confidence: 0.95,
        mimeType: trimmed.split(';')[0].replace('data:', ''),
      };
    }

    // Check if it looks like CSV
    if (isCSVContent(trimmed)) {
      return {
        format: 'csv',
        confidence: looksLikeCannabisMenu(trimmed) ? 0.9 : 0.75,
        detectedDelimiter: detectDelimiter(trimmed),
      };
    }

    // Default to text
    return {
      format: 'text',
      confidence: looksLikeCannabisMenu(trimmed) ? 0.85 : 0.7,
    };
  }

  // Handle File input
  const file = input;
  const extensionFormat = getFormatFromExtension(file.name);
  
  // Read first bytes for magic number detection
  const buffer = await file.slice(0, 32).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const bytesFormat = getFormatFromBytes(bytes);

  // Determine final format
  let format: InputFormat = 'text';
  let confidence = 0.5;
  const mimeType = file.type;

  if (bytesFormat) {
    format = bytesFormat;
    confidence = calculateConfidence(format, !!extensionFormat, true, false);
  } else if (extensionFormat) {
    format = extensionFormat;
    confidence = calculateConfidence(format, true, false, false);
  } else if (file.type) {
    // Fall back to MIME type
    if (file.type.includes('excel') || file.type.includes('spreadsheet')) {
      format = 'excel';
    } else if (file.type === 'text/csv') {
      format = 'csv';
    } else if (file.type.startsWith('image/')) {
      format = 'image';
    } else if (file.type === 'application/pdf') {
      format = 'pdf';
    }
    confidence = 0.7;
  }

  // For text/csv, analyze content
  if (format === 'text' || format === 'csv') {
    const textContent = await file.text();
    if (isCSVContent(textContent)) {
      format = 'csv';
      confidence = 0.8;
    }
    if (looksLikeCannabisMenu(textContent)) {
      confidence += 0.1;
    }
  }

  return {
    format,
    confidence: Math.min(confidence, 1),
    mimeType,
    fileName: file.name,
    fileSize: file.size,
    detectedDelimiter: format === 'csv' ? await detectDelimiterFromFile(file) : undefined,
  };
}

/**
 * Detect CSV delimiter from content
 */
function detectDelimiter(content: string): ',' | '\t' | ';' | '|' {
  const lines = content.trim().split('\n').slice(0, 5);
  const delimiters: Array<',' | '\t' | ';' | '|'> = [',', '\t', ';', '|'];
  
  let bestDelimiter: ',' | '\t' | ';' | '|' = ',';
  let bestConsistency = 0;

  for (const delimiter of delimiters) {
    const counts = lines.map(line => (line.match(new RegExp(`\\${delimiter}`, 'g')) ?? []).length);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - avg, 2), 0) / counts.length;
    
    // Lower variance = more consistent = better
    const consistency = avg > 0 ? avg / (variance + 1) : 0;
    
    if (consistency > bestConsistency) {
      bestConsistency = consistency;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

/**
 * Detect delimiter from file
 */
async function detectDelimiterFromFile(file: File): Promise<',' | '\t' | ';' | '|'> {
  const content = await file.slice(0, 5000).text();
  return detectDelimiter(content);
}

/**
 * Validate that the input can be processed
 */
export function validateInput(result: FormatDetectionResult): { valid: boolean; error?: string } {
  if (result.confidence < 0.3) {
    return { valid: false, error: 'Unable to confidently detect file format' };
  }

  if (result.format === 'pdf') {
    return { valid: false, error: 'PDF files require OCR processing. Please use the image upload option or convert to Excel/CSV.' };
  }

  if (result.fileSize && result.fileSize > 10 * 1024 * 1024) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }

  return { valid: true };
}

export { detectDelimiter, isCSVContent, looksLikeCannabisMenu };




