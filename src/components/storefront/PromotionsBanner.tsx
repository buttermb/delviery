import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useState } from 'react';

interface Promotion {
  id: string;
  title: string;
  description: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  valid_until: string;
  active: boolean;
}

interface PromotionsBannerProps {
  tenantSlug?: string;
}

export function PromotionsBanner({ tenantSlug }: PromotionsBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const { data: promotions = [] } = useQuery({
    queryKey: queryKeys.promotions.active(tenantSlug),
    queryFn: async () => {
      if (!tenantSlug) return [];

      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle();

      if (tenantError) throw tenantError;
      if (!tenant) return [];

      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('active', true)
        .gte('valid_until', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;

      return (data || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        title: p.code as string,
        description: p.description as string || '',
        code: p.code as string,
        discount_type: p.discount_type as Promotion['discount_type'] || 'percentage',
        discount_value: p.discount_value as number || 0,
        valid_until: p.valid_until as string,
        active: true,
      }));
    },
    enabled: !!tenantSlug,
  });

  if (dismissed || promotions.length === 0) return null;

  const formatDiscount = (type: string, value: number) => {
    return type === 'percentage' ? `${value}% OFF` : `$${value} OFF`;
  };

  return (
    <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex items-center gap-4 overflow-x-auto">
            {promotions.slice(0, 2).map((promo) => (
              <div key={promo.id} className="flex items-center gap-2 whitespace-nowrap">
                <Badge variant="secondary" className="bg-white text-emerald-600">
                  {formatDiscount(promo.discount_type, promo.discount_value)}
                </Badge>
                <span className="font-medium">{promo.title}</span>
                {promo.description && (
                  <span className="text-sm opacity-90">• {promo.description}</span>
                )}
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
