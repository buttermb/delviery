/**
 * Build-time validation plugin for Supabase Realtime subscriptions
 * Warns about potential issues at build time
 */

import type { Plugin } from 'vite';

export const realtimeValidationPlugin = (): Plugin => {
  return {
    name: 'realtime-validation',
    enforce: 'post',
    
    transform(code: string, id: string) {
      // Skip node_modules
      if (id.includes('node_modules')) {
        return null;
      }

      // Check for realtime subscriptions without validation
      if (code.includes('.channel(') && code.includes('.subscribe(')) {
        // Check if validation is present
        const hasValidation = 
          code.includes('validate') || 
          code.includes('isValid') ||
          code.includes('if (!') ||
          code.includes('if(!');

        if (!hasValidation) {
          console.warn(
            `\n⚠️  [Realtime Validation] Possible unvalidated realtime subscription in:\n   ${id}\n   Consider adding payload validation to prevent undefined errors.\n`
          );
        }

        // Check for direct property access without null checks
        const hasDirectAccess = 
          code.match(/payload\.new\.(\w+)\.replace\(/g) ||
          code.match(/payload\.new\.(\w+)\.toUpperCase\(/g) ||
          code.match(/payload\.new\.(\w+)\.toLowerCase\(/g);

        if (hasDirectAccess) {
          console.warn(
            `\n⚠️  [Realtime Validation] Direct string method access in realtime handler:\n   ${id}\n   Use safe helper functions (safeReplace, safeUpperCase, etc.) to prevent crashes.\n`
          );
        }

        // Check for missing connection state checks
        if (code.includes('.subscribe(') && !code.includes('SUBSCRIBED')) {
          console.warn(
            `\n⚠️  [Realtime Validation] Subscription without status check in:\n   ${id}\n   Add subscription status handling for CHANNEL_ERROR and TIMED_OUT.\n`
          );
        }
      }

      // Check for WebSocket usage without error handling
      if (code.includes('new WebSocket(') && !code.includes('.onerror')) {
        console.warn(
          `\n⚠️  [WebSocket Validation] WebSocket without error handler in:\n   ${id}\n   Add .onerror handler to prevent crashes.\n`
        );
      }

      return null;
    },
  };
};
