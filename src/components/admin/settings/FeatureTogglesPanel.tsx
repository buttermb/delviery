/**
 * FeatureTogglesPanel
 *
 * Grid of feature cards grouped into "Core Features" (always on, disabled switches)
 * and "Advanced Features" (toggleable). Each card shows a lucide icon,
 * feature name, one-line description, and a Switch toggle.
 * Toggle calls useTenantFeatureToggles().toggleFeature().
 */

import { useState } from 'react';

import { toast } from 'sonner';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import Truck from 'lucide-react/dist/esm/icons/truck';
import Map from 'lucide-react/dist/esm/icons/map';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check';
import Store from 'lucide-react/dist/esm/icons/store';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Users from 'lucide-react/dist/esm/icons/users';
import Megaphone from 'lucide-react/dist/esm/icons/megaphone';
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle';
import Navigation from 'lucide-react/dist/esm/icons/navigation';
import Package from 'lucide-react/dist/esm/icons/package';
import ShoppingBag from 'lucide-react/dist/esm/icons/shopping-bag';
import Link from 'lucide-react/dist/esm/icons/link';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Warehouse from 'lucide-react/dist/esm/icons/warehouse';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card';
import Palette from 'lucide-react/dist/esm/icons/palette';
import type { LucideIcon } from 'lucide-react';

import { type FeatureToggleKey } from '@/lib/featureFlags';
import { humanizeError } from '@/lib/humanizeError';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenantFeatureToggles } from '@/hooks/useTenantFeatureToggles';
import { logger } from '@/lib/logger';

interface FeatureItem {
  key: FeatureToggleKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

const CORE_FEATURES: FeatureItem[] = [
  {
    key: 'orders',
    label: 'Orders',
    description: 'Manage and track customer orders',
    icon: ShoppingBag,
  },
  {
    key: 'products',
    label: 'Products',
    description: 'Product catalog and inventory management',
    icon: Package,
  },
  {
    key: 'menus',
    label: 'Menus',
    description: 'Create and share disposable menus',
    icon: Link,
  },
  {
    key: 'invoices',
    label: 'Invoices',
    description: 'Generate and track invoices',
    icon: FileText,
  },
  {
    key: 'customers',
    label: 'Customers',
    description: 'Customer management and profiles',
    icon: Users,
  },
  {
    key: 'storefront',
    label: 'Storefront',
    description: 'Online store for customer orders',
    icon: Store,
  },
  {
    key: 'inventory',
    label: 'Inventory',
    description: 'Stock tracking and management',
    icon: Warehouse,
  },
];

const ADVANCED_FEATURES: FeatureItem[] = [
  {
    key: 'pos',
    label: 'Point of Sale',
    description: 'Ring up in-store sales with shift management and Z-reports',
    icon: ShoppingCart,
  },
  {
    key: 'delivery_tracking',
    label: 'Delivery Tracking',
    description: 'Assign couriers and track deliveries live',
    icon: Truck,
  },
  {
    key: 'live_map',
    label: 'Live Map',
    description: 'Real-time map view of active deliveries',
    icon: MapPin,
  },
  {
    key: 'fleet_management',
    label: 'Fleet Management',
    description: 'Manage delivery fleet and drivers',
    icon: Navigation,
  },
  {
    key: 'courier_portal',
    label: 'Courier Portal',
    description: 'Dedicated portal for courier operations',
    icon: Map,
  },
  {
    key: 'purchase_orders',
    label: 'Purchase Orders',
    description: 'Track supplier orders and receiving',
    icon: ClipboardList,
  },
  {
    key: 'quality_control',
    label: 'Quality Control',
    description: 'Quality checks and compliance',
    icon: ShieldCheck,
  },
  {
    key: 'vendor_management',
    label: 'Vendor Management',
    description: 'Manage vendor relationships',
    icon: Store,
  },
  {
    key: 'crm_advanced',
    label: 'Advanced CRM',
    description: 'Customer scoring, activity logs, segmentation',
    icon: Users,
  },
  {
    key: 'analytics_advanced',
    label: 'Advanced Analytics',
    description: 'Sales reports and business insights',
    icon: BarChart3,
  },
  {
    key: 'marketing_hub',
    label: 'Marketing Hub',
    description: 'Coupons, campaigns, engagement tools',
    icon: Megaphone,
  },
  {
    key: 'credits_system',
    label: 'Credits System',
    description: 'Customer credit accounts and balances',
    icon: CreditCard,
  },
  {
    key: 'live_chat',
    label: 'Live Chat',
    description: 'Real-time messaging with customers',
    icon: MessageCircle,
  },
  {
    key: 'storefront_builder_advanced',
    label: 'Advanced Storefront Builder',
    description: 'Advanced storefront customization and theming',
    icon: Palette,
  },
];

export function FeatureTogglesPanel() {
  const { isEnabled, toggleFeature, isLoading } = useTenantFeatureToggles();
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const handleToggle = async (key: FeatureToggleKey, enabled: boolean) => {
    setTogglingKey(key);
    try {
      await toggleFeature(key, enabled);
      toast.success(`${enabled ? 'Enabled' : 'Disabled'} feature`);
    } catch (err) {
      logger.error('[FeatureTogglesPanel] Toggle failed', err instanceof Error ? err : new Error(String(err)));
      toast.error('Failed to update feature toggle', { description: humanizeError(err) });
    } finally {
      setTogglingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Core Features — always on, switches disabled */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Core Features
        </h3>
        <p className="text-xs text-muted-foreground">
          These features are always enabled and cannot be turned off.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.key} className="relative opacity-80">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-medium">
                        {feature.label}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`toggle-${feature.key}`} className="sr-only">
                        {feature.label} (always on)
                      </Label>
                      <Switch
                        id={`toggle-${feature.key}`}
                        checked
                        disabled
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-xs">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Advanced Features — toggleable */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Advanced Features
        </h3>
        <p className="text-xs text-muted-foreground">
          Enable or disable advanced features for your business.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ADVANCED_FEATURES.map((feature) => {
            const Icon = feature.icon;
            const enabled = isEnabled(feature.key);
            const isToggling = togglingKey === feature.key;

            return (
              <Card key={feature.key} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-medium">
                        {feature.label}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`toggle-${feature.key}`} className="sr-only">
                        Toggle {feature.label}
                      </Label>
                      <Switch
                        id={`toggle-${feature.key}`}
                        checked={enabled}
                        disabled={isToggling}
                        onCheckedChange={(checked) => handleToggle(feature.key, checked)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-xs">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
