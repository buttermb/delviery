import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { triggerHaptic } from '@/lib/utils/mobile';

/**
 * Mobile Navigation Hook
 * Handles loading states, haptic feedback, and navigation tracking
 */
export function useMobileNavigation() {
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);

  // Show loading state during navigation
  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), 300);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Handle navigation with haptic feedback
  const handleNavigate = (callback: () => void, intensity: 'light' | 'medium' | 'heavy' = 'light') => {
    triggerHaptic(intensity);
    callback();
  };

  return {
    isNavigating,
    handleNavigate,
    currentPath: location.pathname,
  };
}
