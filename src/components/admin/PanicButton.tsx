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
      const { data, error } = await supabase.functions.invoke('emergency-wipe', {
        body: { tenant_id: tenantId },
      });

      if (error) throw error;

      toast({
        title: 'Emergency wipe activated',
        description: 'All tenant data has been wiped. Redirecting...',
        variant: 'destructive',
      });

      // Redirect to maintenance page
      setTimeout(() => {
        navigate('/maintenance');
      }, 2000);
    } catch (error: any) {
      console.error('Panic button error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to activate emergency wipe',
        variant: 'destructive',
      });
    }
  };

  const handleMouseDown = () => {
    setIsHolding(true);
    startTimeRef.current = Date.now();
    
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setHoldTime(elapsed);
      
      if (elapsed >= PANIC_DURATION) {
        handlePanic();
        handleMouseUp();
      }
    }, 10);
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

  const progress = (holdTime / PANIC_DURATION) * 100;

  return (
    <button
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      className="fixed bottom-4 right-4 z-50 w-16 h-16 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg flex items-center justify-center transition-all duration-200 opacity-0 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
      aria-label="Emergency data wipe"
      title="Hold for 3 seconds to activate emergency data wipe"
    >
      <div className="relative">
        <AlertTriangle className="h-6 w-6" />
        {isHolding && (
          <div
            className="absolute inset-0 rounded-full border-4 border-destructive-foreground"
            style={{
              clipPath: `inset(0 ${100 - progress}% 0 0)`,
            }}
          />
        )}
      </div>
    </button>
  );
}

