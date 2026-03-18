import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, ArrowLeft, UserPlus } from 'lucide-react';
import { logger } from '@/lib/logger';
import { useEffect } from 'react';

export default function TenantNotFoundPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    logger.warn('Tenant not found: invalid tenant slug', { tenantSlug });
  }, [tenantSlug]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 px-6 text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-muted p-4">
              <Building2 className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Business Not Found</h1>
            <p className="text-muted-foreground">
              The business you&apos;re looking for doesn&apos;t exist or the URL may be incorrect.
            </p>
            {tenantSlug && (
              <p className="text-sm text-muted-foreground">
                Slug: <span className="font-mono">{tenantSlug}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => navigate('/signup')}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Sign Up
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
        </CardContent>
      </Card>
    </div>
  );
}
