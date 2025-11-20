/**
 * Safe storage wrapper to handle private browsing mode and storage errors
 */
export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn('Error accessing localStorage:', error);
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Error setting localStorage:', error);
    }
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn('Error removing from localStorage:', error);
    }
  },

  clear: (): void => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.clear();
    } catch (error) {
      console.warn('Error clearing localStorage:', error);
    }
  }
};

