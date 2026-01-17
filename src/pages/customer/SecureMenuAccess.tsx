import { logger } from '@/lib/logger';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, Lock, MapPin, CheckCircle, XCircle, Loader2, 
  Sparkles, Eye, Clock, Fingerprint
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// OTP-style input component
function CodeInput({ 
  value, 
  onChange, 
  onComplete,
  disabled 
}: { 
  value: string; 
  onChange: (value: string) => void;
  onComplete: () => void;
  disabled: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const CODE_LENGTH = 8;

  const handleChange = (index: number, char: string) => {
    const upperChar = char.toUpperCase();
    if (!/^[A-Z0-9]?$/.test(upperChar)) return;

    const newValue = value.split('');
    newValue[index] = upperChar;
    const joined = newValue.join('').slice(0, CODE_LENGTH);
    onChange(joined);

    // Auto-advance to next input
    if (upperChar && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (joined.length === CODE_LENGTH) {
      setTimeout(() => onComplete(), 100);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
    onChange(pasted);
    if (pasted.length === CODE_LENGTH) {
      setTimeout(() => onComplete(), 100);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: CODE_LENGTH }).map((_, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="text"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          disabled={disabled}
          className={cn(
            "w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-mono font-bold",
            "border-2 rounded-lg bg-background/80 backdrop-blur-sm",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
            "transition-colors duration-200",
            value[index] ? "border-primary/50 bg-primary/5" : "border-muted-foreground/30",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          autoFocus={index === 0}
        />
      ))}
    </div>
  );
}

// Step indicator component
function StepIndicator({ 
  steps, 
  currentStep 
}: { 
  steps: { id: string; label: string; icon: React.ElementType }[];
  currentStep: string;
}) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = index === currentIndex;
        const isComplete = index < currentIndex;
        
        return (
          <div key={step.id} className="flex items-center">
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors",
              isActive && "bg-primary text-primary-foreground",
              isComplete && "bg-primary/20 text-primary",
              !isActive && !isComplete && "bg-muted text-muted-foreground"
            )}>
              {isComplete ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={cn(
                "w-6 sm:w-10 h-0.5 mx-1",
                index < currentIndex ? "bg-primary" : "bg-muted"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const SecureMenuAccess = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const uniqueToken = searchParams.get('u');

  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'location' | 'code' | 'verify'>('location');
  const [locationStatus, setLocationStatus] = useState<'checking' | 'granted' | 'denied' | 'skipped'>('checking');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState('');
  const [shakeError, setShakeError] = useState(false);
  const [menuData, setMenuData] = useState<any>(null);

  const steps = [
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'code', label: 'Enter Code', icon: Lock },
    { id: 'verify', label: 'Verify', icon: Shield },
  ];

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
          setCurrentStep('code');
        },
        (err) => {
          logger.error('Location access error', err instanceof Error ? err : new Error(String(err)), { component: 'SecureMenuAccess' });
          setLocationStatus('denied');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationStatus('denied');
    }
  }, []);

  const generateDeviceFingerprint = useCallback(() => {
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
  }, []);

  const handleSubmit = async () => {
    if (!accessCode || accessCode.length !== 8) {
      setError('Please enter all 8 characters');
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
      return;
    }

    setLoading(true);
    setCurrentStep('verify');
    setError('');

    try {
      const fingerprint = generateDeviceFingerprint();
      const deviceHash = btoa(JSON.stringify(fingerprint));

      const { data, error: validateError } = await supabase.functions.invoke('menu-access-validate', {
        body: {
          encrypted_url_token: token,
          access_code: accessCode.toUpperCase(),
          unique_access_token: uniqueToken,
          device_fingerprint: deviceHash,
          location,
          ip_address: 'client',
          user_agent: navigator.userAgent
        }
      });

      if (validateError) throw validateError;

      // Check for error in response body
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Menu access validation failed';
        throw new Error(errorMessage);
      }

      // Handle response
      if (data) {
        if (data.access_granted) {
          sessionStorage.setItem(`menu_${token}`, JSON.stringify(data.menu_data));
          
          // Check if this is a forum menu and redirect immediately
          if (data.menu_data?.security_settings?.menu_type === 'forum') {
            const forumUrl = data.menu_data.security_settings?.forum_url || '/community';
            window.location.href = forumUrl;
            return;
          }
          
          setMenuData(data.menu_data);
          return;
        } else if (data.violations) {
          throw new Error(data.violations.join(', '));
        } else if (data.error) {
          throw new Error(data.error);
        }
      }

      throw new Error('Access denied');
    } catch (err: unknown) {
      logger.error('Access validation error', err, { component: 'SecureMenuAccess' });
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate access. Please try again.';
      setError(errorMessage);
      setCurrentStep('code');
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipLocation = () => {
    setLocationStatus('skipped');
    setCurrentStep('code');
  };

  if (menuData) {
    // Redirect to menu view
    window.location.href = `/m/${token}/view`;
    return null;
  }

  return (
    <div className="min-h-dvh relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-blob" />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-dvh flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <div className="relative w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-2xl shadow-primary/30">
                <Shield className="h-10 w-10 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Secure Access</h1>
              <p className="text-white/70">
                You've been invited to view an exclusive catalog
              </p>
            </div>
          </div>

          {/* Step Indicator */}
          <StepIndicator steps={steps} currentStep={currentStep} />

          {/* Main Card */}
          <Card className={cn(
            "p-6 sm:p-8 bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl",
            shakeError && "animate-shake"
          )}>
            {/* Location Step */}
            {currentStep === 'location' && (
              <div className="space-y-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                  {locationStatus === 'checking' ? (
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  ) : locationStatus === 'granted' ? (
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                  ) : (
                    <MapPin className="h-8 w-8 text-primary" />
                  )}
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-white">Location Verification</h2>
                  <p className="text-white/60 text-sm">
                    {locationStatus === 'checking' 
                      ? 'Checking your location...'
                      : locationStatus === 'granted'
                      ? 'Location verified! Proceeding...'
                      : 'Location access helps verify your identity'}
                  </p>
                </div>

                {locationStatus === 'denied' && (
                  <div className="space-y-3">
                    <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-200">
                      <AlertDescription>
                        Location access was denied. You can still continue, but some menus may require location verification.
                      </AlertDescription>
                    </Alert>
                    <Button 
                      onClick={handleSkipLocation}
                      className="w-full bg-white/10 hover:bg-white/20 text-white border-white/20"
                      variant="outline"
                    >
                      Continue Without Location
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Code Entry Step */}
            {currentStep === 'code' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-semibold text-white">Enter Access Code</h2>
                  <p className="text-white/60 text-sm">
                    Enter the 8-character code you received
                  </p>
                </div>

                <CodeInput
                  value={accessCode}
                  onChange={setAccessCode}
                  onComplete={handleSubmit}
                  disabled={loading}
                />

                {/* Error Message */}
                {error && (
                  <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
                    <AlertDescription className="text-red-200">{error}</AlertDescription>
                  </Alert>
                )}

                {/* Submit Button */}
                <Button 
                  onClick={handleSubmit}
                  className="w-full h-12 text-lg bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                  disabled={accessCode.length !== 8 || loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Lock className="h-5 w-5 mr-2" />
                      Access Menu
                    </>
                  )}
                </Button>

                {/* Location Status Badge */}
                <div className="flex justify-center">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "gap-1.5",
                      locationStatus === 'granted' 
                        ? "border-emerald-500/50 text-emerald-300" 
                        : "border-amber-500/50 text-amber-300"
                    )}
                  >
                    <MapPin className="h-3 w-3" />
                    {locationStatus === 'granted' ? 'Location Verified' : 'Location Not Verified'}
                  </Badge>
                </div>
              </div>
            )}

            {/* Verify Step */}
            {currentStep === 'verify' && (
              <div className="space-y-6 text-center py-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-white">Verifying Access</h2>
                  <p className="text-white/60 text-sm">
                    Please wait while we validate your credentials...
                  </p>
                </div>
                <div className="flex justify-center gap-2">
                  {['Checking code', 'Validating device', 'Preparing menu'].map((text, i) => (
                    <Badge key={i} variant="outline" className="border-white/20 text-white/60 text-xs">
                      {text}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-4 text-white/50 text-xs">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              <span>End-to-End Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Fingerprint className="h-3.5 w-3.5" />
              <span>Device Verified</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>Time-Limited Access</span>
            </div>
          </div>

          {/* Security Notice */}
          <div className="text-center text-white/40 text-xs space-y-1">
            <p>This catalog is confidential and for your eyes only.</p>
            <p>Do not share this link or take screenshots.</p>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default SecureMenuAccess;
