/**
 * Store List View Component
 * Displays all tenant stores in a grid layout
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Plus from "lucide-react/dist/esm/icons/plus";
import Store from "lucide-react/dist/esm/icons/store";
import { StoreCard } from './StoreCard';

interface MarketplaceStore {
  id: string;
  store_name: string;
  slug: string;
  tagline: string | null;
  is_active: boolean;
  total_orders: number;
  total_revenue: number;
  logo_url: string | null;
}

interface StoreListViewProps {
  stores: MarketplaceStore[];
  activeStoreId: string | null;
  onSelectStore: (storeId: string) => void;
  onPreviewStore: (slug: string) => void;
  onSettingsStore: (storeId: string) => void;
  onDeleteStore: (store: { id: string; store_name: string }) => void;
  onCreateStore: () => void;
}

export function StoreListView({
  stores,
  activeStoreId,
  onSelectStore,
  onPreviewStore,
  onSettingsStore,
  onDeleteStore,
  onCreateStore,
}: StoreListViewProps) {
  if (stores.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Stores Yet</h3>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Create your first store to start selling online.
          </p>
          <Button onClick={onCreateStore}>
            <Plus className="w-4 h-4 mr-2" />
            Create Store
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Your Stores</h2>
          <p className="text-sm text-muted-foreground">
            {stores.length} store{stores.length !== 1 ? 's' : ''} • Select one to manage
          </p>
        </div>
        <Button onClick={onCreateStore}>
          <Plus className="w-4 h-4 mr-2" />
          New Store
        </Button>
      </div>

      {/* Store Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores.map((store) => (
          <StoreCard
            key={store.id}
            store={store}
            isSelected={store.id === activeStoreId}
            onSelect={onSelectStore}
            onPreview={onPreviewStore}
            onSettings={onSettingsStore}
            onDelete={onDeleteStore}
          />
        ))}

        {/* Add Store Card */}
        <Card 
          className="border-dashed cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
          onClick={onCreateStore}
        >
          <CardContent className="flex flex-col items-center justify-center h-full min-h-[200px] p-5">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <span className="font-medium">Add Store</span>
            <span className="text-xs text-muted-foreground">Create a new storefront</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
