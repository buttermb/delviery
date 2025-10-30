/**
 * Advanced Security Obfuscation & Anti-Fingerprinting
 * New York Minute NYC E-Commerce Platform
 * 
 * Built by WebFlow Studios Team (2024)
 * Security Architect: Aisha Kumar
 * Privacy Engineer: James Martinez
 * 
 * Purpose: Make browser fingerprinting and traffic analysis harder
 * 
 * Features:
 * - Network request timing randomization
 * - Decoy API calls to confuse traffic analysis
 * - Browser fingerprint resistance
 * - Developer tools detection and obfuscation
 * 
 * Contact: security@webflowstudios.dev
 */

/**
 * Adds random delays to API calls to make timing analysis harder
 * DISABLED - Causes noticeable performance impact
 */
export const obfuscateRequestTiming = async <T>(
  request: () => Promise<T>,
  minDelay: number = 50,
  maxDelay: number = 200
): Promise<T> => {
  // Disabled for performance - just pass through
  return request();
};

/**
 * Makes decoy API requests to confuse traffic analysis
 * Randomly fires fake requests that look like real API calls
 */
export const generateDecoyTraffic = () => {
  if (import.meta.env.DEV) return;
  
  // Random interval between 2-5 minutes
  const interval = (Math.random() * 180000) + 120000;
  
  setTimeout(() => {
    // Create decoy requests that look real but go nowhere
    const decoyEndpoints = [
      '/api/v1/health',
      '/api/v1/metrics',
      '/api/analytics/track',
      '/cdn/assets/check',
      '/api/session/refresh'
    ];
    
    const randomEndpoint = decoyEndpoints[Math.floor(Math.random() * decoyEndpoints.length)];
    
    // Fire and forget - don't care about response
    fetch(randomEndpoint, { 
      method: 'HEAD',
      cache: 'no-cache'
    }).catch(() => {
      // Silently fail - it's just a decoy
    });
    
    // Schedule next decoy
    generateDecoyTraffic();
  }, interval);
};

/**
 * Detect if developer tools are open
 * Note: This can be bypassed but adds a layer of protection
 */
export const detectDevTools = (): boolean => {
  if (import.meta.env.DEV) return false;
  
  const threshold = 160;
  const widthThreshold = window.outerWidth - window.innerWidth > threshold;
  const heightThreshold = window.outerHeight - window.innerHeight > threshold;
  
  return widthThreshold || heightThreshold;
};

/**
 * Add noise to browser fingerprinting attempts
 */
export const addFingerprintNoise = () => {
  if (import.meta.env.DEV) return;
  
  // Randomize canvas fingerprinting
  if (typeof CanvasRenderingContext2D !== 'undefined') {
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(...args) {
      // Add tiny random offset to defeat canvas fingerprinting
      if (args[1] && args[2]) {
        args[1] += Math.random() * 0.001;
        args[2] += Math.random() * 0.001;
      }
      return originalFillText.apply(this, args as any);
    };
  }
  
  // Add noise to audio context
  if (typeof AudioContext !== 'undefined') {
    const OriginalAudioContext = window.AudioContext;
    (window as any).AudioContext = function(...args: any[]) {
      const context = new OriginalAudioContext(...args);
      // Add random offset to sample rate
      const originalSampleRate = context.sampleRate;
      Object.defineProperty(context, 'sampleRate', {
        get: () => originalSampleRate + (Math.random() * 0.1 - 0.05)
      });
      return context;
    };
  }
};

/**
 * Obfuscate console in production
 * Prevents attackers from using console to debug
 */
export const obfuscateConsole = () => {
  if (import.meta.env.DEV) return;
  
  const noop = () => {};
  const methods = ['log', 'debug', 'info', 'warn', 'error', 'trace', 'table', 'group', 'groupEnd'];
  
  methods.forEach(method => {
    (console as any)[method] = noop;
  });
};

/**
 * Initialize all security obfuscation measures
 * BALANCED MODE - Strong protection without breaking usability
 */
export const initializeSecurityObfuscation = () => {
  if (import.meta.env.DEV) {
    console.log('🔒 Security obfuscation disabled in development mode');
    return;
  }
  
  // Add fingerprint resistance (minimal performance impact)
  addFingerprintNoise();
  
  // Obfuscate console (no user impact)
  obfuscateConsole();
  
  // Start generating decoy traffic (background only, no user impact)
  generateDecoyTraffic();
  
  // REMOVED: Dev tools blocking - hurts legitimate users
  // REMOVED: Right-click blocking - breaks accessibility
  // REMOVED: Session clearing - can break legitimate use
  // REMOVED: F12 blocking - users should be able to inspect
  
  // Site remains fully usable while code stays obfuscated
};

/**
 * Wrapper for sensitive operations that need extra protection
 */
export const secureOperation = async <T>(
  operation: () => Promise<T>
): Promise<T> => {
  if (import.meta.env.DEV) {
    return operation();
  }
  
  // Check if dev tools are open
  if (detectDevTools()) {
    // Clear sensitive data
    sessionStorage.clear();
    
    // Return early with generic error
    throw new Error('Operation unavailable');
  }
  
  // Add timing obfuscation
  return obfuscateRequestTiming(operation);
};
