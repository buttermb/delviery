import { logger } from '@/lib/logger';
/**
 * Copy to Clipboard Utility
 * Copy text to clipboard with toast notification
 */

import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(
  text: string,
  showNotification: boolean = true
): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      if (showNotification) {
        showSuccessToast('Copied to clipboard');
      }
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
        if (showNotification) {
          showSuccessToast('Copied to clipboard');
        }
        return true;
      } catch (err) {
        if (showNotification) {
          showErrorToast('Failed to copy to clipboard');
        }
        return false;
      } finally {
        document.body.removeChild(textArea);
      }
    }
  } catch (err) {
    logger.error('Clipboard error:', err);
    if (showNotification) {
      showErrorToast('Failed to copy to clipboard');
    }
    return false;
  }
}

