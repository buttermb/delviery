/**
 * Advanced Honeypot Detection System
 * Multi-layered bot/fraud detection via honeypots, timing, behavior analysis
 */

import { logger } from '@/lib/logger';

export interface HoneypotResult {
  triggered: boolean;
  type: 'form_field' | 'timing' | 'behavior' | 'mouse_movement' | 'keyboard' | 'scroll' | 'touch';
  score: number; // 0-100, higher = more likely bot
  details: Record<string, unknown>;
}

export interface BotDetectionReport {
  isBot: boolean;
  confidence: number; // 0-100
  results: HoneypotResult[];
  fingerprint: string;
  timestamp: number;
}

// ============================================================================
// HONEYPOT FIELD DETECTION
// ============================================================================

/**
 * Create invisible honeypot form fields that bots typically fill
 */
export function createHoneypotFields(): { fields: HTMLInputElement[]; cleanup: () => void } {
  const fieldConfigs = [
    { name: 'website', type: 'text' },
    { name: 'url', type: 'url' },
    { name: 'email_confirm', type: 'email' },
    { name: 'phone_alt', type: 'tel' },
    { name: 'fax', type: 'text' }, // Nobody uses fax, bots often fill it
  ];

  const fields = fieldConfigs.map(({ name, type }) => {
    const field = document.createElement('input');
    field.type = type;
    field.name = name;
    field.id = `hp_${name}_${Date.now()}`;
    field.tabIndex = -1;
    field.autocomplete = 'off';
    field.setAttribute('aria-hidden', 'true');
    field.style.cssText = `
      position: absolute !important;
      left: -9999px !important;
      width: 1px !important;
      height: 1px !important;
      opacity: 0 !important;
      pointer-events: none !important;
      overflow: hidden !important;
    `;
    return field;
  });

  return {
    fields,
    cleanup: () => fields.forEach(f => f.remove()),
  };
}

/**
 * Check if any honeypot fields were filled
 */
export function checkHoneypotFields(fields: HTMLInputElement[]): HoneypotResult {
  const filledFields = fields.filter(f => f.value && f.value.length > 0);

  if (filledFields.length > 0) {
    return {
      triggered: true,
      type: 'form_field',
      score: Math.min(100, filledFields.length * 40), // 40 points per filled field
      details: {
        message: 'Honeypot fields were filled',
        filledCount: filledFields.length,
        fieldNames: filledFields.map(f => f.name),
      },
    };
  }

  return { triggered: false, type: 'form_field', score: 0, details: {} };
}

// ============================================================================
// TIMING ANALYSIS
// ============================================================================

export interface TimingMonitor {
  check: () => HoneypotResult;
  getElapsed: () => number;
}

/**
 * Monitor form submission timing
 * Too fast = bot, way too slow = session hijack
 */
export function createTimingMonitor(options: {
  minTime?: number;
  maxTime?: number;
  formComplexity?: 'simple' | 'medium' | 'complex';
} = {}): TimingMonitor {
  const startTime = Date.now();

  // Adjust thresholds based on form complexity
  const complexityMultiplier = {
    simple: 1,
    medium: 1.5,
    complex: 2.5,
  }[options.formComplexity || 'medium'];

  const MIN_HUMAN_TIME = (options.minTime || 2000) * complexityMultiplier;
  const MAX_REASONABLE_TIME = options.maxTime || 30 * 60 * 1000; // 30 minutes

  return {
    check: (): HoneypotResult => {
      const elapsed = Date.now() - startTime;

      if (elapsed < MIN_HUMAN_TIME) {
        return {
          triggered: true,
          type: 'timing',
          score: Math.min(100, Math.round((1 - elapsed / MIN_HUMAN_TIME) * 80)),
          details: {
            message: 'Form submitted too quickly',
            elapsed_ms: elapsed,
            threshold_ms: MIN_HUMAN_TIME,
          },
        };
      }

      if (elapsed > MAX_REASONABLE_TIME) {
        return {
          triggered: true,
          type: 'timing',
          score: 30, // Lower score - could be legitimate user who got distracted
          details: {
            message: 'Form submission took unusually long',
            elapsed_ms: elapsed,
            threshold_ms: MAX_REASONABLE_TIME,
          },
        };
      }

      return { triggered: false, type: 'timing', score: 0, details: { elapsed_ms: elapsed } };
    },
    getElapsed: () => Date.now() - startTime,
  };
}

// ============================================================================
// MOUSE MOVEMENT ANALYSIS
// ============================================================================

export interface MouseMonitor {
  check: () => HoneypotResult;
  cleanup: () => void;
}

/**
 * Monitor mouse movement patterns
 * Bots often have no movement or perfectly linear movement
 */
export function createMouseMonitor(): MouseMonitor {
  let movements = 0;
  let totalDistance = 0;
  let linearSegments = 0;
  let lastX = 0;
  let lastY = 0;
  let lastAngle: number | null = null;
  const positions: Array<{ x: number; y: number; t: number }> = [];

  const handleMouseMove = (e: MouseEvent) => {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 5) {
      movements++;
      totalDistance += distance;

      // Check for suspiciously linear movement
      const angle = Math.atan2(dy, dx);
      if (lastAngle !== null && Math.abs(angle - lastAngle) < 0.1) {
        linearSegments++;
      }
      lastAngle = angle;

      // Store position sample (max 100)
      if (positions.length < 100) {
        positions.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      }

      lastX = e.clientX;
      lastY = e.clientY;
    }
  };

  document.addEventListener('mousemove', handleMouseMove, { passive: true });

  return {
    check: (): HoneypotResult => {
      const MIN_MOVEMENTS = 5;
      const linearRatio = movements > 0 ? linearSegments / movements : 0;

      // No mouse movement at all
      if (movements < MIN_MOVEMENTS) {
        return {
          triggered: true,
          type: 'mouse_movement',
          score: 60,
          details: {
            message: 'Insufficient mouse movement detected',
            movements,
            minRequired: MIN_MOVEMENTS,
          },
        };
      }

      // Too linear (robotic)
      if (linearRatio > 0.8 && movements > 10) {
        return {
          triggered: true,
          type: 'mouse_movement',
          score: 50,
          details: {
            message: 'Mouse movement pattern too linear',
            linearRatio,
            movements,
          },
        };
      }

      return {
        triggered: false,
        type: 'mouse_movement',
        score: 0,
        details: { movements, totalDistance, linearRatio },
      };
    },
    cleanup: () => document.removeEventListener('mousemove', handleMouseMove),
  };
}

// ============================================================================
// KEYBOARD PATTERN ANALYSIS
// ============================================================================

export interface KeyboardMonitor {
  check: () => HoneypotResult;
  cleanup: () => void;
}

/**
 * Monitor keyboard patterns
 * Bots often type at inhuman speeds or with no variation
 */
export function createKeyboardMonitor(): KeyboardMonitor {
  const keyTimes: number[] = [];
  let lastKeyTime = 0;

  const handleKeyDown = () => {
    const now = Date.now();
    if (lastKeyTime > 0) {
      keyTimes.push(now - lastKeyTime);
    }
    lastKeyTime = now;
  };

  document.addEventListener('keydown', handleKeyDown, { passive: true });

  return {
    check: (): HoneypotResult => {
      if (keyTimes.length < 5) {
        return { triggered: false, type: 'keyboard', score: 0, details: { samples: keyTimes.length } };
      }

      // Calculate typing speed statistics
      const avgInterval = keyTimes.reduce((a, b) => a + b, 0) / keyTimes.length;
      const variance = keyTimes.reduce((sum, t) => sum + Math.pow(t - avgInterval, 2), 0) / keyTimes.length;
      const stdDev = Math.sqrt(variance);

      // Inhuman typing speed (< 30ms average between keys)
      if (avgInterval < 30) {
        return {
          triggered: true,
          type: 'keyboard',
          score: 70,
          details: {
            message: 'Typing speed too fast for human',
            avgInterval,
            stdDev,
          },
        };
      }

      // No variation in typing rhythm (robotic)
      if (stdDev < 10 && keyTimes.length > 20) {
        return {
          triggered: true,
          type: 'keyboard',
          score: 50,
          details: {
            message: 'Typing rhythm too consistent',
            avgInterval,
            stdDev,
          },
        };
      }

      return {
        triggered: false,
        type: 'keyboard',
        score: 0,
        details: { avgInterval, stdDev, samples: keyTimes.length },
      };
    },
    cleanup: () => document.removeEventListener('keydown', handleKeyDown),
  };
}

// ============================================================================
// SCROLL BEHAVIOR ANALYSIS
// ============================================================================

export interface ScrollMonitor {
  check: () => HoneypotResult;
  cleanup: () => void;
}

/**
 * Monitor scroll behavior
 * Bots often don't scroll or scroll in unnatural patterns
 */
export function createScrollMonitor(): ScrollMonitor {
  let scrollCount = 0;
  let totalScrollDistance = 0;
  let lastScrollY = window.scrollY;

  const handleScroll = () => {
    const currentY = window.scrollY;
    const distance = Math.abs(currentY - lastScrollY);
    if (distance > 10) {
      scrollCount++;
      totalScrollDistance += distance;
      lastScrollY = currentY;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  return {
    check: (): HoneypotResult => {
      // Check if page is scrollable but user never scrolled
      const isScrollable = document.body.scrollHeight > window.innerHeight;

      if (isScrollable && scrollCount === 0) {
        return {
          triggered: true,
          type: 'scroll',
          score: 30, // Lower score - some users might not need to scroll
          details: {
            message: 'No scroll detected on scrollable page',
            pageHeight: document.body.scrollHeight,
            viewportHeight: window.innerHeight,
          },
        };
      }

      return {
        triggered: false,
        type: 'scroll',
        score: 0,
        details: { scrollCount, totalScrollDistance },
      };
    },
    cleanup: () => window.removeEventListener('scroll', handleScroll),
  };
}

// ============================================================================
// TOUCH DETECTION (Mobile)
// ============================================================================

export interface TouchMonitor {
  check: () => HoneypotResult;
  cleanup: () => void;
}

/**
 * Monitor touch events on mobile
 * Helps detect headless browsers pretending to be mobile
 */
export function createTouchMonitor(): TouchMonitor {
  let touchCount = 0;
  let hasTouchSupport = 'ontouchstart' in window;

  const handleTouch = () => {
    touchCount++;
  };

  if (hasTouchSupport) {
    document.addEventListener('touchstart', handleTouch, { passive: true });
  }

  return {
    check: (): HoneypotResult => {
      // Claims touch support but no touches detected
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      if (isMobileUA && hasTouchSupport && touchCount === 0) {
        return {
          triggered: true,
          type: 'touch',
          score: 40,
          details: {
            message: 'Mobile device with no touch events',
            userAgent: navigator.userAgent,
            hasTouchSupport,
          },
        };
      }

      return {
        triggered: false,
        type: 'touch',
        score: 0,
        details: { touchCount, hasTouchSupport },
      };
    },
    cleanup: () => {
      if (hasTouchSupport) {
        document.removeEventListener('touchstart', handleTouch);
      }
    },
  };
}

// ============================================================================
// BROWSER FINGERPRINT
// ============================================================================

/**
 * Generate a simple browser fingerprint for tracking
 */
export function generateFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
    navigator.hardwareConcurrency || 'unknown',
  ];

  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// UNIFIED BOT DETECTION
// ============================================================================

export interface BotDetector {
  getReport: () => BotDetectionReport;
  cleanup: () => void;
  addHoneypotFields: (container: HTMLElement) => void;
}

/**
 * Create a unified bot detection system
 */
export function createBotDetector(options: {
  minFormTime?: number;
  formComplexity?: 'simple' | 'medium' | 'complex';
} = {}): BotDetector {
  const honeypotData = createHoneypotFields();
  const timingMonitor = createTimingMonitor(options);
  const mouseMonitor = createMouseMonitor();
  const keyboardMonitor = createKeyboardMonitor();
  const scrollMonitor = createScrollMonitor();
  const touchMonitor = createTouchMonitor();

  return {
    getReport: (): BotDetectionReport => {
      const results = [
        checkHoneypotFields(honeypotData.fields),
        timingMonitor.check(),
        mouseMonitor.check(),
        keyboardMonitor.check(),
        scrollMonitor.check(),
        touchMonitor.check(),
      ];

      // Calculate weighted confidence score
      const totalScore = results.reduce((sum, r) => sum + r.score, 0);
      const triggeredCount = results.filter(r => r.triggered).length;
      const confidence = Math.min(100, totalScore + triggeredCount * 10);

      const report: BotDetectionReport = {
        isBot: confidence >= 50,
        confidence,
        results,
        fingerprint: generateFingerprint(),
        timestamp: Date.now(),
      };

      // Log suspicious activity
      if (report.isBot) {
        logger.warn('Bot detected', {
          confidence,
          triggered: results.filter(r => r.triggered).map(r => r.type),
          fingerprint: report.fingerprint,
        });
      }

      return report;
    },

    cleanup: () => {
      honeypotData.cleanup();
      mouseMonitor.cleanup();
      keyboardMonitor.cleanup();
      scrollMonitor.cleanup();
      touchMonitor.cleanup();
    },

    addHoneypotFields: (container: HTMLElement) => {
      honeypotData.fields.forEach(field => container.appendChild(field));
    },
  };
}

// ============================================================================
// REACT HOOK
// ============================================================================

import { useEffect, useRef, useCallback } from 'react';

/**
 * React hook for bot detection
 */
export function useBotDetection(options: {
  minFormTime?: number;
  formComplexity?: 'simple' | 'medium' | 'complex';
  onBotDetected?: (report: BotDetectionReport) => void;
} = {}) {
  const detectorRef = useRef<BotDetector | null>(null);

  // Destructure options to use stable primitive values in dependencies
  const { minFormTime, formComplexity, onBotDetected } = options;

  useEffect(() => {
    detectorRef.current = createBotDetector({ minFormTime, formComplexity });
    return () => detectorRef.current?.cleanup();
  }, [minFormTime, formComplexity]);

  const getReport = useCallback(() => {
    if (!detectorRef.current) return null;
    const report = detectorRef.current.getReport();
    if (report.isBot && onBotDetected) {
      onBotDetected(report);
    }
    return report;
  }, [onBotDetected]);

  const addHoneypotFields = useCallback((container: HTMLElement | null) => {
    if (container && detectorRef.current) {
      detectorRef.current.addHoneypotFields(container);
    }
  }, []);

  return { getReport, addHoneypotFields };
}
