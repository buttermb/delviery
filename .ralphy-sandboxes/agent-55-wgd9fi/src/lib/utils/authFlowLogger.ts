import { logger } from '@/lib/logger';
/**
 * Auth Flow Logging Utility
 * Provides detailed logging for authentication flows with performance metrics
 */

import { ErrorCategory } from './networkResilience';

/**
 * Auth flow steps
 */
export enum AuthFlowStep {
  INIT = 'INIT',
  VALIDATE_INPUT = 'VALIDATE_INPUT',
  NETWORK_REQUEST = 'NETWORK_REQUEST',
  PARSE_RESPONSE = 'PARSE_RESPONSE',
  STORE_TOKEN = 'STORE_TOKEN',
  VERIFY_TOKEN = 'VERIFY_TOKEN',
  REFRESH_TOKEN = 'REFRESH_TOKEN',
  REDIRECT = 'REDIRECT',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

/**
 * Auth action types
 */
export enum AuthAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  SIGNUP = 'SIGNUP',
  VERIFY = 'VERIFY',
  REFRESH = 'REFRESH',
  IMPERSONATE = 'IMPERSONATE',
}

/**
 * Performance metrics for auth flow
 */
export interface AuthFlowMetrics {
  action: AuthAction;
  step: AuthFlowStep;
  startTime: number;
  endTime?: number;
  duration?: number;
  attempts: number;
  networkLatency?: number;
  errorCategory?: ErrorCategory;
  errorMessage?: string;
  success: boolean;
}

/**
 * Auth flow logger class
 */
class AuthFlowLogger {
  private flows: Map<string, AuthFlowMetrics> = new Map();
  private currentFlowId: string | null = null;

  /**
   * Start a new auth flow
   */
  startFlow(action: AuthAction, metadata?: Record<string, unknown>): string {
    const flowId = `${action}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    const metrics: AuthFlowMetrics = {
      action,
      step: AuthFlowStep.INIT,
      startTime,
      attempts: 0,
      success: false,
    };

    this.flows.set(flowId, metrics);
    this.currentFlowId = flowId;

    logger.info('Auth flow started', {
      flowId,
      action,
      metadata,
      timestamp: new Date().toISOString(),
    });

    return flowId;
  }

  /**
   * Log a step in the current flow
   */
  logStep(
    flowId: string,
    step: AuthFlowStep,
    metadata?: Record<string, unknown>
  ): void {
    const metrics = this.flows.get(flowId);
    if (!metrics) {
      logger.warn('Attempted to log step for unknown flow', { flowId, step });
      return;
    }

    metrics.step = step;
    metrics.attempts++;

    const currentTime = performance.now();
    const stepDuration = currentTime - (metrics.endTime || metrics.startTime);

    logger.debug('Auth flow step', {
      flowId,
      action: metrics.action,
      step,
      stepDuration: `${stepDuration.toFixed(2)}ms`,
      totalDuration: `${(currentTime - metrics.startTime).toFixed(2)}ms`,
      metadata,
    });

    // Track network latency for network requests
    if (step === AuthFlowStep.NETWORK_REQUEST) {
      metrics.networkLatency = stepDuration;
    }
  }

  /**
   * Log a fetch attempt
   */
  logFetchAttempt(
    flowId: string,
    url: string,
    attempt: number,
    metadata?: Record<string, unknown>
  ): void {
    logger.debug('Auth fetch attempt', {
      flowId,
      url,
      attempt,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  /**
   * Log a fetch retry
   */
  logFetchRetry(
    flowId: string,
    url: string,
    attempt: number,
    error: unknown,
    delay: number
  ): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.warn('Auth fetch retry', {
      flowId,
      url,
      attempt,
      error: errorMessage,
      delay,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log fetch success
   */
  logFetchSuccess(
    flowId: string,
    url: string,
    status: number,
    duration: number
  ): void {
    logger.info('Auth fetch success', {
      flowId,
      url,
      status,
      duration: `${duration.toFixed(2)}ms`,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log fetch failure
   */
  logFetchFailure(
    flowId: string,
    url: string,
    error: unknown,
    category: ErrorCategory,
    attempts: number
  ): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Auth fetch failure', error instanceof Error ? error : new Error(errorMessage), {
      flowId,
      url,
      category,
      attempts,
      errorMessage,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Complete a flow successfully
   */
  completeFlow(flowId: string, metadata?: Record<string, unknown>): void {
    const metrics = this.flows.get(flowId);
    if (!metrics) {
      logger.warn('Attempted to complete unknown flow', { flowId });
      return;
    }

    const endTime = performance.now();
    metrics.endTime = endTime;
    metrics.duration = endTime - metrics.startTime;
    metrics.step = AuthFlowStep.COMPLETE;
    metrics.success = true;

    logger.info('Auth flow completed', {
      flowId,
      action: metrics.action,
      duration: `${metrics.duration.toFixed(2)}ms`,
      attempts: metrics.attempts,
      networkLatency: metrics.networkLatency ? `${metrics.networkLatency.toFixed(2)}ms` : undefined,
      metadata,
      timestamp: new Date().toISOString(),
    });

    // Clean up after 5 minutes
    setTimeout(() => {
      this.flows.delete(flowId);
    }, 5 * 60 * 1000);
  }

  /**
   * Fail a flow
   */
  failFlow(
    flowId: string,
    error: unknown,
    category: ErrorCategory,
    metadata?: Record<string, unknown>
  ): void {
    const metrics = this.flows.get(flowId);
    if (!metrics) {
      logger.warn('Attempted to fail unknown flow', { flowId });
      return;
    }

    const endTime = performance.now();
    metrics.endTime = endTime;
    metrics.duration = endTime - metrics.startTime;
    metrics.step = AuthFlowStep.ERROR;
    metrics.success = false;
    metrics.errorCategory = category;
    metrics.errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Auth flow failed', error instanceof Error ? error : new Error(metrics.errorMessage), {
      flowId,
      action: metrics.action,
      duration: `${metrics.duration.toFixed(2)}ms`,
      attempts: metrics.attempts,
      category,
      errorMessage: metrics.errorMessage,
      metadata,
      timestamp: new Date().toISOString(),
    });

    // Clean up after 5 minutes
    setTimeout(() => {
      this.flows.delete(flowId);
    }, 5 * 60 * 1000);
  }

  /**
   * Get current flow ID
   */
  getCurrentFlowId(): string | null {
    return this.currentFlowId;
  }

  /**
   * Get flow metrics
   */
  getFlowMetrics(flowId: string): AuthFlowMetrics | undefined {
    return this.flows.get(flowId);
  }

  /**
   * Get all active flows
   */
  getActiveFlows(): AuthFlowMetrics[] {
    return Array.from(this.flows.values()).filter(
      metrics => metrics.step !== AuthFlowStep.COMPLETE && metrics.step !== AuthFlowStep.ERROR
    );
  }
}

// Singleton instance
export const authFlowLogger = new AuthFlowLogger();

