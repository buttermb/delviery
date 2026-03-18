/**
 * AES-256 Encryption Utilities
 * 
 * Provides secure encryption/decryption for sensitive data like lab results
 * Uses Web Crypto API (AES-GCM) for browser-side encryption
 * 
 * IMPORTANT: For production, encryption should be done server-side in Edge Functions
 * This client-side encryption is for additional security layer
 */

/**
 * Generate a random encryption key (for client-side use)
 * In production, keys should be managed server-side
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive a key from a password using PBKDF2
 * Used when encrypting with a user-provided password
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-256-GCM
 * 
 * @param data - Data to encrypt (string or object)
 * @param key - Encryption key (CryptoKey)
 * @returns Encrypted data as base64 string with IV prepended
 */
export async function encryptData(
  data: string | object,
  key: CryptoKey
): Promise<string> {
  // Convert data to string if object
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(dataString);

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    dataBuffer
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using AES-256-GCM
 * 
 * @param encryptedData - Base64 encrypted string with IV prepended
 * @param key - Decryption key (CryptoKey)
 * @returns Decrypted data as string
 */
export async function decryptData(
  encryptedData: string,
  key: CryptoKey
): Promise<string> {
  // Convert from base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

  // Extract IV (first 12 bytes)
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  // Decrypt
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encrypted
  );

  // Convert to string
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Encrypt JSON object
 * Convenience function that handles JSON serialization
 */
export async function encryptJSON<T extends object>(
  data: T,
  key: CryptoKey
): Promise<string> {
  return encryptData(JSON.stringify(data), key);
}

/**
 * Decrypt JSON object
 * Convenience function that handles JSON parsing
 */
export async function decryptJSON<T extends object>(
  encryptedData: string,
  key: CryptoKey
): Promise<T> {
  const decrypted = await decryptData(encryptedData, key);
  try {
    return JSON.parse(decrypted) as T;
  } catch {
    throw new Error('Failed to parse decrypted data as JSON');
  }
}

/**
 * Check if Web Crypto API is available
 */
export function isEncryptionSupported(): boolean {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' &&
         typeof crypto.getRandomValues !== 'undefined';
}

/**
 * Error class for encryption errors
 */
export class EncryptionError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'EncryptionError';
  }
}

