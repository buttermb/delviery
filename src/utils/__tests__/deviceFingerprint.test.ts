/**
 * deviceFingerprint Utility Tests
 *
 * Tests:
 * 1. Generates consistent fingerprints from the same device
 * 2. Detects device type (desktop/mobile/tablet)
 * 3. Detects browser (Chrome/Firefox/Safari/Edge)
 * 4. Detects OS (Windows/MacOS/Linux/Android/iOS)
 * 5. Returns expected DeviceInfo shape
 * 6. Hash function produces deterministic output
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger before importing
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock canvas
const mockGetContext = vi.fn(() => ({
  textBaseline: '',
  font: '',
  fillText: vi.fn(),
}));

const mockToDataURL = vi.fn(
  () => 'data:image/png;base64,abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnop'
);

vi.stubGlobal('document', {
  createElement: vi.fn(() => ({
    getContext: mockGetContext,
    toDataURL: mockToDataURL,
  })),
});

// Mock screen
vi.stubGlobal('screen', {
  colorDepth: 24,
  width: 1920,
  height: 1080,
});

// Mock Intl
vi.stubGlobal('Intl', {
  DateTimeFormat: vi.fn(() => ({
    resolvedOptions: vi.fn(() => ({ timeZone: 'America/New_York' })),
  })),
});

describe('deviceFingerprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default navigator values
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      value: 8,
      writable: true,
      configurable: true,
    });
  });

  describe('generateDeviceFingerprint', () => {
    it('should return a DeviceInfo object with all required fields', async () => {
      const { generateDeviceFingerprint } = await import(
        '@/utils/deviceFingerprint'
      );
      const result = generateDeviceFingerprint();

      expect(result).toHaveProperty('fingerprint');
      expect(result).toHaveProperty('deviceType');
      expect(result).toHaveProperty('browser');
      expect(result).toHaveProperty('os');
      expect(result).toHaveProperty('screenResolution');
      expect(result).toHaveProperty('timezone');
      expect(result).toHaveProperty('language');
    });

    it('should generate a non-empty fingerprint string', async () => {
      const { generateDeviceFingerprint } = await import(
        '@/utils/deviceFingerprint'
      );
      const result = generateDeviceFingerprint();

      expect(typeof result.fingerprint).toBe('string');
      expect(result.fingerprint.length).toBeGreaterThan(0);
    });

    it('should generate consistent fingerprints for the same input', async () => {
      const { generateDeviceFingerprint } = await import(
        '@/utils/deviceFingerprint'
      );
      const result1 = generateDeviceFingerprint();
      const result2 = generateDeviceFingerprint();

      expect(result1.fingerprint).toBe(result2.fingerprint);
    });

    it('should detect desktop device type', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
        configurable: true,
      });

      const { generateDeviceFingerprint } = await import(
        '@/utils/deviceFingerprint'
      );
      const result = generateDeviceFingerprint();

      expect(result.deviceType).toBe('desktop');
    });

    it('should detect mobile device type', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        configurable: true,
      });

      const { generateDeviceFingerprint } = await import(
        '@/utils/deviceFingerprint'
      );
      const result = generateDeviceFingerprint();

      expect(result.deviceType).toBe('mobile');
    });

    it('should detect tablet device type', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true,
      });

      const { generateDeviceFingerprint } = await import(
        '@/utils/deviceFingerprint'
      );
      const result = generateDeviceFingerprint();

      expect(result.deviceType).toBe('tablet');
    });

    it('should detect Chrome browser', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'mozilla/5.0 chrome/120.0.0.0',
        configurable: true,
      });

      const { generateDeviceFingerprint } = await import(
        '@/utils/deviceFingerprint'
      );
      const result = generateDeviceFingerprint();

      expect(result.browser).toBe('Chrome');
    });

    it('should detect Firefox browser', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'mozilla/5.0 firefox/120.0',
        configurable: true,
      });

      const { generateDeviceFingerprint } = await import(
        '@/utils/deviceFingerprint'
      );
      const result = generateDeviceFingerprint();

      expect(result.browser).toBe('Firefox');
    });

    it('should detect MacOS', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'mozilla/5.0 (macintosh; intel mac os x 10_15_7) chrome/120',
        configurable: true,
      });

      const { generateDeviceFingerprint } = await import(
        '@/utils/deviceFingerprint'
      );
      const result = generateDeviceFingerprint();

      expect(result.os).toBe('MacOS');
    });

    it('should detect Windows', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'mozilla/5.0 (windows nt 10.0; win64; x64) chrome/120',
        configurable: true,
      });

      const { generateDeviceFingerprint } = await import(
        '@/utils/deviceFingerprint'
      );
      const result = generateDeviceFingerprint();

      expect(result.os).toBe('Windows');
    });

    it('should return screen resolution as WxH format', async () => {
      const { generateDeviceFingerprint } = await import(
        '@/utils/deviceFingerprint'
      );
      const result = generateDeviceFingerprint();

      expect(result.screenResolution).toBe('1920x1080');
    });

    it('should return timezone from Intl', async () => {
      const { generateDeviceFingerprint } = await import(
        '@/utils/deviceFingerprint'
      );
      const result = generateDeviceFingerprint();

      expect(result.timezone).toBe('America/New_York');
    });

    it('should return navigator language', async () => {
      const { generateDeviceFingerprint } = await import(
        '@/utils/deviceFingerprint'
      );
      const result = generateDeviceFingerprint();

      expect(result.language).toBe('en-US');
    });
  });

  describe('getDeviceFingerprint', () => {
    it('should return just the fingerprint string', async () => {
      const { getDeviceFingerprint } = await import(
        '@/utils/deviceFingerprint'
      );
      const fingerprint = await getDeviceFingerprint();

      expect(typeof fingerprint).toBe('string');
      expect(fingerprint.length).toBeGreaterThan(0);
    });
  });

  describe('getReferralCode', () => {
    it('should return null when no ref parameter present', async () => {
      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
        configurable: true,
      });

      const { getReferralCode } = await import('@/utils/deviceFingerprint');
      expect(getReferralCode()).toBeNull();
    });

    it('should extract ref parameter from URL', async () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?ref=ABC123' },
        writable: true,
        configurable: true,
      });

      const { getReferralCode } = await import('@/utils/deviceFingerprint');
      expect(getReferralCode()).toBe('ABC123');
    });
  });
});
