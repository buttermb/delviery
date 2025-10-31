import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, Lock, Eye, ShoppingCart, AlertTriangle, MapPin, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useScreenshotProtection } from '@/hooks/useScreenshotProtection';
import { useGeofencing } from '@/hooks/useGeofencing';
import { toast } from 'sonner';
import { initHoneypotSystem } from '@/utils/honeypotDetection';

const MenuAccess = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const uniqueToken = searchParams.get('u');

  const [accessCode, setAccessCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [menu, setMenu] = useState<any>(null);
  const [accessGranted, setAccessGranted] = useState(false);
  const [error, setError] = useState('');
  const [viewCount, setViewCount] = useState(0);
  const [honeypotSystem, setHoneypotSystem] = useState<any>(null);

  // Enable screenshot protection if menu is loaded
  useScreenshotProtection({
    menuId: menu?.id || '',
    customerName: menu?.customer_name,
    enabled: accessGranted && menu?.screenshot_protection,
    watermarkEnabled: menu?.watermark_enabled,
    watermarkText: menu?.watermark_text || `CONFIDENTIAL - ${menu?.name}`,
    showToast: true,
    disableRightClickEnabled: menu?.disable_right_click,
  });

  // Geofencing validation
  const { isChecking: isCheckingLocation, accessGranted: locationAllowed, violation } = useGeofencing({
    geofences: menu?.geofence_rules || [],
    enabled: menu?.geofence_enabled || false,
    onViolation: async (details) => {
      await supabase.from('menu_security_events').insert({
        menu_id: menu?.id,
        event_type: 'geofence_violation',
        severity: 'high',
        details
      });
    }
  });

  // Initialize honeypot
  useEffect(() => {
    const form = document.querySelector('form');
    if (form && !honeypotSystem) {
      const system = initHoneypotSystem(form);
      setHoneypotSystem(system);
      return () => system.cleanup();
    }
  }, [honeypotSystem]);

  const handleValidate = async () => {
    if (!accessCode || accessCode.length < 4 || accessCode.length > 6) {
      setError('Please enter a 4-6 digit access code');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      // Call validation edge function
      const { data, error } = await supabase.functions.invoke('menu-access-validate', {
        body: {
          encrypted_url_token: token,
          access_code: accessCode,
          unique_access_token: uniqueToken,
          device_fingerprint: generateFingerprint(),
        },
      });

      if (error) throw error;

      if (data.access_granted) {
        setMenu(data.menu);
        setAccessGranted(true);
        setViewCount(data.remaining_views || 0);
        toast.success('Access granted!');
      } else {
        setError(data.violations?.join(', ') || 'Access denied');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to validate access');
    } finally {
      setIsValidating(false);
    }
  };

  const generateFingerprint = () => {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
    ];
    return btoa(components.join('|'));
  };

  if (!accessGranted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-6">
            <Shield className="h-16 w-16 mx-auto text-primary mb-4" />
            <h1 className="text-2xl font-bold mb-2">Secure Menu Access</h1>
            <p className="text-muted-foreground">
              You've been invited to view a private catalog
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="accessCode">Enter Access Code</Label>
              <Input
                id="accessCode"
                type="text"
                placeholder="Enter your access code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={6}
                className="text-center text-2xl tracking-widest font-mono"
                onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button
              onClick={handleValidate}
              disabled={isValidating}
              className="w-full"
              size="lg"
            >
              {isValidating ? (
                <>Validating...</>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Access Menu
                </>
              )}
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t space-y-2 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <Shield className="h-3 w-3" />
              This catalog is confidential
            </p>
            <p className="flex items-center gap-2">
              <Eye className="h-3 w-3" />
              Screenshots are tracked
            </p>
            <p className="flex items-center gap-2">
              <Lock className="h-3 w-3" />
              Do not share this link
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Menu view after access granted
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{menu.custom_message || 'Wholesale Catalog'}</h1>
              {menu.show_availability && (
                <p className="text-sm text-muted-foreground">
                  Available: {menu.allowed_hours?.start}:00 - {menu.allowed_hours?.end}:00
                </p>
              )}
            </div>
            {viewCount > 0 && (
              <Badge variant="outline">
                <Eye className="h-3 w-3 mr-1" />
                {viewCount} views remaining
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menu.products?.map((product: any) => (
            <Card key={product.id} className="p-6">
              {menu.show_product_images && product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              )}
              <h3 className="text-xl font-bold mb-2">{product.name}</h3>
              <p className="text-2xl font-bold text-primary mb-2">
                ${product.price}/lb
              </p>
              {menu.show_availability && (
                <Badge variant={product.available ? 'default' : 'secondary'}>
                  {product.available ? `${product.stock} lbs available` : 'Out of stock'}
                </Badge>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                Min order: {product.min_quantity} lbs
              </p>
              <Button className="w-full mt-4" disabled={!product.available}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Order
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Footer */}
      {menu.show_contact_info && (
        <div className="border-t bg-muted/30 py-8">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm text-muted-foreground">
              Need help? Contact us at contact@example.com
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuAccess;