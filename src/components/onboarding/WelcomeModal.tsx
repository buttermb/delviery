import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Sparkles, ArrowRight, X, PlayCircle } from 'lucide-react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTutorialContext } from '@/components/tutorial/TutorialProvider';
import { logger } from '@/utils/logger';

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export const WelcomeModal = ({ open, onClose }: WelcomeModalProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenant, admin } = useTenantAdminAuth();
  const { startTutorial } = useTutorialContext();
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);

  // Check if user has already seen welcome modal
  useEffect(() => {
    if (tenant?.id) {
      const welcomeKey = `welcome_seen_${tenant.id}`;
      const seen = sessionStorage.getItem(welcomeKey);
      if (seen === 'true') {
        setHasSeenWelcome(true);
        onClose();
      }
    }
  }, [tenant?.id, onClose]);

  const handleGetStarted = () => {
    if (tenant?.id) {
      const welcomeKey = `welcome_seen_${tenant.id}`;
      sessionStorage.setItem(welcomeKey, 'true');
    }
    onClose();
    
    // Navigate to welcome/setup page
    if (tenant?.slug) {
      navigate(`/${tenant.slug}/admin/welcome`);
    }
  };

  const handleTakeTour = () => {
    if (tenant?.id) {
      const welcomeKey = `welcome_seen_${tenant.id}`;
      sessionStorage.setItem(welcomeKey, 'true');
    }
    onClose();
    
    // Start dashboard tutorial
    startTutorial('dashboard-tour', true);
  };

  const handleSkip = () => {
    if (tenant?.id) {
      const welcomeKey = `welcome_seen_${tenant.id}`;
      sessionStorage.setItem(welcomeKey, 'true');
    }
    onClose();
  };

  if (hasSeenWelcome) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl">
                  Welcome to {tenant?.business_name || 'Your Dashboard'}!
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Your account has been created successfully
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Account Created</p>
                <p className="text-sm text-muted-foreground">
                  Your tenant account is ready to use
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">14-Day Trial Started</p>
                <p className="text-sm text-muted-foreground">
                  Explore all features with full access
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Email Verification</p>
                <p className="text-sm text-muted-foreground">
                  Please verify your email within 7 days
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-4">
              Let's get you set up in just a few minutes. We'll guide you through adding your first products, customers, and menus.
            </p>

            <div className="flex flex-col gap-2">
              <div className="flex gap-3">
                <Button
                  onClick={handleGetStarted}
                  className="flex-1"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTakeTour}
                  className="flex-1"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Take Tour
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="w-full"
              >
                Skip for Now
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

