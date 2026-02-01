/**
 * File Upload Security Validation Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeFileName,
  isExtensionAllowed,
  validateFile,
  generateSecureStoragePath,
  formatFileSize,
  FILE_SIZE_LIMITS,
  ALLOWED_MIME_TYPES,
} from './fileValidation';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('sanitizeFileName', () => {
  it('should remove path components', () => {
    expect(sanitizeFileName('/path/to/file.jpg')).toBe('file.jpg');
    expect(sanitizeFileName('C:\\Users\\test\\file.jpg')).toBe('file.jpg');
  });

  it('should remove dangerous characters', () => {
    expect(sanitizeFileName('file<script>.jpg')).toBe('file_script_.jpg');
    expect(sanitizeFileName('file"test".jpg')).toBe('file_test_.jpg');
    expect(sanitizeFileName('file|pipe.jpg')).toBe('file_pipe.jpg');
  });

  it('should handle double extensions with dangerous extensions', () => {
    expect(sanitizeFileName('file.php.jpg')).toBe('file.jpg');
    expect(sanitizeFileName('file.exe.png')).toBe('file.png');
    expect(sanitizeFileName('file.js.html')).toBe('file.html');
  });

  it('should preserve safe double extensions', () => {
    expect(sanitizeFileName('file.min.jpg')).toBe('file.min.jpg');
    expect(sanitizeFileName('archive.tar.gz')).toBe('archive.tar.gz');
  });

  it('should remove null bytes and control characters', () => {
    expect(sanitizeFileName('file\x00.jpg')).toBe('file.jpg');
    expect(sanitizeFileName('file\x1f.jpg')).toBe('file.jpg');
  });

  it('should handle empty or invalid filenames', () => {
    expect(sanitizeFileName('')).toMatch(/^file_\d+$/);
    expect(sanitizeFileName('.')).toMatch(/^file_\d+$/);
    expect(sanitizeFileName('..')).toMatch(/^file_\d+$/);
  });

  it('should truncate long filenames', () => {
    const longName = 'a'.repeat(300) + '.jpg';
    const result = sanitizeFileName(longName);
    expect(result.length).toBeLessThanOrEqual(255);
    expect(result).toMatch(/\.jpg$/);
  });
});

describe('isExtensionAllowed', () => {
  it('should allow valid extensions', () => {
    expect(isExtensionAllowed('file.jpg', ['jpg', 'png'])).toBe(true);
    expect(isExtensionAllowed('file.png', ['jpg', 'png'])).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(isExtensionAllowed('file.JPG', ['jpg', 'png'])).toBe(true);
    expect(isExtensionAllowed('file.PNG', ['.png'])).toBe(true);
  });

  it('should reject invalid extensions', () => {
    expect(isExtensionAllowed('file.gif', ['jpg', 'png'])).toBe(false);
    expect(isExtensionAllowed('file.pdf', ['jpg', 'png'])).toBe(false);
  });

  it('should always reject dangerous extensions', () => {
    expect(isExtensionAllowed('file.exe', ['exe'])).toBe(false);
    expect(isExtensionAllowed('file.php', ['php'])).toBe(false);
    expect(isExtensionAllowed('file.js', ['js'])).toBe(false);
    expect(isExtensionAllowed('script.bat', ['bat'])).toBe(false);
  });

  it('should handle extensions with dots', () => {
    expect(isExtensionAllowed('file.jpg', ['.jpg'])).toBe(true);
    expect(isExtensionAllowed('file.png', ['.png', '.jpg'])).toBe(true);
  });
});

describe('generateSecureStoragePath', () => {
  it('should generate unique paths', () => {
    const path1 = generateSecureStoragePath('file.jpg', 'images');
    const path2 = generateSecureStoragePath('file.jpg', 'images');
    expect(path1).not.toBe(path2);
  });

  it('should include tenant ID when provided', () => {
    const path = generateSecureStoragePath('file.jpg', 'images', 'tenant-123');
    expect(path).toMatch(/^tenant-123\/images\//);
  });

  it('should preserve file extension', () => {
    const jpgPath = generateSecureStoragePath('photo.jpg', 'images');
    const pngPath = generateSecureStoragePath('photo.png', 'images');
    expect(jpgPath).toMatch(/\.jpg$/);
    expect(pngPath).toMatch(/\.png$/);
  });

  it('should sanitize the filename', () => {
    const path = generateSecureStoragePath('../../../etc/passwd', 'docs');
    expect(path).not.toContain('..');
    expect(path).not.toContain('/etc/');
  });

  it('should include prefix in path', () => {
    const path = generateSecureStoragePath('file.pdf', 'compliance');
    expect(path).toContain('compliance/');
  });
});

describe('formatFileSize', () => {
  it('should format bytes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSize(500)).toBe('500 Bytes');
  });

  it('should format KB', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('should format MB', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatFileSize(10.5 * 1024 * 1024)).toBe('10.5 MB');
  });

  it('should format GB', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });
});

describe('FILE_SIZE_LIMITS', () => {
  it('should have expected size limits', () => {
    expect(FILE_SIZE_LIMITS.image).toBe(10 * 1024 * 1024);
    expect(FILE_SIZE_LIMITS.document).toBe(25 * 1024 * 1024);
    expect(FILE_SIZE_LIMITS.spreadsheet).toBe(50 * 1024 * 1024);
    expect(FILE_SIZE_LIMITS.default).toBe(10 * 1024 * 1024);
  });
});

describe('ALLOWED_MIME_TYPES', () => {
  it('should have expected MIME types for product images', () => {
    expect(ALLOWED_MIME_TYPES.productImage).toContain('image/jpeg');
    expect(ALLOWED_MIME_TYPES.productImage).toContain('image/png');
    expect(ALLOWED_MIME_TYPES.productImage).not.toContain('application/pdf');
  });

  it('should have expected MIME types for ID verification', () => {
    expect(ALLOWED_MIME_TYPES.idVerification).toContain('image/jpeg');
    expect(ALLOWED_MIME_TYPES.idVerification).toContain('image/png');
    expect(ALLOWED_MIME_TYPES.idVerification).not.toContain('application/pdf');
  });

  it('should have expected MIME types for COA documents', () => {
    expect(ALLOWED_MIME_TYPES.coaDocument).toContain('application/pdf');
    expect(ALLOWED_MIME_TYPES.coaDocument).toContain('image/jpeg');
    expect(ALLOWED_MIME_TYPES.coaDocument).toContain('image/png');
  });

  it('should have expected MIME types for data import', () => {
    expect(ALLOWED_MIME_TYPES.dataImport).toContain('text/csv');
    expect(ALLOWED_MIME_TYPES.dataImport).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(ALLOWED_MIME_TYPES.dataImport).not.toContain('image/jpeg');
  });
});

describe('validateFile', () => {
  // Helper to create mock files
  function createMockFile(
    name: string,
    size: number,
    type: string,
    content?: ArrayBuffer
  ): File {
    const blob = content
      ? new Blob([content], { type })
      : new Blob(['x'.repeat(size)], { type });
    return new File([blob], name, { type });
  }

  // JPEG magic bytes
  const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

  // PNG magic bytes
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // PDF magic bytes
  const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

  describe('file size validation', () => {
    it('should reject files exceeding size limit', async () => {
      const largeFile = createMockFile('large.jpg', 20 * 1024 * 1024, 'image/jpeg');
      const result = await validateFile(largeFile, {
        context: 'productImage',
        maxSize: 10 * 1024 * 1024,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should accept files within size limit', async () => {
      const smallFile = createMockFile(
        'small.jpg',
        1024,
        'image/jpeg',
        jpegHeader.buffer as ArrayBuffer
      );
      const result = await validateFile(smallFile, {
        context: 'productImage',
        maxSize: 10 * 1024 * 1024,
      });
      expect(result.isValid).toBe(true);
    });

    it('should reject empty files', async () => {
      const emptyFile = createMockFile('empty.jpg', 0, 'image/jpeg');
      const result = await validateFile(emptyFile, { context: 'productImage' });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('file extension validation', () => {
    it('should reject dangerous extensions', async () => {
      const exeFile = createMockFile('malware.exe', 1024, 'application/x-msdownload');
      const result = await validateFile(exeFile, { context: 'productImage' });
      expect(result.isValid).toBe(false);
    });

    it('should reject unsupported extensions', async () => {
      const docFile = createMockFile('document.docx', 1024, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      const result = await validateFile(docFile, { context: 'productImage' });
      expect(result.isValid).toBe(false);
    });

    it('should accept valid extensions for context', async () => {
      const jpgFile = createMockFile(
        'photo.jpg',
        1024,
        'image/jpeg',
        jpegHeader.buffer as ArrayBuffer
      );
      const result = await validateFile(jpgFile, { context: 'productImage' });
      expect(result.isValid).toBe(true);
    });
  });

  describe('MIME type validation', () => {
    it('should detect JPEG from magic bytes', async () => {
      const jpegFile = createMockFile(
        'test.jpg',
        1024,
        'image/jpeg',
        jpegHeader.buffer as ArrayBuffer
      );
      const result = await validateFile(jpegFile, { context: 'productImage' });
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('image/jpeg');
    });

    it('should detect PNG from magic bytes', async () => {
      const pngFile = createMockFile(
        'test.png',
        1024,
        'image/png',
        pngHeader.buffer as ArrayBuffer
      );
      const result = await validateFile(pngFile, { context: 'productImage' });
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('image/png');
    });

    it('should detect PDF from magic bytes', async () => {
      const pdfFile = createMockFile(
        'test.pdf',
        1024,
        'application/pdf',
        pdfHeader.buffer as ArrayBuffer
      );
      const result = await validateFile(pdfFile, { context: 'coaDocument' });
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('application/pdf');
    });
  });

  describe('filename sanitization', () => {
    it('should sanitize the filename in result', async () => {
      const dangerousFile = createMockFile(
        '../../../etc/passwd.jpg',
        1024,
        'image/jpeg',
        jpegHeader.buffer as ArrayBuffer
      );
      const result = await validateFile(dangerousFile, { context: 'productImage' });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedFileName).toBe('passwd.jpg');
    });

    it('should handle double extension attacks', async () => {
      const doubleExtFile = createMockFile(
        'image.php.jpg',
        1024,
        'image/jpeg',
        jpegHeader.buffer as ArrayBuffer
      );
      const result = await validateFile(doubleExtFile, { context: 'productImage' });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedFileName).toBe('image.jpg');
    });
  });

  describe('context-specific validation', () => {
    it('should allow PDF for compliance documents but not for product images', async () => {
      const pdfFile = createMockFile(
        'doc.pdf',
        1024,
        'application/pdf',
        pdfHeader.buffer as ArrayBuffer
      );

      const complianceResult = await validateFile(pdfFile, { context: 'complianceDocument' });
      expect(complianceResult.isValid).toBe(true);

      const imageResult = await validateFile(pdfFile, { context: 'productImage' });
      expect(imageResult.isValid).toBe(false);
    });

    it('should allow CSV for data import but not for ID verification', async () => {
      const csvContent = 'name,value\ntest,123';
      const csvFile = new File([csvContent], 'data.csv', { type: 'text/csv' });

      // For text-based files (CSV), validation is more lenient since we can't
      // verify magic bytes. The extension check will pass for dataImport context.
      const importResult = await validateFile(csvFile, { context: 'dataImport' });
      expect(importResult.isValid).toBe(true);

      const idResult = await validateFile(csvFile, { context: 'idVerification' });
      // Should fail because CSV extension is not allowed for ID verification
      expect(idResult.isValid).toBe(false);
    });
  });
});
