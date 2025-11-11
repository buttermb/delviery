/**
 * Button Monitoring System
 * Tracks all button interactions, errors, and success rates
 * Helps identify broken buttons and monitor button health
 */

import { logger } from '@/lib/logger';

export interface ButtonInteraction {
  buttonId: string;
  component: string;
  action: string;
  timestamp: string;
  status: 'success' | 'error' | 'timeout';
  error?: string;
  duration?: number;
  userAgent?: string;
  url?: string;
}

interface ButtonStats {
  buttonId: string;
  component: string;
  action: string;
  totalClicks: number;
  successCount: number;
  errorCount: number;
  timeoutCount: number;
  lastError?: string;
  lastErrorTime?: string;
  averageDuration?: number;
  lastClickTime?: string;
}

class ButtonMonitor {
  private interactions: ButtonInteraction[] = [];
  private stats: Map<string, ButtonStats> = new Map();
  private readonly MAX_INTERACTIONS = 1000; // Keep last 1000 interactions
  private readonly MAX_STATS = 500; // Keep stats for 500 unique buttons

  /**
   * Track a button click
   */
  trackClick(
    buttonId: string,
    component: string,
    action: string,
    startTime: number
  ): () => void {
    const timestamp = new Date().toISOString();
    const url = typeof window !== 'undefined' ? window.location.href : 'unknown';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';

    // Return cleanup function to call on completion
    return (status: 'success' | 'error' | 'timeout' = 'success', error?: Error | string) => {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : error || undefined;

      const interaction: ButtonInteraction = {
        buttonId,
        component,
        action,
        timestamp,
        status,
        error: errorMessage,
        duration,
        userAgent,
        url,
      };

      this.recordInteraction(interaction);
      this.updateStats(interaction);

      // Log errors immediately
      if (status === 'error') {
        logger.error(
          `Button error: ${component}.${action}`,
          error instanceof Error ? error : new Error(errorMessage || 'Unknown error'),
          {
            component: 'ButtonMonitor',
            buttonId,
            duration,
            url,
          }
        );
      } else if (status === 'timeout') {
        logger.warn(
          `Button timeout: ${component}.${action}`,
          { buttonId, duration, url },
          'ButtonMonitor'
        );
      }
    };
  }

  /**
   * Record an interaction
   */
  private recordInteraction(interaction: ButtonInteraction): void {
    this.interactions.push(interaction);

    // Keep only last N interactions
    if (this.interactions.length > this.MAX_INTERACTIONS) {
      this.interactions.shift();
    }
  }

  /**
   * Update statistics for a button
   */
  private updateStats(interaction: ButtonInteraction): void {
    const key = `${interaction.component}.${interaction.action}`;
    const existing = this.stats.get(key);

    if (existing) {
      existing.totalClicks++;
      if (interaction.status === 'success') existing.successCount++;
      if (interaction.status === 'error') existing.errorCount++;
      if (interaction.status === 'timeout') existing.timeoutCount++;
      if (interaction.error) {
        existing.lastError = interaction.error;
        existing.lastErrorTime = interaction.timestamp;
      }
      if (interaction.duration) {
        existing.averageDuration =
          (existing.averageDuration || 0) * (existing.totalClicks - 1) + interaction.duration;
        existing.averageDuration /= existing.totalClicks;
      }
      existing.lastClickTime = interaction.timestamp;
    } else {
      // Only create new stats if under limit
      if (this.stats.size < this.MAX_STATS) {
        this.stats.set(key, {
          buttonId: interaction.buttonId,
          component: interaction.component,
          action: interaction.action,
          totalClicks: 1,
          successCount: interaction.status === 'success' ? 1 : 0,
          errorCount: interaction.status === 'error' ? 1 : 0,
          timeoutCount: interaction.status === 'timeout' ? 1 : 0,
          lastError: interaction.error,
          lastErrorTime: interaction.error ? interaction.timestamp : undefined,
          averageDuration: interaction.duration,
          lastClickTime: interaction.timestamp,
        });
      }
    }
  }

  /**
   * Get all button statistics
   */
  getStats(): ButtonStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Get statistics for a specific button
   */
  getButtonStats(component: string, action: string): ButtonStats | undefined {
    const key = `${component}.${action}`;
    return this.stats.get(key);
  }

  /**
   * Get broken buttons (error rate > threshold)
   */
  getBrokenButtons(errorRateThreshold: number = 0.5): ButtonStats[] {
    return this.getStats().filter((stat) => {
      const errorRate = stat.totalClicks > 0 ? stat.errorCount / stat.totalClicks : 0;
      return errorRate >= errorRateThreshold;
    });
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 50): ButtonInteraction[] {
    return this.interactions
      .filter((i) => i.status === 'error')
      .slice(-limit)
      .reverse();
  }

  /**
   * Get button health report
   */
  getHealthReport(): {
    totalButtons: number;
    totalClicks: number;
    successRate: number;
    errorRate: number;
    brokenButtons: number;
    recentErrors: number;
    topErrors: Array<{ button: string; count: number; lastError: string }>;
  } {
    const stats = this.getStats();
    const totalClicks = stats.reduce((sum, s) => sum + s.totalClicks, 0);
    const totalSuccess = stats.reduce((sum, s) => sum + s.successCount, 0);
    const totalErrors = stats.reduce((sum, s) => sum + s.errorCount, 0);
    const brokenButtons = this.getBrokenButtons().length;
    const recentErrors = this.getRecentErrors(10);

    // Top errors by count
    const errorMap = new Map<string, { count: number; lastError: string }>();
    stats.forEach((stat) => {
      if (stat.errorCount > 0) {
        const key = `${stat.component}.${stat.action}`;
        errorMap.set(key, {
          count: stat.errorCount,
          lastError: stat.lastError || 'Unknown error',
        });
      }
    });
    const topErrors = Array.from(errorMap.entries())
      .map(([button, data]) => ({ button, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalButtons: stats.length,
      totalClicks,
      successRate: totalClicks > 0 ? totalSuccess / totalClicks : 0,
      errorRate: totalClicks > 0 ? totalErrors / totalClicks : 0,
      brokenButtons,
      recentErrors: recentErrors.length,
      topErrors,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.interactions = [];
    this.stats.clear();
  }

  /**
   * Export data for debugging
   */
  exportData(): {
    interactions: ButtonInteraction[];
    stats: ButtonStats[];
    healthReport: ReturnType<typeof this.getHealthReport>;
  } {
    return {
      interactions: [...this.interactions],
      stats: this.getStats(),
      healthReport: this.getHealthReport(),
    };
  }
}

// Singleton instance
export const buttonMonitor = new ButtonMonitor();

/**
 * Hook to monitor button clicks
 */
export function useButtonMonitor(component: string, action: string, buttonId?: string) {
  const id = buttonId || `${component}-${action}-${Date.now()}`;

  const trackClick = () => {
    const startTime = Date.now();
    return buttonMonitor.trackClick(id, component, action, startTime);
  };

  return { trackClick, buttonId: id };
}

/**
 * Higher-order function to wrap button onClick handlers
 */
export function withButtonMonitor<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  component: string,
  action: string,
  buttonId?: string
): T {
  return (async (...args: Parameters<T>) => {
    const id = buttonId || `${component}-${action}-${Date.now()}`;
    const startTime = Date.now();
    const complete = buttonMonitor.trackClick(id, component, action, startTime);

    try {
      const result = await handler(...args);
      complete('success');
      return result;
    } catch (error) {
      complete('error', error);
      throw error;
    }
  }) as T;
}

/**
 * React hook to automatically monitor button clicks
 */
export function useMonitoredButton(
  component: string,
  action: string,
  onClick?: () => void | Promise<void>,
  buttonId?: string
) {
  const { trackClick } = useButtonMonitor(component, action, buttonId);

  const monitoredOnClick = async () => {
    const complete = trackClick();
    try {
      if (onClick) {
        await onClick();
      }
      complete('success');
    } catch (error) {
      complete('error', error);
      throw error;
    }
  };

  return { onClick: monitoredOnClick };
}

