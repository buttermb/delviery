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
import { CourierProvider } from "./contexts/CourierContext";
import { SuperAdminAuthProvider } from "./contexts/SuperAdminAuthContext";
import { TenantAdminAuthProvider } from "./contexts/TenantAdminAuthContext";
import { CustomerAuthProvider } from "./contexts/CustomerAuthContext";
import { lazy, Suspense, useEffect } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AdminErrorBoundary } from "./components/admin/AdminErrorBoundary";
import { AuthErrorBoundary } from "./components/auth/AuthErrorBoundary";
import { SkipToContent } from "./components/SkipToContent";
import { LoadingFallback } from "./components/LoadingFallback";
import { SmartRootRedirect } from "./components/SmartRootRedirect";
import { setupGlobalErrorHandlers, handleMutationError } from "./utils/reactErrorHandler";
import { FeatureProtectedRoute } from "./components/tenant-admin/FeatureProtectedRoute";
import { runProductionHealthCheck } from "@/utils/productionHealthCheck";
import { productionLogger } from "@/utils/productionLogger";
import { toast } from "./hooks/use-toast";

import { NotificationPreferences } from "./components/NotificationPreferences";
import OfflineBanner from "./components/OfflineBanner";
import InstallPWA from "./components/InstallPWA";

// Eager load critical pages
import NotFoundPage from "./pages/NotFoundPage";

// Marketing & Public Pages
const MarketingHome = lazy(() => import("./pages/MarketingHome"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const Contact = lazy(() => import("./pages/Contact"));
const Features = lazy(() => import("./pages/Features"));
const FAQPage = lazy(() => import("./pages/FAQPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const About = lazy(() => import("./pages/About"));
const DemoRequest = lazy(() => import("./pages/DemoRequest"));
const DemoConfirmation = lazy(() => import("./pages/DemoConfirmation"));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const DocsPage = lazy(() => import("./pages/DocsPage"));
const GettingStartedPage = lazy(() => import("./pages/docs/GettingStartedPage"));
const ApiReferencePage = lazy(() => import("./pages/docs/ApiReferencePage"));
const AuthenticationPage = lazy(() => import("./pages/docs/AuthenticationPage"));
const SecurityDocsPage = lazy(() => import("./pages/docs/SecurityPage"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const Careers = lazy(() => import("./pages/Careers"));
const Press = lazy(() => import("./pages/Press"));
const Blog = lazy(() => import("./pages/Blog"));
const Security = lazy(() => import("./pages/Security"));
const Cookie = lazy(() => import("./pages/Cookie"));
const LoginDirectory = lazy(() => import("./pages/LoginDirectory"));

// Three-Tier Auth System Pages
const SuperAdminLoginPage = lazy(() => import("./pages/super-admin/LoginPage"));
const SuperAdminDashboardPage = lazy(() => import("./pages/super-admin/DashboardPage"));
const SuperAdminTenantDetailPage = lazy(() => import("./pages/super-admin/TenantDetailPage"));
const SuperAdminSettingsPage = lazy(() => import("./pages/super-admin/SettingsPage"));
const SuperAdminMonitoringPage = lazy(() => import("./pages/super-admin/MonitoringPage"));
const SuperAdminAnalyticsPage = lazy(() => import("./pages/super-admin/AnalyticsPage"));
const SuperAdminDataExplorerPage = lazy(() => import("./pages/super-admin/DataExplorerPage"));
const SuperAdminAPIUsagePage = lazy(() => import("./pages/super-admin/APIUsagePage"));
const SuperAdminAuditLogsPage = lazy(() => import("./pages/super-admin/AuditLogsPage"));
const SuperAdminRevenueAnalyticsPage = lazy(() => import("./pages/super-admin/RevenueAnalyticsPage"));
const SuperAdminReportBuilderPage = lazy(() => import("./pages/super-admin/ReportBuilderPage"));
const SuperAdminExecutiveDashboardPage = lazy(() => import("./pages/super-admin/ExecutiveDashboardPage"));
const SuperAdminWorkflowsPage = lazy(() => import("./pages/super-admin/WorkflowsPage"));
const SuperAdminCommunicationPage = lazy(() => import("./pages/super-admin/CommunicationPage"));
const SuperAdminFeatureFlagsPage = lazy(() => import("./pages/super-admin/FeatureFlagsPage"));
const SuperAdminSystemConfigPage = lazy(() => import("./pages/super-admin/SystemConfigPage"));
const SuperAdminSecurityPage = lazy(() => import("./pages/super-admin/SecurityPage"));
const SuperAdminToolsPage = lazy(() => import("./pages/super-admin/ToolsPage"));
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
const HelpPage = lazy(() => import("./pages/HelpPage"));

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

// Built pages missing routes (currently locked in sidebar)
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

// Hidden gems - pages that exist but aren't in config
const AdminLiveChat = lazy(() => import("./pages/admin/AdminLiveChat"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
// Tenant-admin versions (if they exist)
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
const ImagesPage = lazy(() => import("./pages/admin/catalog/ImagesPage"));
const BatchesPage = lazy(() => import("./pages/admin/catalog/BatchesPage"));
const CategoriesPage = lazy(() => import("./pages/admin/catalog/CategoriesPage"));
const ReceivingPage = lazy(() => import("./pages/admin/operations/ReceivingPage"));
const WarehousesPage = lazy(() => import("./pages/admin/locations/WarehousesPage"));
const RunnersPage = lazy(() => import("./pages/admin/locations/RunnersPage"));
const AdminPricingPage = lazy(() => import("./pages/admin/sales/PricingPage"));

// GitHub Repos Integration Pages
const AnalyticsPage = lazy(() => import("./pages/admin/AnalyticsPage"));
const RouteOptimizationPageAdmin = lazy(() => import("./pages/admin/RouteOptimizationPage"));
const AdvancedInvoicePage = lazy(() => import("./pages/admin/AdvancedInvoicePage"));
const LocalAIPage = lazy(() => import("./pages/admin/LocalAIPage"));
const WorkflowAutomationPage = lazy(() => import("./pages/admin/WorkflowAutomationPage"));

// Coming Soon Pages - Professional & Enterprise Features
const StockAlertsPage = lazy(() => import("./pages/tenant-admin/StockAlertsPage"));
const InventoryTransfersPage = lazy(() => import("./pages/tenant-admin/InventoryTransfersPage"));
const CustomerAnalyticsPage = lazy(() => import("./pages/tenant-admin/CustomerAnalyticsPage"));
const AdvancedAnalyticsPage = lazy(() => import("./pages/tenant-admin/AdvancedAnalyticsPage"));
const RealtimeDashboardPage = lazy(() => import("./pages/tenant-admin/RealtimeDashboardPage"));
const CustomReportsPage = lazy(() => import("./pages/tenant-admin/CustomReportsPage"));
const CommissionTrackingPage = lazy(() => import("./pages/tenant-admin/CommissionTrackingPage"));
const RevenueReportsPage = lazy(() => import("./pages/tenant-admin/RevenueReportsPage"));
const RouteOptimizationPage = lazy(() => import("./pages/tenant-admin/RouteOptimizationPage"));
const DeliveryAnalyticsPage = lazy(() => import("./pages/tenant-admin/DeliveryAnalyticsPage"));
const CashRegisterPage = lazy(() => import("./pages/tenant-admin/CashRegisterPage"));
const POSAnalyticsPage = lazy(() => import("./pages/tenant-admin/POSAnalyticsPage"));
const POSShiftsPage = lazy(() => import("./pages/tenant-admin/POSShiftsPage"));
const ZReportPage = lazy(() => import("./pages/tenant-admin/ZReportPage"));
const RoleManagementPage = lazy(() => import("./pages/tenant-admin/RoleManagementPage"));
const ActivityLogsPage = lazy(() => import("./pages/tenant-admin/ActivityLogsPage"));
const LocationAnalyticsPage = lazy(() => import("./pages/tenant-admin/LocationAnalyticsPage"));
const UserManagementPage = lazy(() => import("./pages/tenant-admin/UserManagementPage"));
const PermissionsPage = lazy(() => import("./pages/tenant-admin/PermissionsPage"));
const BulkOperationsPage = lazy(() => import("./pages/tenant-admin/BulkOperationsPage"));
const APIAccessPage = lazy(() => import("./pages/tenant-admin/APIAccessPage"));
const WebhooksPage = lazy(() => import("./pages/tenant-admin/WebhooksPage"));
const CustomIntegrationsPage = lazy(() => import("./pages/tenant-admin/CustomIntegrationsPage"));
const AutomationPage = lazy(() => import("./pages/tenant-admin/AutomationPage"));
const DataExportPage = lazy(() => import("./pages/tenant-admin/DataExportPage"));
const AuditTrailPage = lazy(() => import("./pages/tenant-admin/AuditTrailPage"));
const CompliancePage = lazy(() => import("./pages/tenant-admin/CompliancePage"));
const WhiteLabelPage = lazy(() => import("./pages/tenant-admin/WhiteLabelPage"));
const CustomDomainPage = lazy(() => import("./pages/tenant-admin/CustomDomainPage"));
const PrioritySupportPage = lazy(() => import("./pages/tenant-admin/PrioritySupportPage"));
// These pages were deleted as they referenced non-existent database tables
// Will be re-added when proper database migrations are created

// Courier Pages
const CourierLoginPage = lazy(() => import("./pages/courier/LoginPage"));
const CourierDashboardPage = lazy(() => import("./pages/courier/DashboardPage"));
const CourierEarningsPage = lazy(() => import("./pages/courier/EarningsPage"));
const CourierHistoryPage = lazy(() => import("./pages/courier/HistoryPage"));
const CourierActiveOrderPage = lazy(() => import("./pages/courier/ActiveOrderPage"));
const ProtectedCourierRoute = lazy(() => import("./components/ProtectedCourierRoute").then(m => ({ default: m.default })));

// Customer Pages
const CustomerLoginPage = lazy(() => import("./pages/customer/LoginPage"));
const CustomerSignUpPage = lazy(() => import("./pages/customer/SignUpPage"));

// Invitation Pages
const InvitationAcceptPage = lazy(() => import("./pages/InvitationAcceptPage"));
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
                        <Route path="/" element={<SmartRootRedirect />} />
                        <Route path="/marketing" element={<MarketingHome />} />
                        <Route path="/features" element={<Features />} />
                        <Route path="/pricing" element={<PricingPage />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/demo" element={<DemoRequest />} />
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
                        <Route path="/login" element={<LoginDirectory />} />
                        
                        {/* Public Authentication */}
                        <Route path="/signup" element={<SignUpPage />} />
                        <Route path="/saas/login" element={<SaasLoginPage />} />
                        <Route path="/verify-email" element={<VerifyEmailPage />} />
                        
                        {/* Redirect admin routes without tenant slug */}
                        <Route path="/admin/*" element={<Navigate to="/login" replace />} />
                        
                        {/* Invitation Acceptance */}
                        <Route path="/invite/:token" element={<InvitationAcceptPage />} />
                        
                        {/* Public Menu Access */}
                        <Route path="/m/:token" element={<SecureMenuAccess />} />
                        <Route path="/m/:token/view" element={<SecureMenuView />} />
                        <Route path="/menu/:token" element={<MenuAccess />} />
                        
                        {/* ==================== LEVEL 1: SUPER ADMIN (Platform) ==================== */}
                        <Route path="/super-admin/login" element={<SuperAdminLoginPage />} />
                        <Route path="/super-admin/reset/:token" element={<PasswordResetPage />} />
                        <Route path="/super-admin/dashboard" element={<SuperAdminProtectedRouteNew><SuperAdminDashboardPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/monitoring" element={<SuperAdminProtectedRouteNew><SuperAdminMonitoringPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/analytics" element={<SuperAdminProtectedRouteNew><SuperAdminAnalyticsPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/data-explorer" element={<SuperAdminProtectedRouteNew><SuperAdminDataExplorerPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/api-usage" element={<SuperAdminProtectedRouteNew><SuperAdminAPIUsagePage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/audit-logs" element={<SuperAdminProtectedRouteNew><SuperAdminAuditLogsPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/revenue-analytics" element={<SuperAdminProtectedRouteNew><SuperAdminRevenueAnalyticsPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/report-builder" element={<SuperAdminProtectedRouteNew><SuperAdminReportBuilderPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/executive-dashboard" element={<SuperAdminProtectedRouteNew><SuperAdminExecutiveDashboardPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/workflows" element={<SuperAdminProtectedRouteNew><SuperAdminWorkflowsPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/communication" element={<SuperAdminProtectedRouteNew><SuperAdminCommunicationPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/feature-flags" element={<SuperAdminProtectedRouteNew><SuperAdminFeatureFlagsPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/system-config" element={<SuperAdminProtectedRouteNew><SuperAdminSystemConfigPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/security" element={<SuperAdminProtectedRouteNew><SuperAdminSecurityPage /></SuperAdminProtectedRouteNew>} />
                        <Route path="/super-admin/tools" element={<SuperAdminProtectedRouteNew><SuperAdminToolsPage /></SuperAdminProtectedRouteNew>} />
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
                          <Route path="analytics/comprehensive" element={<FeatureProtectedRoute featureId="analytics"><AnalyticsPage /></FeatureProtectedRoute>} />
                          <Route path="disposable-menus" element={<FeatureProtectedRoute featureId="disposable-menus"><DisposableMenus /></FeatureProtectedRoute>} />
                          <Route path="disposable-menu-orders" element={<FeatureProtectedRoute featureId="basic-orders"><DisposableMenuOrders /></FeatureProtectedRoute>} />
                          <Route path="disposable-menu-analytics" element={<FeatureProtectedRoute featureId="disposable-menu-analytics"><DisposableMenuAnalytics /></FeatureProtectedRoute>} />
                          <Route path="menu-analytics" element={<FeatureProtectedRoute featureId="menu-analytics"><MenuAnalytics /></FeatureProtectedRoute>} />
                          <Route path="inventory/products" element={<FeatureProtectedRoute featureId="products"><ProductManagement /></FeatureProtectedRoute>} />
                          <Route path="catalog/images" element={<FeatureProtectedRoute featureId="products"><ImagesPage /></FeatureProtectedRoute>} />
                          <Route path="catalog/batches" element={<FeatureProtectedRoute featureId="products"><BatchesPage /></FeatureProtectedRoute>} />
                          <Route path="catalog/categories" element={<FeatureProtectedRoute featureId="products"><CategoriesPage /></FeatureProtectedRoute>} />
                          <Route path="big-plug-clients" element={<FeatureProtectedRoute featureId="customers"><BigPlugClients /></FeatureProtectedRoute>} />
                          <Route path="generate-barcodes" element={<FeatureProtectedRoute featureId="generate-barcodes"><GenerateBarcodes /></FeatureProtectedRoute>} />
                          <Route path="wholesale-orders" element={<FeatureProtectedRoute featureId="wholesale-orders"><WholesaleOrders /></FeatureProtectedRoute>} />
                          <Route path="inventory-dashboard" element={<FeatureProtectedRoute featureId="inventory-dashboard"><InventoryDashboard /></FeatureProtectedRoute>} />
                          <Route path="reports" element={<FeatureProtectedRoute featureId="reports"><ReportsPage /></FeatureProtectedRoute>} />
                          <Route path="billing" element={<FeatureProtectedRoute featureId="billing"><TenantAdminBillingPage /></FeatureProtectedRoute>} />
                          <Route path="settings" element={<FeatureProtectedRoute featureId="settings"><TenantAdminSettingsPage /></FeatureProtectedRoute>} />
                          
                          {/* 10 Built-but-not-routed pages */}
                          <Route path="live-orders" element={<FeatureProtectedRoute featureId="live-orders"><LiveOrders /></FeatureProtectedRoute>} />
                          <Route path="staff-management" element={<FeatureProtectedRoute featureId="team-members"><TeamManagement /></FeatureProtectedRoute>} />
                          <Route path="team-members" element={<FeatureProtectedRoute featureId="team-members"><TeamManagement /></FeatureProtectedRoute>} />
                          <Route path="advanced-inventory" element={<FeatureProtectedRoute featureId="advanced-inventory"><InventoryManagement /></FeatureProtectedRoute>} />
                          <Route path="fronted-inventory" element={<FeatureProtectedRoute featureId="fronted-inventory"><FrontedInventory /></FeatureProtectedRoute>} />
                          <Route path="invoice-management" element={<FeatureProtectedRoute featureId="invoice-management"><CustomerInvoices /></FeatureProtectedRoute>} />
                          <Route path="fleet-management" element={<FeatureProtectedRoute featureId="fleet-management"><FleetManagement /></FeatureProtectedRoute>} />
                          <Route path="delivery-management" element={<FeatureProtectedRoute featureId="delivery-management"><DeliveryManagement /></FeatureProtectedRoute>} />
                          <Route path="live-map" element={<FeatureProtectedRoute featureId="live-map"><LiveMap /></FeatureProtectedRoute>} />
                          <Route path="pos-system" element={<FeatureProtectedRoute featureId="pos-system"><PointOfSale /></FeatureProtectedRoute>} />
                          <Route path="locations" element={<FeatureProtectedRoute featureId="locations"><LocationsManagement /></FeatureProtectedRoute>} />
                          <Route path="locations/warehouses" element={<FeatureProtectedRoute featureId="locations"><WarehousesPage /></FeatureProtectedRoute>} />
                          <Route path="locations/runners" element={<FeatureProtectedRoute featureId="locations"><RunnersPage /></FeatureProtectedRoute>} />
                          <Route path="sales/pricing" element={<FeatureProtectedRoute featureId="sales"><AdminPricingPage /></FeatureProtectedRoute>} />
                          
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
                          
                          {/* Additional routes that don't need FeatureProtectedRoute or need different paths */}
                          <Route path="risk-management" element={<FeatureProtectedRoute featureId="risk-management"><RiskFactorManagement /></FeatureProtectedRoute>} />
                          <Route path="system-settings" element={<FeatureProtectedRoute featureId="system-settings"><SystemSettings /></FeatureProtectedRoute>} />
                          <Route path="vendor-management" element={<FeatureProtectedRoute featureId="vendor-management"><VendorManagement /></FeatureProtectedRoute>} />
                          
                          {/* Coming Soon Pages - Professional & Enterprise Features */}
                          <Route path="stock-alerts" element={<FeatureProtectedRoute featureId="stock-alerts"><StockAlertsPage /></FeatureProtectedRoute>} />
                          <Route path="inventory-transfers" element={<FeatureProtectedRoute featureId="inventory-transfers"><InventoryTransfersPage /></FeatureProtectedRoute>} />
                          <Route path="customer-analytics" element={<FeatureProtectedRoute featureId="customer-analytics"><CustomerAnalyticsPage /></FeatureProtectedRoute>} />
                          <Route path="advanced-analytics" element={<FeatureProtectedRoute featureId="advanced-analytics"><AdvancedAnalyticsPage /></FeatureProtectedRoute>} />
                          <Route path="realtime-dashboard" element={<FeatureProtectedRoute featureId="realtime-dashboard"><RealtimeDashboardPage /></FeatureProtectedRoute>} />
                          <Route path="custom-reports" element={<FeatureProtectedRoute featureId="custom-reports"><CustomReportsPage /></FeatureProtectedRoute>} />
                          <Route path="commission-tracking" element={<FeatureProtectedRoute featureId="commission-tracking"><CommissionTrackingPage /></FeatureProtectedRoute>} />
                          <Route path="revenue-reports" element={<FeatureProtectedRoute featureId="revenue-reports"><RevenueReportsPage /></FeatureProtectedRoute>} />
                          <Route path="delivery-analytics" element={<FeatureProtectedRoute featureId="delivery-analytics"><DeliveryAnalyticsPage /></FeatureProtectedRoute>} />
                          <Route path="cash-register" element={<FeatureProtectedRoute featureId="cash-register"><CashRegisterPage /></FeatureProtectedRoute>} />
                          <Route path="pos-analytics" element={<FeatureProtectedRoute featureId="pos-analytics"><POSAnalyticsPage /></FeatureProtectedRoute>} />
                          <Route path="pos-shifts" element={<FeatureProtectedRoute featureId="pos-shifts"><POSShiftsPage /></FeatureProtectedRoute>} />
                          <Route path="z-reports" element={<FeatureProtectedRoute featureId="z-reports"><ZReportPage /></FeatureProtectedRoute>} />
                          <Route path="role-management" element={<FeatureProtectedRoute featureId="role-management"><RoleManagementPage /></FeatureProtectedRoute>} />
                          <Route path="activity-logs" element={<FeatureProtectedRoute featureId="activity-logs"><ActivityLogsPage /></FeatureProtectedRoute>} />
                          
                          {/* GitHub Repos Integration Routes */}
                          <Route path="analytics-dashboard" element={<FeatureProtectedRoute featureId="analytics"><AnalyticsPage /></FeatureProtectedRoute>} />
                          <Route path="route-optimizer" element={<FeatureProtectedRoute featureId="route-optimization"><RouteOptimizationPageAdmin /></FeatureProtectedRoute>} />
                          <Route path="advanced-invoice" element={<FeatureProtectedRoute featureId="invoice-management"><AdvancedInvoicePage /></FeatureProtectedRoute>} />
                          <Route path="local-ai" element={<FeatureProtectedRoute featureId="ai"><LocalAIPage /></FeatureProtectedRoute>} />
                          <Route path="workflow-automation" element={<FeatureProtectedRoute featureId="automation"><WorkflowAutomationPage /></FeatureProtectedRoute>} />
                          <Route path="location-analytics" element={<FeatureProtectedRoute featureId="location-analytics"><LocationAnalyticsPage /></FeatureProtectedRoute>} />
                          <Route path="user-management" element={<FeatureProtectedRoute featureId="user-management"><UserManagementPage /></FeatureProtectedRoute>} />
                          <Route path="permissions" element={<FeatureProtectedRoute featureId="permissions"><PermissionsPage /></FeatureProtectedRoute>} />
                          <Route path="bulk-operations" element={<FeatureProtectedRoute featureId="bulk-operations"><BulkOperationsPage /></FeatureProtectedRoute>} />
                          <Route path="operations/receiving" element={<FeatureProtectedRoute featureId="operations"><ReceivingPage /></FeatureProtectedRoute>} />
                          <Route path="api-access" element={<FeatureProtectedRoute featureId="api-access"><APIAccessPage /></FeatureProtectedRoute>} />
                          <Route path="webhooks" element={<FeatureProtectedRoute featureId="webhooks"><WebhooksPage /></FeatureProtectedRoute>} />
                          <Route path="custom-integrations" element={<FeatureProtectedRoute featureId="custom-integrations"><CustomIntegrationsPage /></FeatureProtectedRoute>} />
                          <Route path="data-export" element={<FeatureProtectedRoute featureId="data-export"><DataExportPage /></FeatureProtectedRoute>} />
                          <Route path="audit-trail" element={<FeatureProtectedRoute featureId="audit-trail"><AuditTrailPage /></FeatureProtectedRoute>} />
                          <Route path="compliance" element={<FeatureProtectedRoute featureId="compliance"><CompliancePage /></FeatureProtectedRoute>} />
                          <Route path="white-label" element={<FeatureProtectedRoute featureId="white-label"><WhiteLabelPage /></FeatureProtectedRoute>} />
                          <Route path="custom-domain" element={<FeatureProtectedRoute featureId="custom-domain"><CustomDomainPage /></FeatureProtectedRoute>} />
                          <Route path="priority-support" element={<FeatureProtectedRoute featureId="priority-support"><PrioritySupportPage /></FeatureProtectedRoute>} />
                        </Route>
                        
                        {/* ==================== COURIER PORTAL ==================== */}
                        <Route path="/courier/login" element={<CourierLoginPage />} />
                        <Route
                          path="/courier/*"
                          element={
                            <CourierProvider>
                              <Routes>
                                <Route path="dashboard" element={<ProtectedCourierRoute><CourierDashboardPage /></ProtectedCourierRoute>} />
                                <Route path="earnings" element={<ProtectedCourierRoute><CourierEarningsPage /></ProtectedCourierRoute>} />
                                <Route path="history" element={<ProtectedCourierRoute><CourierHistoryPage /></ProtectedCourierRoute>} />
                                <Route path="order/:orderId" element={<ProtectedCourierRoute><CourierActiveOrderPage /></ProtectedCourierRoute>} />
                              </Routes>
                            </CourierProvider>
                          }
                        />
                        
                        {/* ==================== LEVEL 3: CUSTOMER (End User) ==================== */}
                        <Route path="/:tenantSlug/customer/login" element={<CustomerLoginPage />} />
                        <Route path="/:tenantSlug/customer/signup" element={<CustomerSignUpPage />} />
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
                        <Route path="*" element={<NotFoundPage />} />
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
