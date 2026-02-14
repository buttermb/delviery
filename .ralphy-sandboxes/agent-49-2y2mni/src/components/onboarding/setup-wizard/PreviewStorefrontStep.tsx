/**
 * Setup Wizard Step 5: Preview Storefront
 * Shows a preview of the storefront and lets users open it in a new tab
 */

import { Eye, ExternalLink, CheckCircle2, Store } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

interface PreviewStorefrontStepProps {
  onComplete: () => void;
}

export function PreviewStorefrontStep({ onComplete }: PreviewStorefrontStepProps) {
  const { tenant } = useTenantAdminAuth();

  const storefrontUrl = tenant?.slug ? `/${tenant.slug}` : '#';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-xl">
          <Eye className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Preview Your Storefront</h3>
          <p className="text-sm text-muted-foreground">See how your store looks to customers</p>
        </div>
      </div>

      {/* Storefront Preview Card */}
      <Card className="overflow-hidden border-2">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-lg">{tenant?.business_name || 'Your Store'}</h4>
              <p className="text-sm text-muted-foreground">
                {tenant?.slug ? `floraiq.co/${tenant.slug}` : 'Your storefront URL'}
              </p>
            </div>
          </div>

          {/* Mock storefront preview */}
          <div className="bg-background/80 backdrop-blur rounded-lg p-4 space-y-3">
            <div className="h-3 bg-muted rounded-full w-3/4" />
            <div className="h-3 bg-muted rounded-full w-1/2" />
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-20 bg-muted rounded-lg" />
                  <div className="h-2 bg-muted rounded-full w-3/4" />
                  <div className="h-2 bg-muted rounded-full w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <CardContent className="p-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(storefrontUrl, '_blank')}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Storefront in New Tab
          </Button>
        </CardContent>
      </Card>

      {/* Completion */}
      <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
        <h4 className="text-lg font-semibold text-green-700 dark:text-green-300">
          You're All Set!
        </h4>
        <p className="text-sm text-green-600 dark:text-green-400">
          Your store is configured and ready for business. You can always adjust these settings later.
        </p>
      </div>

      <Button onClick={onComplete} className="w-full" size="lg">
        <CheckCircle2 className="mr-2 h-4 w-4" />
        Complete Setup & Go to Dashboard
      </Button>
    </div>
  );
}
