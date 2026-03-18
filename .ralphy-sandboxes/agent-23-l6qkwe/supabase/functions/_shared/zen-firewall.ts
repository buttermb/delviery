/**
 * Zen Firewall Integration for Deno Edge Functions
 * Provides runtime security protection for edge functions
 */

import { secureHeaders } from './secure-headers.ts';

const AIKIDO_TOKEN = Deno.env.get('AIKIDO_TOKEN');
const AIKIDO_ENDPOINT = 'https://runtime.aikido.dev/api/v1';

interface ZenConfig {
  enabled: boolean;
  blockMode: boolean;
  logMode: boolean;
}

const config: ZenConfig = {
  enabled: !!AIKIDO_TOKEN,
  blockMode: true,
  logMode: true,
};

/**
 * Initialize Zen Firewall protection
 */
export function initZenFirewall() {
  if (!config.enabled) {
    console.warn('Zen Firewall: AIKIDO_TOKEN not configured');
    return null;
  }
  
  console.log('Zen Firewall: Protection enabled');
  return config;
}

/**
 * Report security event to Aikido
 */
async function reportToAikido(event: any) {
  if (!AIKIDO_TOKEN || !config.logMode) return;

  try {
    await fetch(`${AIKIDO_ENDPOINT}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIKIDO_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        event,
      }),
    });
  } catch (error) {
    console.error('Zen Firewall: Failed to report event', error);
  }
}

/**
 * Validate and sanitize request
 */
export async function validateRequest(req: Request): Promise<{
  valid: boolean;
  threat?: string;
  action: 'allow' | 'block' | 'log';
}> {
  if (!config.enabled) {
    return { valid: true, action: 'allow' };
  }

  try {
    const url = new URL(req.url);
    const body = req.method !== 'GET' ? await req.clone().text() : '';

    // SQL Injection detection
    const sqlPatterns = [
      /(\bUNION\b.*\bSELECT\b)/i,
      /(\bOR\b.*=.*)/i,
      /(\bDROP\b.*\bTABLE\b)/i,
      /(;\s*DELETE\s+FROM)/i,
    ];

    // XSS detection
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
    ];

    // Path traversal detection
    const pathTraversalPatterns = [
      /\.\.[\/\\]/,
      /%2e%2e[\/\\]/i,
    ];

    const allPatterns = [...sqlPatterns, ...xssPatterns, ...pathTraversalPatterns];
    const testString = `${url.pathname}${url.search}${body}`;

    for (const pattern of allPatterns) {
      if (pattern.test(testString)) {
        const threat = `Potential attack detected: ${pattern.source}`;
        
        await reportToAikido({
          type: 'threat_detected',
          threat,
          url: req.url,
          method: req.method,
          blocked: config.blockMode,
        });

        return {
          valid: false,
          threat,
          action: config.blockMode ? 'block' : 'log',
        };
      }
    }

    return { valid: true, action: 'allow' };
  } catch (error) {
    console.error('Zen Firewall: Validation error', error);
    return { valid: true, action: 'allow' }; // Fail open
  }
}

/**
 * Zen Firewall middleware wrapper
 */
export function withZenProtection(
  handler: (req: Request) => Promise<Response>
) {
  initZenFirewall();

  return async (req: Request): Promise<Response> => {
    const validation = await validateRequest(req);

    if (validation.action === 'block') {
      return new Response(
        JSON.stringify({
          error: 'Request blocked by security policy',
          threat: validation.threat,
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'X-Zen-Firewall': 'blocked',
            ...secureHeaders,
          },
        }
      );
    }

    const response = await handler(req);
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(secureHeaders)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}
