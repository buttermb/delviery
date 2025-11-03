/**
 * Panic Button Component
 * Emergency data wipe feature for security
 * Hold for 3 seconds to activate
 */

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

export function PanicButton() {
  const [holdTime, setHoldTime] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const handlePanic = async () => {
    if (!tenantId) return;

    try {
      // Call emergency wipe function
      const { error } = await supabase.rpc('emergency_wipe', {
        tenant_id: tenantId
      });

      if (error) throw error;

      // Clear local storage
      localStorage.clear();
      sessionStorage.clear();

      // Clear all cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      // Redirect to maintenance page
      window.location.href = '/maintenance';
    } catch (error: any) {
      console.error('Panic failed:', error);
      // Still redirect even if RPC fails
      window.location.href = '/maintenance';
    }
  };

  const handleMouseDown = () => {
    setIsHolding(true);
    setHoldTime(0);

    intervalRef.current = setInterval(() => {
      setHoldTime((prev) => {
        const next = prev + 100;
        if (next >= 3000) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          handlePanic();
          return 3000;
        }
        return next;
      });
    }, 100);
  };

  const handleMouseUp = () => {
    setIsHolding(false);
    setHoldTime(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const progress = (holdTime / 3000) * 100;

  return (
    <button
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      className={cn(
        'fixed bottom-24 right-4 z-50',
        'w-14 h-14 rounded-full shadow-2xl',
        'flex items-center justify-center',
        'bg-red-600 hover:bg-red-700',
        'transition-all duration-200',
        'lg:hidden',
        isHolding && 'scale-110'
      )}
      aria-label="Emergency panic button - hold for 3 seconds"
    >
      <AlertTriangle className="text-white h-6 w-6" />
      
      {/* Progress ring */}
      {isHolding && (
        <svg
          className="absolute inset-0 w-full h-full -rotate-90"
          viewBox="0 0 56 56"
        >
          <circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeDasharray={`${(holdTime / 3000) * 150.8} 150.8`}
            className="transition-all duration-100"
          />
        </svg>
      )}
    </button>
  );
}

