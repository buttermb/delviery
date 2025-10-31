import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useGeofencing } from '@/hooks/useGeofencing';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { useDeviceTracking } from '@/hooks/useDeviceTracking';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle2, MapPin, Clock, Shield } from 'lucide-react';
import { MenuProductGrid } from '@/components/menu/MenuProductGrid';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { CartButton } from '@/components/menu/CartButton';
import { CartDrawer } from '@/components/menu/CartDrawer';
import { OrderFormDialog } from '@/components/menu/OrderFormDialog';
import { MenuCartProvider } from '@/contexts/MenuCartContext';
import { toast } from '@/hooks/use-toast';
import type { GeofenceRule } from '@/utils/geofencing';

interface MenuData {
  id: string;
  title: string;
  description: string | null;
  expires_at: string;
  geofence_enabled: boolean;
  geofence_rules: GeofenceRule[];
  time_restriction_enabled: boolean;
  time_restriction_start: string | null;
  time_restriction_end: string | null;
  time_restriction_timezone: string;
  screenshot_protection_enabled: boolean;
  watermark_text: string | null;
  invite_only: boolean;
  max_views_per_customer: number | null;
  view_time_period_days: number | null;
  products: any[];
}

interface AccessValidation {
  access_granted: boolean;
  menu?: MenuData;
  violations?: string[];
  whitelist_entry?: {
    id: string;
    customer_name: string;
    status: string;
  };
}

export default function MenuAccess() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const accessCode = searchParams.get('code');

  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState<AccessValidation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderFormOpen, setOrderFormOpen] = useState(false);

  // Initialize device tracking
  useDeviceTracking();

  // Initialize geofencing
  const { accessGranted: geoAccessGranted, isChecking: geoChecking, violation: geoViolation } = useGeofencing({
    geofences: validation?.menu?.geofence_rules || [],
    enabled: validation?.menu?.geofence_enabled || false,
    onViolation: (details) => {
      toast({
        variant: 'destructive',
        title: 'Location Access Denied',
        description: 'You must be within the allowed location to view this menu.',
      });
    },
  });

  // Initialize screenshot protection
  useScreenshotProtection({
    menuId: validation?.menu?.id || '',
    customerId: validation?.whitelist_entry?.id,
    customerName: validation?.whitelist_entry?.customer_name,
    enabled: validation?.menu?.screenshot_protection_enabled || false,
    watermarkEnabled: validation?.menu?.screenshot_protection_enabled || false,
    watermarkText: validation?.menu?.watermark_text || undefined,
  });

  useEffect(() => {
    validateAccess();
  }, [token, accessCode]);

  const validateAccess = async () => {
    if (!token) {
      setError('Invalid access link');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get user location for geofencing
      let userLocation = null;
      try {
        if (navigator.geolocation) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            });
          });
          userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
        }
      } catch (err) {
        console.log('Geolocation not available:', err);
      }

      // Call validation edge function
      console.log('=== MenuAccess calling menu-access-validate ===');
      console.log('Payload:', {
        encrypted_url_token: token,
        access_code: accessCode,
        location: userLocation,
        device_fingerprint: localStorage.getItem('device_fingerprint'),
        user_agent: navigator.userAgent,
      });

      const { data, error: validationError } = await supabase.functions.invoke('menu-access-validate', {
        body: {
          encrypted_url_token: token,
          access_code: accessCode,
          location: userLocation,
          device_fingerprint: localStorage.getItem('device_fingerprint'),
          user_agent: navigator.userAgent,
        },
      });

      if (validationError) throw validationError;

      setValidation(data);

      if (!data.access_granted) {
        setError(data.violations?.join(', ') || 'Access denied');
      }
    } catch (err: any) {
      console.error('Access validation error:', err);
      setError(err.message || 'Failed to validate access');
      toast({
        variant: 'destructive',
        title: 'Access Error',
        description: 'Unable to validate menu access. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if currently within time restrictions
  const isWithinTimeRestriction = () => {
    if (!validation?.menu?.time_restriction_enabled) return true;

    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', {
      hour12: false,
      timeZone: validation.menu.time_restriction_timezone,
    });

    const start = validation.menu.time_restriction_start;
    const end = validation.menu.time_restriction_end;

    if (!start || !end) return true;

    return currentTime >= start && currentTime <= end;
  };

  if (loading || geoChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Validating access...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !validation?.access_granted || !geoAccessGranted || !isWithinTimeRestriction()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                {!geoAccessGranted
                  ? 'You must be within the allowed location to access this menu.'
                  : !isWithinTimeRestriction()
                  ? 'This menu is only available during specific hours.'
                  : error || 'You do not have permission to view this menu.'}
              </AlertDescription>
            </Alert>

            {validation?.violations && validation.violations.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Reasons:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {validation.violations.map((violation, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      {violation}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {geoViolation && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location Issue
                </p>
                <p className="text-sm text-muted-foreground">{geoViolation.reason}</p>
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                If you believe this is an error, please contact the merchant.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const menu = validation.menu!;

  return (
    <MenuCartProvider>
      <div className="min-h-screen bg-background">
      <MenuHeader
        title={menu.title}
        description={menu.description}
        expiresAt={menu.expires_at}
        customerName={validation.whitelist_entry?.customer_name}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Security indicators */}
        <div className="flex flex-wrap gap-2 mb-6">
          {menu.geofence_enabled && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
              <MapPin className="h-4 w-4 text-primary" />
              Location Verified
            </div>
          )}
          {menu.time_restriction_enabled && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
              <Clock className="h-4 w-4 text-primary" />
              Time Restricted
            </div>
          )}
          {menu.screenshot_protection_enabled && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
              <Shield className="h-4 w-4 text-primary" />
              Protected Content
            </div>
          )}
        </div>

        {/* Success message */}
        <Alert className="mb-6 border-primary/50 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertDescription>
            Welcome! You have been granted access to this exclusive menu.
          </AlertDescription>
        </Alert>

        {/* Products */}
        <MenuProductGrid 
          products={menu.products} 
          menuId={menu.id}
          whitelistEntryId={validation.whitelist_entry?.id}
        />

        {/* Floating Cart Button */}
        <CartButton onClick={() => setCartOpen(true)} />

        {/* Cart Drawer */}
        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            setOrderFormOpen(true);
          }}
        />

        {/* Order Form Dialog */}
        <OrderFormDialog
          open={orderFormOpen}
          onClose={() => setOrderFormOpen(false)}
          menuId={menu.id}
          whitelistEntryId={validation.whitelist_entry?.id}
        />
      </div>
      </div>
    </MenuCartProvider>
  );
}
