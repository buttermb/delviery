/**
 * Customer Portal Mode Switcher
 * Allows customers to toggle between B2C (Retail) and B2B (Wholesale/Marketplace) modes
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Building2, Shield } from 'lucide-react';
import { STORAGE_KEYS, safeStorage } from '@/constants/storageKeys';
import { cn } from '@/lib/utils';

type CustomerMode = 'retail' | 'wholesale';

interface ModeSwitcherProps {
  currentMode?: CustomerMode;
  onModeChange?: (mode: CustomerMode) => void;
  className?: string;
  isBusinessBuyer?: boolean;
  isVerified?: boolean;
}

export function ModeSwitcher({ 
  currentMode, 
  onModeChange, 
  className,
  isBusinessBuyer = false,
  isVerified = false
}: ModeSwitcherProps) {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [mode, setMode] = useState<CustomerMode>(currentMode || 'retail');

  // Load saved mode preference
  useEffect(() => {
    try {
      const savedMode = safeStorage.getItem(STORAGE_KEYS.CUSTOMER_MODE) as CustomerMode | null;
      if (savedMode && (savedMode === 'retail' || savedMode === 'wholesale')) {
        setMode(savedMode);
        onModeChange?.(savedMode);
      }
    } catch {
      // Ignore storage errors
    }
  }, [onModeChange]);

  // Sync with prop changes
  useEffect(() => {
    if (currentMode) {
      setMode(currentMode);
    }
  }, [currentMode]);

  const handleModeChange = (newMode: CustomerMode) => {
    // Prevent switching to wholesale if not verified business buyer
    if (newMode === 'wholesale' && (!isBusinessBuyer || !isVerified)) {
      // Navigate to settings to verify business
      navigate(`/${slug}/shop/settings`);
      return;
    }

    setMode(newMode);
    
    // Save to localStorage
    try {
      safeStorage.setItem(STORAGE_KEYS.CUSTOMER_MODE, newMode);
    } catch {
      // Ignore storage errors
    }

    // Notify parent
    onModeChange?.(newMode);

    // Navigate based on mode
    if (newMode === 'wholesale') {
      // Navigate to wholesale marketplace
      navigate(`/${slug}/shop/wholesale`);
    } else {
      // Navigate to retail shop
      navigate(`/${slug}/shop`);
    }
  };

  const handleVerifyBusiness = () => {
    navigate(`/${slug}/shop/settings`);
  };

  // Determine if wholesale button should be enabled
  const canAccessWholesale = isBusinessBuyer && isVerified;

  return (
    <div className={cn('flex items-center gap-2 p-1 bg-muted rounded-lg', className)}>
        <Button
          variant={mode === 'retail' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange('retail')}
          className={cn(
            'flex-1',
            mode === 'retail' && 'bg-background shadow-sm'
          )}
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Retail</span>
          <span className="sm:hidden">B2C</span>
        </Button>
        {canAccessWholesale ? (
          <Button
            variant={mode === 'wholesale' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleModeChange('wholesale')}
            className={cn(
              'flex-1',
              mode === 'wholesale' && 'bg-background shadow-sm'
            )}
          >
            <Building2 className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Wholesale</span>
            <span className="sm:hidden">B2B</span>
          </Button>
        ) : isBusinessBuyer ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleVerifyBusiness}
            className="flex-1 border-warning text-warning hover:bg-warning/10"
          >
            <Shield className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Verify Business</span>
            <span className="sm:hidden">Verify</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled
            className="flex-1 opacity-50"
          >
            <Building2 className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Wholesale</span>
            <span className="sm:hidden">B2B</span>
          </Button>
        )}
    </div>
  );
}

/**
 * Mode Banner - Shows current mode and allows switching
 */
export function ModeBanner({ 
  currentMode, 
  onModeChange,
  isBusinessBuyer = false,
  isVerified = false
}: { 
  currentMode?: CustomerMode; 
  onModeChange?: (mode: CustomerMode) => void;
  isBusinessBuyer?: boolean;
  isVerified?: boolean;
}) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {currentMode === 'wholesale' ? (
            <>
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <div className="font-semibold text-sm">Wholesale Mode</div>
                <div className="text-xs text-muted-foreground">
                  Browse and order from wholesale marketplace
                </div>
              </div>
            </>
          ) : (
            <>
              <ShoppingBag className="h-5 w-5 text-primary" />
              <div>
                <div className="font-semibold text-sm">Retail Mode</div>
                <div className="text-xs text-muted-foreground">
                  Shop retail products and menus
                </div>
              </div>
            </>
          )}
        </div>
        <ModeSwitcher 
          currentMode={currentMode} 
          onModeChange={onModeChange}
          isBusinessBuyer={isBusinessBuyer}
          isVerified={isVerified}
        />
      </div>
    </div>
  );
}

