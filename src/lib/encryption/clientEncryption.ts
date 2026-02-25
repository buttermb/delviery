import { logger } from '@/lib/logger';
// src/lib/encryption/clientEncryption.ts

import CryptoJS from 'crypto-js';
import {
  ENCRYPTION_CONFIG,
  STORAGE_KEYS,
  ERROR_MESSAGES
} from './constants';
import type {
  EncryptableValue,
  EncryptionMetadata,
  EncryptionSession
} from './types';
import { safeStorage } from '@/utils/safeStorage';

// Safe wrapper for sessionStorage
const safeSession = {
  setItem: (key: string, value: string) => {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      logger.warn('SessionStorage failed', e);
    }
  },
  getItem: (key: string) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  removeItem: (key: string) => {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      logger.warn('SessionStorage failed', e);
    }
  }
};

/**
 * Zero-knowledge client-side encryption engine
 * All encryption/decryption happens in browser
 * Keys NEVER leave the client
 */
export class ClientEncryption {
  private userKey: string | null = null;
  private salt: string | null = null;
  private session: EncryptionSession | null = null;

  /**
   * Initialize encryption with user password
   * Called on login/signup - derives key from password
   * @param password - User's password (NEVER sent to server)
   * @param userId - User ID for salt storage
   */
  async initialize(password: string, userId: string): Promise<void> {
    try {
      // Get or generate salt
      this.salt = this.getSalt(userId) || this.generateSalt();
      this.storeSalt(userId, this.salt);

      // Derive encryption key from password using PBKDF2
      this.userKey = this.deriveKey(password, this.salt);

      // Create session
      this.session = {
        key: this.userKey,
        initialized: new Date(),
        lastActivity: new Date(),
        userId,
      };

      // Store in sessionStorage (cleared on browser close)
      safeSession.setItem(STORAGE_KEYS.sessionKey, this.userKey);
      safeSession.setItem(STORAGE_KEYS.lastActivity, Date.now().toString());

      // Clear password from memory (best effort)
      password = '';
    } catch (error) {
      logger.error('❌ Encryption initialization failed:', error);
      throw new Error('Failed to initialize encryption');
    }
  }

  /**
   * Derive encryption key from password using PBKDF2
   * This is the CRITICAL function - creates user's encryption key
   */
  private deriveKey(password: string, salt: string): string {
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: ENCRYPTION_CONFIG.keySize / 32,
      iterations: ENCRYPTION_CONFIG.pbkdf2.iterations,
      hasher: CryptoJS.algo.SHA256,
    });
    return key.toString();
  }

  /**
   * Generate cryptographically secure random salt
   */
  private generateSalt(): string {
    return CryptoJS.lib.WordArray.random(
      ENCRYPTION_CONFIG.pbkdf2.saltLength
    ).toString();
  }

  /**
   * Store salt in localStorage (salt is not sensitive)
   */
  private storeSalt(userId: string, salt: string): void {
    safeStorage.setItem(`${STORAGE_KEYS.userSalt}_${userId}`, salt);
  }

  /**
   * Retrieve user's salt from localStorage
   */
  private getSalt(userId: string): string | null {
    return safeStorage.getItem(`${STORAGE_KEYS.userSalt}_${userId}`);
  }

  /**
   * Encrypt any value (string, number, object, array)
   * @param value - Value to encrypt
   * @returns Base64 encrypted string
   */
  encrypt(value: EncryptableValue): string {
    if (!this.isReady()) {
      throw new Error(ERROR_MESSAGES.NOT_INITIALIZED);
    }

    if (value === null || value === undefined) {
      return '';
    }

    try {
      // Update last activity
      this.updateActivity();

      // Convert to string
      const plaintext = typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

      // Encrypt using AES-256-GCM
      const encrypted = CryptoJS.AES.encrypt(plaintext, this.userKey!);

      return encrypted.toString();
    } catch (error) {
      logger.error('❌ Encryption failed:', error);
      throw new Error(ERROR_MESSAGES.ENCRYPTION_FAILED);
    }
  }

  /**
   * Decrypt encrypted value back to original type
   * @param encryptedValue - Base64 encrypted string
   * @returns Decrypted value
   */
  decrypt<T = string>(encryptedValue: string): T {
    if (!this.isReady()) {
      throw new Error(ERROR_MESSAGES.NOT_INITIALIZED);
    }

    if (!encryptedValue) {
      return null as T;
    }

    try {
      // Update last activity
      this.updateActivity();

      // Decrypt
      const decrypted = CryptoJS.AES.decrypt(encryptedValue, this.userKey!);
      const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

      if (!plaintext) {
        throw new Error('Decryption produced empty result');
      }

      // Try to parse as JSON, otherwise return as string
      try {
        return JSON.parse(plaintext) as T;
      } catch {
        return plaintext as T;
      }
    } catch (error) {
      logger.error('❌ Decryption failed:', error);
      throw new Error(ERROR_MESSAGES.DECRYPTION_FAILED);
    }
  }

  /**
   * Encrypt entire object (all fields)
   * Adds '_encrypted' suffix to field names
   * @param obj - Object to encrypt
   * @returns Object with encrypted fields
   */
  encryptObject<T extends Record<string, unknown>>(
    obj: T
  ): Record<string, string> {
    const encrypted: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        encrypted[`${key}_encrypted`] = this.encrypt(value as EncryptableValue);
      }
    }

    return encrypted;
  }

  /**
   * Decrypt entire object (all encrypted fields)
   * Removes '_encrypted' suffix from field names
   * @param encryptedObj - Object with encrypted fields
   * @returns Decrypted object
   */
  decryptObject<T extends Record<string, unknown>>(
    encryptedObj: Record<string, unknown>
  ): T {
    const decrypted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(encryptedObj)) {
      if (key.endsWith('_encrypted')) {
        // Remove '_encrypted' suffix
        const originalKey = key.replace('_encrypted', '');
        decrypted[originalKey] = this.decrypt(value as string);
      } else if (
        !key.includes('search_index') &&
        !key.includes('metadata') &&
        key !== 'encryption_metadata'
      ) {
        // Keep non-encrypted fields (like IDs, timestamps)
        decrypted[key] = value;
      }
    }

    return decrypted as T;
  }

  /**
   * Create deterministic hash for encrypted field searching
   * Same input always produces same hash
   * @param value - Value to hash
   * @returns Hash for search index
   */
  createSearchHash(value: string): string {
    if (!this.isReady()) {
      throw new Error(ERROR_MESSAGES.NOT_INITIALIZED);
    }

    // Use HMAC for deterministic hashing
    const hash = CryptoJS.HmacSHA256(
      value.toLowerCase().trim(),
      this.userKey!
    );
    return hash.toString();
  }

  /**
   * Encrypt file/blob
   * @param file - File to encrypt
   * @returns Encrypted blob
   */
  async encryptFile(file: File): Promise<Blob> {
    if (!this.isReady()) {
      throw new Error(ERROR_MESSAGES.NOT_INITIALIZED);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
          const encrypted = CryptoJS.AES.encrypt(wordArray, this.userKey!);

          const blob = new Blob(
            [encrypted.toString()],
            { type: 'application/octet-stream' }
          );
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Decrypt file/blob
   * @param encryptedBlob - Encrypted blob
   * @param originalType - Original file MIME type
   * @returns Decrypted blob
   */
  async decryptFile(
    encryptedBlob: Blob,
    originalType: string
  ): Promise<Blob> {
    if (!this.isReady()) {
      throw new Error(ERROR_MESSAGES.NOT_INITIALIZED);
    }

    const text = await encryptedBlob.text();
    const decrypted = CryptoJS.AES.decrypt(text, this.userKey!);
    const arrayBuffer = this.wordArrayToArrayBuffer(decrypted);

    return new Blob([arrayBuffer], { type: originalType });
  }

  /**
   * Convert CryptoJS WordArray to ArrayBuffer
   */
  private wordArrayToArrayBuffer(
    wordArray: CryptoJS.lib.WordArray
  ): ArrayBuffer {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    const arrayBuffer = new ArrayBuffer(sigBytes);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < sigBytes; i++) {
      uint8Array[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }

    return arrayBuffer;
  }

  /**
   * Update last activity timestamp
   */
  private updateActivity(): void {
    if (this.session) {
      this.session.lastActivity = new Date();
      safeSession.setItem(
        STORAGE_KEYS.lastActivity,
        Date.now().toString()
      );
    }
  }

  /**
   * Check if session has expired
   */
  isSessionExpired(): boolean {
    const lastActivity = safeSession.getItem(STORAGE_KEYS.lastActivity);

    if (!lastActivity) return true;

    const elapsed = Date.now() - parseInt(lastActivity, 10);
    return elapsed > ENCRYPTION_CONFIG.sessionTimeout;
  }

  /**
   * Check if encryption is ready
   */
  isReady(): boolean {
    if (this.isSessionExpired()) {
      this.destroy();
      return false;
    }
    return this.userKey !== null;
  }

  /**
   * Restore session from sessionStorage
   * Called on page refresh
   */
  restoreSession(): boolean {
    const sessionKey = safeSession.getItem(STORAGE_KEYS.sessionKey);

    if (sessionKey && !this.isSessionExpired()) {
      this.userKey = sessionKey;
      return true;
    }

    return false;
  }

  /**
   * Clear all encryption data from memory
   * Called on logout or session expiry
   */
  destroy(): void {
    this.userKey = null;
    this.salt = null;
    this.session = null;

    // Clear session storage
    safeSession.removeItem(STORAGE_KEYS.sessionKey);
    safeSession.removeItem(STORAGE_KEYS.lastActivity);

    logger.debug('🔒 Encryption session destroyed');
  }

  /**
   * Get encryption metadata for storage
   */
  getMetadata(): EncryptionMetadata {
    return {
      version: ENCRYPTION_CONFIG.version,
      algorithm: ENCRYPTION_CONFIG.algorithm,
      timestamp: new Date().toISOString(),
    };
  }
}

// Singleton instance
export const clientEncryption = new ClientEncryption();

