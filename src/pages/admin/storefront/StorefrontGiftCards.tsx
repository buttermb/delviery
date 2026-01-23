/**
 * StorefrontGiftCards Page
 * Admin page for issuing, managing, and viewing gift card history
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { StorefrontGiftCardManager } from '@/components/admin/storefront/StorefrontGiftCardManager';
import { GiftCardTable } from '@/components/admin/storefront/GiftCardTable';
import { GiftCardLedger } from '@/components/admin/storefront/GiftCardLedger';
import { GiftCardBalanceCheck } from '@/components/admin/storefront/GiftCardBalanceCheck';
import { Skeleton } from '@/components/ui/skeleton';

interface SelectedCard {
  id: string;
  code: string;
  initial_balance: number;
  current_balance: number;
  status: string;
  recipient_email: string | null;
  recipient_name: string | null;
}

export default function StorefrontGiftCards() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ['marketplace-store', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('marketplace_stores')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  if (storeLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No store found for this tenant.</p>
      </div>
    );
  }

  if (selectedCard) {
    return (
      <div className="p-6">
        <GiftCardLedger
          storeId={store.id}
          card={selectedCard}
          onBack={() => setSelectedCard(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gift Cards</h2>
          <p className="text-muted-foreground">
            Issue and manage gift cards for your customers.
          </p>
        </div>
        <StorefrontGiftCardManager storeId={store.id} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <GiftCardTable storeId={store.id} onViewLedger={setSelectedCard} />
        </div>
        <div className="lg:col-span-1">
          <GiftCardBalanceCheck storeId={store.id} />
        </div>
      </div>
    </div>
  );
}
