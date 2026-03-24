import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Cookie } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CookieConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      // Small delay to avoid layout shift on initial load
      const timer = setTimeout(() => setShow(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    setShow(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-4 duration-300">
      <Card className="max-w-4xl mx-auto p-4 shadow-lg border-border/80 bg-background/95 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <Cookie className="h-6 w-6 text-muted-foreground flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Cookie Consent</h3>
            <p className="text-sm text-muted-foreground mb-3">
              We use strictly necessary cookies to operate the service, and optional analytics and functional cookies to improve your experience.
              By clicking &quot;Accept All&quot;, you consent to all cookies. &quot;Essential Only&quot; limits cookies to those required for the service to function.
              Read our{' '}
              <Link to="/cookie" className="underline hover:text-foreground transition-colors">Cookie Policy</Link>
              {' '}and{' '}
              <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>
              {' '}for details.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleAccept} size="sm">
                Accept All
              </Button>
              <Button onClick={handleDecline} variant="outline" size="sm">
                Essential Only
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
