import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, MapPin, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SecureMenuAccess = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const uniqueToken = searchParams.get('u');

  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState('');
  const [menuData, setMenuData] = useState<any>(null);

  useEffect(() => {
    // Request location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocationStatus('granted');
        },
        (error) => {
          console.error('Location error:', error);
          setLocationStatus('denied');
        }
      );
    } else {
      setLocationStatus('denied');
    }
  }, []);

  const generateDeviceFingerprint = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('fingerprint', 2, 2);
    }
    
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvas: canvas.toDataURL()
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode) return;

    setLoading(true);
    setError('');

    try {
      const fingerprint = generateDeviceFingerprint();
      const deviceHash = btoa(JSON.stringify(fingerprint));

      const { data, error: validateError } = await supabase.functions.invoke('menu-access-validate', {
        body: {
          encrypted_url_token: token,
          access_code: accessCode,
          unique_access_token: uniqueToken,
          device_fingerprint: deviceHash,
          location,
          ip_address: 'client', // Would be captured server-side in production
          user_agent: navigator.userAgent
        }
      });

      if (validateError) throw validateError;

      if (data.access_granted) {
        // Store menu data in session storage
        sessionStorage.setItem(`menu_${token}`, JSON.stringify(data.menu_data));
        setMenuData(data.menu_data);
      } else {
        setError(data.violations?.join(', ') || 'Access denied');
      }
    } catch (err: any) {
      console.error('Access validation error:', err);
      setError(err.message || 'Failed to validate access');
    } finally {
      setLoading(false);
    }
  };

  if (menuData) {
    // Redirect to menu view
    window.location.href = `/m/${token}/view`;
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Shield className="h-16 w-16 mx-auto text-primary mb-4" />
          <h1 className="text-2xl font-bold mb-2">Secure Access</h1>
          <p className="text-muted-foreground">
            You've been invited to view a private wholesale catalog
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Location Status */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4" />
              <span className="font-medium">Location Verification:</span>
              {locationStatus === 'checking' && (
                <span className="text-muted-foreground">Checking...</span>
              )}
              {locationStatus === 'granted' && (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Verified
                </span>
              )}
              {locationStatus === 'denied' && (
                <span className="text-destructive flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  Required
                </span>
              )}
            </div>
          </div>

          {/* Access Code Input */}
          <div className="space-y-2">
            <Label htmlFor="accessCode">Enter Access Code</Label>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Input
                  key={i}
                  type="text"
                  maxLength={1}
                  className="w-12 h-12 text-center text-lg font-bold"
                  value={accessCode[i] || ''}
                  onChange={(e) => {
                    const newCode = accessCode.split('');
                    newCode[i] = e.target.value;
                    setAccessCode(newCode.join(''));
                    
                    // Auto-focus next input
                    if (e.target.value && i < 5) {
                      const nextInput = e.target.parentElement?.nextElementSibling?.querySelector('input');
                      nextInput?.focus();
                    }
                  }}
                />
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full" 
            size="lg"
            disabled={accessCode.length !== 6 || loading || locationStatus !== 'granted'}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Lock className="h-4 w-4 mr-2" />
            Access Menu
          </Button>
        </form>

        {/* Security Notices */}
        <div className="mt-8 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-3 w-3" />
            <span>This catalog is confidential</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-3 w-3" />
            <span>Do not share this link</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            <span>Location verification required</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SecureMenuAccess;
