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
    console.log(formatLog('info', message, context));
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
