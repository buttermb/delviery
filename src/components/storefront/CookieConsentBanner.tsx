import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Cookie } from 'lucide-react';

export function CookieConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShow(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShow(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <Card className="max-w-4xl mx-auto p-4 shadow-lg">
        <div className="flex items-start gap-4">
          <Cookie className="h-6 w-6 text-muted-foreground flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Cookie Consent</h3>
            <p className="text-sm text-muted-foreground mb-3">
              We use cookies to enhance your experience, analyze site traffic, and personalize content.
              By clicking "Accept", you consent to our use of cookies.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleAccept} size="sm">
                Accept
              </Button>
              <Button onClick={handleDecline} variant="outline" size="sm">
                Decline
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
