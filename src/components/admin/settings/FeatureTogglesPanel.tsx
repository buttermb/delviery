/**
 * FeatureTogglesPanel
 *
 * Shows ALL platform features grouped by category.
 * - Features with toggle keys get a working Switch (or disabled if tier-locked).
 * - Essential features (dashboard, hotbox, settings, billing, help) are always on.
 * - Features without toggles show "Included" or tier-lock status.
 * - Summary stats at the top: accessible / locked / total.
 */

import { useState, useMemo } from 'react';

import { toast } from 'sonner';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import Truck from 'lucide-react/dist/esm/icons/truck';
import MapIcon from 'lucide-react/dist/esm/icons/map';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check';
import Store from 'lucide-react/dist/esm/icons/store';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import UsersIcon from 'lucide-react/dist/esm/icons/users';
import Megaphone from 'lucide-react/dist/esm/icons/megaphone';
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle';
import Navigation from 'lucide-react/dist/esm/icons/navigation';
import PackageIcon from 'lucide-react/dist/esm/icons/package';
import ShoppingBag from 'lucide-react/dist/esm/icons/shopping-bag';
import LinkIcon from 'lucide-react/dist/esm/icons/link';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Warehouse from 'lucide-react/dist/esm/icons/warehouse';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Lock from 'lucide-react/dist/esm/icons/lock';
import Check from 'lucide-react/dist/esm/icons/check';
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard';
import Settings from 'lucide-react/dist/esm/icons/settings';
import Zap from 'lucide-react/dist/esm/icons/zap';
import Star from 'lucide-react/dist/esm/icons/star';
import Tag from 'lucide-react/dist/esm/icons/tag';
import Gift from 'lucide-react/dist/esm/icons/gift';
import Receipt from 'lucide-react/dist/esm/icons/receipt';
import Bell from 'lucide-react/dist/esm/icons/bell';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import Headphones from 'lucide-react/dist/esm/icons/headphones';
import Radio from 'lucide-react/dist/esm/icons/radio';
import Scan from 'lucide-react/dist/esm/icons/scan';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import ArrowLeftRight from 'lucide-react/dist/esm/icons/arrow-left-right';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import Boxes from 'lucide-react/dist/esm/icons/boxes';
import Globe from 'lucide-react/dist/esm/icons/globe';
import Webhook from 'lucide-react/dist/esm/icons/webhook';
import Bot from 'lucide-react/dist/esm/icons/bot';
import Download from 'lucide-react/dist/esm/icons/download';
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle';
import type { LucideIcon } from 'lucide-react';

import { type FeatureToggleKey } from '@/lib/featureFlags';
import {
  FEATURES,
  ESSENTIAL_FEATURES,
  TIER_NAMES,
  CATEGORY_ORDER,
  type FeatureId,
  type FeatureCategory,
  type SubscriptionTier,
} from '@/lib/featureConfig';
import { FEATURE_TO_TOGGLE_MAP } from '@/lib/featureMapping';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { humanizeError } from '@/lib/humanizeError';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenantFeatureToggles } from '@/hooks/useTenantFeatureToggles';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Icon maps
// ---------------------------------------------------------------------------

/** Per-feature icons (hand-picked for the most important features). */
const FEATURE_ICONS: Partial<Record<FeatureId, LucideIcon>> = {
  // Command Center
  'dashboard': LayoutDashboard,
  'hotbox': Zap,
  'live-orders': Radio,
  'notifications': Bell,
  'realtime-dashboard': Radio,
  'live-map': MapPin,
  // Sales & Orders
  'basic-orders': ShoppingBag,
  'wholesale-orders': Boxes,
  'wholesale-pricing-tiers': Tag,
  'loyalty-program': Star,
  'coupons': Tag,
  'marketplace': Store,
  'marketplace-product-sync': ArrowLeftRight,
  'sales-dashboard': TrendingUp,
  'storefront': Store,
  'storefront-builder': Palette,
  'storefront-settings': Settings,
  'storefront-analytics': BarChart3,
  'storefront-live-orders': Radio,
  'storefront-reviews': MessageCircle,
  'pos-system': ShoppingCart,
  // Menus
  'disposable-menus': LinkIcon,
  'menu-migration': ArrowLeftRight,
  // Inventory
  'products': PackageIcon,
  'inventory-dashboard': Warehouse,
  'stock-alerts': AlertTriangle,
  'generate-barcodes': Scan,
  'advanced-inventory': Warehouse,
  'inventory-transfers': ArrowLeftRight,
  'dispatch-inventory': Truck,
  'vendor-management': Store,
  // Customers
  'customers': UsersIcon,
  'customer-crm': UsersIcon,
  'crm-invoices': FileText,
  'customer-insights': TrendingUp,
  'marketing-automation': Megaphone,
  'customer-analytics': BarChart3,
  'live-chat': MessageCircle,
  // Operations
  'suppliers': PackageIcon,
  'purchase-orders': ClipboardList,
  'returns': ArrowLeftRight,
  'team-members': UsersIcon,
  'role-management': ShieldCheck,
  'activity-logs': FileText,
  'quality-control': ShieldCheck,
  'appointments': Calendar,
  'support-tickets': Headphones,
  'operations': Boxes,
  'fronted-inventory': CreditCard,
  'locations': MapIcon,
  'user-management': UsersIcon,
  'permissions': Lock,
  // Analytics & Finance
  'reports': BarChart3,
  'analytics': BarChart3,
  'revenue-reports': TrendingUp,
  'financial-center': CreditCard,
  'collections': CreditCard,
  'invoice-management': Receipt,
  'commission-tracking': TrendingUp,
  'expense-tracking': Receipt,
  'menu-analytics': BarChart3,
  'order-analytics': BarChart3,
  'advanced-reporting': FileText,
  'predictive-analytics': TrendingUp,
  'advanced-analytics': Bot,
  'custom-reports': FileText,
  'data-export': Download,
  'risk-management': AlertTriangle,
  // Delivery & Fleet
  'delivery-management': Truck,
  'fleet-management': Navigation,
  'couriers': MapIcon,
  'route-optimization': MapPin,
  'delivery-tracking': Truck,
  'delivery-analytics': BarChart3,
  'drivers': UsersIcon,
  'fleet-map': MapPin,
  // Point of Sale
  'cash-register': ShoppingCart,
  'pos-analytics': BarChart3,
  'location-analytics': MapPin,
  // Integrations
  'bulk-operations': Boxes,
  'vendor-portal': Store,
  'api-access': Globe,
  'webhooks': Webhook,
  'custom-integrations': LinkIcon,
  'automation': Zap,
  'ai': Bot,
  // Security & Compliance
  'batch-recall': AlertTriangle,
  'compliance-vault': ShieldCheck,
  'audit-trail': FileText,
  'compliance': ShieldCheck,
  // Settings
  'settings': Settings,
  'billing': CreditCard,
  'help': HelpCircle,
  'white-label': Palette,
  'custom-domain': Globe,
  'system-settings': Settings,
  'priority-support': Headphones,
};

/** Fallback icon per category when a feature has no specific icon. */
const CATEGORY_ICONS: Record<FeatureCategory, LucideIcon> = {
  'Command Center': LayoutDashboard,
  'Sales & Orders': ShoppingCart,
  'Menus': LinkIcon,
  'Inventory': Warehouse,
  'Customers': UsersIcon,
  'Operations': ClipboardList,
  'Analytics & Finance': BarChart3,
  'Delivery & Fleet': Truck,
  'Point of Sale': ShoppingCart,
  'Integrations': LinkIcon,
  'Security & Compliance': ShieldCheck,
  'Settings': Settings,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeatureTogglesPanel() {
  const { isEnabled, toggleFeature, isLoading } = useTenantFeatureToggles();
  const { canAccess, currentTier } = useFeatureAccess();
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  // Group all features by category in sidebar order
  const categorized = useMemo(() => {
    const allIds = Object.keys(FEATURES) as FeatureId[];
    const grouped = new Map<FeatureCategory, FeatureId[]>();

    for (const id of allIds) {
      const f = FEATURES[id];
      const list = grouped.get(f.category) ?? [];
      list.push(id);
      grouped.set(f.category, list);
    }

    return CATEGORY_ORDER
      .filter((cat) => grouped.has(cat))
      .map((cat) => ({ category: cat, featureIds: grouped.get(cat)! }));
  }, []);

  // Summary stats
  const stats = useMemo(() => {
    const allIds = Object.keys(FEATURES) as FeatureId[];
    let accessible = 0;
    let locked = 0;
    for (const id of allIds) {
      if (ESSENTIAL_FEATURES.includes(id) || canAccess(id)) {
        accessible++;
      } else {
        locked++;
      }
    }
    return { total: allIds.length, accessible, locked };
  }, [canAccess]);

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
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Plan summary */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant="outline" className="text-xs font-semibold">
          {TIER_NAMES[currentTier]} Plan
        </Badge>
        <span className="text-muted-foreground">
          {stats.accessible} of {stats.total} features accessible
        </span>
        {stats.locked > 0 && (
          <span className="text-muted-foreground">
            &middot; {stats.locked} locked
          </span>
        )}
      </div>

      {/* Features by category */}
      {categorized.map(({ category, featureIds }) => (
        <div key={category} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {category}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featureIds.map((featureId) => (
              <FeatureCard
                key={featureId}
                featureId={featureId}
                category={category}
                canAccess={canAccess(featureId)}
                isEssential={ESSENTIAL_FEATURES.includes(featureId)}
                isEnabled={isEnabled}
                isToggling={togglingKey}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature Card
// ---------------------------------------------------------------------------

interface FeatureCardProps {
  featureId: FeatureId;
  category: FeatureCategory;
  canAccess: boolean;
  isEssential: boolean;
  isEnabled: (key: FeatureToggleKey) => boolean;
  isToggling: string | null;
  onToggle: (key: FeatureToggleKey, enabled: boolean) => void;
}

function FeatureCard({
  featureId,
  category,
  canAccess: accessible,
  isEssential,
  isEnabled,
  isToggling,
  onToggle,
}: FeatureCardProps) {
  const feature = FEATURES[featureId];
  const toggleKey = FEATURE_TO_TOGGLE_MAP[featureId] as FeatureToggleKey | undefined;
  const Icon = FEATURE_ICONS[featureId] ?? CATEGORY_ICONS[category] ?? PackageIcon;

  const tierLocked = !isEssential && !accessible;
  const requiredTier = tierLocked ? TIER_NAMES[feature.tier as SubscriptionTier] : null;

  // Determine what to show on the right side
  let rightContent: React.ReactNode;

  if (isEssential) {
    // Always-on essential features
    rightContent = (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
        Always on
      </Badge>
    );
  } else if (toggleKey && !tierLocked) {
    // Has a toggle and tier is accessible → working switch
    const enabled = isEnabled(toggleKey);
    rightContent = (
      <>
        <Label htmlFor={`toggle-${featureId}`} className="sr-only">
          Toggle {feature.name}
        </Label>
        <Switch
          id={`toggle-${featureId}`}
          checked={enabled}
          disabled={isToggling === toggleKey}
          onCheckedChange={(checked) => onToggle(toggleKey, checked)}
        />
      </>
    );
  } else if (tierLocked) {
    // Tier-locked → show lock badge
    rightContent = (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 gap-1">
        <Lock className="h-2.5 w-2.5" />
        {requiredTier}
      </Badge>
    );
  } else {
    // Accessible, no toggle → included check
    rightContent = (
      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium">Included</span>
      </div>
    );
  }

  return (
    <Card className={`relative ${tierLocked ? 'opacity-50' : ''}`}>
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <CardTitle className="text-sm font-medium truncate">
              {feature.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {rightContent}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3 px-3">
        <CardDescription className="text-xs line-clamp-2">
          {tierLocked ? `Upgrade to ${requiredTier} to unlock` : feature.description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}
