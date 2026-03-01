import { logger } from '@/lib/logger';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { useDeviceTracking } from '@/hooks/useDeviceTracking';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { EnhancedMenuProductGrid } from '@/components/menu/EnhancedMenuProductGrid';
import { MenuHeader } from '@/components/menu/MenuHeader';
import { CartButton } from '@/components/menu/CartButton';
import { CartDrawer } from '@/components/menu/CartDrawer';
import { ModernCheckoutFlow } from '@/components/menu/ModernCheckoutFlow';
import { useMenuCartStore } from '@/stores/menuCartStore';
import { toast } from 'sonner';
import { STORAGE_KEYS } from '@/constants/storageKeys';

interface MenuProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  image_url?: string | null;
  images?: string[];
  quantity_lbs?: number;
  prices?: Record<string, number>;
  strain_type?: string;
  thc_percentage?: number;
  cbd_percentage?: number;
  terpenes?: Array<{ name: string; percentage: number }>;
  effects?: string[];
  flavors?: string[];
}

interface AccessValidation {
  access_granted: boolean;
  menu_data?: {
    id: string;
    tenant_id?: string;
    name: string;
    description: string | null;
    products: MenuProduct[];
    menu_id: string;
    min_order_quantity: number;
    max_order_quantity: number;
    expiration_date?: string | null;
    never_expires?: boolean;
    appearance_settings: {
      show_product_images: boolean;
      show_availability: boolean;
    };
    security_settings?: {
      screenshot_protection_enabled?: boolean;
      watermark_enabled?: boolean;
      watermark_text?: string;
      require_geofence?: boolean;
      geofence_lat?: number;
      geofence_lng?: number;
      geofence_radius?: number;
    };
  };
  violations?: string[];
  remaining_views?: number | null;
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

  const clearCart = useMenuCartStore((state) => state.clearCart);

  // Initialize device tracking
  useDeviceTracking();

  // Initialize screenshot protection based on menu security settings
  const securitySettings = validation?.menu_data?.security_settings;
  const screenshotProtectionEnabled = Boolean(securitySettings?.screenshot_protection_enabled ?? true);
  const watermarkEnabled = Boolean(securitySettings?.watermark_enabled ?? true);
  const watermarkText = securitySettings?.watermark_text
    || validation?.whitelist_entry?.customer_name
    || 'CONFIDENTIAL';

  useScreenshotProtection({
    menuId: validation?.menu_data?.id ?? '',
    customerId: validation?.whitelist_entry?.id,
    customerName: validation?.whitelist_entry?.customer_name,
    enabled: screenshotProtectionEnabled && Boolean(validation?.access_granted),
    watermarkEnabled: watermarkEnabled,
    watermarkText: watermarkText,
  });

  useEffect(() => {
    validateAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- validateAccess is defined below, only run when token/accessCode changes
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
        logger.debug('Geolocation not available', { error: err, component: 'MenuAccess' });
      }

      // Call validation edge function
      logger.debug('MenuAccess calling menu-access-validate', {
        encrypted_url_token: token,
        access_code: accessCode,
        location: userLocation,
        device_fingerprint: localStorage.getItem(STORAGE_KEYS.DEVICE_FINGERPRINT),
        user_agent: navigator.userAgent,
      }, 'MenuAccess');

      const { data, error: validationError } = await supabase.functions.invoke('menu-access-validate', {
        body: {
          encrypted_url_token: token,
          access_code: accessCode,
          location: userLocation,
          device_fingerprint: localStorage.getItem(STORAGE_KEYS.DEVICE_FINGERPRINT),
          user_agent: navigator.userAgent,
        },
      });

      if (validationError) throw validationError;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Menu access validation failed';
        throw new Error(errorMessage);
      }

      logger.debug('Validation response', {
        access_granted: data?.access_granted,
        products_count: data?.menu_data?.products?.length
      }, 'MenuAccess');

      setValidation(data);

      if (!data.access_granted) {
        setError(data.violations?.join(', ') || 'Access denied');
      }
    } catch (err: unknown) {
      logger.error('Access validation error', err, { component: 'MenuAccess' });
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate access';
      setError(errorMessage);
      toast.error('Unable to validate menu access. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
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

  // Detect expired menu specifically for a clearer user message
  const isMenuExpired = error?.toLowerCase().includes('expired') ||
    validation?.violations?.some(v => v.toLowerCase().includes('expired'));

  if (isMenuExpired) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
              <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-2xl">This Menu Has Expired</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              The link you followed has expired. Menus are time-limited for security purposes.
            </p>
            <p className="text-sm text-muted-foreground">
              Please contact the merchant for an updated link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !validation?.access_granted) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
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
                {error || 'You do not have permission to view this menu.'}
              </AlertDescription>
            </Alert>

            {validation?.violations && validation.violations.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Reasons:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {validation.violations.map((violation, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-destructive">&bull;</span>
                      {violation}
                    </li>
                  ))}
                </ul>
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

  const menuData = validation.menu_data!;

  const handleOrderComplete = (orderId?: string) => {
    toast.success('Order placed successfully!');
    clearCart();
    setOrderFormOpen(false);
    logger.info('Menu order completed', { orderId, component: 'MenuAccess' });
  };

  return (
    <div className="min-h-dvh bg-background">
      <MenuHeader
        title={menuData.name}
        description={menuData.description}
        expiresAt={!menuData.never_expires && menuData.expiration_date ? menuData.expiration_date : null}
        customerName={validation.whitelist_entry?.customer_name}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Success message */}
        <Alert className="mb-6 border-primary/50 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertDescription>
            Welcome! You have been granted access to this exclusive menu.
            {validation.remaining_views && validation.remaining_views > 0 && (
              <> ({validation.remaining_views} views remaining)</>
            )}
          </AlertDescription>
        </Alert>

        {/* Products */}
        <EnhancedMenuProductGrid
          products={menuData.products}
          menuId={menuData.id}
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

        {/* Modern Checkout Flow */}
        <ModernCheckoutFlow
          open={orderFormOpen}
          onOpenChange={setOrderFormOpen}
          menuId={menuData.menu_id}
          tenantId={menuData.tenant_id}
          accessToken={validation.whitelist_entry?.id}
          minOrder={menuData.min_order_quantity}
          maxOrder={menuData.max_order_quantity}
          onOrderComplete={handleOrderComplete}
          products={menuData.products.map(p => ({ id: p.id, name: p.name, image_url: p.image_url ?? undefined }))}
        />
      </div>
    </div>
  );
}
