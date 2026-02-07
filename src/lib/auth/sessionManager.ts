/**
 * Session Manager
 *
 * Tracks session state, detects session expiry and triggers refresh,
 * handles multiple tabs with BroadcastChannel to sync auth state,
 * detects user activity for session extension.
 *
 * Provides: startSessionTimer, extendSession, endSession
 */

import { logger } from '@/lib/logger';
import { tokenRefreshManager } from '@/lib/auth/tokenRefreshManager';

// --- Types ---

export type SessionState = 'active' | 'idle' | 'expiring' | 'expired';

export interface SessionConfig {
  /** Session timeout in milliseconds (default: 30 minutes) */
  sessionTimeoutMs: number;
  /** Warning threshold before expiry in milliseconds (default: 5 minutes) */
  expiryWarningMs: number;
  /** Idle timeout before marking session idle in milliseconds (default: 15 minutes) */
  idleTimeoutMs: number;
  /** Token refresh scope used with tokenRefreshManager */
  refreshScope: string;
  /** BroadcastChannel name for cross-tab sync */
  channelName: string;
  /** Callback when session state changes */
  onStateChange?: (state: SessionState) => void;
  /** Callback when session needs refresh (return refresh result) */
  onRefreshNeeded?: () => Promise<boolean>;
  /** Callback when session expires (trigger logout) */
  onSessionExpired?: () => void;
}

interface BroadcastMessage {
  type: 'SESSION_EXTENDED' | 'SESSION_ENDED' | 'SESSION_ACTIVITY';
  timestamp: number;
}

// --- Constants ---

const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_EXPIRY_WARNING_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_THROTTLE_MS = 60 * 1000; // Throttle activity detection to once per minute

const USER_ACTIVITY_EVENTS: Array<keyof DocumentEventMap> = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
];

// --- Session Manager Class ---

class SessionManager {
  private state: SessionState = 'expired';
  private config: SessionConfig | null = null;

  private sessionTimer: ReturnType<typeof setTimeout> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  private lastActivityTimestamp = 0;
  private sessionStartTimestamp = 0;
  private channel: BroadcastChannel | null = null;

  private activityHandler: (() => void) | null = null;
  private isDestroyed = false;

  /**
   * Start a new session timer with the given configuration.
   * Sets up activity listeners, BroadcastChannel, and expiry timers.
   */
  startSessionTimer(config: Partial<SessionConfig> & Pick<SessionConfig, 'refreshScope' | 'channelName'>): void {
    // Clean up any existing session first
    this.cleanup();

    this.config = {
      sessionTimeoutMs: config.sessionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS,
      expiryWarningMs: config.expiryWarningMs ?? DEFAULT_EXPIRY_WARNING_MS,
      idleTimeoutMs: config.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS,
      refreshScope: config.refreshScope,
      channelName: config.channelName,
      onStateChange: config.onStateChange,
      onRefreshNeeded: config.onRefreshNeeded,
      onSessionExpired: config.onSessionExpired,
    };

    this.isDestroyed = false;
    this.sessionStartTimestamp = Date.now();
    this.lastActivityTimestamp = Date.now();

    this.setState('active');
    this.setupTimers();
    this.setupActivityListeners();
    this.setupBroadcastChannel();

    logger.debug('[SessionManager] Session started', {
      scope: this.config.refreshScope,
      timeoutMs: this.config.sessionTimeoutMs,
    });
  }

  /**
   * Extend the current session, resetting all timers.
   * Call this after a successful token refresh or explicit user action.
   */
  extendSession(): void {
    if (this.isDestroyed || !this.config) {
      logger.warn('[SessionManager] Cannot extend - no active session');
      return;
    }

    this.lastActivityTimestamp = Date.now();
    this.sessionStartTimestamp = Date.now();

    this.clearTimers();
    this.setupTimers();
    this.setState('active');

    // Broadcast extension to other tabs
    this.broadcast({ type: 'SESSION_EXTENDED', timestamp: Date.now() });

    logger.debug('[SessionManager] Session extended', { scope: this.config.refreshScope });
  }

  /**
   * End the current session and clean up all resources.
   * Call this on explicit logout.
   */
  endSession(): void {
    if (!this.config) return;

    const scope = this.config.refreshScope;

    // Broadcast to other tabs before cleanup
    this.broadcast({ type: 'SESSION_ENDED', timestamp: Date.now() });

    this.setState('expired');
    this.cleanup();

    logger.debug('[SessionManager] Session ended', { scope });
  }

  /**
   * Get the current session state.
   */
  getState(): SessionState {
    return this.state;
  }

  /**
   * Get milliseconds remaining until session expires.
   * Returns 0 if no active session.
   */
  getTimeRemaining(): number {
    if (!this.config || this.state === 'expired') return 0;

    const elapsed = Date.now() - this.sessionStartTimestamp;
    const remaining = this.config.sessionTimeoutMs - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Check if the session is currently active (not expired or idle).
   */
  isActive(): boolean {
    return this.state === 'active' || this.state === 'expiring';
  }

  // --- Private Methods ---

  private setState(newState: SessionState): void {
    if (this.state === newState) return;

    const previousState = this.state;
    this.state = newState;

    logger.debug('[SessionManager] State changed', { from: previousState, to: newState });

    if (this.config?.onStateChange) {
      try {
        this.config.onStateChange(newState);
      } catch (error) {
        logger.error('[SessionManager] onStateChange callback error', error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private setupTimers(): void {
    if (!this.config) return;

    const { sessionTimeoutMs, expiryWarningMs, idleTimeoutMs } = this.config;

    // Session expiry timer
    this.sessionTimer = setTimeout(() => {
      this.handleSessionExpired();
    }, sessionTimeoutMs);

    // Warning timer (fires before expiry to trigger refresh)
    const warningDelay = sessionTimeoutMs - expiryWarningMs;
    if (warningDelay > 0) {
      this.warningTimer = setTimeout(() => {
        this.handleExpiryWarning();
      }, warningDelay);
    }

    // Idle timer
    this.idleTimer = setTimeout(() => {
      this.handleIdle();
    }, idleTimeoutMs);
  }

  private clearTimers(): void {
    if (this.sessionTimer !== null) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
    if (this.warningTimer !== null) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private setupActivityListeners(): void {
    if (typeof document === 'undefined') return;

    this.activityHandler = () => {
      this.handleUserActivity();
    };

    for (const event of USER_ACTIVITY_EVENTS) {
      document.addEventListener(event, this.activityHandler, { passive: true });
    }
  }

  private removeActivityListeners(): void {
    if (typeof document === 'undefined' || !this.activityHandler) return;

    for (const event of USER_ACTIVITY_EVENTS) {
      document.removeEventListener(event, this.activityHandler);
    }
    this.activityHandler = null;
  }

  private setupBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined' || !this.config) return;

    try {
      this.channel = new BroadcastChannel(this.config.channelName);
      this.channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
        this.handleBroadcastMessage(event.data);
      };
    } catch (error) {
      logger.warn('[SessionManager] Failed to create BroadcastChannel', error);
    }
  }

  private closeBroadcastChannel(): void {
    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        // Channel may already be closed
      }
      this.channel = null;
    }
  }

  private broadcast(message: BroadcastMessage): void {
    if (!this.channel) return;

    try {
      this.channel.postMessage(message);
    } catch (error) {
      logger.warn('[SessionManager] Failed to broadcast message', error);
    }
  }

  private handleBroadcastMessage(message: BroadcastMessage): void {
    if (this.isDestroyed) return;

    switch (message.type) {
      case 'SESSION_EXTENDED':
        // Another tab extended the session, sync our timers
        this.sessionStartTimestamp = message.timestamp;
        this.lastActivityTimestamp = message.timestamp;
        this.clearTimers();
        this.setupTimers();
        if (this.state !== 'active') {
          this.setState('active');
        }
        logger.debug('[SessionManager] Session synced from another tab');
        break;

      case 'SESSION_ENDED':
        // Another tab ended the session, expire locally
        this.setState('expired');
        this.clearTimers();
        if (this.config?.onSessionExpired) {
          try {
            this.config.onSessionExpired();
          } catch (error) {
            logger.error('[SessionManager] onSessionExpired callback error', error instanceof Error ? error : new Error(String(error)));
          }
        }
        logger.debug('[SessionManager] Session ended by another tab');
        break;

      case 'SESSION_ACTIVITY':
        // Another tab detected activity, reset idle timer
        this.lastActivityTimestamp = message.timestamp;
        this.resetIdleTimer();
        break;
    }
  }

  private handleUserActivity(): void {
    if (this.isDestroyed || !this.config) return;

    const now = Date.now();

    // Throttle activity handling
    if (now - this.lastActivityTimestamp < ACTIVITY_THROTTLE_MS) return;

    this.lastActivityTimestamp = now;

    // Reset idle timer on activity
    this.resetIdleTimer();

    // If session was idle, make it active again
    if (this.state === 'idle') {
      this.setState('active');
    }

    // Broadcast activity to other tabs
    this.broadcast({ type: 'SESSION_ACTIVITY', timestamp: now });
  }

  private resetIdleTimer(): void {
    if (!this.config) return;

    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.handleIdle();
    }, this.config.idleTimeoutMs);
  }

  private handleIdle(): void {
    if (this.isDestroyed) return;

    this.setState('idle');
    logger.debug('[SessionManager] Session idle - no user activity detected');
  }

  private async handleExpiryWarning(): Promise<void> {
    if (this.isDestroyed || !this.config) return;

    // Only refresh if user has been active recently
    const timeSinceActivity = Date.now() - this.lastActivityTimestamp;
    const isUserActive = timeSinceActivity < this.config.idleTimeoutMs;

    if (!isUserActive) {
      logger.debug('[SessionManager] Skipping refresh - user is idle');
      this.setState('expiring');
      return;
    }

    this.setState('expiring');

    // Attempt to refresh the session
    if (this.config.onRefreshNeeded) {
      try {
        const refreshResult = await tokenRefreshManager.refresh(
          this.config.refreshScope,
          async () => {
            const success = await this.config!.onRefreshNeeded!();
            return { success };
          }
        );

        if (refreshResult.success) {
          // Refresh succeeded, extend the session
          this.extendSession();
        } else {
          logger.warn('[SessionManager] Token refresh failed, session will expire');
        }
      } catch (error) {
        logger.error('[SessionManager] Refresh error', error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private handleSessionExpired(): void {
    if (this.isDestroyed) return;

    this.setState('expired');
    this.clearTimers();

    logger.debug('[SessionManager] Session expired');

    if (this.config?.onSessionExpired) {
      try {
        this.config.onSessionExpired();
      } catch (error) {
        logger.error('[SessionManager] onSessionExpired callback error', error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private cleanup(): void {
    this.isDestroyed = true;
    this.clearTimers();
    this.removeActivityListeners();
    this.closeBroadcastChannel();
    this.config = null;
  }
}

// Singleton instance shared across the application
export const sessionManager = new SessionManager();
