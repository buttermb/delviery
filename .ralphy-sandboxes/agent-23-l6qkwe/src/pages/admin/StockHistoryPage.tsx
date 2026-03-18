import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { StockHistoryLog } from '@/components/admin/inventory/StockHistoryLog';
import { Skeleton } from '@/components/ui/skeleton';

export function StockHistoryPage() {
  const { tenant, loading: isLoading } = useTenantAdminAuth();

  if (isLoading) {
    return (
      <div className="p-2 sm:p-4 md:p-4 space-y-4 sm:space-y-4">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-2 sm:p-4 md:p-4">
        <p className="text-muted-foreground">Unable to load tenant information.</p>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-4">
      <StockHistoryLog showHeader={true} compact={false} />
    </div>
  );
}

export default StockHistoryPage;
