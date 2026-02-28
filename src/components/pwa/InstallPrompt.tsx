/**
 * PWA Install Prompt Component
 * Shows a customizable prompt to install the app on mobile/desktop
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Download, Smartphone, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { STORAGE_KEYS } from '@/constants/storageKeys';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPromptProps {
  /** Custom app name */
  appName?: string;
  /** Custom description */
  description?: string;
  /** Position of the prompt */
  position?: 'bottom' | 'top' | 'banner';
  /** Days to wait before showing again after dismissal */
  dismissDays?: number;
  /** Custom className */
  className?: string;
}

export function InstallPrompt({
  appName = 'FloraIQ',
  description = 'Install for a faster, app-like experience with offline access.',
  position = 'bottom',
  dismissDays = 7,
  className,
}: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    // Check if previously dismissed
    try {
      const dismissedAt = localStorage.getItem(STORAGE_KEYS.PWA_DISMISS_DATE);
      if (dismissedAt) {
        const daysSinceDismiss = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
        if (daysSinceDismiss < dismissDays) {
          return;
        }
      }
    } catch {
      // localStorage not available
    }

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // For iOS, show manual instructions
    if (ios && !standalone) {
      setTimeout(() => setShowPrompt(true), 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [dismissDays]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    try {
      localStorage.setItem(STORAGE_KEYS.PWA_DISMISS_DATE, Date.now().toString());
    } catch {
      // localStorage not available
    }
  }, []);

  // Don't show if already installed or shouldn't show
  if (isStandalone || !showPrompt) {
    return null;
  }

  const positionClasses = {
    bottom: 'fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50',
    top: 'fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50',
    banner: 'fixed bottom-0 left-0 right-0 z-50',
  };

  return (
    <Card
      className={cn(
        positionClasses[position],
        'shadow-xl border-primary/20 bg-background/95 backdrop-blur-sm animate-in slide-in-from-bottom-5',
        className
      )}
    >
      <CardHeader className="pb-2 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Smartphone className="h-5 w-5 text-primary" />
          Install {appName}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {isIOS ? (
          // iOS installation instructions
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tap <Share className="h-4 w-4 inline-block mx-1" /> then &quot;Add to Home Screen&quot;
            </p>
            <Button variant="outline" className="w-full" onClick={handleDismiss}>
              Got it
            </Button>
          </div>
        ) : (
          // Android/Desktop install button
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleDismiss}>
              Not now
            </Button>
            <Button className="flex-1 gap-2" onClick={handleInstall}>
              <Download className="h-4 w-4" />
              Install
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Minimal banner version for less intrusive prompts
 */
export function InstallBanner({
  appName = 'FloraIQ',
  className,
}: {
  appName?: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-primary text-primary-foreground p-3 flex items-center justify-between z-50',
        className
      )}
    >
      <span className="text-sm font-medium">
        Add {appName} to your home screen
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="text-primary-foreground hover:bg-primary-foreground/10"
          onClick={() => setShow(false)}
        >
          Dismiss
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleInstall}
        >
          Install
        </Button>
      </div>
    </div>
  );
}

