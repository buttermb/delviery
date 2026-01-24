/**
 * Password Breach Checking Utility
 * Uses HaveIBeenPwned API with k-anonymity to check if a password
 * has appeared in known data breaches without sending the full password.
 *
 * K-anonymity approach:
 * 1. SHA-1 hash the password
 * 2. Send only first 5 chars of hash to HIBP API
 * 3. API returns all hashes starting with those 5 chars
 * 4. Check locally if full hash appears in returned list
 */

import { logger } from '@/lib/logger';

/** Minimum breach count to block a password outright */
const BLOCK_THRESHOLD = 10;

/** Minimum breach count to warn the user */
const WARN_THRESHOLD = 1;

export interface BreachCheckResult {
  /** Whether the password was found in breaches */
  breached: boolean;
  /** Number of times the password appeared in breaches */
  count: number;
  /** Whether the password should be blocked (too commonly breached) */
  blocked: boolean;
  /** User-facing message */
  message: string;
}

/**
 * Compute SHA-1 hash of a string using Web Crypto API
 */
async function sha1Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Check a password against the HaveIBeenPwned Passwords API using k-anonymity.
 * Only the first 5 characters of the SHA-1 hash are sent to the API.
 */
export async function checkPasswordBreach(password: string): Promise<BreachCheckResult> {
  try {
    const hash = await sha1Hash(password);
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'Add-Padding': 'true', // Request padding to prevent response-length analysis
      },
    });

    if (!response.ok) {
      // If the API is unavailable, don't block the user - just log and allow
      logger.warn('HIBP API request failed', { status: response.status });
      return {
        breached: false,
        count: 0,
        blocked: false,
        message: '',
      };
    }

    const text = await response.text();
    const lines = text.split('\n');

    for (const line of lines) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if (hashSuffix === suffix) {
        const count = parseInt(countStr, 10);

        if (count >= BLOCK_THRESHOLD) {
          return {
            breached: true,
            count,
            blocked: true,
            message: `This password has appeared in ${count.toLocaleString()} data breaches and cannot be used. Please choose a different password.`,
          };
        }

        if (count >= WARN_THRESHOLD) {
          return {
            breached: true,
            count,
            blocked: false,
            message: `This password has appeared in ${count.toLocaleString()} data breach${count === 1 ? '' : 'es'}. Consider using a stronger password.`,
          };
        }
      }
    }

    return {
      breached: false,
      count: 0,
      blocked: false,
      message: '',
    };
  } catch (error) {
    // Network errors shouldn't block signup - log and allow
    logger.warn('Password breach check failed', { error });
    return {
      breached: false,
      count: 0,
      blocked: false,
      message: '',
    };
  }
}

/**
 * Generate a cryptographically strong random password.
 * Uses crypto.getRandomValues for secure randomness.
 */
export function generateStrongPassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';
  const allChars = uppercase + lowercase + numbers + symbols;

  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);

  // Ensure at least one of each required character type
  const password: string[] = [];
  password.push(uppercase[randomValues[0] % uppercase.length]);
  password.push(lowercase[randomValues[1] % lowercase.length]);
  password.push(numbers[randomValues[2] % numbers.length]);
  password.push(symbols[randomValues[3] % symbols.length]);

  // Fill remaining characters
  for (let i = 4; i < length; i++) {
    password.push(allChars[randomValues[i] % allChars.length]);
  }

  // Shuffle the password array using Fisher-Yates with crypto randomness
  const shuffleValues = new Uint32Array(password.length);
  crypto.getRandomValues(shuffleValues);
  for (let i = password.length - 1; i > 0; i--) {
    const j = shuffleValues[i] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
}
