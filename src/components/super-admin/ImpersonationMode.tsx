/**
 * Tenant Impersonation Component
 * Safe mode for super admins to view tenant data as tenant admin
 * Includes safety warnings and logging
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import User from "lucide-react/dist/esm/icons/user";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import LogOut from "lucide-react/dist/esm/icons/log-out";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { auditActions } from '@/lib/auditLog';

interface ImpersonationModeProps {
  tenantId: string;
  onStartImpersonation: (tenantId: string) => void;
}

export function ImpersonationMode({ tenantId, onStartImpersonation }: ImpersonationModeProps) {
  const { toast } = useToast();
  const [isImpersonating, setIsImpersonating] = useState(false);

  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('business_name, slug, subscription_status')
        .eq('id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const handleStart = () => {
    if (!tenantId) return;

    // Log impersonation start
    auditActions.impersonationStarted(tenantId);

    setIsImpersonating(true);
    onStartImpersonation(tenantId);

    toast({
      title: 'Impersonation Started',
      description: `You are now viewing as ${tenant?.business_name || 'tenant'}`,
      variant: 'default',
    });
  };

  const handleStop = () => {
    if (!tenantId) return;

    // Log impersonation end
    auditActions.impersonationEnded(tenantId);

    setIsImpersonating(false);
    toast({
      title: 'Impersonation Ended',
      description: 'Returned to super admin view',
    });
  };

  return (
    <Card className="border-yellow-500/20 bg-yellow-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Tenant Impersonation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Safety Warning</AlertTitle>
          <AlertDescription>
            Impersonation mode allows you to view the platform as a tenant admin.
            All actions will be logged in the audit trail.
          </AlertDescription>
        </Alert>

        {tenant && (
          <div className="space-y-2">
            <Label>Tenant</Label>
            <div className="p-3 border rounded-lg">
              <p className="font-medium">{tenant.business_name}</p>
              <p className="text-sm text-muted-foreground">{tenant.slug}</p>
              <Badge variant="outline" className="mt-2">
                {tenant.subscription_status}
              </Badge>
            </div>
          </div>
        )}

        {isImpersonating ? (
          <div className="space-y-2">
            <Alert className="bg-green-500/10 border-green-500/20">
              <AlertTitle className="text-green-500">Impersonation Active</AlertTitle>
              <AlertDescription>
                You are currently viewing as this tenant. All actions are being logged.
              </AlertDescription>
            </Alert>
            <Button variant="destructive" onClick={handleStop} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              End Impersonation
            </Button>
          </div>
        ) : (
          <Button onClick={handleStart} className="w-full" variant="outline">
            <User className="h-4 w-4 mr-2" />
            Start Impersonation
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

