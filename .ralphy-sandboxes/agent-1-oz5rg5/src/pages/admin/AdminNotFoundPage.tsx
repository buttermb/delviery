import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileQuestion, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { logger } from '@/lib/logger';
import { useEffect } from 'react';

export default function AdminNotFoundPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    logger.warn('Admin 404: Page not found', { pathname: location.pathname, tenantSlug });
  }, [location.pathname, tenantSlug]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 px-6 text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-muted p-4">
              <FileQuestion className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Page Not Found</h1>
            <p className="text-muted-foreground">
              The admin page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => navigate(`/${tenantSlug}/admin/dashboard`)}
              className="gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              Back to Dashboard
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

          {import.meta.env.DEV && (
            <p className="text-xs text-muted-foreground font-mono pt-2 border-t">
              Attempted path: {location.pathname}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
