/**
 * Task 342: Delivery Fee Calculation by Zone
 * Calculates delivery fee based on delivery zone, distance, and order value.
 */

import { useState, useEffect } from 'react';
import { MapPin, DollarSign, Calculator, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  zip_codes: string[];
}

interface DeliveryFeeResult {
  baseFee: number;
  distanceSurcharge: number;
  totalFee: number;
  zoneName: string;
  isFreeDelivery: boolean;
  minimumNotMet: boolean;
}

interface DeliveryFeeCalculatorProps {
  orderSubtotal?: number;
  deliveryAddress?: string;
  zipCode?: string;
  onFeeCalculated?: (result: DeliveryFeeResult) => void;
}

export function DeliveryFeeCalculator({
  orderSubtotal = 0,
  deliveryAddress = '',
  zipCode = '',
  onFeeCalculated,
}: DeliveryFeeCalculatorProps) {
  const { tenant } = useTenantAdminAuth();
  const [localZipCode, setLocalZipCode] = useState(zipCode);
  const [localSubtotal, setLocalSubtotal] = useState(orderSubtotal);
  const [calculatedFee, setCalculatedFee] = useState<DeliveryFeeResult | null>(null);

  // Fetch delivery zones
  const { data: zones = [] } = useQuery({
    queryKey: queryKeys.delivery.zones(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true);

      if (error) throw error;
      return data as unknown as DeliveryZone[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch tenant delivery settings
  const { data: tenantSettings } = useQuery({
    queryKey: queryKeys.delivery.settings(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data, error } = await supabase
        .from('tenants')
        .select('default_delivery_fee, free_delivery_threshold')
        .eq('id', tenant.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  useEffect(() => {
    if (!localZipCode) {
      setCalculatedFee(null);
      return;
    }

    calculateFee();
  }, [localZipCode, localSubtotal, zones, tenantSettings]);

  const calculateFee = () => {
    // Find matching zone
    const matchingZone = zones.find((zone) =>
      zone.zip_codes.some((code) => code === localZipCode)
    );

    const baseFee = matchingZone?.delivery_fee ?? tenantSettings?.default_delivery_fee ?? 0;
    const freeDeliveryThreshold = tenantSettings?.free_delivery_threshold ?? 0;
    const minimumOrder = matchingZone?.minimum_order ?? 0;

    // Calculate distance surcharge (simplified - in production, use actual distance API)
    const distanceSurcharge = 0;

    // Check if free delivery threshold is met
    const isFreeDelivery =
      freeDeliveryThreshold > 0 && localSubtotal >= freeDeliveryThreshold;

    // Check if minimum order is met
    const minimumNotMet = minimumOrder > 0 && localSubtotal < minimumOrder;

    const totalFee = isFreeDelivery ? 0 : baseFee + distanceSurcharge;

    const result: DeliveryFeeResult = {
      baseFee,
      distanceSurcharge,
      totalFee,
      zoneName: matchingZone?.name ?? 'Default Zone',
      isFreeDelivery,
      minimumNotMet,
    };

    setCalculatedFee(result);
    onFeeCalculated?.(result);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-5 w-5" />
          Delivery Fee Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="zip-code">Delivery ZIP Code</Label>
            <Input
              id="zip-code"
              placeholder="90210"
              value={localZipCode}
              onChange={(e) => setLocalZipCode(e.target.value)}
              maxLength={10}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="order-subtotal">Order Subtotal ($)</Label>
            <Input
              id="order-subtotal"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={localSubtotal}
              onChange={(e) => setLocalSubtotal(Number(e.target.value))}
            />
          </div>
        </div>

        {calculatedFee && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{calculatedFee.zoneName}</span>
              </div>
              <Badge variant={calculatedFee.isFreeDelivery ? 'default' : 'secondary'}>
                {calculatedFee.isFreeDelivery ? 'Free Delivery' : formatCurrency(calculatedFee.totalFee)}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Base Fee:</span>
                <span className="font-medium">{formatCurrency(calculatedFee.baseFee)}</span>
              </div>

              {calculatedFee.distanceSurcharge > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Distance Surcharge:</span>
                  <span className="font-medium">{formatCurrency(calculatedFee.distanceSurcharge)}</span>
                </div>
              )}

              {calculatedFee.isFreeDelivery && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Free Delivery Applied:</span>
                  <span className="font-medium">-{formatCurrency(calculatedFee.baseFee)}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t text-base font-semibold">
                <span>Total Delivery Fee:</span>
                <span className={calculatedFee.isFreeDelivery ? 'text-emerald-600' : ''}>
                  {formatCurrency(calculatedFee.totalFee)}
                </span>
              </div>
            </div>

            {calculatedFee.minimumNotMet && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md text-amber-700 dark:text-amber-400 text-xs">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Minimum order of {formatCurrency(zones.find((z) => z.name === calculatedFee.zoneName)?.minimum_order ?? 0)} not met for this zone.
                </span>
              </div>
            )}

            {tenantSettings?.free_delivery_threshold && localSubtotal < tenantSettings.free_delivery_threshold && (
              <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md text-blue-700 dark:text-blue-400 text-xs">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Add {formatCurrency(tenantSettings.free_delivery_threshold - localSubtotal)} more to get free delivery!
                </span>
              </div>
            )}
          </div>
        )}

        {!calculatedFee && localZipCode && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            ZIP code not found in configured delivery zones
          </div>
        )}
      </CardContent>
    </Card>
  );
}
