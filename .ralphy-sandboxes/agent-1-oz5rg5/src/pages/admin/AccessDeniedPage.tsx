import { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { logger } from '@/lib/logger';

interface AccessDeniedPageProps {
  userRole?: string;
  requiredRoles?: string[];
}

export default function AccessDeniedPage({ userRole, requiredRoles }: AccessDeniedPageProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    logger.warn('Access Denied: insufficient permissions', {
      pathname: location.pathname,
      tenantSlug,
      userRole,
      requiredRoles,
    });
  }, [location.pathname, tenantSlug, userRole, requiredRoles]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 px-6 text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-destructive/10 p-4">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Access Denied</h1>
            <p className="text-muted-foreground">
              You don&apos;t have permission to access this page.
              {userRole && (
                <span className="block mt-1 text-sm">
                  Your current role ({userRole}) does not have the required access level.
                </span>
              )}
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
              Path: {location.pathname}
              {userRole && ` | Role: ${userRole}`}
              {requiredRoles && ` | Required: ${requiredRoles.join(', ')}`}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
