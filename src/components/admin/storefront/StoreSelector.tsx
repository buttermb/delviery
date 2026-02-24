/**
 * Store Selector Component
 * Dropdown for switching between stores
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Store,
  ChevronDown,
  Check,
  Plus,
  LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketplaceStore {
  id: string;
  store_name: string;
  slug: string;
  is_active: boolean;
  logo_url: string | null;
}

interface StoreSelectorProps {
  stores: MarketplaceStore[];
  activeStoreId: string | null;
  onSelectStore: (storeId: string) => void;
  onViewAllStores: () => void;
  onCreateStore: () => void;
}

export function StoreSelector({
  stores,
  activeStoreId,
  onSelectStore,
  onViewAllStores,
  onCreateStore,
}: StoreSelectorProps) {
  const [open, setOpen] = useState(false);
  
  const activeStore = stores.find(s => s.id === activeStoreId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between min-w-[200px]">
          <div className="flex items-center gap-2">
            {activeStore?.logo_url ? (
              <img
                src={activeStore.logo_url}
                alt={`${activeStore.store_name} logo`}
                className="w-5 h-5 rounded object-cover"
              />
            ) : (
              <Store className="w-4 h-4" />
            )}
            <span className="truncate max-w-[150px]">
              {activeStore?.store_name || 'Select Store'}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" align="start">
        <div className="space-y-1">
          {/* Store List */}
          {stores.map((store) => (
            <button
              key={store.id}
              className={cn(
                "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
                "hover:bg-accent",
                store.id === activeStoreId && "bg-accent"
              )}
              onClick={() => {
                onSelectStore(store.id);
                setOpen(false);
              }}
            >
              {store.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={`${store.store_name} logo`}
                  className="w-8 h-8 rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                  <Store className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{store.store_name}</span>
                  {store.id === activeStoreId && (
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground truncate">
                    /shop/{store.slug}
                  </span>
                  <Badge 
                    variant={store.is_active ? 'default' : 'secondary'}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {store.is_active ? 'Live' : 'Draft'}
                  </Badge>
                </div>
              </div>
            </button>
          ))}

          {/* Divider */}
          <div className="border-t my-2" />

          {/* Actions */}
          <button
            className="w-full flex items-center gap-3 p-2 rounded-md text-left hover:bg-accent transition-colors"
            onClick={() => {
              onViewAllStores();
              setOpen(false);
            }}
          >
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="text-sm">Manage All Stores</span>
          </button>

          <button
            className="w-full flex items-center gap-3 p-2 rounded-md text-left hover:bg-accent transition-colors"
            onClick={() => {
              onCreateStore();
              setOpen(false);
            }}
          >
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
              <Plus className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="text-sm">Create New Store</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
