/**
 * Device Fingerprinting Library
 * 
 * Generates unique browser/device fingerprints for anti-abuse protection.
 * Uses multiple signals to create a reliable identifier.
 */

import { logger } from '@/lib/logger';

// ============================================================================
// Browser API type extensions
// ============================================================================

interface NavigatorWithExtensions extends Navigator {
  connection?: { effectiveType?: string };
  mozConnection?: { effectiveType?: string };
  webkitConnection?: { effectiveType?: string };
  deviceMemory?: number;
}

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// ============================================================================
// Types
// ============================================================================

export interface DeviceFingerprint {
  hash: string;
  components: FingerprintComponents;
  confidence: number;
  timestamp: number;
}

export interface FingerprintComponents {
  // Canvas fingerprint
  canvasHash: string;
  
  // WebGL fingerprint
  webglHash: string;
  webglVendor: string;
  webglRenderer: string;
  
  // Audio fingerprint
  audioHash: string;
  
  // Fonts fingerprint
  fontsHash: string;
  fontsDetected: string[];
  
  // Browser/Device info
  userAgent: string;
  userAgentHash: string;
  language: string;
  languages: string[];
  platform: string;
  timezone: string;
  timezoneOffset: number;
  
  // Screen info
  screenResolution: string;
  availableResolution: string;
  colorDepth: number;
  pixelRatio: number;
  
  // Hardware
  hardwareConcurrency: number;
  deviceMemory: number | null;
  maxTouchPoints: number;
  touchSupport: boolean;
  
  // Storage/Features
  cookieEnabled: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDB: boolean;
  
  // Network
  connectionType: string | null;
  
  // Plugins (legacy)
  pluginsHash: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate SHA-256 hash of a string
 */
async function sha256(str: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Murmurhash3 for quick hashing (non-crypto)
 */
function murmurhash3(str: string, seed = 0): number {
  let h1 = seed;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;

  for (let i = 0; i < str.length; i++) {
    let k1 = str.charCodeAt(i);
    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);
    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = Math.imul(h1, 5) + 0xe6546b64;
  }

  h1 ^= str.length;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

// ============================================================================
// Fingerprint Collection Functions
// ============================================================================

/**
 * Get canvas fingerprint
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    canvas.width = 200;
    canvas.height = 50;

    // Draw various elements
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Fingerprint', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Canvas', 4, 17);

    // Add some curves
    ctx.beginPath();
    ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    const dataUrl = canvas.toDataURL();
    return murmurhash3(dataUrl).toString(16);
  } catch {
    return '';
  }
}

/**
 * Get WebGL fingerprint
 */
function getWebGLFingerprint(): { hash: string; vendor: string; renderer: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) return { hash: '', vendor: '', renderer: '' };

    const webgl = gl as WebGLRenderingContext;
    const debugInfo = webgl.getExtension('WEBGL_debug_renderer_info');
    
    const vendor = debugInfo 
      ? webgl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) 
      : webgl.getParameter(webgl.VENDOR);
    
    const renderer = debugInfo 
      ? webgl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) 
      : webgl.getParameter(webgl.RENDERER);

    const data = [
      vendor,
      renderer,
      webgl.getParameter(webgl.VERSION),
      webgl.getParameter(webgl.SHADING_LANGUAGE_VERSION),
    ].join('|');

    return {
      hash: murmurhash3(data).toString(16),
      vendor: vendor ?? '',
      renderer: renderer ?? '',
    };
  } catch {
    return { hash: '', vendor: '', renderer: '' };
  }
}

/**
 * Get audio fingerprint
 */
async function getAudioFingerprint(): Promise<string> {
  try {
    const AudioContext = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioContext) return '';

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const analyser = context.createAnalyser();
    const gainNode = context.createGain();
    const scriptProcessor = context.createScriptProcessor(4096, 1, 1);

    gainNode.gain.value = 0; // Mute
    oscillator.type = 'triangle';
    oscillator.connect(analyser);
    analyser.connect(scriptProcessor);
    scriptProcessor.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(0);

    const fingerprint = await new Promise<string>((resolve) => {
      scriptProcessor.onaudioprocess = (event) => {
        const output = event.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < output.length; i++) {
          sum += Math.abs(output[i]);
        }
        oscillator.disconnect();
        scriptProcessor.disconnect();
        gainNode.disconnect();
        context.close();
        resolve(murmurhash3(sum.toString()).toString(16));
      };
    });

    return fingerprint;
  } catch {
    return '';
  }
}

/**
 * Detect installed fonts
 */
function getFontsFingerprint(): { hash: string; detected: string[] } {
  const testFonts = [
    'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS',
    'Consolas', 'Courier', 'Courier New', 'Georgia', 'Helvetica',
    'Impact', 'Lucida Console', 'Lucida Sans', 'Microsoft Sans Serif',
    'Monaco', 'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times',
    'Times New Roman', 'Trebuchet MS', 'Verdana', 'Wingdings',
  ];

  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testString = 'mmmmmmmmmmlli';
  const testSize = '72px';

  const span = document.createElement('span');
  span.style.position = 'absolute';
  span.style.left = '-9999px';
  span.style.fontSize = testSize;
  span.style.lineHeight = 'normal';
  span.innerHTML = testString;
  document.body.appendChild(span);

  const baseWidths: Record<string, number> = {};
  const baseHeights: Record<string, number> = {};

  // Get base font dimensions
  for (const baseFont of baseFonts) {
    span.style.fontFamily = baseFont;
    baseWidths[baseFont] = span.offsetWidth;
    baseHeights[baseFont] = span.offsetHeight;
  }

  const detected: string[] = [];

  // Check each test font
  for (const font of testFonts) {
    let fontDetected = false;
    for (const baseFont of baseFonts) {
      span.style.fontFamily = `'${font}', ${baseFont}`;
      if (span.offsetWidth !== baseWidths[baseFont] || 
          span.offsetHeight !== baseHeights[baseFont]) {
        fontDetected = true;
        break;
      }
    }
    if (fontDetected) {
      detected.push(font);
    }
  }

  document.body.removeChild(span);

  return {
    hash: murmurhash3(detected.join(',')).toString(16),
    detected,
  };
}

/**
 * Get plugins hash (legacy, mostly empty in modern browsers)
 */
function getPluginsHash(): string {
  try {
    const plugins = navigator.plugins;
    const pluginData: string[] = [];
    
    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];
      pluginData.push(`${plugin.name}|${plugin.filename}`);
    }
    
    return murmurhash3(pluginData.join(';')).toString(16);
  } catch {
    return '';
  }
}

/**
 * Get connection type if available
 */
function getConnectionType(): string | null {
  try {
    const nav = navigator as NavigatorWithExtensions;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    return connection?.effectiveType || null;
  } catch {
    return null;
  }
}

// ============================================================================
// Main Fingerprint Function
// ============================================================================

/**
 * Generate complete device fingerprint
 */
export async function generateFingerprint(): Promise<DeviceFingerprint> {
  try {
    // Collect canvas fingerprint
    const canvasHash = getCanvasFingerprint();

    // Collect WebGL fingerprint
    const webgl = getWebGLFingerprint();

    // Collect audio fingerprint (async)
    const audioHash = await getAudioFingerprint();

    // Collect fonts fingerprint
    const fonts = getFontsFingerprint();

    // Collect user agent info
    const userAgent = navigator.userAgent;
    const userAgentHash = murmurhash3(userAgent).toString(16);

    // Collect other browser info
    const language = navigator.language;
    const languages = Array.from(navigator.languages || [language]);
    const platform = navigator.platform;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezoneOffset = new Date().getTimezoneOffset();

    // Collect screen info
    const screenResolution = `${screen.width}x${screen.height}`;
    const availableResolution = `${screen.availWidth}x${screen.availHeight}`;
    const colorDepth = screen.colorDepth;
    const pixelRatio = window.devicePixelRatio || 1;

    // Collect hardware info
    const hardwareConcurrency = navigator.hardwareConcurrency ?? 0;
    const deviceMemory = (navigator as NavigatorWithExtensions).deviceMemory ?? null;
    const maxTouchPoints = navigator.maxTouchPoints ?? 0;
    const touchSupport = 'ontouchstart' in window || maxTouchPoints > 0;

    // Check storage capabilities
    const cookieEnabled = navigator.cookieEnabled;
    let localStorage = false;
    let sessionStorage = false;
    let indexedDB = false;

    try {
      localStorage = !!window.localStorage;
      window.localStorage.setItem('__fp_test__', '1');
      window.localStorage.removeItem('__fp_test__');
    } catch {
      localStorage = false;
    }

    try {
      sessionStorage = !!window.sessionStorage;
      window.sessionStorage.setItem('__fp_test__', '1');
      window.sessionStorage.removeItem('__fp_test__');
    } catch {
      sessionStorage = false;
    }

    try {
      indexedDB = !!window.indexedDB;
    } catch {
      indexedDB = false;
    }

    // Get connection type
    const connectionType = getConnectionType();

    // Get plugins hash
    const pluginsHash = getPluginsHash();

    // Compile components
    const components: FingerprintComponents = {
      canvasHash,
      webglHash: webgl.hash,
      webglVendor: webgl.vendor,
      webglRenderer: webgl.renderer,
      audioHash,
      fontsHash: fonts.hash,
      fontsDetected: fonts.detected,
      userAgent,
      userAgentHash,
      language,
      languages,
      platform,
      timezone,
      timezoneOffset,
      screenResolution,
      availableResolution,
      colorDepth,
      pixelRatio,
      hardwareConcurrency,
      deviceMemory,
      maxTouchPoints,
      touchSupport,
      cookieEnabled,
      localStorage,
      sessionStorage,
      indexedDB,
      connectionType,
      pluginsHash,
    };

    // Generate combined hash
    const fingerprintString = [
      canvasHash,
      webgl.hash,
      audioHash,
      fonts.hash,
      userAgentHash,
      platform,
      timezone,
      screenResolution,
      colorDepth.toString(),
      pixelRatio.toString(),
      hardwareConcurrency.toString(),
      maxTouchPoints.toString(),
      pluginsHash,
    ].join('|');

    const hash = await sha256(fingerprintString);

    // Calculate confidence score (0-100)
    let confidence = 0;
    if (canvasHash) confidence += 20;
    if (webgl.hash) confidence += 20;
    if (audioHash) confidence += 15;
    if (fonts.hash) confidence += 15;
    if (userAgentHash) confidence += 10;
    if (screenResolution) confidence += 10;
    if (timezone) confidence += 10;

    return {
      hash,
      components,
      confidence,
      timestamp: Date.now(),
    };
  } catch (error) {
    logger.error('Failed to generate fingerprint', error as Error);
    
    // Return minimal fingerprint on error
    const fallbackString = `${navigator.userAgent}|${screen.width}x${screen.height}|${Date.now()}`;
    const hash = await sha256(fallbackString);
    
    return {
      hash,
      components: {} as FingerprintComponents,
      confidence: 10,
      timestamp: Date.now(),
    };
  }
}

/**
 * Get a quick fingerprint hash (faster, less accurate)
 */
export async function getQuickFingerprint(): Promise<string> {
  const quickString = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency ?? 0,
  ].join('|');

  return sha256(quickString);
}

/**
 * Store fingerprint in session storage
 */
export function storeFingerprint(fingerprint: DeviceFingerprint): void {
  try {
    sessionStorage.setItem('__device_fp__', JSON.stringify({
      hash: fingerprint.hash,
      confidence: fingerprint.confidence,
      timestamp: fingerprint.timestamp,
    }));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get stored fingerprint from session storage
 */
export function getStoredFingerprint(): { hash: string; confidence: number; timestamp: number } | null {
  try {
    const stored = sessionStorage.getItem('__device_fp__');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

/**
 * Get or generate fingerprint (uses cached if available)
 */
export async function getOrGenerateFingerprint(): Promise<DeviceFingerprint> {
  const stored = getStoredFingerprint();
  
  // Use cached if less than 1 hour old
  if (stored && Date.now() - stored.timestamp < 3600000) {
    return {
      hash: stored.hash,
      components: {} as FingerprintComponents,
      confidence: stored.confidence,
      timestamp: stored.timestamp,
    };
  }

  const fingerprint = await generateFingerprint();
  storeFingerprint(fingerprint);
  return fingerprint;
}







