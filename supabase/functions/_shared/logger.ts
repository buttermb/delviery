/**
 * Shared structured logger for edge functions
 * Provides consistent logging format across all functions
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  functionName?: string;
  requestId?: string;
  userId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...context,
  };
  return JSON.stringify(logEntry);
}

export const log = {
  debug: (message: string, context?: LogContext) => {
    console.debug(formatLog('debug', message, context));
  },
  
  info: (message: string, context?: LogContext) => {
    console.error(formatLog('info', message, context));
  },
  
  warn: (message: string, context?: LogContext) => {
    console.warn(formatLog('warn', message, context));
  },
  
  error: (message: string, context?: LogContext) => {
    console.error(formatLog('error', message, context));
  },
};

/**
 * Create a logger with pre-bound function name
 */
export function createLogger(functionName: string) {
  return {
    debug: (message: string, context?: Omit<LogContext, 'functionName'>) =>
      log.debug(message, { functionName, ...context }),
    info: (message: string, context?: Omit<LogContext, 'functionName'>) =>
      log.info(message, { functionName, ...context }),
    warn: (message: string, context?: Omit<LogContext, 'functionName'>) =>
      log.warn(message, { functionName, ...context }),
    error: (message: string, context?: Omit<LogContext, 'functionName'>) =>
      log.error(message, { functionName, ...context }),
  };
}

/**
 * Create a request-scoped logger with correlation ID.
 *
 * Extracts `x-request-id` from the incoming request headers, falling back to
 * a new UUID. Every log entry includes timestamp, level, functionName,
 * requestId, message, and optional structured data.
 */
export function createRequestLogger(functionName: string, req: Request): {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
  requestId: string;
} {
  const requestId =
    req.headers.get('x-request-id') ?? crypto.randomUUID();

  function emit(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      functionName,
      requestId,
      message,
      ...(data !== undefined ? { data } : {}),
    };

    const json = JSON.stringify(entry);

    switch (level) {
      case 'debug':
        console.debug(json);
        break;
      case 'warn':
        console.warn(json);
        break;
      case 'error':
        console.error(json);
        break;
      case 'info':
      default:
        // Supabase edge-function logs only surface stderr, so info goes to
        // console.error just like the existing `log.info` implementation.
        console.error(json);
        break;
    }
  }

  return {
    info:  (message, data) => emit('info', message, data),
    warn:  (message, data) => emit('warn', message, data),
    error: (message, data) => emit('error', message, data),
    debug: (message, data) => emit('debug', message, data),
    requestId,
  };
}
