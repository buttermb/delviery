/**
 * Multi-Tenant SaaS Platform - Root Application Component
 * 
 * Tech Stack:
 * - React 18.3 with SWC compiler
 * - TanStack Query v5 for state management
 * - React Router v6 for routing
 * - Radix UI primitives
 * - Tailwind CSS utility framework
 */

import { logger } from "@/lib/logger";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { appQueryClient } from "@/lib/react-query-config";
import { AuthProvider } from "./contexts/AuthContext";
import { AccountProvider } from "./contexts/AccountContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TenantProvider } from "./contexts/TenantContext";
import { WhiteLabelProvider } from "./components/whitelabel/WhiteLabelProvider";
import { CourierProvider } from "./contexts/CourierContext";
import { VendorAuthProvider } from "./contexts/VendorAuthContext";
import { SuperAdminAuthProvider } from "./contexts/SuperAdminAuthContext";
import { TenantAdminAuthProvider } from "./contexts/TenantAdminAuthContext";
import { CustomerAuthProvider } from "./contexts/CustomerAuthContext";
import { EncryptionProvider } from "./contexts/EncryptionContext";
import { CreditProvider } from "./contexts/CreditContext";
import { Suspense, useEffect, useState, type ComponentType } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SkipToContent } from "./components/SkipToContent";
import { LoadingFallback } from "./components/LoadingFallback";
import { SkeletonAdminLayout } from "./components/loading/SkeletonAdminLayout";
import { SkeletonDashboard } from "./components/loading/SkeletonDashboard";
import { SkeletonStorefront } from "./components/loading/SkeletonStorefront";
import { SkeletonCourier } from "./components/loading/SkeletonCourier";
import { SmartRootRedirect } from "./components/SmartRootRedirect";
import { setupGlobalErrorHandlers } from "./utils/reactErrorHandler";
import { FeatureProtectedRoute } from "./components/tenant-admin/FeatureProtectedRoute";
import { SubscriptionGuard } from "./components/tenant-admin/SubscriptionGuard";
import { PublicOnlyRoute } from "./components/auth/PublicOnlyRoute";
import { RoleProtectedRoute } from "./components/auth/RoleProtectedRoute";
import { TenantContextGuard } from "./components/auth/TenantContextGuard";
import { runProductionHealthCheck } from "@/utils/productionHealthCheck";
import { productionLogger } from "@/utils/productionLogger";
import { toast } from "sonner";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

import OfflineBanner from "./components/OfflineBanner";
import { ScrollToTop } from "./components/ScrollToTop";
import { RouteProgressManager } from "./components/RouteProgressManager";
import { DocumentTitleManager } from "./components/DocumentTitleManager";
import { initializeGlobalButtonMonitoring } from "./lib/utils/globalButtonInterceptor";
import { useVersionCheck } from "./hooks/useVersionCheck";
import { FeatureFlagsProvider } from "./config/featureFlags";
// AdminDebugPanel is lazy-loaded to ensure admin code never ships in public bundles.
// It's only used in DEV mode (see usage below), so we defer-load it there.
const AdminDebugPanel = lazy(() => import("./components/admin/AdminDebugPanel").then(m => ({ default: m.AdminDebugPanel })));
import { PerformanceMonitor } from "./utils/performance";

import { initCapacitor } from '@/lib/capacitor';

// Configure route-level progress indicator (NProgress)
NProgress.configure({ showSpinner: false, trickleSpeed: 120, minimum: 0.1 });
const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReducedMotion) {
  NProgress.configure({ trickle: false });
}

function SuspenseProgressFallback() {
  // Start progress when lazy content is loading; stop when it resolves
  useEffect(() => {
    try { NProgress.start(); } catch { /* ignore NProgress errors */ }
    return () => {
      try { NProgress.done(); } catch { /* ignore NProgress errors */ }
    };
  }, []);
  return <LoadingFallback />;
}

// All lazy-loaded page components — extracted to src/routes/lazyImports.ts
import {
  NotFoundPage, AdminNotFoundPage, ButtonMonitorPage,
  MarketingHome, PricingPage, Contact, Features, FAQPage, SupportPage,
  TermsPage, PrivacyPage, About, InteractiveDemoPage, DemoRequest, DemoConfirmation,
  IntegrationsPage, DocsPage, GettingStartedPage, ApiReferencePage, AuthenticationPage,
  SecurityDocsPage, StatusPage, Careers, Press, Blog, Security, Cookie, LoginDirectory,
  PublicMarketplacePage, PublicListingDetailPage, ClientPortalPage,
  SuperAdminLoginPage, SuperAdminDashboardPage, SuperAdminTenantsListPage,
  SuperAdminCreateTenantPage, SuperAdminTenantDetailPage, SuperAdminSettingsPage,
  SuperAdminMonitoringPage, SuperAdminAnalyticsPage, SuperAdminDataExplorerPage,
  SuperAdminAPIUsagePage, SuperAdminAuditLogsPage, SuperAdminRevenueAnalyticsPage,
  SuperAdminReportBuilderPage, SuperAdminExecutiveDashboardPage, SuperAdminWorkflowsPage,
  SuperAdminCommunicationPage, SuperAdminFeatureFlagsPage, SuperAdminSystemConfigPage,
  SuperAdminSecurityPage, ForumApprovalsPage, AdminUsersPage, SuperAdminToolsPage,
  MarketplaceModerationPage, SuperAdminCreditsOverviewPage, SuperAdminTenantCreditsPage,
  SuperAdminCreditAuditLogPage, SuperAdminPromoCodeManagementPage,
  SuperAdminCreditPackagesPage, SuperAdminCreditAnalyticsPage,
  SuperAdminReferralManagementPage, SuperAdminProtectedRouteNew, SuperAdminLayout,
  SignUpPage, SelectPlanPage, SaasLoginPage, VerifyEmailPage,
  TenantAdminWelcomePage, SetupWizardPage, TenantAdminVerifyEmailPage,
  PasswordResetPage, SignupSuccessPage, AccountSettingsPage, ChangePasswordPage,
  TenantAdminLoginPage, TenantAdminProtectedRoute, AdminLayout,
  TenantAdminDashboardPage, HotboxPage, FinancialCommandCenterPage, CollectionModePage,
  TenantAdminSelectPlanPage, TrialExpiredPage, HelpPage, HelpHubPage,
  DisposableMenus, DisposableMenuAnalytics, MenuAnalytics, MenuMigration,
  ClientDetail, GenerateBarcodes, NewWholesaleOrder, NewPurchaseOrder, OfflineOrderCreate,
  ReportsPage, BoardReportPage, StrategicDashboardPage, ExpansionAnalysisPage,
  TeamManagement, FrontedInventory, FrontedInventoryDetails, CustomerInvoices,
  RunnerLocationTracking, LiveMap, LocationsManagement, AdminLiveChat, AdminNotifications,
  OrderAnalyticsPage, SalesDashboardPage, CustomerReports, DispatchInventory,
  FrontedInventoryAnalytics, ClientsPage, ClientDetailPage, InvoicesPage,
  CreateInvoicePage, InvoiceDetailPage, CreatePreOrderPage, PreOrderDetailPage,
  ProductDetailsPage, CRMSettingsPage, InvitesPage, InvoicePublicPage,
  DeliveryTrackingPage, AdvancedReportingPage,
  VendorLoginPage, VendorDashboardPage, VendorOrderDetailPage, ProtectedVendorRoute,
  GlobalSearch, RiskFactorManagement, SystemSettings, VendorManagement, VendorDashboard,
  PurchaseOrders, ImagesPage, BatchesPage, CategoriesPage, ReceivingPage,
  WarehousesPage, RunnersPage, AdminPricingPage, PricingTiersPage, DeveloperTools,
  ButtonTester, ReviewsPage, DeliveryZonesPage, AnalyticsPage,
  AdvancedInvoicePage, LocalAIPage, WorkflowAutomationPage,
  MarketplaceDashboard, StoreSettings, ProductVisibilityManager, CouponManager,
  MarketplaceCategoryManager, ProductSyncPage,
  ShopLayout, ShopStorefrontPage, ShopProductCatalogPage, ShopProductDetailPage,
  ShopCartPage, ShopCheckoutPage, ShopOrderConfirmationPage, ShopAccountPage,
  ShopOrderTrackingPage, ShopOrderDetailPage, ShopDealsPage, SinglePageCheckout,
  EncryptedStorePage, StoreLandingPage, StoreMenuPage, StoreProductPage,
  RevenueReportsPage, RouteOptimizationPage, DeliveryAnalyticsPage,
  CashRegisterPage, POSAnalyticsPage, POSShiftsPage, ZReportPage,
  POSHubPage, OrdersHubPage, OrderDetailsPage, InventoryHubPage, CustomerHubPage,
  AnalyticsHubPage, SettingsHubPage, FinanceHubPage, StorefrontHubPage,
  OperationsHubPage, FulfillmentHubPage, DashboardHubPage, SmartTVDashboard,
  MarketingHubPage, RoleManagement, ActivityLogsPage, LocationAnalyticsPage,
  BulkOperationsPage, APIAccessPage, WebhooksPage, CustomIntegrationsPage,
  DataExportPage, AuditTrailPage, CompliancePage, WhiteLabelPage, CustomDomainPage,
  PrioritySupportPage, CreditPurchaseSuccessPage, CreditPurchaseCancelledPage,
  CreditAnalyticsPage, CustomerDetails, StockAlertsPage, InventoryTransfersPage,
  InventoryAuditPage, CustomerAnalyticsPage, AdvancedAnalyticsPage,
  RealtimeDashboardPage, CustomReportsPage, CommissionTrackingPage,
  SellerProfilePage, MyListingsPage, ListingForm, ListingDetailPage,
  MarketplaceOrdersPage, OrderDetailPage, VendorPayoutsPage, MessagesPage,
  PlatformAdminLayout, AllTenantsPage, DesignSystemPage, PlatformPayoutsPage,
  CourierLoginPage, CourierDashboardPage, CourierEarningsPage, CourierHistoryPage,
  CourierActiveOrderPage, UnifiedActiveDeliveryPage, CourierSettingsPage, ProtectedCourierRoute,
  CustomerLoginPage, CustomerSignUpPage, CustomerVerifyEmailPage,
  CustomerForgotPasswordPage, CustomerResetPasswordPage, CustomerLoginLanding,
  CustomerProtectedRoute, CustomerPortal, CustomerDashboardPage, CustomerSettingsPage,
  ShoppingCartPage, CheckoutPage, OrderTrackingPage, SecureMenuAccess, SecureMenuView, StaticMenuPage,
  WholesaleMarketplacePage, WholesaleCartPage, WholesaleCheckoutPage,
  CustomerWholesaleOrdersPage, WholesaleOrderDetailPage,
  BusinessFinderPage, BusinessMenuPage, UnifiedOrdersPage,
  CommunityAuthPage, CommunityProtectedRoute, CommunityLayout, CommunityHomePage,
  CategoryPage, PostDetailPage, CreatePostPage, UserProfilePage, SearchPage, ApprovalPage,
  InvitationAcceptPage, MenuAccess, MobileTestPage,
  TenantAdminAuthCallback, SuperAdminAuthCallback, CustomerAuthCallback,
  MFAChallengePage, AuthConfirmPage, SecureAccountPage,
  FeatureCompliancePage, FeatureLogisticsPage, FeatureEcommercePage,
} from "@/routes/lazyImports";
import { UrlEncodingFixer } from "./components/UrlEncodingFixer";

const scheduleNonCritical = (task: () => void, timeout = 1500) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as Window & {
      requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback(task, { timeout });
    return;
  }
  (window ?? globalThis).setTimeout(task, 0);
};

// Use the singleton QueryClient from centralized config
const queryClient = appQueryClient;

// Setup global error handlers
setupGlobalErrorHandlers();

const App = () => {
  const [VercelAnalytics, setVercelAnalytics] = useState<ComponentType | null>(null);
  const [DeferredUpdateBanner, setDeferredUpdateBanner] = useState<ComponentType | null>(null);
  const [DeferredInstallPWA, setDeferredInstallPWA] = useState<ComponentType | null>(null);
  const [DeferredDeviceTracker, setDeferredDeviceTracker] = useState<ComponentType | null>(null);

  // Enable automatic version checking and cache busting
  useVersionCheck();

  // Safety cleanup: Ensure scroll is never blocked on app load
  useEffect(() => {
    // Initialize Capacitor (Splash Screen, Status Bar)
    initCapacitor();

    // Remove any stuck keyboard-open state
    document.body.classList.remove('keyboard-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.overflow = '';
  }, []);

  // Clear stale auth data on marketing/login pages to prevent cross-tenant contamination
  // Note: Auth cleanup moved to explicit logout actions only
  // to prevent redirect loops when navigating to login pages

  // Initialize global button monitoring
  useEffect(() => {
    scheduleNonCritical(() => {
      initializeGlobalButtonMonitoring();
    }, 3000);
  }, []);

  // Initialize performance monitoring (Core Web Vitals)
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    scheduleNonCritical(() => {
      PerformanceMonitor.init();
      cleanup = () => PerformanceMonitor.disconnect();
    }, 3000);

    // Log performance report in development
    if (import.meta.env.DEV) {
      const reportTimer = setTimeout(() => {
        logger.info(PerformanceMonitor.getReport());
      }, 5000);
      return () => {
        clearTimeout(reportTimer);
        cleanup?.();
      };
    }

    return () => cleanup?.();
  }, []);

  // Load analytics after initial UI is interactive
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    scheduleNonCritical(async () => {
      const mod = await import('@vercel/analytics/react');
      setVercelAnalytics(() => mod.Analytics);
    }, 4000);
  }, []);

  // Load non-critical global UI/hooks after initial paint.
  useEffect(() => {
    scheduleNonCritical(async () => {
      const [updateMod, pwaMod, deviceTrackerMod] = await Promise.all([
        import('./components/mobile/UpdateBanner'),
        import('./components/InstallPWA'),
        import('./components/DeviceTracker'),
      ]);

      setDeferredUpdateBanner(() => updateMod.UpdateBanner);
      setDeferredInstallPWA(() => ((pwaMod as Record<string, unknown>).default ?? (pwaMod as Record<string, unknown>).InstallPWA) as ComponentType);
      setDeferredDeviceTracker(() => ((deviceTrackerMod as Record<string, unknown>).default ?? (deviceTrackerMod as Record<string, unknown>).DeviceTracker) as ComponentType);
    }, 2500);
  }, []);

  // Run route audit on startup (dev mode only)
  useEffect(() => {
    if (import.meta.env.DEV) {
      // Defer heavy route-audit graph imports off the critical path.
      const timer = setTimeout(async () => {
        const [{ runRouteAudit: runAudit }, sidebarConfigs] = await Promise.all([
          import('./utils/routeAudit'),
          import('./lib/sidebar/sidebarConfigs'),
        ]);

        runAudit(sidebarConfigs.STARTER_SIDEBAR);
        runAudit(sidebarConfigs.PROFESSIONAL_SIDEBAR);
        runAudit(sidebarConfigs.ENTERPRISE_SIDEBAR);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  // Run production health check on mount
  useEffect(() => {
    if (import.meta.env.PROD) {
      const runHealthCheck = async () => {
        try {
          const result = await runProductionHealthCheck();

          if (result.issues.length > 0) {
            productionLogger.warning('Production health check found issues', result as unknown as Record<string, unknown>);

            // Show toast for critical issues
            if (!result.supabase || !result.realtime) {
              toast.error('Connection Issues Detected', {
                description: 'Some features may not work properly. Please refresh the page.',
              });
            }
          }
        } catch (error) {
          productionLogger.error('Health check failed', { error });
        }
      };

      // Run after a short delay to not block initial render
      const timer = setTimeout(runHealthCheck, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <ErrorBoundary>
      {VercelAnalytics ? <VercelAnalytics /> : null}
      <QueryClientProvider client={queryClient}>
        <FeatureFlagsProvider>
          <ThemeProvider>
            <AuthProvider>
              <AccountProvider>
                <EncryptionProvider>
                  <TooltipProvider>
                    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                      <SuperAdminAuthProvider>
                        <TenantAdminAuthProvider>
                          <CustomerAuthProvider>
                            <CreditProvider>
                              <TenantProvider>
                                <WhiteLabelProvider>
                                  <SkipToContent />
                                  <OfflineBanner />
                                  {DeferredUpdateBanner ? <DeferredUpdateBanner /> : null}
                                  {DeferredInstallPWA ? <DeferredInstallPWA /> : null}
                                  {DeferredDeviceTracker ? <DeferredDeviceTracker /> : null}

                                  <Sonner />
                                  <Suspense fallback={<SuspenseProgressFallback />}>
                                    <UrlEncodingFixer />
                                    <RouteProgressManager />
                                    <DocumentTitleManager />
                                    <ScrollToTop />
                                    <Routes>
                                      {/* Marketing & Public Routes */}
                                      <Route path="/" element={<SmartRootRedirect />} />
                                      <Route path="/p/:portalToken" element={<ClientPortalPage />} />
                                      <Route path="/marketing" element={<MarketingHome />} />
                                      <Route path="/features" element={<Features />} />
                                      <Route path="/features/compliance" element={<FeatureCompliancePage />} />
                                      <Route path="/features/logistics" element={<FeatureLogisticsPage />} />
                                      <Route path="/features/ecommerce" element={<FeatureEcommercePage />} />
                                      <Route path="/pricing" element={<PricingPage />} />
                                      <Route path="/about" element={<About />} />
                                      <Route path="/contact" element={<Contact />} />
                                      <Route path="/demo" element={<InteractiveDemoPage />} />
                                      <Route path="/demo/request" element={<DemoRequest />} />
                                      <Route path="/demo/confirm" element={<DemoConfirmation />} />
                                      <Route path="/integrations" element={<IntegrationsPage />} />
                                      <Route path="/docs" element={<DocsPage />} />
                                      <Route path="/docs/getting-started" element={<GettingStartedPage />} />
                                      <Route path="/docs/api-reference" element={<ApiReferencePage />} />
                                      <Route path="/docs/authentication" element={<AuthenticationPage />} />
                                      <Route path="/docs/security" element={<SecurityDocsPage />} />
                                      <Route path="/status" element={<StatusPage />} />
                                      <Route path="/faq" element={<FAQPage />} />
                                      <Route path="/support" element={<SupportPage />} />
                                      <Route path="/terms" element={<TermsPage />} />
                                      <Route path="/privacy" element={<PrivacyPage />} />
                                      <Route path="/careers" element={<Careers />} />
                                      <Route path="/press" element={<Press />} />
                                      <Route path="/blog" element={<Blog />} />
                                      <Route path="/security" element={<Security />} />
                                      <Route path="/cookie" element={<Cookie />} />
                                      <Route path="/cookies" element={<Cookie />} />
                                      <Route path="/login" element={<LoginDirectory />} />

                                      {/* Public Marketplace (B2B) */}
                                      <Route path="/marketplace" element={<PublicMarketplacePage />} />
                                      <Route path="/marketplace/listings/:listingId" element={<PublicListingDetailPage />} />

                                      {/* Public Store Landing Page */}
                                      <Route path="/store/:slug" element={<Suspense fallback={<SkeletonStorefront />}><StoreLandingPage /></Suspense>} />
                                      <Route path="/store/:slug/menu" element={<Suspense fallback={<SkeletonStorefront />}><StoreMenuPage /></Suspense>} />
                                      <Route path="/store/:slug/product/:id" element={<Suspense fallback={<SkeletonStorefront />}><StoreProductPage /></Suspense>} />

                                      {/* Encrypted Store Link (Private Shareable) */}
                                      <Route path="/s/:token" element={<Suspense fallback={<SkeletonStorefront />}><EncryptedStorePage /></Suspense>} />

                                      {/* White-Label Shop (Customer Storefront) */}
                                      <Route path="/shop/:storeSlug" element={<Suspense fallback={<SkeletonStorefront />}><ShopLayout /></Suspense>}>
                                        <Route index element={<ShopStorefrontPage />} />
                                        <Route path="products" element={<ShopProductCatalogPage />} />
                                        <Route path="products/:productId" element={<ShopProductDetailPage />} />
                                        {/* SEO-friendly slug-based product URLs */}
                                        <Route path="product/:productSlug" element={<ShopProductDetailPage />} />
                                        <Route path="deals" element={<ShopDealsPage />} />
                                        <Route path="cart" element={<ShopCartPage />} />
                                        <Route path="checkout" element={<ShopCheckoutPage />} />
                                        <Route path="express-checkout" element={<SinglePageCheckout />} />
                                        <Route path="order-confirmation" element={<ShopOrderConfirmationPage />} />
                                        <Route path="track/:trackingToken" element={<ShopOrderTrackingPage />} />
                                        <Route path="account" element={<ShopAccountPage />} />
                                        <Route path="orders" element={<ShopAccountPage />} />
                                        <Route path="orders/:orderId" element={<ShopOrderDetailPage />} />
                                        <Route path="wishlist" element={<ShopAccountPage />} />
                                      </Route>

                                      {/* Public Authentication - Redirect authenticated users */}
                                      <Route path="/signup" element={<PublicOnlyRoute portal="saas"><SignUpPage /></PublicOnlyRoute>} />
                                      <Route path="/select-plan" element={<SelectPlanPage />} />
                                      <Route path="/saas/login" element={<PublicOnlyRoute portal="saas"><SaasLoginPage /></PublicOnlyRoute>} />
                                      <Route path="/verify-email" element={<VerifyEmailPage />} />
                                      <Route path="/signup-success" element={<SignupSuccessPage />} />
                                      <Route path="/auth/confirm" element={<AuthConfirmPage />} />
                                      <Route path="/auth/secure-account" element={<SecureAccountPage />} />


                                      {/* Redirect admin routes without tenant slug - go directly to business login */}
                                      <Route path="/admin/*" element={<PublicOnlyRoute portal="saas"><SaasLoginPage /></PublicOnlyRoute>} />

                                      {/* Invitation Acceptance */}
                                      <Route path="/invite/:token" element={<InvitationAcceptPage />} />

                                      {/* Public Menu Access */}
                                      <Route path="/m/:token" element={<SecureMenuAccess />} />
                                      <Route path="/m/:token/view" element={<SecureMenuView />} />
                                      <Route path="/menu/:token" element={<MenuAccess />} />

                                      {/* Static Menu Page (no auth, clean HTML view) */}
                                      <Route path="/page/:token" element={<StaticMenuPage />} />

                                      {/* Debug Routes - Development Only */}
                                      {import.meta.env.DEV && (
                                        <Route path="/debug/button-monitor" element={<ButtonMonitorPage />} />
                                      )}

                                      {/* ==================== LEVEL 1: SUPER ADMIN (Platform) ==================== */}
                                      <Route path="/super-admin/login" element={<PublicOnlyRoute portal="super-admin"><SuperAdminLoginPage /></PublicOnlyRoute>} />
                                      <Route path="/super-admin/reset/:token" element={<PasswordResetPage />} />
                                      <Route path="/super-admin/auth/callback" element={<SuperAdminAuthCallback />} />
                                      <Route path="/super-admin/auth/mfa-challenge" element={<MFAChallengePage portal="super-admin" />} />
                                      <Route path="/super-admin/*" element={
                                        <Suspense fallback={<SkeletonAdminLayout />}>
                                          <SuperAdminProtectedRouteNew>
                                            <SuperAdminLayout />
                                          </SuperAdminProtectedRouteNew>
                                        </Suspense>
                                      }>
                                        <Route path="dashboard" element={<SuperAdminDashboardPage />} />
                                        <Route path="monitoring" element={<SuperAdminMonitoringPage />} />
                                        <Route path="analytics" element={<SuperAdminAnalyticsPage />} />
                                        <Route path="data-explorer" element={<SuperAdminDataExplorerPage />} />
                                        <Route path="api-usage" element={<SuperAdminAPIUsagePage />} />
                                        <Route path="audit-logs" element={<SuperAdminAuditLogsPage />} />
                                        <Route path="revenue-analytics" element={<SuperAdminRevenueAnalyticsPage />} />
                                        <Route path="report-builder" element={<SuperAdminReportBuilderPage />} />
                                        <Route path="executive-dashboard" element={<SuperAdminExecutiveDashboardPage />} />
                                        <Route path="workflows" element={<SuperAdminWorkflowsPage />} />
                                        <Route path="communication" element={<SuperAdminCommunicationPage />} />
                                        <Route path="feature-flags" element={<SuperAdminFeatureFlagsPage />} />
                                        <Route path="system-config" element={<SuperAdminSystemConfigPage />} />
                                        <Route path="security" element={<SuperAdminSecurityPage />} />
                                        <Route path="forum-approvals" element={<ForumApprovalsPage />} />
                                        <Route path="admin-users" element={<AdminUsersPage />} />
                                        <Route path="tools" element={<SuperAdminToolsPage />} />
                                        <Route path="tenants" element={<SuperAdminTenantsListPage />} />
                                        <Route path="tenants/new" element={<SuperAdminCreateTenantPage />} />
                                        <Route path="tenants/:tenantId" element={<SuperAdminTenantDetailPage />} />
                                        <Route path="marketplace/moderation" element={<MarketplaceModerationPage />} />
                                        <Route path="settings" element={<SuperAdminSettingsPage />} />

                                        {/* Credit Management Routes */}
                                        <Route path="credits" element={<SuperAdminCreditsOverviewPage />} />
                                        <Route path="credits/tenants" element={<SuperAdminTenantCreditsPage />} />
                                        <Route path="credits/transactions" element={<SuperAdminCreditAuditLogPage />} />
                                        <Route path="credits/promo-codes" element={<SuperAdminPromoCodeManagementPage />} />
                                        <Route path="credits/packages" element={<SuperAdminCreditPackagesPage />} />
                                        <Route path="credits/analytics" element={<SuperAdminCreditAnalyticsPage />} />
                                        <Route path="credits/referrals" element={<SuperAdminReferralManagementPage />} />
                                      </Route>

                                      {/* ==================== LEVEL 1.5: PLATFORM ADMIN ==================== */}
                                      <Route path="/platform-admin" element={<Navigate to="/platform-admin/tenants" replace />} />
                                      <Route path="/platform-admin/*" element={
                                        <Suspense fallback={<LoadingFallback />}>
                                          <PlatformAdminLayout />
                                        </Suspense>
                                      }>
                                        <Route path="tenants" element={<AllTenantsPage />} />
                                        <Route path="design-system" element={<DesignSystemPage />} />
                                        <Route path="payouts" element={<PlatformPayoutsPage />} />
                                      </Route>

                                      {/* ==================== LEVEL 2: TENANT ADMIN (Business Owner) ==================== */}
                                      <Route path="/:tenantSlug/admin/login" element={<PublicOnlyRoute portal="tenant-admin"><TenantAdminLoginPage /></PublicOnlyRoute>} />
                                      <Route path="/:tenantSlug/admin/reset/:token" element={<PasswordResetPage />} />
                                      <Route path="/:tenantSlug/admin/auth/callback" element={<TenantAdminAuthCallback />} />
                                      <Route path="/:tenantSlug/admin/auth/mfa-challenge" element={<MFAChallengePage portal="tenant-admin" />} />

                                      {/* Setup Wizard (must be before AdminLayout) */}
                                      <Route path="/:tenantSlug/admin/setup-wizard" element={<TenantAdminProtectedRoute><Suspense fallback={<LoadingFallback />}><SetupWizardPage /></Suspense></TenantAdminProtectedRoute>} />

                                      {/* Welcome Page (must be before AdminLayout) */}
                                      <Route path="/:tenantSlug/admin/welcome" element={<TenantAdminProtectedRoute><TenantAdminWelcomePage /></TenantAdminProtectedRoute>} />

                                      {/* Email Verification Page */}
                                      <Route path="/:tenantSlug/admin/verify-email" element={<TenantAdminProtectedRoute><TenantAdminVerifyEmailPage /></TenantAdminProtectedRoute>} />

                                      {/* Change Password Page */}
                                      <Route path="/:tenantSlug/admin/change-password" element={<TenantAdminProtectedRoute><ChangePasswordPage /></TenantAdminProtectedRoute>} />

                                      {/* Trial Expired Page (must be before AdminLayout) */}
                                      <Route path="/:tenantSlug/admin/trial-expired" element={<TenantAdminProtectedRoute><TrialExpiredPage /></TenantAdminProtectedRoute>} />

                                      {/* Help Pages */}
                                      <Route path="/:tenantSlug/admin/help" element={<TenantAdminProtectedRoute><HelpPage /></TenantAdminProtectedRoute>} />
                                      <Route path="/:tenantSlug/admin/help-hub" element={<TenantAdminProtectedRoute><HelpHubPage /></TenantAdminProtectedRoute>} />

                                      {/* Select Plan Page (for adding payment method) */}
                                      <Route
                                        path="/:tenantSlug/admin/select-plan"
                                        element={
                                          <Suspense fallback={<LoadingFallback />}>
                                            <TenantAdminProtectedRoute>
                                              <TenantAdminSelectPlanPage />
                                            </TenantAdminProtectedRoute>
                                          </Suspense>
                                        }
                                      />

                                      {/* Tenant Admin Portal - Exact redirect */}
                                      <Route path="/:tenantSlug/admin" element={<Navigate to="dashboard" replace />} />
                                      <Route
                                        path="/:tenantSlug/admin/*"
                                        element={
                                          <Suspense fallback={<SkeletonAdminLayout />}>
                                            <TenantAdminProtectedRoute>
                                              <TenantContextGuard>
                                                <SubscriptionGuard>
                                                  <AdminLayout />
                                                </SubscriptionGuard>
                                              </TenantContextGuard>
                                            </TenantAdminProtectedRoute>
                                          </Suspense>
                                        }
                                      >
                                        <Route
                                          path="dashboard"
                                          element={
                                            <Suspense fallback={<SkeletonDashboard />}>
                                              <FeatureProtectedRoute featureId="dashboard">
                                                <TenantAdminDashboardPage />
                                              </FeatureProtectedRoute>
                                            </Suspense>
                                          }
                                        />
                                        <Route
                                          path="dashboard-hub"
                                          element={
                                            <Suspense fallback={<SkeletonDashboard />}>
                                              <FeatureProtectedRoute featureId="dashboard">
                                                <DashboardHubPage />
                                              </FeatureProtectedRoute>
                                            </Suspense>
                                          }
                                        />
                                        <Route
                                          path="hotbox"
                                          element={
                                            <Suspense fallback={<SkeletonDashboard />}>
                                              <FeatureProtectedRoute featureId="hotbox">
                                                <HotboxPage />
                                              </FeatureProtectedRoute>
                                            </Suspense>
                                          }
                                        />
                                        {/* Smart TV Dashboard - Big Screen Operations View */}
                                        <Route
                                          path="tv-dashboard"
                                          element={
                                            <Suspense fallback={<SkeletonDashboard />}>
                                              <SmartTVDashboard />
                                            </Suspense>
                                          }
                                        />
                                        <Route
                                          path="command-center"
                                          element={
                                            <Suspense fallback={<SkeletonDashboard />}>
                                              <FinancialCommandCenterPage />
                                            </Suspense>
                                          }
                                        />
                                        <Route
                                          path="collection-mode"
                                          element={
                                            <FeatureProtectedRoute featureId="collections">
                                              <Suspense fallback={<SkeletonDashboard />}>
                                                <CollectionModePage />
                                              </Suspense>
                                            </FeatureProtectedRoute>
                                          }
                                        />
                                        {/* Collection mode aliases */}
                                        <Route path="collections" element={<Navigate to="../collection-mode" replace />} />
                                        {/* Legacy route redirects - redirect old paths to new paths */}
                                        <Route path="big-plug-dashboard" element={<Navigate to="dashboard" replace />} />
                                        <Route path="big-plug-order" element={<Navigate to="wholesale-orders" replace />} />
                                        <Route path="big-plug-inventory" element={<Navigate to="inventory-dashboard" replace />} />
                                        <Route path="big-plug-financial" element={<Navigate to="financial-center" replace />} />
                                        {/* Common URL aliases - redirect to correct routes */}
                                        <Route path="product-catalog" element={<Navigate to="../inventory-hub?tab=products" replace />} />
                                        <Route path="wholesale-clients" element={<Navigate to="../customer-hub?tab=contacts" replace />} />
                                        <Route path="products" element={<Navigate to="../inventory-hub?tab=products" replace />} />
                                        <Route path="clients" element={<Navigate to="../customer-hub?tab=contacts" replace />} />
                                        <Route path="customers" element={<Navigate to="../customer-hub?tab=contacts" replace />} />
                                        <Route path="inventory/dispatch" element={<Navigate to="../dispatch-inventory" replace />} />
                                        <Route path="admin-notifications" element={<Navigate to="notifications" replace />} />
                                        <Route path="reports-new" element={<Navigate to="reports" replace />} />
                                        <Route path="route-optimization" element={<Navigate to="route-optimizer" replace />} />
                                        <Route path="risk-factors" element={<Navigate to="risk-management" replace />} />
                                        <Route path="inventory/barcodes" element={<Navigate to="../generate-barcodes" replace />} />
                                        {/* Folder redirects for breadcrumbs */}
                                        <Route path="inventory" element={<Navigate to="inventory-hub" replace />} />
                                        <Route path="crm" element={<Navigate to="customer-hub?tab=crm" replace />} />
                                        <Route path="sales" element={<Navigate to="sales-dashboard" replace />} />
                                        <Route path="marketplace" element={<Navigate to="marketplace/listings" replace />} />
                                        <Route path="catalog" element={<Navigate to="inventory-hub?tab=products" replace />} />
                                        {/* Legacy hub redirects - redirect old paths to new paths */}
                                        <Route path="orders-hub" element={<Navigate to="orders" replace />} />
                                        <Route path="pos-hub" element={<Navigate to="pos-system" replace />} />
                                        <Route path="pos" element={<Navigate to="pos-system" replace />} />
                                        <Route path="vendors" element={<Navigate to="vendor-management" replace />} />

                                        <Route path="analytics-hub" element={<FeatureProtectedRoute featureId="analytics" feature="analytics_advanced"><AnalyticsHubPage /></FeatureProtectedRoute>} />
                                        <Route path="analytics/comprehensive" element={<FeatureProtectedRoute featureId="analytics" feature="analytics_advanced"><AnalyticsPage /></FeatureProtectedRoute>} />
                                        <Route path="disposable-menus" element={<FeatureProtectedRoute featureId="disposable-menus"><DisposableMenus /></FeatureProtectedRoute>} />
                                        <Route path="menu-migration" element={<FeatureProtectedRoute featureId="menu-migration"><MenuMigration /></FeatureProtectedRoute>} />
                                        <Route path="orders" element={<FeatureProtectedRoute featureId="basic-orders"><OrdersHubPage /></FeatureProtectedRoute>} />
                                        <Route path="orders/:orderId" element={<FeatureProtectedRoute featureId="basic-orders"><OrderDetailsPage /></FeatureProtectedRoute>} />

                                        {/* Orders Hub Redirects */}
                                        <Route path="disposable-menu-orders" element={<Navigate to="orders?tab=menu" replace />} />
                                        <Route path="disposable-menu-analytics" element={<FeatureProtectedRoute featureId="menu-analytics" feature="analytics_advanced"><DisposableMenuAnalytics /></FeatureProtectedRoute>} />
                                        <Route path="menu-analytics" element={<FeatureProtectedRoute featureId="menu-analytics" feature="analytics_advanced"><MenuAnalytics /></FeatureProtectedRoute>} />

                                        {/* Inventory Hub Redirects */}
                                        <Route path="inventory/products" element={<Navigate to="../inventory-hub?tab=products" replace />} />
                                        <Route path="catalog/images" element={<FeatureProtectedRoute featureId="products"><ImagesPage /></FeatureProtectedRoute>} />
                                        <Route path="catalog/batches" element={<FeatureProtectedRoute featureId="products"><BatchesPage /></FeatureProtectedRoute>} />
                                        <Route path="catalog/categories" element={<FeatureProtectedRoute featureId="products"><CategoriesPage /></FeatureProtectedRoute>} />

                                        <Route path="customer-hub" element={<FeatureProtectedRoute featureId="customers"><CustomerHubPage /></FeatureProtectedRoute>} />
                                        <Route path="big-plug-clients" element={<Navigate to="customer-hub?tab=contacts" replace />} />
                                        <Route path="big-plug-clients/:id" element={<FeatureProtectedRoute featureId="customers"><ClientDetail /></FeatureProtectedRoute>} />
                                        <Route path="generate-barcodes" element={<FeatureProtectedRoute featureId="generate-barcodes"><GenerateBarcodes /></FeatureProtectedRoute>} />

                                        <Route path="wholesale-orders" element={<Navigate to="orders?tab=wholesale" replace />} />
                                        <Route path="wholesale-orders/new" element={<FeatureProtectedRoute featureId="wholesale-orders"><NewWholesaleOrder /></FeatureProtectedRoute>} />
                                        <Route path="wholesale-orders/new-po" element={<FeatureProtectedRoute featureId="wholesale-orders" feature="purchase_orders"><NewPurchaseOrder /></FeatureProtectedRoute>} />
                                        <Route path="orders/offline-create" element={<OfflineOrderCreate />} />

                                        <Route path="inventory-hub" element={<FeatureProtectedRoute featureId="inventory-dashboard"><InventoryHubPage /></FeatureProtectedRoute>} />
                                        <Route path="products/:productId" element={<FeatureProtectedRoute featureId="products"><ProductDetailsPage /></FeatureProtectedRoute>} />
                                        <Route path="inventory-dashboard" element={<Navigate to="inventory-hub?tab=stock" replace />} />
                                        <Route path="inventory-monitoring" element={<Navigate to="inventory-hub?tab=monitoring" replace />} />
                                        <Route path="reports" element={<FeatureProtectedRoute featureId="reports"><ReportsPage /></FeatureProtectedRoute>} />
                                        {/* Billing redirects to Settings */}
                                        <Route path="billing" element={<Navigate to="../settings?tab=payments" replace />} />
                                        {/* Credit Routes */}
                                        <Route path="credits/analytics" element={<FeatureProtectedRoute feature="analytics_advanced"><CreditAnalyticsPage /></FeatureProtectedRoute>} />
                                        <Route path="credits/success" element={<CreditPurchaseSuccessPage />} />
                                        <Route path="credits/cancelled" element={<CreditPurchaseCancelledPage />} />
                                        <Route path="settings" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><FeatureProtectedRoute featureId="settings"><SettingsHubPage /></FeatureProtectedRoute></RoleProtectedRoute>} />
                                        <Route path="account-settings" element={<AccountSettingsPage />} />

                                        {/* Marketplace Routes (B2B) */}
                                        <Route path="marketplace/dashboard" element={<FeatureProtectedRoute featureId="marketplace"><MarketplaceDashboard /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/profile" element={<FeatureProtectedRoute featureId="marketplace"><SellerProfilePage /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/profile/edit" element={<FeatureProtectedRoute featureId="marketplace"><SellerProfilePage /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/listings" element={<FeatureProtectedRoute featureId="marketplace"><MyListingsPage /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/listings/new" element={<FeatureProtectedRoute featureId="marketplace"><ListingForm /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/listings/:listingId" element={<FeatureProtectedRoute featureId="marketplace"><ListingDetailPage /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/listings/:listingId/edit" element={<FeatureProtectedRoute featureId="marketplace"><ListingForm /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/orders" element={<FeatureProtectedRoute featureId="marketplace"><MarketplaceOrdersPage /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/orders/:orderId" element={<FeatureProtectedRoute featureId="marketplace"><OrderDetailPage /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/messages" element={<FeatureProtectedRoute featureId="marketplace"><MessagesPage /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/financials" element={<FeatureProtectedRoute featureId="marketplace"><VendorPayoutsPage /></FeatureProtectedRoute>} />


                                        {/* White-Label Storefront Routes */}
                                        <Route
                                          path="storefront"
                                          element={
                                            <FeatureProtectedRoute featureId="storefront">
                                              <Suspense fallback={<SkeletonDashboard />}>
                                                <StorefrontHubPage />
                                              </Suspense>
                                            </FeatureProtectedRoute>
                                          }
                                        />
                                        {/* Redirect legacy sub-routes to the Hub */}
                                        <Route path="storefront/dashboard" element={<Navigate to="../storefront?tab=dashboard" replace />} />
                                        <Route path="storefront/products" element={<Navigate to="../storefront?tab=products" replace />} />
                                        <Route path="storefront/orders" element={<Navigate to="../storefront?tab=orders" replace />} />
                                        <Route path="storefront/orders/:orderId" element={<Navigate to="../storefront?tab=orders" replace />} />
                                        <Route path="storefront/live-orders" element={<Navigate to="../storefront?tab=live" replace />} />
                                        <Route path="storefront/customers" element={<Navigate to="../storefront?tab=customers" replace />} />
                                        <Route path="storefront/coupons" element={<Navigate to="../storefront?tab=coupons" replace />} />
                                        <Route path="storefront/analytics" element={<Navigate to="../storefront?tab=analytics" replace />} />
                                        <Route path="storefront/bundles" element={<Navigate to="../storefront?tab=bundles" replace />} />
                                        <Route path="storefront/customize" element={<Navigate to="../storefront?tab=builder" replace />} />
                                        <Route path="storefront/builder" element={<Navigate to="../storefront?tab=builder" replace />} />
                                        <Route path="storefront/settings" element={<Navigate to="../storefront?tab=settings" replace />} />


                                        {/* Marketplace Admin (B2C) */}
                                        <Route path="marketplace/settings" element={<FeatureProtectedRoute featureId="marketplace"><StoreSettings /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/products" element={<FeatureProtectedRoute featureId="marketplace"><ProductVisibilityManager /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/coupons" element={<FeatureProtectedRoute featureId="marketplace" feature="marketing_hub"><CouponManager /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/categories" element={<FeatureProtectedRoute featureId="marketplace"><MarketplaceCategoryManager /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/sync" element={<FeatureProtectedRoute featureId="marketplace-product-sync"><ProductSyncPage /></FeatureProtectedRoute>} />


                                        <Route path="live-orders" element={<Navigate to="orders?tab=live" replace />} />
                                        <Route path="staff-management" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><FeatureProtectedRoute featureId="team-members"><TeamManagement /></FeatureProtectedRoute></RoleProtectedRoute>} />
                                        <Route path="team-members" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><FeatureProtectedRoute featureId="team-members"><TeamManagement /></FeatureProtectedRoute></RoleProtectedRoute>} />
                                        <Route path="team-management" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><FeatureProtectedRoute featureId="team-members"><TeamManagement /></FeatureProtectedRoute></RoleProtectedRoute>} />
                                        <Route path="advanced-inventory" element={<Navigate to="inventory-hub?tab=adjustments" replace />} />
                                        <Route path="fronted-inventory" element={<FeatureProtectedRoute featureId="fronted-inventory"><FrontedInventory /></FeatureProtectedRoute>} />
                                        <Route path="fronted-inventory/:id" element={<FeatureProtectedRoute featureId="fronted-inventory"><FrontedInventoryDetails /></FeatureProtectedRoute>} />
                                        <Route path="invoice-management" element={<FeatureProtectedRoute featureId="invoice-management"><CustomerInvoices /></FeatureProtectedRoute>} />
                                        <Route path="customer-invoices" element={<FeatureProtectedRoute featureId="invoice-management"><CustomerInvoices /></FeatureProtectedRoute>} />
                                        <Route path="fleet-management" element={<FeatureProtectedRoute feature="fleet_management"><Navigate to="fulfillment-hub?tab=fleet" replace /></FeatureProtectedRoute>} />
                                        <Route path="delivery-hub" element={<FeatureProtectedRoute feature="delivery_tracking"><Navigate to="fulfillment-hub" replace /></FeatureProtectedRoute>} />
                                        <Route path="fulfillment-hub" element={<FeatureProtectedRoute feature="delivery_tracking"><FulfillmentHubPage /></FeatureProtectedRoute>} />
                                        <Route path="finance-hub" element={<FeatureProtectedRoute featureId="financial-center"><FinanceHubPage /></FeatureProtectedRoute>} />
                                        <Route path="settings-hub" element={<Navigate to="../settings" replace />} />
                                        <Route path="integrations-hub" element={<Navigate to="settings?tab=integrations" replace />} />
                                        <Route path="storefront-hub" element={<FeatureProtectedRoute featureId="storefront"><StorefrontHubPage /></FeatureProtectedRoute>} />
                                        <Route path="operations-hub" element={<FeatureProtectedRoute featureId="suppliers"><OperationsHubPage /></FeatureProtectedRoute>} />
                                        <Route path="compliance-hub" element={<Navigate to="operations-hub?tab=compliance" replace />} />
                                        <Route path="marketing-hub" element={<FeatureProtectedRoute featureId="loyalty-program" feature="marketing_hub"><MarketingHubPage /></FeatureProtectedRoute>} />
                                        <Route path="marketing/reviews" element={<FeatureProtectedRoute featureId="storefront" feature="marketing_hub"><ReviewsPage /></FeatureProtectedRoute>} />
                                        <Route path="delivery-management" element={<FeatureProtectedRoute feature="delivery_tracking"><Navigate to="operations-hub?tab=delivery" replace /></FeatureProtectedRoute>} />
                                        <Route path="live-map" element={<FeatureProtectedRoute feature="delivery_tracking"><LiveMap /></FeatureProtectedRoute>} />
                                        <Route path="gps-tracking" element={<FeatureProtectedRoute feature="delivery_tracking"><RunnerLocationTracking /></FeatureProtectedRoute>} />
                                        <Route path="pos-system" element={<FeatureProtectedRoute feature="pos"><POSHubPage /></FeatureProtectedRoute>} />
                                        <Route path="locations" element={<FeatureProtectedRoute featureId="locations"><LocationsManagement /></FeatureProtectedRoute>} />
                                        <Route path="locations/warehouses" element={<FeatureProtectedRoute featureId="locations"><WarehousesPage /></FeatureProtectedRoute>} />
                                        <Route path="locations/runners" element={<FeatureProtectedRoute featureId="locations"><RunnersPage /></FeatureProtectedRoute>} />
                                        <Route path="sales/pricing" element={<FeatureProtectedRoute featureId="sales-dashboard"><AdminPricingPage /></FeatureProtectedRoute>} />

                                        {/* 13 Hidden gem pages */}
                                        <Route path="live-chat" element={<FeatureProtectedRoute featureId="live-chat" feature="live_chat"><AdminLiveChat /></FeatureProtectedRoute>} />
                                        <Route path="notifications" element={<FeatureProtectedRoute featureId="notifications"><AdminNotifications /></FeatureProtectedRoute>} />
                                        <Route path="couriers" element={<FeatureProtectedRoute feature="delivery_tracking"><Navigate to="operations-hub?tab=delivery" replace /></FeatureProtectedRoute>} />
                                        <Route path="customer-details" element={<FeatureProtectedRoute featureId="customers"><CustomerDetails /></FeatureProtectedRoute>} />
                                        <Route path="customer-reports" element={<FeatureProtectedRoute featureId="customer-insights"><CustomerReports /></FeatureProtectedRoute>} />
                                        <Route path="delivery-tracking" element={<FeatureProtectedRoute feature="delivery_tracking"><Navigate to="operations-hub?tab=delivery" replace /></FeatureProtectedRoute>} />
                                        <Route path="delivery-zones" element={<FeatureProtectedRoute feature="delivery_tracking"><DeliveryZonesPage /></FeatureProtectedRoute>} />
                                        <Route path="dispatch-inventory" element={<FeatureProtectedRoute featureId="dispatch-inventory"><DispatchInventory /></FeatureProtectedRoute>} />
                                        <Route path="financial-center" element={<Navigate to="command-center" replace />} />
                                        <Route path="fronted-inventory-analytics" element={<FeatureProtectedRoute featureId="fronted-inventory" feature="analytics_advanced"><FrontedInventoryAnalytics /></FeatureProtectedRoute>} />
                                        <Route path="global-search" element={<FeatureProtectedRoute featureId="dashboard"><GlobalSearch /></FeatureProtectedRoute>} />
                                        <Route path="suppliers" element={<Navigate to="operations-hub?tab=suppliers" replace />} />
                                        <Route path="purchase-orders" element={<FeatureProtectedRoute featureId="suppliers" feature="purchase_orders"><PurchaseOrders /></FeatureProtectedRoute>} />
                                        <Route path="returns" element={<Navigate to="operations-hub?tab=returns" replace />} />
                                        <Route path="loyalty-program" element={<FeatureProtectedRoute feature="marketing_hub"><Navigate to="marketing-hub?tab=loyalty" replace /></FeatureProtectedRoute>} />
                                        <Route path="coupons" element={<Navigate to="storefront-hub?tab=coupons" replace />} />
                                        <Route path="quality-control" element={<FeatureProtectedRoute feature="quality_control"><Navigate to="operations-hub?tab=quality" replace /></FeatureProtectedRoute>} />
                                        <Route path="customer-crm" element={<Navigate to="customer-hub?tab=crm" replace />} />
                                        <Route path="crm/clients" element={<FeatureProtectedRoute featureId="customer-crm" feature="crm_advanced"><ClientsPage /></FeatureProtectedRoute>} />
                                        <Route path="crm/clients/:clientId" element={<FeatureProtectedRoute featureId="customer-crm" feature="crm_advanced"><ClientDetailPage /></FeatureProtectedRoute>} />
                                        <Route path="crm/invoices" element={<FeatureProtectedRoute featureId="customer-crm" feature="crm_advanced"><InvoicesPage /></FeatureProtectedRoute>} />
                                        <Route path="crm/invoices/new" element={<FeatureProtectedRoute featureId="customer-crm" feature="crm_advanced"><CreateInvoicePage /></FeatureProtectedRoute>} />
                                        <Route path="crm/invoices/:invoiceId" element={<FeatureProtectedRoute featureId="customer-crm" feature="crm_advanced"><InvoiceDetailPage /></FeatureProtectedRoute>} />
                                        <Route path="crm/pre-orders" element={<Navigate to="orders?tab=preorders" replace />} />
                                        <Route path="crm/pre-orders/new" element={<FeatureProtectedRoute featureId="customer-crm" feature="crm_advanced"><CreatePreOrderPage /></FeatureProtectedRoute>} />
                                        <Route path="crm/pre-orders/:preOrderId" element={<FeatureProtectedRoute featureId="customer-crm" feature="crm_advanced"><PreOrderDetailPage /></FeatureProtectedRoute>} />
                                        <Route path="crm/settings" element={<FeatureProtectedRoute featureId="customer-crm" feature="crm_advanced"><CRMSettingsPage /></FeatureProtectedRoute>} />
                                        <Route path="crm/invites" element={<FeatureProtectedRoute featureId="customer-crm" feature="crm_advanced"><InvitesPage /></FeatureProtectedRoute>} />
                                        <Route path="marketing-automation" element={<FeatureProtectedRoute feature="marketing_hub"><Navigate to="marketing-hub?tab=campaigns" replace /></FeatureProtectedRoute>} />
                                        <Route path="appointments" element={<Navigate to="operations-hub?tab=appointments" replace />} />
                                        <Route path="support-tickets" element={<Navigate to="operations-hub?tab=support" replace />} />
                                        <Route path="batch-recall" element={<Navigate to="compliance-hub?tab=batch-recall" replace />} />
                                        <Route path="compliance-vault" element={<Navigate to="compliance-hub?tab=vault" replace />} />
                                        <Route path="compliance" element={<Navigate to="compliance-hub" replace />} />
                                        <Route path="advanced-reporting" element={<FeatureProtectedRoute featureId="advanced-reporting" feature="analytics_advanced"><AdvancedReportingPage /></FeatureProtectedRoute>} />
                                        <Route path="predictive-analytics" element={<Navigate to="analytics-hub?tab=forecasting" replace />} />
                                        <Route path="board-report" element={<FeatureProtectedRoute feature="analytics_advanced"><BoardReportPage /></FeatureProtectedRoute>} />
                                        <Route path="strategic-dashboard" element={<FeatureProtectedRoute feature="analytics_advanced"><StrategicDashboardPage /></FeatureProtectedRoute>} />
                                        <Route path="expansion" element={<FeatureProtectedRoute feature="analytics_advanced"><ExpansionAnalysisPage /></FeatureProtectedRoute>} />

                                        {/* Professional Tier - Analytics */}
                                        <Route path="order-analytics" element={<FeatureProtectedRoute featureId="order-analytics" feature="analytics_advanced"><OrderAnalyticsPage /></FeatureProtectedRoute>} />
                                        <Route path="sales-dashboard" element={<FeatureProtectedRoute featureId="sales-dashboard" feature="analytics_advanced"><SalesDashboardPage /></FeatureProtectedRoute>} />
                                        <Route path="customer-insights" element={<Navigate to="customer-hub?tab=insights" replace />} />

                                        {/* Additional routes that don't need FeatureProtectedRoute or need different paths */}
                                        <Route path="risk-management" element={<FeatureProtectedRoute featureId="risk-management"><RiskFactorManagement /></FeatureProtectedRoute>} />
                                        <Route path="system-settings" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><FeatureProtectedRoute featureId="system-settings"><SystemSettings /></FeatureProtectedRoute></RoleProtectedRoute>} />
                                        <Route path="vendor-management" element={<FeatureProtectedRoute featureId="vendor-management" feature="vendor_management"><VendorManagement /></FeatureProtectedRoute>} />
                                        <Route path="vendor-dashboard" element={<FeatureProtectedRoute featureId="vendor-management" feature="vendor_management"><VendorDashboard /></FeatureProtectedRoute>} />

                                        {/* Coming Soon Pages - Professional & Enterprise Features */}
                                        <Route path="stock-alerts" element={<FeatureProtectedRoute featureId="stock-alerts"><StockAlertsPage /></FeatureProtectedRoute>} />
                                        <Route path="inventory-transfers" element={<FeatureProtectedRoute featureId="inventory-transfers"><InventoryTransfersPage /></FeatureProtectedRoute>} />
                                        <Route path="inventory-audit" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><InventoryAuditPage /></RoleProtectedRoute>} />
                                        <Route path="customer-analytics" element={<FeatureProtectedRoute featureId="customer-analytics" feature="analytics_advanced"><CustomerAnalyticsPage /></FeatureProtectedRoute>} />
                                        <Route path="advanced-analytics" element={<FeatureProtectedRoute featureId="advanced-analytics" feature="analytics_advanced"><AdvancedAnalyticsPage /></FeatureProtectedRoute>} />
                                        <Route path="realtime-dashboard" element={<FeatureProtectedRoute featureId="realtime-dashboard" feature="analytics_advanced"><RealtimeDashboardPage /></FeatureProtectedRoute>} />
                                        <Route path="custom-reports" element={<FeatureProtectedRoute featureId="custom-reports" feature="analytics_advanced"><CustomReportsPage /></FeatureProtectedRoute>} />
                                        <Route path="commission-tracking" element={<FeatureProtectedRoute featureId="commission-tracking" feature="analytics_advanced"><CommissionTrackingPage /></FeatureProtectedRoute>} />
                                        <Route path="revenue-reports" element={<FeatureProtectedRoute featureId="revenue-reports" feature="analytics_advanced"><RevenueReportsPage /></FeatureProtectedRoute>} />
                                        <Route path="delivery-analytics" element={<FeatureProtectedRoute feature="delivery_tracking"><DeliveryAnalyticsPage /></FeatureProtectedRoute>} />
                                        <Route path="cash-register" element={<FeatureProtectedRoute feature="pos"><CashRegisterPage /></FeatureProtectedRoute>} />
                                        <Route path="pos-analytics" element={<FeatureProtectedRoute feature="pos"><POSAnalyticsPage /></FeatureProtectedRoute>} />
                                        <Route path="pos-shifts" element={<FeatureProtectedRoute feature="pos"><POSShiftsPage /></FeatureProtectedRoute>} />
                                        <Route path="z-reports" element={<FeatureProtectedRoute feature="pos"><ZReportPage /></FeatureProtectedRoute>} />
                                        <Route path="role-management" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><FeatureProtectedRoute featureId="role-management"><RoleManagement /></FeatureProtectedRoute></RoleProtectedRoute>} />
                                        <Route path="activity-logs" element={<RoleProtectedRoute allowedRoles={['owner', 'admin', 'manager']}><FeatureProtectedRoute featureId="activity-logs"><ActivityLogsPage /></FeatureProtectedRoute></RoleProtectedRoute>} />

                                        {/* GitHub Repos Integration Routes */}
                                        <Route path="analytics-dashboard" element={<FeatureProtectedRoute featureId="analytics" feature="analytics_advanced"><AnalyticsPage /></FeatureProtectedRoute>} />
                                        <Route path="route-optimizer" element={<FeatureProtectedRoute featureId="route-optimization"><RouteOptimizationPage /></FeatureProtectedRoute>} />
                                        <Route path="wholesale-pricing-tiers" element={<PricingTiersPage />} />
                                        <Route path="advanced-invoice" element={<FeatureProtectedRoute featureId="invoice-management"><AdvancedInvoicePage /></FeatureProtectedRoute>} />
                                        <Route path="local-ai" element={<FeatureProtectedRoute featureId="ai"><LocalAIPage /></FeatureProtectedRoute>} />
                                        <Route path="workflow-automation" element={<FeatureProtectedRoute featureId="automation"><WorkflowAutomationPage /></FeatureProtectedRoute>} />
                                        <Route path="location-analytics" element={<FeatureProtectedRoute featureId="location-analytics" feature="analytics_advanced"><LocationAnalyticsPage /></FeatureProtectedRoute>} />
                                        <Route path="user-management" element={<Navigate to="team-members" replace />} />
                                        <Route path="permissions" element={<Navigate to="role-management" replace />} />
                                        <Route path="bulk-operations" element={<FeatureProtectedRoute featureId="bulk-operations"><BulkOperationsPage /></FeatureProtectedRoute>} />
                                        <Route path="operations/receiving" element={<FeatureProtectedRoute featureId="operations"><ReceivingPage /></FeatureProtectedRoute>} />
                                        <Route path="developer-tools" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><DeveloperTools /></RoleProtectedRoute>} />
                                        <Route path="button-tester" element={<ButtonTester />} />
                                        <Route path="api-access" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><FeatureProtectedRoute featureId="api-access"><APIAccessPage /></FeatureProtectedRoute></RoleProtectedRoute>} />
                                        <Route path="webhooks" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><FeatureProtectedRoute featureId="webhooks"><WebhooksPage /></FeatureProtectedRoute></RoleProtectedRoute>} />
                                        <Route path="custom-integrations" element={<FeatureProtectedRoute featureId="custom-integrations"><CustomIntegrationsPage /></FeatureProtectedRoute>} />
                                        <Route path="data-export" element={<FeatureProtectedRoute featureId="data-export"><DataExportPage /></FeatureProtectedRoute>} />
                                        <Route path="audit-trail" element={<RoleProtectedRoute allowedRoles={['owner', 'admin', 'manager']}><FeatureProtectedRoute featureId="audit-trail"><AuditTrailPage /></FeatureProtectedRoute></RoleProtectedRoute>} />
                                        <Route path="compliance" element={<FeatureProtectedRoute featureId="compliance"><CompliancePage /></FeatureProtectedRoute>} />
                                        <Route path="white-label" element={<FeatureProtectedRoute featureId="white-label"><WhiteLabelPage /></FeatureProtectedRoute>} />
                                        <Route path="custom-domain" element={<FeatureProtectedRoute featureId="custom-domain"><CustomDomainPage /></FeatureProtectedRoute>} />
                                        <Route path="priority-support" element={<FeatureProtectedRoute featureId="priority-support"><PrioritySupportPage /></FeatureProtectedRoute>} />
                                        {/* Coming Soon Pages for missing features */}
                                        <Route path="expense-tracking" element={<Navigate to="finance-hub?tab=expenses" replace />} />
                                        {/* Catch-all for unknown admin routes */}
                                        <Route path="*" element={<Suspense fallback={<LoadingFallback />}><AdminNotFoundPage /></Suspense>} />
                                      </Route>

                                      {/* Mobile Test Route */}
                                      <Route
                                        path="/mobile-test"
                                        element={
                                          <Suspense fallback={<LoadingFallback />}>
                                            <MobileTestPage />
                                          </Suspense>
                                        }
                                      />

                                      {/* Catch-all route for /admin/* paths without tenant slug - go directly to business login */}
                                      <Route path="/admin/*" element={<PublicOnlyRoute portal="saas"><SaasLoginPage /></PublicOnlyRoute>} />

                                      {/* ==================== COURIER PORTAL ==================== */}
                                      <Route path="/courier/login" element={<Suspense fallback={<SkeletonCourier />}><CourierLoginPage /></Suspense>} />
                                      <Route
                                        path="/courier/*"
                                        element={
                                          <Suspense fallback={<SkeletonCourier />}>
                                            <ErrorBoundary title="Courier Portal Unavailable" description="We encountered an error loading the courier portal. Please try refreshing the page.">
                                              <CourierProvider>
                                                <Routes>
                                                  <Route path="dashboard" element={<ProtectedCourierRoute><CourierDashboardPage /></ProtectedCourierRoute>} />
                                                  <Route path="earnings" element={<ProtectedCourierRoute><CourierEarningsPage /></ProtectedCourierRoute>} />
                                                  <Route path="history" element={<ProtectedCourierRoute><CourierHistoryPage /></ProtectedCourierRoute>} />
                                                  <Route path="settings" element={<ProtectedCourierRoute><CourierSettingsPage /></ProtectedCourierRoute>} />
                                                  <Route path="order/:orderId" element={<ProtectedCourierRoute><CourierActiveOrderPage /></ProtectedCourierRoute>} />
                                                  <Route path="delivery/:id" element={<ProtectedCourierRoute><UnifiedActiveDeliveryPage /></ProtectedCourierRoute>} />
                                                </Routes>
                                              </CourierProvider>
                                            </ErrorBoundary>
                                          </Suspense>
                                        }
                                      />

                                      {/* ==================== CUSTOMER LOGIN LANDING (No Tenant) ==================== */}
                                      <Route path="/customer/login" element={<Suspense fallback={<SkeletonStorefront />}><CustomerLoginLanding /></Suspense>} />
                                      <Route path="/shop/login" element={<Suspense fallback={<SkeletonStorefront />}><CustomerLoginLanding /></Suspense>} />

                                      {/* ==================== LEVEL 3: CUSTOMER (End User) ==================== */}
                                      <Route path="/:tenantSlug/customer/login" element={<Suspense fallback={<SkeletonStorefront />}><CustomerLoginPage /></Suspense>} />
                                      <Route path="/:tenantSlug/customer/signup" element={<Suspense fallback={<SkeletonStorefront />}><CustomerSignUpPage /></Suspense>} />
                                      <Route path="/:tenantSlug/customer/verify-email" element={<Suspense fallback={<SkeletonStorefront />}><CustomerVerifyEmailPage /></Suspense>} />
                                      <Route path="/:tenantSlug/customer/forgot-password" element={<Suspense fallback={<SkeletonStorefront />}><CustomerForgotPasswordPage /></Suspense>} />
                                      <Route path="/:tenantSlug/customer/reset-password" element={<Suspense fallback={<SkeletonStorefront />}><CustomerResetPasswordPage /></Suspense>} />
                                      <Route path="/:tenantSlug/customer/auth/callback" element={<Suspense fallback={<SkeletonStorefront />}><CustomerAuthCallback /></Suspense>} />
                                      <Route path="/:tenantSlug/customer/auth/mfa-challenge" element={<Suspense fallback={<SkeletonStorefront />}><MFAChallengePage portal="customer" /></Suspense>} />
                                      <Route path="/:tenantSlug/shop/login" element={<Suspense fallback={<SkeletonStorefront />}><CustomerLoginPage /></Suspense>} />
                                      <Route path="/:tenantSlug/shop/reset/:token" element={<Suspense fallback={<SkeletonStorefront />}><PasswordResetPage /></Suspense>} />
                                      {/* Public Routes */}
                                      <Route path="/portal/invoice/:token" element={<InvoicePublicPage />} />
                                      <Route path="/track" element={<DeliveryTrackingPage />} />
                                      <Route path="/track/:trackingCode" element={<DeliveryTrackingPage />} />
                                      <Route path="/:tenantSlug/shop" element={
                                        <Suspense fallback={<SkeletonStorefront />}>
                                          <ErrorBoundary title="Shop Unavailable" description="We encountered an error loading the shop. Please try refreshing the page.">
                                            <CustomerProtectedRoute><CustomerPortal /></CustomerProtectedRoute>
                                          </ErrorBoundary>
                                        </Suspense>
                                      }>
                                        <Route index element={<Navigate to="dashboard" replace />} />
                                        <Route path="dashboard" element={<CustomerDashboardPage />} />
                                      </Route>
                                      <Route path="/:tenantSlug/shop/cart" element={<Suspense fallback={<SkeletonStorefront />}><CustomerProtectedRoute><ShoppingCartPage /></CustomerProtectedRoute></Suspense>} />
                                      <Route path="/:tenantSlug/shop/checkout" element={<Suspense fallback={<SkeletonStorefront />}><CustomerProtectedRoute><CheckoutPage /></CustomerProtectedRoute></Suspense>} />
                                      <Route path="/:tenantSlug/shop/orders" element={<Suspense fallback={<SkeletonStorefront />}><CustomerProtectedRoute><UnifiedOrdersPage /></CustomerProtectedRoute></Suspense>} />
                                      <Route path="/:tenantSlug/shop/orders/:orderId" element={<Suspense fallback={<SkeletonStorefront />}><CustomerProtectedRoute><OrderTrackingPage /></CustomerProtectedRoute></Suspense>} />
                                      <Route path="/:tenantSlug/shop/orders/retail/:orderId" element={<Suspense fallback={<SkeletonStorefront />}><CustomerProtectedRoute><OrderTrackingPage /></CustomerProtectedRoute></Suspense>} />
                                      <Route path="/:tenantSlug/shop/settings" element={<Suspense fallback={<SkeletonStorefront />}><CustomerProtectedRoute><CustomerSettingsPage /></CustomerProtectedRoute></Suspense>} />
                                      {/* Retail Shopping Routes */}
                                      <Route path="/:tenantSlug/shop/retail/businesses" element={<Suspense fallback={<SkeletonStorefront />}><CustomerProtectedRoute><BusinessFinderPage /></CustomerProtectedRoute></Suspense>} />
                                      <Route path="/:tenantSlug/shop/retail/businesses/:businessSlug/menu" element={<Suspense fallback={<SkeletonStorefront />}><CustomerProtectedRoute><BusinessMenuPage /></CustomerProtectedRoute></Suspense>} />
                                      {/* Wholesale Marketplace Routes */}
                                      <Route path="/:tenantSlug/shop/wholesale" element={<Suspense fallback={<SkeletonStorefront />}><CustomerProtectedRoute><WholesaleMarketplacePage /></CustomerProtectedRoute></Suspense>} />
                                      <Route path="/:tenantSlug/shop/wholesale/cart" element={<Suspense fallback={<SkeletonStorefront />}><CustomerProtectedRoute><WholesaleCartPage /></CustomerProtectedRoute></Suspense>} />
                                      <Route path="/:tenantSlug/shop/wholesale/checkout" element={<Suspense fallback={<SkeletonStorefront />}><CustomerProtectedRoute><WholesaleCheckoutPage /></CustomerProtectedRoute></Suspense>} />
                                      {/* Component renamed to avoid duplicate import */}
                                      <Route path="/:tenantSlug/shop/wholesale/orders" element={<Suspense fallback={<SkeletonStorefront />}><CustomerProtectedRoute><CustomerWholesaleOrdersPage /></CustomerProtectedRoute></Suspense>} />
                                      <Route path="/:tenantSlug/shop/wholesale/orders/:orderId" element={<Suspense fallback={<SkeletonStorefront />}><CustomerProtectedRoute><WholesaleOrderDetailPage /></CustomerProtectedRoute></Suspense>} />

                                      {/* ==================== VENDOR PORTAL (External Access) ==================== */}
                                      <Route
                                        path="/vendor/*"
                                        element={
                                          <Suspense fallback={<LoadingFallback />}>
                                            <ErrorBoundary title="Vendor Portal Unavailable" description="We encountered an error loading the vendor portal. Please try refreshing the page.">
                                              <VendorAuthProvider>
                                                <Routes>
                                                  <Route path="login" element={<VendorLoginPage />} />
                                                  <Route path="dashboard" element={<ProtectedVendorRoute><VendorDashboardPage /></ProtectedVendorRoute>} />
                                                  <Route path="order/:orderId" element={<ProtectedVendorRoute><VendorOrderDetailPage /></ProtectedVendorRoute>} />
                                                </Routes>
                                              </VendorAuthProvider>
                                            </ErrorBoundary>
                                          </Suspense>
                                        }
                                      />

                                      {/* ==================== COMMUNITY FORUM (Global) ==================== */}
                                      <Route path="/community/auth" element={<Suspense fallback={<LoadingFallback />}><CommunityAuthPage /></Suspense>} />
                                      <Route path="/community" element={<Suspense fallback={<LoadingFallback />}><CommunityProtectedRoute><CommunityLayout /></CommunityProtectedRoute></Suspense>}>
                                        <Route index element={<CommunityHomePage />} />
                                        <Route path="c/:categorySlug" element={<CategoryPage />} />
                                        <Route path="post/:postId" element={<PostDetailPage />} />
                                        <Route path="create" element={<CreatePostPage />} />
                                        <Route path="u/:username" element={<UserProfilePage />} />
                                        <Route path="search" element={<SearchPage />} />
                                        <Route path="approval" element={<ApprovalPage />} />
                                      </Route>

                                      {/* ==================== 404 NOT FOUND ==================== */}
                                      <Route path="*" element={<NotFoundPage />} />
                                    </Routes>
                                  </Suspense>
                                </WhiteLabelProvider>
                              </TenantProvider>
                            </CreditProvider>
                          </CustomerAuthProvider>
                          {/* Debug Panel - Only visible in development, lazy-loaded */}
                          {import.meta.env.DEV && <Suspense fallback={null}><AdminDebugPanel /></Suspense>}
                        </TenantAdminAuthProvider>
                      </SuperAdminAuthProvider>
                    </BrowserRouter>
                  </TooltipProvider>
                </EncryptionProvider>
              </AccountProvider>
            </AuthProvider>
          </ThemeProvider>
        </FeatureFlagsProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
