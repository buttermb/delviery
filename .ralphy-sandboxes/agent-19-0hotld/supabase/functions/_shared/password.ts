/**
 * Password hashing utilities using Web Crypto API (PBKDF2)
 * Compatible with Supabase Edge Runtime
 */

const ITERATIONS = 310000; // OWASP recommended minimum for PBKDF2-SHA256
const HASH_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16; // 128 bits

/**
 * Generate a random salt
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Hash a password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    HASH_LENGTH * 8
  );
  
  return new Uint8Array(derivedBits);
}

/**
 * Convert Uint8Array to base64 string
 */
function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Hash a password
 * Returns: base64(salt):base64(hash)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await deriveKey(password, salt);
  return `${arrayBufferToBase64(salt)}:${arrayBufferToBase64(hash)}`;
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [saltB64, hashB64] = storedHash.split(':');
    if (!saltB64 || !hashB64) return false;
    
    const salt = base64ToArrayBuffer(saltB64);
    const storedHashBytes = base64ToArrayBuffer(hashB64);
    const derivedHash = await deriveKey(password, salt);
    
    // Constant-time comparison
    if (derivedHash.length !== storedHashBytes.length) return false;
    
    let mismatch = 0;
    for (let i = 0; i < derivedHash.length; i++) {
      mismatch |= derivedHash[i] ^ storedHashBytes[i];
    }
    
    return mismatch === 0;
  } catch {
    return false;
  }
}
