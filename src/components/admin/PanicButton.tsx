/**
 * Panic Button Component
 * Emergency data wipe feature for security
 * Hold for 3 seconds to activate
 */

import { useState, useRef, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export function PanicButton() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [holdTime, setHoldTime] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const PANIC_DURATION = 3000; // 3 seconds

  const handlePanic = async () => {
    if (!tenantId) return;

    try {
      // Call emergency wipe function
      const { error } = await supabase.rpc('emergency_wipe', {
        tenant_id: tenantId,
      });

      if (error) {
        console.error('Emergency wipe error:', error);
        // Still proceed with local cleanup even if RPC fails
      }

      // Clear local storage
      localStorage.clear();
      sessionStorage.clear();

      // Clear cookies
      document.cookie.split(';').forEach((c) => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      });

      // Show toast
      toast({
        title: 'Emergency Wipe Activated',
        description: 'All data has been cleared. Redirecting...',
        variant: 'destructive',
      });

      // Redirect to maintenance page
      setTimeout(() => {
        window.location.href = '/maintenance';
      }, 1000);
    } catch (error: any) {
      console.error('Panic button error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to execute emergency wipe',
        variant: 'destructive',
      });
    } finally {
      setIsHolding(false);
      setHoldTime(0);
    }
  };

  const handleMouseDown = () => {
    setIsHolding(true);
    startTimeRef.current = Date.now();
    
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setHoldTime(elapsed);

      if (elapsed >= PANIC_DURATION) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        handlePanic();
      }
    }, 100);
  };

  const handleMouseUp = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsHolding(false);
    setHoldTime(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseDown();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseUp();
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const progress = Math.min((holdTime / PANIC_DURATION) * 100, 100);

  return (
    <button
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseLeave={handleMouseUp}
      className="fixed bottom-20 right-4 w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full shadow-lg flex items-center justify-center z-50 lg:hidden touch-manipulation transition-colors active:scale-95"
      aria-label="Emergency panic button - hold for 3 seconds"
      type="button"
    >
      <AlertTriangle className="text-white h-6 w-6" />
      {isHolding && (
        <>
          <div
            className="absolute inset-0 bg-red-800 rounded-full opacity-50 transition-transform"
            style={{
              transform: `scale(${progress / 100})`,
            }}
          />
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            {Math.ceil((PANIC_DURATION - holdTime) / 1000)}s
          </div>
        </>
      )}
    </button>
  );
}

