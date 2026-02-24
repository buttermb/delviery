import { logger } from '@/lib/logger';

export function setupGlobalErrorHandlers() {
  window.addEventListener('error', (event) => {
    logger.error('Global error:', event.error, { component: 'globalErrorHandler' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled rejection:', event.reason, { component: 'globalErrorHandler' });
  });
}
