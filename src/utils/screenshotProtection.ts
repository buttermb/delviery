/**
 * Screenshot Detection & Protection
 * Detects and logs screenshot attempts for security monitoring
 */

import { supabase } from '@/integrations/supabase/client';

export interface ScreenshotEvent {
  menu_id?: string;
  customer_id?: string;
  event_type: 'screenshot_attempt' | 'print_attempt' | 'right_click' | 'devtools';
  event_data?: Record<string, any>;
}

/**
 * Enable screenshot protection for a menu page
 */
export function enableScreenshotProtection(
  menuId: string,
  customerId?: string,
  onDetection?: (event: ScreenshotEvent) => void
) {
  const logEvent = async (event: ScreenshotEvent) => {
    // Log to backend
    try {
      await supabase.functions.invoke('log-security-event', {
        body: {
          menu_id: menuId,
          customer_id: customerId,
          ...event,
        },
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }

    // Call custom handler
    if (onDetection) {
      onDetection(event);
    }
  };

  // 1. Detect PrintScreen key
  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
      logEvent({
        menu_id: menuId,
        customer_id: customerId,
        event_type: 'screenshot_attempt',
        event_data: {
          key: e.key,
          code: e.code,
          timestamp: new Date().toISOString(),
        },
      });
      
      // Blur content briefly
      document.body.style.filter = 'blur(20px)';
      setTimeout(() => {
        document.body.style.filter = 'none';
      }, 1000);
      
      showWarning('Screenshots are not allowed and have been logged');
    }
  };

  // 2. Detect Windows screenshot combo (Win + Shift + S)
  const handleKeyDown = (e: KeyboardEvent) => {
    // Windows: Win + Shift + S
    if (e.key.toLowerCase() === 's' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
      logEvent({
        menu_id: menuId,
        customer_id: customerId,
        event_type: 'screenshot_attempt',
        event_data: {
          combination: 'Win+Shift+S',
          timestamp: new Date().toISOString(),
        },
      });
      
      e.preventDefault();
      showWarning('Screenshot shortcuts are disabled');
    }

    // Mac: Cmd + Shift + 4/5
    if ((e.key === '4' || e.key === '5') && e.shiftKey && e.metaKey) {
      logEvent({
        menu_id: menuId,
        customer_id: customerId,
        event_type: 'screenshot_attempt',
        event_data: {
          combination: `Cmd+Shift+${e.key}`,
          timestamp: new Date().toISOString(),
        },
      });
      
      e.preventDefault();
      showWarning('Screenshot shortcuts are disabled');
    }

    // F12 (DevTools) detection
    if (e.key === 'F12') {
      logEvent({
        menu_id: menuId,
        customer_id: customerId,
        event_type: 'devtools',
        event_data: {
          key: 'F12',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Ctrl+Shift+I (DevTools)
    if (e.key.toLowerCase() === 'i' && e.ctrlKey && e.shiftKey) {
      logEvent({
        menu_id: menuId,
        customer_id: customerId,
        event_type: 'devtools',
        event_data: {
          combination: 'Ctrl+Shift+I',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };

  // 3. Disable right-click context menu
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    logEvent({
      menu_id: menuId,
      customer_id: customerId,
      event_type: 'right_click',
      event_data: {
        timestamp: new Date().toISOString(),
      },
    });
    showWarning('Right-click is disabled');
    return false;
  };

  // 4. Detect when page loses focus (might be screenshot tool)
  let blurTimeout: NodeJS.Timeout;
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Page hidden - might be screenshot tool
      document.body.style.filter = 'blur(10px)';
      
      blurTimeout = setTimeout(() => {
        if (!document.hidden) {
          document.body.style.filter = 'none';
        }
      }, 500);
    } else {
      document.body.style.filter = 'none';
      if (blurTimeout) clearTimeout(blurTimeout);
    }
  };

  // 5. Detect print attempts
  const handleBeforePrint = () => {
    logEvent({
      menu_id: menuId,
      customer_id: customerId,
      event_type: 'print_attempt',
      event_data: {
        timestamp: new Date().toISOString(),
      },
    });
  };

  // 6. Disable text selection (optional - can be aggressive)
  const handleSelectStart = (e: Event) => {
    // Only prevent on images
    if ((e.target as HTMLElement)?.tagName === 'IMG') {
      e.preventDefault();
      return false;
    }
  };

  // 7. Detect copy attempts
  const handleCopy = (e: ClipboardEvent) => {
    // Only log if copying images or large amounts of text
    const selection = window.getSelection()?.toString();
    if (selection && selection.length > 100) {
      logEvent({
        menu_id: menuId,
        customer_id: customerId,
        event_type: 'screenshot_attempt',
        event_data: {
          action: 'copy',
          length: selection.length,
          timestamp: new Date().toISOString(),
        },
      });
    }
  };

  // 8. Detect drag attempts on images
  const handleDragStart = (e: DragEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'IMG') {
      e.preventDefault();
      logEvent({
        menu_id: menuId,
        customer_id: customerId,
        event_type: 'screenshot_attempt',
        event_data: {
          action: 'drag_image',
          timestamp: new Date().toISOString(),
        },
      });
      return false;
    }
  };

  // Add all event listeners
  document.addEventListener('keyup', handleKeyUp);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeprint', handleBeforePrint);
  document.addEventListener('selectstart', handleSelectStart);
  document.addEventListener('copy', handleCopy);
  document.addEventListener('dragstart', handleDragStart);

  // Disable common screenshot browser extensions (heuristic)
  // Check for known screenshot extension indicators
  if (typeof (window as any).chrome !== 'undefined') {
    const checkExtensions = () => {
      // Some screenshot extensions modify the DOM
      const suspiciousElements = document.querySelectorAll('[data-screenshot]');
      if (suspiciousElements.length > 0) {
        logEvent({
          menu_id: menuId,
          customer_id: customerId,
          event_type: 'screenshot_attempt',
          event_data: {
            indicator: 'suspicious_dom_modification',
            timestamp: new Date().toISOString(),
          },
        });
      }
    };
    
    setInterval(checkExtensions, 5000);
  }

  // Return cleanup function
  return () => {
    document.removeEventListener('keyup', handleKeyUp);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeprint', handleBeforePrint);
    document.removeEventListener('selectstart', handleSelectStart);
    document.removeEventListener('copy', handleCopy);
    document.removeEventListener('dragstart', handleDragStart);
    if (blurTimeout) clearTimeout(blurTimeout);
  };
}

/**
 * Show warning message to user
 */
function showWarning(message: string) {
  // Create or update warning toast
  const existingToast = document.getElementById('screenshot-warning');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'screenshot-warning';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #dc2626;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    font-weight: 600;
    font-size: 14px;
    max-width: 90%;
    text-align: center;
  `;
  toast.textContent = `⚠️ ${message}`;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Generate device fingerprint for tracking
 */
export async function generateDeviceFingerprint(): Promise<string> {
  const components: Record<string, any> = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    colorDepth: screen.colorDepth,
    deviceMemory: (navigator as any).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: navigator.platform,
    vendor: navigator.vendor,
  };

  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Device fingerprint', 2, 15);
      components.canvas = canvas.toDataURL();
    }
  } catch (e) {
    console.error('Canvas fingerprint failed:', e);
  }

  // WebGL fingerprint
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        components.webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
    }
  } catch (e) {
    console.error('WebGL fingerprint failed:', e);
  }

  // Hash components
  const str = JSON.stringify(components);
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex.substring(0, 32); // Return first 32 chars
}

