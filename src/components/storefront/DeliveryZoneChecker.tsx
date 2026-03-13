import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { CheckCircle, XCircle, MapPin } from 'lucide-react';

interface DeliveryZoneCheckerProps {
  tenantSlug: string;
}

export function DeliveryZoneChecker({ tenantSlug }: DeliveryZoneCheckerProps) {
  const [zipCode, setZipCode] = useState('');
  const [checkResult, setCheckResult] = useState<{
    available: boolean;
    zone?: string;
    fee?: number;
    message: string;
  } | null>(null);

  const { data: deliverySettings } = useQuery({
    queryKey: queryKeys.tenantSettings.byTenant(tenantSlug, 'delivery'),
    queryFn: async () => {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('slug', tenantSlug)
        .maybeSingle();

      if (!tenant) return null;

      const metadata = tenant.metadata as Record<string, unknown> || {};
      return metadata.delivery_settings as Record<string, unknown> | undefined;
    },
    enabled: !!tenantSlug,
  });

  const handleCheck = () => {
    if (!zipCode || !deliverySettings) {
      setCheckResult({
        available: false,
        message: 'Please enter a valid ZIP code',
      });
      return;
    }

    // Simple stub logic - in production, this would check against actual delivery zones
    const zones = (deliverySettings.delivery_zones as Array<Record<string, unknown>>) || [];
    const defaultFee = (deliverySettings.default_delivery_fee as number) || 5.00;

    // For now, accept all zip codes and use default fee
    setCheckResult({
      available: true,
      zone: 'Standard Zone',
      fee: defaultFee,
      message: `Delivery available to ${zipCode}!`,
    });
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Check Delivery Availability</h3>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Enter ZIP code"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            maxLength={5}
          />
          <Button onClick={handleCheck}>Check</Button>
        </div>

        {checkResult && (
          <div className={`flex items-start gap-2 p-3 rounded-lg ${
            checkResult.available ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'
          }`}>
            {checkResult.available ? (
              <CheckCircle className="h-5 w-5 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium">{checkResult.message}</p>
              {checkResult.available && checkResult.fee !== undefined && (
                <p className="text-sm mt-1">
                  Delivery fee: ${checkResult.fee.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
