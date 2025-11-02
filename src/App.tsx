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

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AccountProvider } from "./contexts/AccountContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TenantProvider } from "./contexts/TenantContext";
import { WhiteLabelProvider } from "./components/whitelabel/WhiteLabelProvider";
import { SuperAdminAuthProvider } from "./contexts/SuperAdminAuthContext";
import { TenantAdminAuthProvider } from "./contexts/TenantAdminAuthContext";
import { CustomerAuthProvider } from "./contexts/CustomerAuthContext";
import { lazy, Suspense, useEffect } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AdminErrorBoundary } from "./components/admin/AdminErrorBoundary";
import { AuthErrorBoundary } from "./components/auth/AuthErrorBoundary";
import { SkipToContent } from "./components/SkipToContent";
import { LoadingFallback } from "./components/LoadingFallback";
import { setupGlobalErrorHandlers, handleMutationError } from "./utils/reactErrorHandler";
import { FeatureProtectedRoute } from "./components/tenant-admin/FeatureProtectedRoute";
import { runProductionHealthCheck } from "@/utils/productionHealthCheck";
import { productionLogger } from "@/utils/productionLogger";
import { toast } from "./hooks/use-toast";

import { NotificationPreferences } from "./components/NotificationPreferences";
import OfflineBanner from "./components/OfflineBanner";
import InstallPWA from "./components/InstallPWA";

// Eager load critical pages
import NotFound from "./pages/NotFound";

// Marketing & Public Pages
const MarketingHome = lazy(() => import("./pages/MarketingHome"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const Contact = lazy(() => import("./pages/Contact"));
const Features = lazy(() => import("./pages/Features"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Support = lazy(() => import("./pages/Support"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const About = lazy(() => import("./pages/About"));

// Three-Tier Auth System Pages
const SuperAdminLoginPage = lazy(() => import("./pages/super-admin/LoginPage"));
const SuperAdminDashboardPage = lazy(() => import("./pages/super-admin/DashboardPage"));
const SuperAdminTenantDetailPage = lazy(() => import("./pages/super-admin/TenantDetailPage"));
const SuperAdminSettingsPage = lazy(() => import("./pages/super-admin/SettingsPage"));
const SuperAdminProtectedRouteNew = lazy(() => import("./components/auth/SuperAdminProtectedRoute").then(m => ({ default: m.SuperAdminProtectedRoute })));
const SignUpPage = lazy(() => import("./pages/saas/SignUpPage"));
const SaasLoginPage = lazy(() => import("./pages/saas/LoginPage"));
const VerifyEmailPage = lazy(() => import("./pages/saas/VerifyEmailPage"));
const TenantAdminWelcomePage = lazy(() => import("./pages/tenant-admin/WelcomePage"));
const PasswordResetPage = lazy(() => import("./pages/auth/PasswordResetPage"));

// Tenant Admin Pages
const TenantAdminLoginPage = lazy(() => import("./pages/tenant-admin/LoginPage"));
const TenantAdminProtectedRoute = lazy(() => import("./components/auth/TenantAdminProtectedRoute").then(m => ({ default: m.TenantAdminProtectedRoute })));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const TenantAdminDashboardPage = lazy(() => import("./pages/tenant-admin/DashboardPage"));
const TenantAdminBillingPage = lazy(() => import("./pages/tenant-admin/BillingPage"));
const TenantAdminSettingsPage = lazy(() => import("./pages/tenant-admin/SettingsPage"));
const TrialExpiredPage = lazy(() => import("./pages/tenant-admin/TrialExpired"));
const HelpPage = lazy(() => import("./pages/Help"));

// Tenant Admin Feature Pages
const DisposableMenus = lazy(() => import("./pages/admin/DisposableMenus"));
const DisposableMenuOrders = lazy(() => import("./pages/admin/DisposableMenuOrders"));
const DisposableMenuAnalytics = lazy(() => import("./pages/admin/DisposableMenuAnalytics"));
const MenuAnalytics = lazy(() => import("./pages/admin/MenuAnalytics"));
const ProductManagement = lazy(() => import("./pages/admin/ProductManagement"));
const BigPlugClients = lazy(() => import("./pages/admin/CustomerManagement"));
const GenerateBarcodes = lazy(() => import("./pages/admin/GenerateBarcodes"));
const WholesaleOrders = lazy(() => import("./pages/admin/NewWholesaleOrderReal"));
const InventoryDashboard = lazy(() => import("./pages/admin/InventoryDashboard"));
const ReportsPage = lazy(() => import("./pages/admin/ReportsPage"));

// 10 Built-but-not-routed pages
const LiveOrders = lazy(() => import("./pages/admin/LiveOrders"));
const TeamManagement = lazy(() => import("./pages/admin/TeamManagement"));
const InventoryManagement = lazy(() => import("./pages/admin/InventoryManagement"));
const FrontedInventory = lazy(() => import("./pages/admin/FrontedInventory"));
const CustomerInvoices = lazy(() => import("./pages/admin/CustomerInvoices"));
const FleetManagement = lazy(() => import("./pages/admin/FleetManagement"));
const DeliveryManagement = lazy(() => import("./pages/admin/DeliveryManagement"));
const LiveMap = lazy(() => import("./pages/admin/LiveMap"));
const PointOfSale = lazy(() => import("./pages/admin/PointOfSale"));
const LocationsManagement = lazy(() => import("./pages/admin/LocationsManagement"));

// 13 Hidden gem pages
const AdminLiveChat = lazy(() => import("./pages/admin/AdminLiveChat"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const OrderAnalyticsPage = lazy(() => import("./pages/tenant-admin/OrderAnalyticsPage"));
const SalesDashboardPage = lazy(() => import("./pages/tenant-admin/SalesDashboardPage"));
const CustomerInsightsPage = lazy(() => import("./pages/tenant-admin/CustomerInsightsPage"));
const Couriers = lazy(() => import("./pages/admin/Couriers"));
const CustomerDetails = lazy(() => import("./pages/admin/CustomerDetails"));
const CustomerReports = lazy(() => import("./pages/admin/CustomerReports"));
const DeliveryTracking = lazy(() => import("./pages/admin/DeliveryTracking"));
const DispatchInventory = lazy(() => import("./pages/admin/DispatchInventory"));
const FinancialCenter = lazy(() => import("./pages/admin/FinancialCenterReal"));
const FrontedInventoryAnalytics = lazy(() => import("./pages/admin/FrontedInventoryAnalytics"));
const GlobalSearch = lazy(() => import("./pages/admin/GlobalSearch"));
const RiskFactorManagement = lazy(() => import("./pages/admin/RiskFactorManagement"));
const SystemSettings = lazy(() => import("./pages/admin/SystemSettings"));
const VendorManagement = lazy(() => import("./pages/admin/VendorManagement"));

// Customer Pages
const CustomerLoginPage = lazy(() => import("./pages/customer/LoginPage"));
const CustomerProtectedRoute = lazy(() => import("./components/auth/CustomerProtectedRoute").then(m => ({ default: m.CustomerProtectedRoute })));
const CustomerPortal = lazy(() => import("./pages/customer/CustomerPortal"));
const CustomerDashboardPage = lazy(() => import("./pages/customer/DashboardPage"));
const CustomerSettingsPage = lazy(() => import("./pages/customer/SettingsPage"));
const ShoppingCartPage = lazy(() => import("./pages/customer/ShoppingCartPage"));
const CheckoutPage = lazy(() => import("./pages/customer/CheckoutPage"));
const OrderTrackingPage = lazy(() => import("./pages/customer/OrderTrackingPage"));
const OrdersListPage = lazy(() => import("./pages/customer/OrdersListPage"));
const SecureMenuAccess = lazy(() => import("./pages/customer/SecureMenuAccess"));
const SecureMenuView = lazy(() => import("./pages/customer/SecureMenuView"));

// Public Menu Access
const MenuAccess = lazy(() => import("./pages/MenuAccess"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
      onError: handleMutationError,
    },
  },
});

// Setup global error handlers
setupGlobalErrorHandlers();

const App = () => {
  // Run production health check on mount
  useEffect(() => {
    if (import.meta.env.PROD) {
      const runHealthCheck = async () => {
        try {
          const result = await runProductionHealthCheck();
          
          if (result.issues.length > 0) {
            productionLogger.warning('Production health check found issues', result);
            
            // Show toast for critical issues
            if (!result.supabase || !result.realtime) {
              toast({
                title: 'Connection Issues Detected',
                description: 'Some features may not work properly. Please refresh the page.',
                variant: 'destructive',
              });
            }
          }
        } catch (error) {
          productionLogger.error('Health check failed', { error });
        }
      };

      // Run after a short delay to not block initial render
      setTimeout(runHealthCheck, 2000);
    }
  }, []);
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <AccountProvider>
                  <SuperAdminAuthProvider>
                    <TenantAdminAuthProvider>
                      <CustomerAuthProvider>
                        <TenantProvider>
                          <WhiteLabelProvider>
                            <TooltipProvider>
                    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <SkipToContent />
                    <OfflineBanner />
                    <InstallPWA />
                    
                    <Toaster />
                    <Sonner />
                    <Suspense fallback={<LoadingFallback />}>
                      <Routes>
                        {/* Marketing & Public Routes */}
                        <Route path="/" element={<Navigate to="/marketing" replace />} />
                        <Route path="/marketing" element={<MarketingHome />} />
                        <Route path="/features" element={<Features />} />
                        <Route path="/pricing" element={<PricingPage />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/faq" element={<FAQ />} />
                        <Route path="/support" element={<Support />} />
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/privacy" element={<Privacy />} />
                        
                        {/* Public Authentication */}
                        <Route path="/signup" element={<SignUpPage />} />
                        <Route path="/saas/login" element={<SaasLoginPage />} />
                        <Route path="/verify-email" element={<VerifyEmailPage />} />
                        
                        {/* Public Menu Access */}
                        <Route path="/m/:token" element={<SecureMenuAccess />} />
                        <Route path="/m/:token/view" element={<SecureMenuView />} />
                        <Route path="/menu/:token" element={<MenuAccess />} />
                        
                        {/* ==================== LEVEL 1: SUPER ADMIN (Platform) ==================== */}
                        <Route path="/super-admin/login" element={<SuperAdminLoginPage />} />
                        <Route path="/super-admin/reset/:token" element={<PasswordResetPage />} />
                        <Route path="/super-admin/dashboard" element={<SuperAdminProtectedRouteNew><SuperAdminDashboardPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/tenants/:tenantId" element={<SuperAdminProtectedRouteNew><SuperAdminTenantDetailPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/settings" element={<SuperAdminProtectedRouteNew><SuperAdminSettingsPage /></SuperAdminProtectedRouteNew>} />
                        
                        {/* ==================== LEVEL 2: TENANT ADMIN (Business Owner) ==================== */}
                        <Route path="/:tenantSlug/admin/login" element={<TenantAdminLoginPage />} />
                        <Route path="/:tenantSlug/admin/reset/:token" element={<PasswordResetPage />} />
                        
                        {/* Welcome Page (must be before AdminLayout) */}
                        <Route path="/:tenantSlug/admin/welcome" element={<TenantAdminProtectedRoute><TenantAdminWelcomePage /></TenantAdminProtectedRoute>} />
                        
                        {/* Trial Expired Page (must be before AdminLayout) */}
                        <Route path="/:tenantSlug/admin/trial-expired" element={<TenantAdminProtectedRoute><TrialExpiredPage /></TenantAdminProtectedRoute>} />
                        
                        {/* Help Page */}
                        <Route path="/:tenantSlug/admin/help" element={<TenantAdminProtectedRoute><HelpPage /></TenantAdminProtectedRoute>} />
                        
                        {/* Tenant Admin Portal */}
                        <Route path="/:tenantSlug/admin" element={<TenantAdminProtectedRoute><AdminLayout /></TenantAdminProtectedRoute>}>
                          <Route index element={<Navigate to="dashboard" replace />} />
                          <Route path="dashboard" element={<FeatureProtectedRoute featureId="dashboard"><TenantAdminDashboardPage /></FeatureProtectedRoute>} />
                          <Route path="disposable-menus" element={<FeatureProtectedRoute featureId="disposable-menus"><DisposableMenus /></FeatureProtectedRoute>} />
                          <Route path="disposable-menu-orders" element={<FeatureProtectedRoute featureId="basic-orders"><DisposableMenuOrders /></FeatureProtectedRoute>} />
                          <Route path="disposable-menu-analytics" element={<FeatureProtectedRoute featureId="disposable-menu-analytics"><DisposableMenuAnalytics /></FeatureProtectedRoute>} />
                          <Route path="menu-analytics" element={<FeatureProtectedRoute featureId="menu-analytics"><MenuAnalytics /></FeatureProtectedRoute>} />
                          <Route path="inventory/products" element={<FeatureProtectedRoute featureId="products"><ProductManagement /></FeatureProtectedRoute>} />
                          <Route path="big-plug-clients" element={<FeatureProtectedRoute featureId="customers"><BigPlugClients /></FeatureProtectedRoute>} />
                          <Route path="generate-barcodes" element={<FeatureProtectedRoute featureId="generate-barcodes"><GenerateBarcodes /></FeatureProtectedRoute>} />
                          <Route path="wholesale-orders" element={<FeatureProtectedRoute featureId="wholesale-orders"><WholesaleOrders /></FeatureProtectedRoute>} />
                          <Route path="inventory-dashboard" element={<FeatureProtectedRoute featureId="inventory-dashboard"><InventoryDashboard /></FeatureProtectedRoute>} />
                          <Route path="reports" element={<FeatureProtectedRoute featureId="reports"><ReportsPage /></FeatureProtectedRoute>} />
                          <Route path="billing" element={<FeatureProtectedRoute featureId="billing"><TenantAdminBillingPage /></FeatureProtectedRoute>} />
                          <Route path="settings" element={<FeatureProtectedRoute featureId="settings"><TenantAdminSettingsPage /></FeatureProtectedRoute>} />
                          
                          {/* 10 Built-but-not-routed pages */}
                          <Route path="live-orders" element={<FeatureProtectedRoute featureId="live-orders"><LiveOrders /></FeatureProtectedRoute>} />
                          <Route path="team-members" element={<FeatureProtectedRoute featureId="team-members"><TeamManagement /></FeatureProtectedRoute>} />
                          <Route path="advanced-inventory" element={<FeatureProtectedRoute featureId="advanced-inventory"><InventoryManagement /></FeatureProtectedRoute>} />
                          <Route path="fronted-inventory" element={<FeatureProtectedRoute featureId="fronted-inventory"><FrontedInventory /></FeatureProtectedRoute>} />
                          <Route path="invoice-management" element={<FeatureProtectedRoute featureId="invoice-management"><CustomerInvoices /></FeatureProtectedRoute>} />
                          <Route path="fleet-management" element={<FeatureProtectedRoute featureId="fleet-management"><FleetManagement /></FeatureProtectedRoute>} />
                          <Route path="delivery-management" element={<FeatureProtectedRoute featureId="delivery-management"><DeliveryManagement /></FeatureProtectedRoute>} />
                          <Route path="live-map" element={<FeatureProtectedRoute featureId="live-map"><LiveMap /></FeatureProtectedRoute>} />
                          <Route path="pos-system" element={<FeatureProtectedRoute featureId="pos-system"><PointOfSale /></FeatureProtectedRoute>} />
                          <Route path="locations" element={<FeatureProtectedRoute featureId="locations"><LocationsManagement /></FeatureProtectedRoute>} />
                          
                          {/* 13 Hidden gem pages */}
                          <Route path="live-chat" element={<FeatureProtectedRoute featureId="live-chat"><AdminLiveChat /></FeatureProtectedRoute>} />
                          <Route path="notifications" element={<FeatureProtectedRoute featureId="notifications"><AdminNotifications /></FeatureProtectedRoute>} />
                          <Route path="couriers" element={<FeatureProtectedRoute featureId="couriers"><Couriers /></FeatureProtectedRoute>} />
                          <Route path="customer-details" element={<FeatureProtectedRoute featureId="customer-details"><CustomerDetails /></FeatureProtectedRoute>} />
                          <Route path="customer-reports" element={<FeatureProtectedRoute featureId="customer-reports"><CustomerReports /></FeatureProtectedRoute>} />
                          <Route path="delivery-tracking" element={<FeatureProtectedRoute featureId="delivery-tracking"><DeliveryTracking /></FeatureProtectedRoute>} />
                          <Route path="dispatch-inventory" element={<FeatureProtectedRoute featureId="dispatch-inventory"><DispatchInventory /></FeatureProtectedRoute>} />
                          <Route path="financial-center" element={<FeatureProtectedRoute featureId="financial-center"><FinancialCenter /></FeatureProtectedRoute>} />
                          <Route path="fronted-inventory-analytics" element={<FeatureProtectedRoute featureId="fronted-inventory-analytics"><FrontedInventoryAnalytics /></FeatureProtectedRoute>} />
                          <Route path="global-search" element={<FeatureProtectedRoute featureId="global-search"><GlobalSearch /></FeatureProtectedRoute>} />
                          
                          {/* Professional Tier - Analytics */}
                          <Route path="order-analytics" element={<FeatureProtectedRoute featureId="order-analytics"><OrderAnalyticsPage /></FeatureProtectedRoute>} />
                          <Route path="sales-dashboard" element={<FeatureProtectedRoute featureId="sales-dashboard"><SalesDashboardPage /></FeatureProtectedRoute>} />
                          <Route path="customer-insights" element={<FeatureProtectedRoute featureId="customer-insights"><CustomerInsightsPage /></FeatureProtectedRoute>} />
                          
                          <Route path="risk-management" element={<FeatureProtectedRoute featureId="risk-management"><RiskFactorManagement /></FeatureProtectedRoute>} />
                          <Route path="system-settings" element={<FeatureProtectedRoute featureId="system-settings"><SystemSettings /></FeatureProtectedRoute>} />
                          <Route path="vendor-management" element={<FeatureProtectedRoute featureId="vendor-management"><VendorManagement /></FeatureProtectedRoute>} />
                        </Route>
                        
                        {/* ==================== LEVEL 3: CUSTOMER (End User) ==================== */}
                        <Route path="/:tenantSlug/shop/login" element={<CustomerLoginPage />} />
                        <Route path="/:tenantSlug/shop/reset/:token" element={<PasswordResetPage />} />
                        <Route path="/:tenantSlug/shop" element={<CustomerProtectedRoute><CustomerPortal /></CustomerProtectedRoute>}>
                          <Route index element={<Navigate to="dashboard" replace />} />
                          <Route path="dashboard" element={<CustomerDashboardPage />} />
                        </Route>
                        <Route path="/:tenantSlug/shop/cart" element={<CustomerProtectedRoute><ShoppingCartPage /></CustomerProtectedRoute>} />
                        <Route path="/:tenantSlug/shop/checkout" element={<CustomerProtectedRoute><CheckoutPage /></CustomerProtectedRoute>} />
                        <Route path="/:tenantSlug/shop/orders" element={<CustomerProtectedRoute><OrdersListPage /></CustomerProtectedRoute>} />
                        <Route path="/:tenantSlug/shop/orders/:orderId" element={<CustomerProtectedRoute><OrderTrackingPage /></CustomerProtectedRoute>} />
                        <Route path="/:tenantSlug/shop/settings" element={<CustomerProtectedRoute><CustomerSettingsPage /></CustomerProtectedRoute>} />

                        {/* ==================== 404 NOT FOUND ==================== */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                    </BrowserRouter>
                            </TooltipProvider>
                          </WhiteLabelProvider>
                        </TenantProvider>
                      </CustomerAuthProvider>
                    </TenantAdminAuthProvider>
                  </SuperAdminAuthProvider>
            </AccountProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
