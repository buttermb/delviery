/**
 * Tenant Admin Sidebar
 * 
 * Displays navigation menu filtered by subscription tier.
 * Features are organized by category and only shows features the user has access to,
 * with upgrade prompts for higher-tier features.
 */

import { logger } from '@/lib/logger';
import { NavLink, useParams, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  ChevronDown,
  Settings,
  LogOut,
  Menu,
  Package,
  Users,
  BarChart3,
  FileText,
  Barcode,
  ShoppingCart,
  CreditCard,
  Warehouse,
  TrendingUp,
  Lock,
  Star,
  Diamond,
  Truck,
  MapPin,
  DollarSign,
  PieChart,
  Zap,
  Globe,
  HelpCircle,
  Bell,
  Building,
  Shield,
  Box,
  AlertCircle,
  ArrowRightLeft,
  Receipt,
  UserCog,
  Activity,
  FileSpreadsheet,
  Download,
  MapPinned,
  Building2,
  Key,
  ScrollText,
  Headphones,
  Store,
  Brain,
  Tag,
  Mail,
  Calendar,
  Flame,
  ChevronUp,
  Wallet,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { UpgradeModal } from "./UpgradeModal";
import { useState, useMemo } from "react";
import {
  type FeatureId,
  type SubscriptionTier,
  FEATURES,
  TIER_NAMES,
  hasFeatureAccess,
} from "@/lib/featureConfig";

// Icon mapping for features
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  // Command Center
  'dashboard': LayoutDashboard,
  'hotbox': Flame,
  'live-orders': Activity,
  'notifications': Bell,
  'realtime-dashboard': Activity,
  'live-map': MapPin,

  // Sales & Orders
  'basic-orders': ShoppingCart,
  'disposable-menus': Menu,
  'wholesale-orders': FileText,
  'wholesale-pricing-tiers': Tag,
  'loyalty-program': Star,
  'coupons': Tag,
  'menu-migration': Download,
  'marketplace': Globe,
  'marketplace-product-sync': ArrowRightLeft,
  'sales-dashboard': DollarSign,
  'storefront': Store,
  'pos-system': Store,

  // Inventory
  'products': Package,
  'inventory-dashboard': Warehouse,
  'stock-alerts': AlertCircle,
  'generate-barcodes': Barcode,
  'advanced-inventory': Box,
  'inventory-transfers': ArrowRightLeft,
  'fronted-inventory': CreditCard,
  'operations': Warehouse,
  'dispatch-inventory': Truck,
  'vendor-management': Building2,

  // Customers
  'customers': Users,
  'customer-crm': Users,
  'crm-invoices': FileText,
  'customer-insights': TrendingUp,
  'marketing-automation': Mail,
  'customer-analytics': BarChart3,
  'live-chat': MessageSquare,

  // Operations
  'suppliers': Building2,
  'purchase-orders': FileText,
  'returns': ArrowRightLeft,
  'team-members': Users,
  'role-management': UserCog,
  'activity-logs': ScrollText,
  'quality-control': Shield,
  'appointments': Calendar,
  'support-tickets': Headphones,
  'locations': Building,
  'user-management': UserCog,
  'permissions': Key,

  // Delivery & Fleet
  'delivery-management': Truck,
  'fleet-management': Building2,
  'couriers': Users,
  'route-optimization': MapPinned,
  'delivery-tracking': MapPin,
  'delivery-analytics': BarChart3,

  // Point of Sale
  'cash-register': Wallet,
  'pos-analytics': PieChart,
  'location-analytics': MapPin,

  // Analytics & Finance
  'reports': FileSpreadsheet,
  'analytics': BarChart3,
  'revenue-reports': TrendingUp,
  'financial-center': DollarSign,
  'collections': Wallet,
  'invoice-management': Receipt,
  'commission-tracking': DollarSign,
  'expense-tracking': Receipt,
  'menu-analytics': BarChart3,
  'order-analytics': PieChart,
  'advanced-reporting': BarChart3,
  'predictive-analytics': TrendingUp,
  'advanced-analytics': Brain,
  'custom-reports': FileText,
  'data-export': Download,
  'risk-management': Shield,

  // Integrations
  'bulk-operations': Box,
  'vendor-portal': Building2,
  'api-access': Zap,
  'webhooks': Activity,
  'custom-integrations': Zap,
  'automation': Zap,
  'ai': Brain,

  // Security & Compliance
  'batch-recall': AlertCircle,
  'compliance-vault': FileText,
  'audit-trail': ScrollText,
  'compliance': Shield,

  // Settings
  'settings': Settings,
  'billing': CreditCard,
  'help': HelpCircle,
  'white-label': Globe,
  'custom-domain': Globe,
  'system-settings': Settings,
  'priority-support': Headphones,
};

// Sidebar menu structure organized by category
interface SidebarCategory {
  label: string;
  features: FeatureId[];
  showForTiers?: SubscriptionTier[]; // Only show category for these tiers (optional)
}

const SIDEBAR_CATEGORIES: SidebarCategory[] = [
  {
    label: 'Command Center',
    features: ['dashboard', 'hotbox', 'notifications'],
  },
  {
    label: 'Sales & Orders',
    features: ['basic-orders', 'pos-system', 'marketplace'],
  },
  {
    label: 'Menus',
    features: ['disposable-menus', 'storefront'],
  },
  {
    label: 'Inventory',
    features: ['products'],
  },
  {
    label: 'Customers',
    features: ['customers'],
  },
  {
    label: 'Operations',
    features: ['suppliers', 'team-members', 'locations'],
  },
  {
    label: 'Delivery',
    features: ['delivery-management'],
    showForTiers: ['enterprise'],
  },
  {
    label: 'Analytics & Finance',
    features: ['analytics', 'financial-center'],
  },
  {
    label: 'Integrations',
    features: ['api-access', 'automation'],
  },
  {
    label: 'Settings',
    features: ['settings', 'billing', 'help'],
  },
];


export function TenantAdminSidebar() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const location = useLocation();
  const { tenant, logout } = useTenantAdminAuth();
  const { canAccess, currentTier, subscriptionValid } = useFeatureAccess();
  const [upgradeFeatureId, setUpgradeFeatureId] = useState<FeatureId | null>(null);

  // Build filtered sidebar based on current tier
  const filteredCategories = useMemo(() => {
    if (!tenantSlug) return []; // Early return inside useMemo is fine
    return SIDEBAR_CATEGORIES.map(category => {
      // Get features user has access to
      const accessibleFeatures = category.features.filter(featureId => {
        const feature = FEATURES[featureId];
        if (!feature) return false;
        return canAccess(featureId);
      });

      // Get locked features (show first few as upgrade hints)
      const lockedFeatures = category.features.filter(featureId => {
        const feature = FEATURES[featureId];
        if (!feature) return false;
        return !canAccess(featureId);
      });

      // Show up to 2 locked features as upgrade hints per category
      const upgradeHints = lockedFeatures.slice(0, 2);

      return {
        ...category,
        accessibleFeatures,
        lockedFeatures,
        upgradeHints,
        hasAccessibleFeatures: accessibleFeatures.length > 0,
        hasLockedFeatures: lockedFeatures.length > 0,
      };
    }).filter(category => {
      // Filter out categories with no accessible features AND no upgrade hints
      // But always show categories with accessible features
      return category.hasAccessibleFeatures || category.upgradeHints.length > 0;
    });
  }, [canAccess, tenantSlug]);

  const isActive = (url: string) => {
    const fullPath = `/${tenantSlug}${url}`;
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleLockedItemClick = (featureId: FeatureId) => {
    setUpgradeFeatureId(featureId);
  };

  const getIcon = (featureId: FeatureId) => {
    return ICON_MAP[featureId] || Package;
  };

  const getTierBadge = (tier: SubscriptionTier) => {
    if (tier === 'enterprise') {
      return (
        <Badge variant="outline" className="ml-auto flex items-center gap-1 text-[10px] px-1.5 py-0 h-5 border-purple-500/50 text-purple-600 dark:text-purple-400">
          <Diamond className="h-2.5 w-2.5" />
          Pro+
        </Badge>
      );
    }
    if (tier === 'professional') {
      return (
        <Badge variant="outline" className="ml-auto flex items-center gap-1 text-[10px] px-1.5 py-0 h-5 border-blue-500/50 text-blue-600 dark:text-blue-400">
          <Star className="h-2.5 w-2.5" />
          Pro
        </Badge>
      );
    }
    return null;
  };

  // Get current tier display info
  const tierDisplay = {
    starter: { name: 'Starter', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
    professional: { name: 'Professional', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
    enterprise: { name: 'Enterprise', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  };

  const currentTierInfo = tierDisplay[currentTier as SubscriptionTier] || tierDisplay.starter;

  return (
    <>
      <Sidebar data-tutorial="navigation-sidebar">
        <SidebarHeader className="p-3 sm:p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0">
              {tenant?.slug?.charAt(0).toUpperCase() || "T"}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-semibold text-xs sm:text-sm truncate min-w-0">
                {tenant?.slug || "Tenant Admin"}
              </span>
              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 w-fit ${currentTierInfo.bgColor} ${currentTierInfo.color}`}>
                {currentTierInfo.name}
              </Badge>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {filteredCategories.map((category, index) => {
            const isDefaultOpen = index < 2; // Open first two categories by default

            return (
              <Collapsible
                key={category.label}
                defaultOpen={isDefaultOpen}
                className="group/collapsible"
              >
                <SidebarGroup>
                  <SidebarGroupLabel asChild>
                    <CollapsibleTrigger className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{category.label}</span>
                        {category.hasLockedFeatures && category.lockedFeatures.length > 2 && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 opacity-50">
                            +{category.lockedFeatures.length}
                          </Badge>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {/* Accessible features */}
                        {category.accessibleFeatures.map((featureId) => {
                          const feature = FEATURES[featureId];
                          if (!feature) return null;

                          const Icon = getIcon(featureId);
                          const itemIsActive = isActive(feature.route);

                          return (
                            <SidebarMenuItem key={featureId}>
                              <SidebarMenuButton asChild isActive={itemIsActive}>
                                <NavLink to={`/${tenantSlug}${feature.route}`}>
                                  <Icon className="h-4 w-4" />
                                  <span className="truncate min-w-0">{feature.name}</span>
                                </NavLink>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}

                        {/* Upgrade hint features (locked) */}
                        {category.upgradeHints.map((featureId) => {
                          const feature = FEATURES[featureId];
                          if (!feature) return null;

                          const Icon = getIcon(featureId);

                          return (
                            <SidebarMenuItem key={`locked-${featureId}`}>
                              <SidebarMenuButton
                                onClick={() => handleLockedItemClick(featureId)}
                                className="cursor-pointer opacity-50 hover:opacity-80 transition-opacity"
                              >
                                <Icon className="h-4 w-4" />
                                <span className="truncate min-w-0">{feature.name}</span>
                                <Lock className="h-3 w-3 ml-auto text-muted-foreground" />
                                {getTierBadge(feature.tier)}
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}

                        {/* Show "View more" if there are additional locked features */}
                        {category.lockedFeatures.length > 2 && (
                          <SidebarMenuItem>
                            <SidebarMenuButton
                              onClick={() => handleLockedItemClick(category.lockedFeatures[0])}
                              className="cursor-pointer opacity-40 hover:opacity-60 text-xs"
                            >
                              <ChevronUp className="h-3 w-3 rotate-180" />
                              <span className="text-muted-foreground">
                                Upgrade to unlock {category.lockedFeatures.length - 2} more
                              </span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })}
        </SidebarContent>

        <SidebarFooter className="p-3 sm:p-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start min-h-[44px] touch-manipulation"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span className="text-sm sm:text-base">Logout</span>
          </Button>
        </SidebarFooter>
      </Sidebar>

      {upgradeFeatureId && (
        <UpgradeModal
          open={!!upgradeFeatureId}
          onOpenChange={(open) => !open && setUpgradeFeatureId(null)}
          featureId={upgradeFeatureId}
        />
      )}
    </>
  );
}
