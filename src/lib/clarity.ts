/**
 * Microsoft Clarity Session Recording Integration
 *
 * Dynamically injects the Clarity script tag.
 * No-op when VITE_CLARITY_PROJECT_ID is missing or not in production.
 */

import { logger } from '@/lib/logger';

/**
 * Initialize Microsoft Clarity. Called via scheduleIdle in main.tsx.
 */
export function initClarity(): void {
  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID;
  if (!projectId || !import.meta.env.PROD) {
    logger.info('[Clarity] Project ID not configured or not production, skipping');
    return;
  }

  try {
    // Inject official Clarity script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.textContent = `
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window,document,"clarity","script","${projectId}");
    `;
    document.head.appendChild(script);
    logger.info('[Clarity] Script injected');
  } catch (error) {
    logger.error('[Clarity] Failed to initialize', error);
  }
}
