/**
 * Password Utility Functions
 * For hashing and verifying passwords
 * 
 * Note: In production, use proper bcrypt library
 * This is a simplified implementation using Web Crypto API
 */

/**
 * Hash password using SHA-256 (simplified)
 * In production, use bcrypt with proper salt rounds (10-12)
 */
export async function hashPassword(password: string, salt?: string): Promise<string> {
  const encoder = new TextEncoder();
  const secret = salt || import.meta.env.VITE_PASSWORD_SECRET || 'change-in-production';
  
  // Combine password with salt/secret
  const data = encoder.encode(password + secret);
  
  // Hash using Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  // Convert to hex string
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify password against hash
 */
export async function comparePassword(password: string, hash: string, salt?: string): Promise<boolean> {
  const hashedPassword = await hashPassword(password, salt);
  return hashedPassword === hash;
}

/**
 * Generate a secure random password reset token
 */
export function generatePasswordResetToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  score: number; // 0-4
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push('Password must be at least 8 characters');

  if (password.length >= 12) score++;

  if (/[a-z]/.test(password)) score++;
  else feedback.push('Add lowercase letters');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Add uppercase letters');

  if (/[0-9]/.test(password)) score++;
  else feedback.push('Add numbers');

  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else feedback.push('Add special characters');

  return {
    valid: score >= 4,
    score: Math.min(score, 4),
    feedback: feedback.length > 0 ? feedback : ['Strong password'],
  };
}

