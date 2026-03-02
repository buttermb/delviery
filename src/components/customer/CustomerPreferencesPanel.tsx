/**
 * Customer Preferences Panel
 *
 * Displays browsing history, wishlist, and preferences for storefront customers.
 * Data is accessible from admin customer hub for unified CRM.
 */

import { memo, useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Clock,
  Heart,
  Settings,
  ShoppingCart,
  Trash2,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  useStorefrontCustomerProfile,
  type BrowsingHistoryItem,
  type WishlistItem,
} from '@/hooks/useStorefrontCustomerProfile';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';

interface CustomerPreferencesPanelProps {
  defaultTab?: 'history' | 'wishlist' | 'preferences';
}

function CustomerPreferencesPanelComponent({
  defaultTab = 'wishlist',
}: CustomerPreferencesPanelProps) {
  const navigate = useNavigate();
  const { tenant } = useCustomerAuth();
  const [activeTab, setActiveTab] = useState(defaultTab);

  const {
    profile,
    browsingHistory,
    isLoadingHistory,
    wishlist,
    isLoadingWishlist,
    removeFromWishlist,
    isUpdatingWishlist,
    updatePreferences,
    isUpdatingPreferences,
  } = useStorefrontCustomerProfile();

  const handleProductClick = useCallback((productId: string) => {
    navigate(`/${tenant?.slug}/shop/products/${productId}`);
  }, [navigate, tenant?.slug]);

  const handleAddToCart = useCallback((productId: string) => {
    navigate(`/${tenant?.slug}/shop/products/${productId}`);
  }, [navigate, tenant?.slug]);

  return (
    <Card className="bg-white border-[hsl(var(--customer-border))] shadow-sm">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-[hsl(var(--customer-text))]">
              My Activity
            </CardTitle>
            <TabsList className="bg-[hsl(var(--customer-surface))]">
              <TabsTrigger
                value="wishlist"
                className="data-[state=active]:bg-white"
              >
                <Heart className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Wishlist</span>
                {wishlist.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {wishlist.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="data-[state=active]:bg-white"
              >
                <Clock className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">History</span>
              </TabsTrigger>
              <TabsTrigger
                value="preferences"
                className="data-[state=active]:bg-white"
              >
                <Settings className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Preferences</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>
        <CardContent>
          <TabsContent value="wishlist" className="mt-0">
            <WishlistTab
              items={wishlist}
              isLoading={isLoadingWishlist}
              onRemove={removeFromWishlist}
              onProductClick={handleProductClick}
              onAddToCart={handleAddToCart}
              isRemoving={isUpdatingWishlist}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-0">
            <BrowsingHistoryTab
              items={browsingHistory}
              isLoading={isLoadingHistory}
              onProductClick={handleProductClick}
            />
          </TabsContent>
          <TabsContent value="preferences" className="mt-0">
            <PreferencesTab
              preferences={profile?.preferences ?? null}
              onUpdate={updatePreferences}
              isUpdating={isUpdatingPreferences}
            />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

// Wishlist Tab Component
interface WishlistTabProps {
  items: WishlistItem[];
  isLoading: boolean;
  onRemove: (productId: string) => void;
  onProductClick: (productId: string) => void;
  onAddToCart: (productId: string) => void;
  isRemoving: boolean;
}

const WishlistTab = memo(function WishlistTab({
  items,
  isLoading,
  onRemove,
  onProductClick,
  onAddToCart,
  isRemoving,
}: WishlistTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <Heart className="h-12 w-12 mx-auto mb-3 text-[hsl(var(--customer-text-light))] opacity-50" />
        <p className="text-[hsl(var(--customer-text))] font-medium">No items in wishlist</p>
        <p className="text-sm text-[hsl(var(--customer-text-light))] mt-1">
          Save products you love for later
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--customer-surface))] hover:bg-[hsl(var(--customer-surface))]/80 transition-colors"
        >
          <div
            onClick={() => onProductClick(item.product_id)}
            className="h-16 w-16 rounded-md bg-gray-200 overflow-hidden flex-shrink-0 cursor-pointer"
          >
            {item.product_image ? (
              <img
                src={item.product_image}
                alt={item.product_name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-400">
                <ShoppingCart className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              onClick={() => onProductClick(item.product_id)}
              className="font-medium text-[hsl(var(--customer-text))] truncate cursor-pointer hover:underline"
            >
              {item.product_name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-semibold text-[hsl(var(--customer-primary))]">
                {formatCurrency(item.product_price)}
              </span>
              {!item.in_stock && (
                <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Out of stock
                </Badge>
              )}
            </div>
            <p className="text-xs text-[hsl(var(--customer-text-light))] mt-1">
              Added {formatSmartDate(item.added_at)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {item.in_stock && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAddToCart(item.product_id)}
                className="border-[hsl(var(--customer-border))]"
              >
                <ShoppingCart className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemove(item.product_id)}
              disabled={isRemoving}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
});

// Browsing History Tab Component
interface BrowsingHistoryTabProps {
  items: BrowsingHistoryItem[];
  isLoading: boolean;
  onProductClick: (productId: string) => void;
}

const BrowsingHistoryTab = memo(function BrowsingHistoryTab({
  items,
  isLoading,
  onProductClick,
}: BrowsingHistoryTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <Eye className="h-12 w-12 mx-auto mb-3 text-[hsl(var(--customer-text-light))] opacity-50" />
        <p className="text-[hsl(var(--customer-text))] font-medium">No browsing history</p>
        <p className="text-sm text-[hsl(var(--customer-text-light))] mt-1">
          Products you view will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onProductClick(item.product_id)}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-[hsl(var(--customer-surface))] cursor-pointer transition-colors"
        >
          <div className="h-12 w-12 rounded-md bg-gray-200 overflow-hidden flex-shrink-0">
            {item.product_image ? (
              <img
                src={item.product_image}
                alt={item.product_name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-400">
                <Eye className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-[hsl(var(--customer-text))] truncate">
              {item.product_name}
            </p>
            <p className="text-xs text-[hsl(var(--customer-text-light))]">
              {formatCurrency(item.product_price)}
            </p>
          </div>
          <span className="text-xs text-[hsl(var(--customer-text-light))] whitespace-nowrap">
            {formatSmartDate(item.viewed_at)}
          </span>
        </div>
      ))}
    </div>
  );
});

// Preferences Tab Component
interface PreferencesTabProps {
  preferences: {
    email_notifications: boolean;
    sms_notifications: boolean;
    marketing_emails: boolean;
    preferred_delivery_time: string | null;
    dietary_preferences: string[];
    favorite_categories: string[];
  } | null;
  onUpdate: (updates: Partial<NonNullable<PreferencesTabProps['preferences']>>) => void;
  isUpdating: boolean;
}

const PreferencesTab = memo(function PreferencesTab({
  preferences,
  onUpdate,
  isUpdating,
}: PreferencesTabProps) {
  const handleToggle = (key: keyof NonNullable<typeof preferences>, value: boolean) => {
    onUpdate({ [key]: value });
  };

  const defaultPrefs = {
    email_notifications: true,
    sms_notifications: false,
    marketing_emails: true,
    preferred_delivery_time: null,
    dietary_preferences: [],
    favorite_categories: [],
    ...preferences,
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-[hsl(var(--customer-text))] mb-3">
          Notifications
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label
                htmlFor="email_notifications"
                className="text-sm text-[hsl(var(--customer-text))]"
              >
                Order Updates
              </Label>
              <p className="text-xs text-[hsl(var(--customer-text-light))]">
                Receive email updates about your orders
              </p>
            </div>
            <Switch
              id="email_notifications"
              checked={defaultPrefs.email_notifications}
              onCheckedChange={(v) => handleToggle('email_notifications', v)}
              disabled={isUpdating}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label
                htmlFor="sms_notifications"
                className="text-sm text-[hsl(var(--customer-text))]"
              >
                SMS Notifications
              </Label>
              <p className="text-xs text-[hsl(var(--customer-text-light))]">
                Get text messages for delivery updates
              </p>
            </div>
            <Switch
              id="sms_notifications"
              checked={defaultPrefs.sms_notifications}
              onCheckedChange={(v) => handleToggle('sms_notifications', v)}
              disabled={isUpdating}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label
                htmlFor="marketing_emails"
                className="text-sm text-[hsl(var(--customer-text))]"
              >
                Promotions & Deals
              </Label>
              <p className="text-xs text-[hsl(var(--customer-text-light))]">
                Receive special offers and discounts
              </p>
            </div>
            <Switch
              id="marketing_emails"
              checked={defaultPrefs.marketing_emails}
              onCheckedChange={(v) => handleToggle('marketing_emails', v)}
              disabled={isUpdating}
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-[hsl(var(--customer-border))]">
        <p className="text-xs text-[hsl(var(--customer-text-light))]">
          Your preferences are synced with our system and help us provide better recommendations.
        </p>
      </div>
    </div>
  );
});

export const CustomerPreferencesPanel = memo(CustomerPreferencesPanelComponent);
