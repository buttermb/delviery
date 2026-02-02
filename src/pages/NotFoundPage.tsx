import { logger } from '@/lib/logger';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Home from "lucide-react/dist/esm/icons/home";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Search from "lucide-react/dist/esm/icons/search";
import HelpCircle from "lucide-react/dist/esm/icons/help-circle";
import bugFinder from '@/utils/bugFinder';
import { useEffect } from 'react';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    logger.error('404 Error: User attempted to access non-existent route', { pathname: location.pathname, component: 'NotFoundPage' });
    // Report 404 to bug finder
    bugFinder.report404(location.pathname, {
      timestamp: new Date().toISOString(),
      referrer: document.referrer,
    });
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="max-w-2xl w-full">
        <CardContent className="pt-12 pb-12 px-6 text-center space-y-8">
          {/* 404 Display */}
          <div className="space-y-4">
            <h1 className="text-8xl font-bold text-primary">404</h1>
            <h2 className="text-3xl font-semibold">Page Not Found</h2>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Go Home
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>

          {/* Helpful Links */}
          <div className="pt-8 border-t space-y-4">
            <p className="text-sm font-medium">Popular Pages:</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/faq')}
                className="gap-2"
              >
                <HelpCircle className="h-4 w-4" />
                FAQ
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/support')}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Support
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/contact')}
                className="gap-2"
              >
                Contact
              </Button>
            </div>
          </div>

          {/* Error Details (for debugging) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="pt-4 border-t text-left">
              <p className="text-xs text-muted-foreground font-mono">
                Attempted path: {location.pathname}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

