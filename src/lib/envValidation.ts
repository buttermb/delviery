/**
 * Environment Variable Validation
 *
 * Validates required environment variables at application startup.
 * Throws descriptive errors if critical variables are missing.
 */

import { logger } from "@/lib/logger";

interface EnvValidationError {
  variable: string;
  message: string;
}

/**
 * Validates that all required environment variables are present
 * @throws {Error} If any required environment variables are missing
 */
export function validateEnvironmentVariables(): void {
  const errors: EnvValidationError[] = [];

  // Required Supabase configuration
  if (!import.meta.env.VITE_SUPABASE_URL) {
    errors.push({
      variable: 'VITE_SUPABASE_URL',
      message: 'Supabase URL is required for database connectivity',
    });
  }

  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
    errors.push({
      variable: 'VITE_SUPABASE_ANON_KEY',
      message: 'Supabase Anonymous Key is required for authentication',
    });
  }

  // Validate URL format if present
  if (import.meta.env.VITE_SUPABASE_URL) {
    try {
      new URL(import.meta.env.VITE_SUPABASE_URL);
    } catch {
      errors.push({
        variable: 'VITE_SUPABASE_URL',
        message: 'Supabase URL must be a valid URL',
      });
    }
  }

  // If there are errors, throw with detailed message
  if (errors.length > 0) {
    const errorMessage = [
      '❌ Environment Variable Validation Failed',
      '',
      'Missing or invalid required environment variables:',
      ...errors.map(err => `  • ${err.variable}: ${err.message}`),
      '',
      'Please check your .env file and ensure all required variables are set.',
      'See .env.example for reference.',
    ].join('\n');

    logger.error('Environment validation failed', { errors });
    throw new Error(errorMessage);
  }

  logger.info('Environment variables validated successfully');
}

/**
 * Validates environment variables and logs warnings for optional variables
 */
export function validateWithWarnings(): void {
  // First validate required variables
  validateEnvironmentVariables();

  // Check optional variables and warn if missing
  const optionalVars = [
    { key: 'VITE_APP_VERSION', description: 'Application version for tracking' },
    { key: 'VITE_SENTRY_DSN', description: 'Error tracking configuration' },
  ];

  optionalVars.forEach(({ key, description }) => {
    if (!import.meta.env[key]) {
      logger.warn(`Optional environment variable missing: ${key} - ${description}`);
    }
  });
}
