/**
 * useDashboardTour Hook
 *
 * Manages the dashboard tour state for new users using react-joyride.
 * Stores completion status in localStorage to show tour only once.
 */

import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS, safeStorage } from '@/constants/storageKeys';
import { logger } from '@/lib/logger';
import type { CallBackProps, STATUS, EVENTS } from 'react-joyride';

interface UseDashboardTourOptions {
  /** Delay before auto-starting the tour for new users (ms) */
  autoStartDelay?: number;
  /** Whether to automatically start tour for new users */
  autoStart?: boolean;
}

interface UseDashboardTourReturn {
  /** Whether the tour is currently running */
  isRunning: boolean;
  /** Current step index */
  stepIndex: number;
  /** Whether the tour has been completed before */
  hasCompletedTour: boolean;
  /** Start the tour */
  startTour: () => void;
  /** Stop/skip the tour */
  stopTour: () => void;
  /** Reset tour completion status (allows re-triggering) */
  resetTour: () => void;
  /** Handle joyride callback events */
  handleJoyrideCallback: (data: CallBackProps) => void;
}

export function useDashboardTour(
  options: UseDashboardTourOptions = {}
): UseDashboardTourReturn {
  const { autoStartDelay = 1000, autoStart = true } = options;

  const [isRunning, setIsRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(() => {
    const completed = safeStorage.getItem(STORAGE_KEYS.DASHBOARD_TOUR_COMPLETED);
    return completed === 'true';
  });

  // Auto-start tour for new users after a delay
  useEffect(() => {
    if (!autoStart || hasCompletedTour) {
      return;
    }

    const timer = setTimeout(() => {
      logger.info('[DashboardTour] Auto-starting tour for new user');
      setIsRunning(true);
    }, autoStartDelay);

    return () => clearTimeout(timer);
  }, [autoStart, hasCompletedTour, autoStartDelay]);

  const startTour = useCallback(() => {
    logger.info('[DashboardTour] Starting tour');
    setStepIndex(0);
    setIsRunning(true);
  }, []);

  const stopTour = useCallback(() => {
    logger.info('[DashboardTour] Stopping tour');
    setIsRunning(false);
    setStepIndex(0);
  }, []);

  const completeTour = useCallback(() => {
    logger.info('[DashboardTour] Tour completed');
    setIsRunning(false);
    setStepIndex(0);
    setHasCompletedTour(true);
    safeStorage.setItem(STORAGE_KEYS.DASHBOARD_TOUR_COMPLETED, 'true');
  }, []);

  const resetTour = useCallback(() => {
    logger.info('[DashboardTour] Resetting tour');
    safeStorage.removeItem(STORAGE_KEYS.DASHBOARD_TOUR_COMPLETED);
    setHasCompletedTour(false);
    setStepIndex(0);
  }, []);

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { status, type, index, action } = data;

      // Handle step changes
      if (type === 'step:after') {
        if (action === 'next') {
          setStepIndex(index + 1);
        } else if (action === 'prev') {
          setStepIndex(index - 1);
        }
      }

      // Handle tour completion or skip
      const finishedStatuses: string[] = ['finished', 'skipped'];
      if (finishedStatuses.includes(status as string)) {
        completeTour();
      }

      // Handle close button
      if (type === 'tour:end') {
        completeTour();
      }
    },
    [completeTour]
  );

  return {
    isRunning,
    stepIndex,
    hasCompletedTour,
    startTour,
    stopTour,
    resetTour,
    handleJoyrideCallback,
  };
}
