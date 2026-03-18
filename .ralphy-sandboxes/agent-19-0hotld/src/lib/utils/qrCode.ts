import { logger } from '@/lib/logger';

export interface QRCodeOptions {
  size?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Lazy-load the qrcode library on first use.
 * Cached after initial import so subsequent calls are instant.
 */
let qrCodeModule: typeof import('qrcode') | null = null;

async function getQRCode(): Promise<typeof import('qrcode')> {
  if (!qrCodeModule) {
    qrCodeModule = await import('qrcode');
  }
  return qrCodeModule;
}

/**
 * Generate QR code as data URL (for img src)
 */
export async function generateQRCodeDataURL(
  text: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const {
    size = 256,
    margin = 2,
    color = {
      dark: '#000000',
      light: '#FFFFFF',
    },
  } = options;

  try {
    const QRCode = await getQRCode();
    const dataURL = await QRCode.toDataURL(text, {
      width: size,
      margin,
      color,
      errorCorrectionLevel: 'M',
    });
    return dataURL;
  } catch (error) {
    logger.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(
  text: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const {
    size = 256,
    margin = 2,
    color = {
      dark: '#000000',
      light: '#FFFFFF',
    },
  } = options;

  try {
    const QRCode = await getQRCode();
    const svg = await QRCode.toString(text, {
      type: 'svg',
      width: size,
      margin,
      color,
      errorCorrectionLevel: 'M',
    });
    return svg;
  } catch (error) {
    logger.error('Error generating QR code SVG:', error);
    throw new Error('Failed to generate QR code SVG');
  }
}

/**
 * Download QR code as PNG file
 */
export async function downloadQRCodePNG(
  text: string,
  filename: string = 'qrcode.png',
  options: QRCodeOptions = {}
): Promise<void> {
  try {
    const dataURL = await generateQRCodeDataURL(text, options);
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    logger.error('Error downloading QR code:', error);
    throw new Error('Failed to download QR code');
  }
}

/**
 * Generate QR code with logo overlay (for future enhancement)
 */
export async function generateQRCodeWithLogo(
  text: string,
  logoUrl: string,
  options: QRCodeOptions = {}
): Promise<string> {
  // This would require canvas manipulation
  // For now, return basic QR code
  return generateQRCodeDataURL(text, options);
}
