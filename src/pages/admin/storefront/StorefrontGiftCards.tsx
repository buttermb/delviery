import { useTenant } from '@/contexts/TenantContext';
import { StorefrontGiftCardManager } from '@/components/admin/storefront/StorefrontGiftCardManager';

export default function StorefrontGiftCards() {
    const { tenant } = useTenant();

    if (!tenant) return null;

    return (
        <div className="p-6">
            <div className="mb-6">
                <h2 className="text-3xl font-bold tracking-tight">Gift Cards</h2>
                <p className="text-muted-foreground">
                    Issue and manage gift cards for your customers.
                </p>
            </div>
            <StorefrontGiftCardManager storeId={tenant.id} />
        </div>
    );
}
