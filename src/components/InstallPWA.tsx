import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Check if user has dismissed this before
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      const dismissedTime = localStorage.getItem('pwa-install-dismissed-time');
      
      // Show again after 7 days
      if (dismissed && dismissedTime) {
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - parseInt(dismissedTime) < sevenDays) {
          return;
        }
      }
      
      if (!dismissed) {
        // Show after 10 seconds on mobile, 30 seconds on desktop
        const isMobile = window.innerWidth < 768;
        setTimeout(() => setShowInstallPrompt(true), isMobile ? 10000 : 30000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallPrompt(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
    localStorage.setItem('pwa-install-dismissed-time', Date.now().toString());
  };

  if (!showInstallPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 z-40 max-w-sm animate-in slide-in-from-bottom-4 duration-500">
      <Card className="border-2 border-primary/20 bg-background/95 backdrop-blur-lg shadow-2xl">
        <CardContent className="p-4">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-base mb-1">Install NY Minute</h3>
              <p className="text-sm text-muted-foreground">
                Add to your home screen for quick access and a better experience
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              className="flex-1"
            >
              Not Now
            </Button>
            <Button
              variant="hero"
              size="sm"
              onClick={handleInstall}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Install
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export { InstallPWA };
export default InstallPWA;
