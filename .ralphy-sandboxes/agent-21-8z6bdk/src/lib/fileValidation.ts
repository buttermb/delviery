/**
 * File Upload Security Validation Utilities
 *
 * This module provides comprehensive file validation to prevent:
 * - Malicious file uploads (executable files, scripts)
 * - MIME type spoofing attacks
 * - Oversized file uploads
 * - Path traversal attacks
 * - Double extension attacks
 */

import { logger } from '@/lib/logger';

// Magic bytes for common file types
const FILE_SIGNATURES: Record<string, Uint8Array[]> = {
  // Images
  'image/jpeg': [new Uint8Array([0xff, 0xd8, 0xff])],
  'image/png': [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  'image/gif': [
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  ],
  'image/webp': [new Uint8Array([0x52, 0x49, 0x46, 0x46])], // RIFF header, need additional check for WEBP
  'image/svg+xml': [], // Text-based, check differently
  // Documents
  'application/pdf': [new Uint8Array([0x25, 0x50, 0x44, 0x46])], // %PDF
  // Excel/CSV - xlsx is a zip file
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
  ], // PK (ZIP header)
  'application/vnd.ms-excel': [
    new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  ], // OLE header
  'text/csv': [], // Text-based
  'text/plain': [], // Text-based
};

// Dangerous file extensions that should always be blocked
const DANGEROUS_EXTENSIONS = new Set([
  // Executables
  'exe', 'dll', 'com', 'bat', 'cmd', 'msi', 'scr', 'pif',
  // Scripts
  'js', 'vbs', 'vbe', 'jse', 'wsf', 'wsh', 'ps1', 'psm1',
  // Web shells
  'php', 'php3', 'php4', 'php5', 'phtml', 'asp', 'aspx',
  'jsp', 'jspx', 'cgi', 'pl', 'py', 'rb',
  // Archives that might contain malware
  'jar', 'war',
  // Other dangerous
  'hta', 'htaccess', 'ini', 'reg', 'lnk', 'url',
  // macOS specific
  'app', 'dmg', 'pkg',
  // Linux specific
  'sh', 'bash', 'zsh', 'deb', 'rpm',
]);

// File size limits by category (in bytes)
export const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB
  document: 25 * 1024 * 1024, // 25MB
  spreadsheet: 50 * 1024 * 1024, // 50MB
  default: 10 * 1024 * 1024, // 10MB
} as const;

// Allowed MIME types by upload context
export const ALLOWED_MIME_TYPES = {
  productImage: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  idVerification: ['image/jpeg', 'image/png', 'image/webp'],
  coaDocument: ['application/pdf', 'image/jpeg', 'image/png'],
  complianceDocument: ['application/pdf', 'image/jpeg', 'image/png'],
  deliveryPhoto: ['image/jpeg', 'image/png'],
  barcode: ['image/svg+xml', 'image/png'],
  dataImport: [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
  ],
} as const;

export type UploadContext = keyof typeof ALLOWED_MIME_TYPES;

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedFileName?: string;
  detectedMimeType?: string;
}

export interface FileValidationOptions {
  context: UploadContext;
  maxSize?: number;
  allowedTypes?: string[];
}

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
export function sanitizeFileName(fileName: string): string {
  // Remove path components (forward and backward slashes)
  let sanitized = fileName.replace(/^.*[\\/]/, '');

  // Remove null bytes and other control characters
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '');

  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '_');

  // Handle double extensions (e.g., file.php.jpg)
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    // Check if any middle part is a dangerous extension
    for (let i = 1; i < parts.length - 1; i++) {
      if (DANGEROUS_EXTENSIONS.has(parts[i].toLowerCase())) {
        // Remove the dangerous extension
        parts.splice(i, 1);
        i--;
      }
    }
    sanitized = parts.join('.');
  }

  // Limit filename length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop() ?? '';
    const name = sanitized.substring(0, 255 - ext.length - 1);
    sanitized = `${name}.${ext}`;
  }

  // Ensure filename is not empty
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    sanitized = `file_${Date.now()}`;
  }

  return sanitized;
}

/**
 * Check file extension against allowed list
 */
export function isExtensionAllowed(
  fileName: string,
  allowedExtensions: string[]
): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  // Always reject dangerous extensions
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return false;
  }

  return allowedExtensions.some((allowed) => {
    if (allowed.startsWith('.')) {
      return ext === allowed.slice(1).toLowerCase();
    }
    return ext === allowed.toLowerCase();
  });
}

/**
 * Detect MIME type from file content using magic bytes
 */
export async function detectMimeType(file: File): Promise<string | null> {
  try {
    // Read first 16 bytes for signature detection
    const buffer = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
      for (const signature of signatures) {
        if (signature.length === 0) continue; // Skip text-based formats

        let matches = true;
        for (let i = 0; i < signature.length; i++) {
          if (bytes[i] !== signature[i]) {
            matches = false;
            break;
          }
        }

        if (matches) {
          // Special case for WEBP (RIFF container)
          if (mimeType === 'image/webp' && bytes.length >= 12) {
            const webpMarker = new Uint8Array([0x57, 0x45, 0x42, 0x50]); // WEBP
            const isWebp = bytes[8] === webpMarker[0] &&
                          bytes[9] === webpMarker[1] &&
                          bytes[10] === webpMarker[2] &&
                          bytes[11] === webpMarker[3];
            if (!isWebp) continue;
          }
          return mimeType;
        }
      }
    }

    // For text-based formats, check content
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      const text = await file.slice(0, 1024).text();
      // Basic CSV validation - should contain commas or semicolons
      if (text.includes(',') || text.includes(';') || text.includes('\t')) {
        return 'text/csv';
      }
    }

    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      const text = await file.slice(0, 1024).text();
      // Check for SVG declaration
      if (text.includes('<svg') || text.includes('<?xml')) {
        // Security: Check for dangerous SVG content
        const dangerousSvgPatterns = [
          /<script/i,
          /javascript:/i,
          /on\w+\s*=/i, // onclick, onerror, etc.
          /<foreignObject/i,
          /<iframe/i,
          /<embed/i,
        ];

        for (const pattern of dangerousSvgPatterns) {
          if (pattern.test(text)) {
            logger.warn('Dangerous SVG content detected', {
              pattern: pattern.toString(),
              fileName: file.name
            });
            return null; // Reject dangerous SVG
          }
        }

        return 'image/svg+xml';
      }
    }

    return null;
  } catch (error) {
    logger.error('Error detecting MIME type', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get allowed extensions from MIME types
 */
function getExtensionsFromMimeTypes(mimeTypes: readonly string[]): string[] {
  const mimeToExt: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif'],
    'image/webp': ['webp'],
    'image/svg+xml': ['svg'],
    'application/pdf': ['pdf'],
    'text/csv': ['csv'],
    'text/plain': ['txt'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
    'application/vnd.ms-excel': ['xls'],
  };

  const extensions: string[] = [];
  for (const mime of mimeTypes) {
    const exts = mimeToExt[mime];
    if (exts) {
      extensions.push(...exts);
    }
  }
  return extensions;
}

/**
 * Comprehensive file validation
 */
export async function validateFile(
  file: File,
  options: FileValidationOptions
): Promise<FileValidationResult> {
  const { context, maxSize, allowedTypes } = options;
  const contextAllowedTypes = allowedTypes || ALLOWED_MIME_TYPES[context];

  // 1. Check file size
  const sizeLimit = maxSize || getSizeLimitForContext(context);
  if (file.size > sizeLimit) {
    return {
      isValid: false,
      error: `File size exceeds maximum allowed size of ${formatFileSize(sizeLimit)}`,
    };
  }

  // 2. Check file size is not zero
  if (file.size === 0) {
    return {
      isValid: false,
      error: 'File is empty',
    };
  }

  // 3. Sanitize filename
  const sanitizedFileName = sanitizeFileName(file.name);

  // 4. Check extension
  const allowedExtensions = getExtensionsFromMimeTypes(contextAllowedTypes);
  if (!isExtensionAllowed(sanitizedFileName, allowedExtensions)) {
    return {
      isValid: false,
      error: `File extension not allowed. Allowed: ${allowedExtensions.join(', ')}`,
    };
  }

  // 5. Verify MIME type matches extension (prevent spoofing)
  const detectedMimeType = await detectMimeType(file);

  // For images and PDFs, we require magic byte verification
  const requiresMagicByteVerification = contextAllowedTypes.some(
    (t) => t.startsWith('image/') || t === 'application/pdf'
  );

  if (requiresMagicByteVerification) {
    if (!detectedMimeType) {
      // For some file types, detection might fail but browser type might be correct
      if (!(contextAllowedTypes as readonly string[]).includes(file.type)) {
        return {
          isValid: false,
          error: 'Unable to verify file type. Please upload a valid file.',
        };
      }
    } else if (!(contextAllowedTypes as readonly string[]).includes(detectedMimeType)) {
      return {
        isValid: false,
        error: `File content does not match expected type. Detected: ${detectedMimeType}`,
      };
    }
  }

  // 6. For text-based files (CSV), do basic content validation
  if (context === 'dataImport' && file.name.endsWith('.csv')) {
    const validationResult = await validateCsvContent(file);
    if (!validationResult.isValid) {
      return validationResult;
    }
  }

  return {
    isValid: true,
    sanitizedFileName,
    detectedMimeType: detectedMimeType || file.type,
  };
}

/**
 * Validate CSV content for basic security
 */
async function validateCsvContent(file: File): Promise<FileValidationResult> {
  try {
    // Read first 10KB to check for formula injection
    let text: string;
    try {
      // Try using the text() method first
      const slice = file.slice(0, 10240);
      text = await slice.text();
    } catch {
      // Fallback to FileReader for older environments
      text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file.slice(0, 10240));
      });
    }

    // Check for CSV formula injection patterns
    // These can be used in DDE attacks when opened in Excel

    // Only flag if it looks intentional (not just data that happens to start with these)
    const lines = text.split('\n').slice(0, 100); // Check first 100 lines
    for (const line of lines) {
      const cells = line.split(/[,;\t]/);
      for (const cell of cells) {
        const trimmed = cell.trim().replace(/^["']|["']$/g, ''); // Remove quotes

        // Check for obvious formula injection
        if (/^[=@+!].*\(.*\)/.test(trimmed)) {
          logger.warn('Potential CSV formula injection detected', {
            cell: trimmed.substring(0, 50),
            fileName: file.name
          });
          return {
            isValid: false,
            error: 'File contains potentially dangerous formula content',
          };
        }

        // Check for DDE commands
        if (/^=cmd\|/i.test(trimmed) || /^=HYPERLINK/i.test(trimmed)) {
          return {
            isValid: false,
            error: 'File contains potentially dangerous content',
          };
        }
      }
    }

    return { isValid: true };
  } catch (error) {
    // If we can't read the file, log but don't fail validation
    // The extension check already passed at this point
    logger.warn('Could not validate CSV content, allowing based on extension', {
      error: error instanceof Error ? error.message : String(error),
      fileName: file.name
    });
    return { isValid: true };
  }
}

/**
 * Get size limit for upload context
 */
function getSizeLimitForContext(context: UploadContext): number {
  switch (context) {
    case 'productImage':
    case 'idVerification':
    case 'deliveryPhoto':
      return FILE_SIZE_LIMITS.image;
    case 'coaDocument':
    case 'complianceDocument':
      return FILE_SIZE_LIMITS.document;
    case 'dataImport':
      return FILE_SIZE_LIMITS.spreadsheet;
    default:
      return FILE_SIZE_LIMITS.default;
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generate a secure storage path
 */
export function generateSecureStoragePath(
  fileName: string,
  prefix: string,
  tenantId?: string
): string {
  const sanitized = sanitizeFileName(fileName);
  const ext = sanitized.split('.').pop() ?? '';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);

  // Generate unique filename to prevent overwrites and enumeration
  const secureFileName = `${timestamp}-${random}.${ext}`;

  if (tenantId) {
    return `${tenantId}/${prefix}/${secureFileName}`;
  }

  return `${prefix}/${secureFileName}`;
}

/**
 * Validate image dimensions (optional, for client-side preview validation)
 */
export async function validateImageDimensions(
  file: File,
  maxWidth: number,
  maxHeight: number
): Promise<{ isValid: boolean; width?: number; height?: number; error?: string }> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ isValid: false, error: 'File is not an image' });
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      if (img.width > maxWidth || img.height > maxHeight) {
        resolve({
          isValid: false,
          width: img.width,
          height: img.height,
          error: `Image dimensions (${img.width}x${img.height}) exceed maximum (${maxWidth}x${maxHeight})`,
        });
      } else {
        resolve({
          isValid: true,
          width: img.width,
          height: img.height,
        });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ isValid: false, error: 'Failed to load image for validation' });
    };

    img.src = url;
  });
}
