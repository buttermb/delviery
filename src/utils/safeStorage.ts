import { logger } from '@/lib/logger';
/**
 * Safe storage wrapper to handle private browsing mode and storage errors
 */
class SafeStorage {
  private memoryStorage: Map<string, string>;
  private isSupported: boolean;

  constructor() {
    this.memoryStorage = new Map();
    this.isSupported = this.checkSupport();
  }

  private checkSupport(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  getItem(key: string): string | null {
    if (this.isSupported) {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        logger.warn('Error accessing localStorage, falling back to memory:', error);
      }
    }
    return this.memoryStorage.get(key) || null;
  }

  setItem(key: string, value: string): void {
    if (this.isSupported) {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        logger.warn('Error setting localStorage, falling back to memory:', error);
      }
    }
    this.memoryStorage.set(key, value);
  }

  removeItem(key: string): void {
    if (this.isSupported) {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        logger.warn('Error removing from localStorage:', error);
      }
    }
    this.memoryStorage.delete(key);
  }

  clear(): void {
    if (this.isSupported) {
      try {
        window.localStorage.clear();
      } catch (error) {
        logger.warn('Error clearing localStorage:', error);
      }
    }
    this.memoryStorage.clear();
  }
}

export const safeStorage = new SafeStorage();

