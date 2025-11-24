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
import { EncryptionProvider } from "./contexts/EncryptionContext";
import { lazy, Suspense, useEffect } from "react";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AdminErrorBoundary } from "./components/admin/AdminErrorBoundary";
import { AuthErrorBoundary } from "./components/auth/AuthErrorBoundary";
import { SkipToContent } from "./components/SkipToContent";
import { LoadingFallback } from "./components/LoadingFallback";
import { SkeletonAdminLayout } from "./components/loading/SkeletonAdminLayout";
import { SkeletonDashboard } from "./components/loading/SkeletonDashboard";
import { SmartRootRedirect } from "./components/SmartRootRedirect";
import { setupGlobalErrorHandlers, handleMutationError } from "./utils/reactErrorHandler";
import { FeatureProtectedRoute } from "./components/tenant-admin/FeatureProtectedRoute";
import { SubscriptionGuard } from "./components/tenant-admin/SubscriptionGuard";
import { runProductionHealthCheck } from "@/utils/productionHealthCheck";
import { productionLogger } from "@/utils/productionLogger";
import { toast } from "./hooks/use-toast";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

import { NotificationPreferences } from "./components/NotificationPreferences";
import OfflineBanner from "./components/OfflineBanner";
import InstallPWA from "./components/InstallPWA";
import { DeviceTracker } from "./components/DeviceTracker";
import { initializeGlobalButtonMonitoring } from "./lib/utils/globalButtonInterceptor";
import { useVersionCheck } from "./hooks/useVersionCheck";
import { FeatureFlagsProvider } from "./config/featureFlags";

// Configure route-level progress indicator (NProgress)
NProgress.configure({ showSpinner: false, trickleSpeed: 120, minimum: 0.1 });
const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReducedMotion) {
  NProgress.configure({ trickle: false });
}

function SuspenseProgressFallback() {
  // Start progress when lazy content is loading; stop when it resolves
  useEffect(() => {
    try { NProgress.start(); } catch { }
    return () => {
      try { NProgress.done(); } catch { }
    };
  }, []);
  return <LoadingFallback />;
}

// Eager load critical pages
import NotFoundPage from "./pages/NotFoundPage";
const ButtonMonitorPage = lazy(() => import("./pages/debug/ButtonMonitorPage"));

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
const PublicMarketplacePage = lazy(() => import("./pages/marketplace/PublicMarketplacePage"));
const PublicListingDetailPage = lazy(() => import("./pages/marketplace/PublicListingDetailPage"));
const ClientPortalPage = lazy(() => import("./pages/customer/ClientPortalPage"));

// Three-Tier Auth System Pages
const SuperAdminLoginPage = lazy(() => import("./pages/super-admin/LoginPage"));
const SuperAdminDashboardPage = lazy(() => import("./pages/super-admin/DashboardPage"));
const SuperAdminTenantsListPage = lazy(() => import("./pages/super-admin/TenantsListPage"));
const SuperAdminCreateTenantPage = lazy(() => import("./pages/super-admin/CreateTenantPage"));
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
const ForumApprovalsPage = lazy(() => import("./pages/super-admin/ForumApprovalsPage"));
const AdminUsersPage = lazy(() => import("./pages/super-admin/AdminUsersPage"));
const SuperAdminToolsPage = lazy(() => import("./pages/super-admin/ToolsPage"));
const MarketplaceModerationPage = lazy(() => import("./pages/super-admin/MarketplaceModerationPage"));
const SuperAdminProtectedRouteNew = lazy(() => import("./components/auth/SuperAdminProtectedRoute").then(m => ({ default: m.SuperAdminProtectedRoute })));
const SuperAdminLayout = lazyWithRetry(() => import("./layouts/SuperAdminLayout").then(m => ({ default: m.SuperAdminLayout })));
const SignUpPage = lazy(() => import("./pages/saas/SignUpPage"));
const SelectPlanPage = lazy(() => import("./pages/saas/SelectPlanPage"));
const SaasLoginPage = lazy(() => import("./pages/saas/LoginPage"));
const VerifyEmailPage = lazy(() => import("./pages/saas/VerifyEmailPage"));
const TenantAdminWelcomePage = lazy(() => import("./pages/tenant-admin/WelcomePage"));
const PasswordResetPage = lazy(() => import("./pages/auth/PasswordResetPage"));

// Tenant Admin Pages
const TenantAdminLoginPage = lazy(() => import("./pages/tenant-admin/LoginPage"));
const TenantAdminProtectedRoute = lazy(() => import("./components/auth/TenantAdminProtectedRoute").then(m => ({ default: m.TenantAdminProtectedRoute })));
const AdminLayout = lazyWithRetry(() => import("./pages/admin/AdminLayout"));
const TenantAdminDashboardPage = lazy(() => import("./pages/tenant-admin/DashboardPage"));
const TenantAdminBillingPage = lazy(() => import("./pages/tenant-admin/BillingPage"));
const TenantAdminSettingsPage = lazy(() => import("./pages/tenant-admin/SettingsPage"));
const TenantAdminSelectPlanPage = lazy(() => import("./pages/tenant-admin/SelectPlanPage"));
const TrialExpiredPage = lazy(() => import("./pages/tenant-admin/TrialExpired"));
const HelpPage = lazy(() => import("./pages/HelpPage"));

// Tenant Admin Feature Pages
const DisposableMenus = lazy(() => import("./pages/admin/DisposableMenus"));
const DisposableMenuOrders = lazy(() => import("./pages/admin/DisposableMenuOrders"));
const DisposableMenuAnalytics = lazy(() => import("./pages/admin/DisposableMenuAnalytics"));
const MenuAnalytics = lazy(() => import("./pages/admin/MenuAnalytics"));
const ProductManagement = lazy(() => import("./pages/admin/ProductManagement"));
const BigPlugClients = lazy(() => import("./pages/admin/CustomerManagement"));
const ClientDetail = lazy(() => import("./pages/admin/ClientDetail"));
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
const RunnerLocationTracking = lazy(() => import("./pages/admin/RunnerLocationTracking"));
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
const SupplierManagementPage = lazy(() => import("./pages/admin/SupplierManagementPage"));
const PurchaseOrdersPage = lazy(() => import("./pages/admin/PurchaseOrdersPage"));
const ReturnsManagementPage = lazy(() => import("./pages/admin/ReturnsManagementPage"));
const LoyaltyProgramPage = lazy(() => import("./pages/admin/LoyaltyProgramPage"));
const CouponManagementPage = lazy(() => import("./pages/admin/CouponManagementPage"));
const QualityControlPage = lazy(() => import("./pages/admin/QualityControlPage"));
const CustomerCRMPage = lazy(() => import("./pages/admin/CustomerCRMPage"));
const ClientsPage = lazy(() => import("./pages/admin/ClientsPage"));
const ClientDetailPage = lazy(() => import("./pages/admin/ClientDetailPage"));
const InvoicesPage = lazy(() => import("./pages/admin/InvoicesPage"));
const CreateInvoicePage = lazy(() => import("./pages/admin/CreateInvoicePage"));
const InvoiceDetailPage = lazy(() => import("./pages/admin/InvoiceDetailPage"));
const PreOrdersPage = lazy(() => import("./pages/admin/PreOrdersPage"));
const CreatePreOrderPage = lazy(() => import("./pages/admin/CreatePreOrderPage"));
const PreOrderDetailPage = lazy(() => import("./pages/admin/PreOrderDetailPage"));
const CRMSettingsPage = lazy(() => import("./pages/admin/CRMSettingsPage"));
const InvitesPage = lazy(() => import("./pages/admin/InvitesPage"));
const InvoicePublicPage = lazy(() => import("./pages/portal/InvoicePublicPage"));
const MarketingAutomationPage = lazy(() => import("./pages/admin/MarketingAutomationPage"));
const AppointmentSchedulerPage = lazy(() => import("./pages/admin/AppointmentSchedulerPage"));
const SupportTicketsPage = lazy(() => import("./pages/admin/SupportTicketsPage"));
const BatchRecallPage = lazy(() => import("./pages/admin/BatchRecallPage"));
const ComplianceVaultPage = lazy(() => import("./pages/admin/ComplianceVaultPage"));
const AdvancedReportingPage = lazy(() => import("./pages/admin/AdvancedReportingPage"));
const VendorLoginPage = lazy(() => import("./pages/vendor/VendorLoginPage"));
const VendorDashboardPage = lazy(() => import("./pages/vendor/VendorDashboardPage"));
const PredictiveAnalyticsPage = lazy(() => import("./pages/admin/PredictiveAnalyticsPage"));
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
const InventoryMonitoringPage = lazy(() => import("./pages/admin/InventoryMonitoringPage"));
const DeveloperTools = lazy(() => import("./pages/admin/DeveloperTools"));
const ButtonTester = lazy(() => import("./pages/admin/ButtonTester"));

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

// Marketplace Pages
const SellerProfilePage = lazy(() => import("./pages/tenant-admin/marketplace/SellerProfilePage"));
const MyListingsPage = lazy(() => import("./pages/tenant-admin/marketplace/MyListingsPage"));
const ListingForm = lazy(() => import("./pages/tenant-admin/marketplace/ListingForm").then(m => ({ default: m.ListingForm })));
const ListingDetailPage = lazy(() => import("./pages/tenant-admin/marketplace/ListingDetailPage"));
const MarketplaceOrdersPage = lazy(() => import("./pages/tenant-admin/marketplace/MarketplaceOrdersPage"));
const OrderDetailPage = lazy(() => import("./pages/tenant-admin/marketplace/OrderDetailPage"));
const MessagesPage = lazy(() => import("./pages/tenant-admin/marketplace/MessagesPage"));
// These pages were deleted as they referenced non-existent database tables
// Will be re-added when proper database migrations are created

// Courier Pages
const CourierLoginPage = lazy(() => import("./pages/courier/LoginPage"));
const CourierDashboardPage = lazy(() => import("./pages/courier/DashboardPage"));
const CourierEarningsPage = lazy(() => import("./pages/courier/EarningsPage"));
const CourierHistoryPage = lazy(() => import("./pages/courier/HistoryPage"));
const CourierActiveOrderPage = lazy(() => import("./pages/courier/ActiveOrderPage"));
const UnifiedActiveDeliveryPage = lazy(() => import("./pages/courier/UnifiedActiveDeliveryPage"));
const CourierSettingsPage = lazy(() => import("./pages/courier/SettingsPage"));
const ProtectedCourierRoute = lazy(() => import("./components/ProtectedCourierRoute").then(m => ({ default: m.default })));

// Customer Pages
const CustomerLoginPage = lazy(() => import("./pages/customer/LoginPage"));
const CustomerSignUpPage = lazy(() => import("./pages/customer/SignUpPage"));
const CustomerVerifyEmailPage = lazy(() => import("./pages/customer/VerifyEmailPage"));
const CustomerForgotPasswordPage = lazy(() => import("./pages/customer/ForgotPasswordPage"));
const CustomerResetPasswordPage = lazy(() => import("./pages/customer/ResetPasswordPage"));
const CustomerLoginLanding = lazy(() => import("./pages/customer/CustomerLoginLanding"));

// Community Pages
const CommunityAuthPage = lazy(() => import("./pages/community/AuthPage").then(m => ({ default: m.AuthPage })));

// Invitation Pages
const InvitationAcceptPage = lazy(() => import("./pages/InvitationAcceptPage"));
const CustomerProtectedRoute = lazy(() => import("./components/auth/CustomerProtectedRoute").then(m => ({ default: m.CustomerProtectedRoute })));
const CommunityProtectedRoute = lazy(() => import("./components/auth/CommunityProtectedRoute").then(m => ({ default: m.CommunityProtectedRoute })));
const CustomerPortal = lazy(() => import("./pages/customer/CustomerPortal"));
const CustomerDashboardPage = lazy(() => import("./pages/customer/DashboardPage"));
const CustomerSettingsPage = lazy(() => import("./pages/customer/SettingsPage"));
const ShoppingCartPage = lazy(() => import("./pages/customer/ShoppingCartPage"));
const CheckoutPage = lazy(() => import("./pages/customer/CheckoutPage"));
const OrderTrackingPage = lazy(() => import("./pages/customer/OrderTrackingPage"));
const OrdersListPage = lazy(() => import("./pages/customer/OrdersListPage"));
const SecureMenuAccess = lazy(() => import("./pages/customer/SecureMenuAccess"));
const SecureMenuView = lazy(() => import("./pages/customer/SecureMenuView"));
const WholesaleMarketplacePage = lazy(() => import("./pages/customer/WholesaleMarketplacePage"));
const WholesaleCartPage = lazy(() => import("./pages/customer/WholesaleCartPage"));
const WholesaleCheckoutPage = lazy(() => import("./pages/customer/WholesaleCheckoutPage"));
const WholesaleOrdersPage = lazy(() => import("./pages/customer/WholesaleOrdersPage"));
const WholesaleOrderDetailPage = lazy(() => import("./pages/customer/WholesaleOrderDetailPage"));
const BusinessFinderPage = lazy(() => import("./pages/customer/retail/BusinessFinderPage"));
const BusinessMenuPage = lazy(() => import("./pages/customer/retail/BusinessMenuPage"));
const UnifiedOrdersPage = lazy(() => import("./pages/customer/UnifiedOrdersPage"));

// Community Forum Pages
const CommunityLayout = lazy(() => import("./pages/community/CommunityLayout").then(m => ({ default: m.CommunityLayout })));
const CommunityHomePage = lazy(() => import("./pages/community/HomePage").then(m => ({ default: m.HomePage })));
const CategoryPage = lazy(() => import("./pages/community/CategoryPage").then(m => ({ default: m.CategoryPage })));
const PostDetailPage = lazy(() => import("./pages/community/PostDetailPage").then(m => ({ default: m.PostDetailPage })));
const CreatePostPage = lazy(() => import("./pages/community/CreatePostPage").then(m => ({ default: m.CreatePostPage })));
const UserProfilePage = lazy(() => import("./pages/community/UserProfilePage").then(m => ({ default: m.UserProfilePage })));
const SearchPage = lazy(() => import("./pages/community/SearchPage").then(m => ({ default: m.SearchPage })));
const ApprovalPage = lazy(() => import("./pages/community/ApprovalPage").then(m => ({ default: m.ApprovalPage })));

// Public Menu Access
const MenuAccess = lazy(() => import("./pages/MenuAccess"));
const ComingSoonPage = lazy(() => import("./pages/ComingSoonPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnMount: false, // Don't refetch on mount if data is fresh
      refetchOnReconnect: true, // Refetch when network reconnects
      retry: 2, // Retry failed requests twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      // Performance optimizations
      structuralSharing: true, // Enable structural sharing to prevent unnecessary re-renders
    },
    mutations: {
      retry: 1,
      onError: handleMutationError,
      // Optimize mutation performance
      networkMode: 'online', // Only run mutations when online
    },
  },
});

// Setup global error handlers
setupGlobalErrorHandlers();

const MobileTestPage = lazy(() => import("@/pages/mobile/MobileTestPage"));

const App = () => {
  // Enable automatic version checking and cache busting
  useVersionCheck();

  // Safety cleanup: Ensure scroll is never blocked on app load
  useEffect(() => {
    // Remove any stuck keyboard-open state
    document.body.classList.remove('keyboard-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.overflow = '';
  }, []);

  // Clear stale auth data on marketing/login pages to prevent cross-tenant contamination
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/marketing' || path === '/login' || path === '/saas/login' || path === '/saas/signup') {
      // Clear tenant-specific data (preserve super admin if exists)
      const superAdminToken = localStorage.getItem('super_admin_access_token');
      if (!superAdminToken) {
        localStorage.removeItem('tenant_admin_access_token');
        localStorage.removeItem('tenant_admin_refresh_token');
        localStorage.removeItem('tenant_admin_user');
        localStorage.removeItem('tenant_data');
        localStorage.removeItem('lastTenantSlug'); // Clear tenant slug cache
      }
    }
  }, []);

  // Initialize global button monitoring
  useEffect(() => {
    initializeGlobalButtonMonitoring();
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
                            <TenantProvider>
                              <WhiteLabelProvider>
                                <SkipToContent />
                                <OfflineBanner />
                                <InstallPWA />
                                <DeviceTracker />

                                <Sonner />
                                <Suspense fallback={<SuspenseProgressFallback />}>
                                  <Routes>
                                    {/* Marketing & Public Routes */}
                                    <Route path="/" element={<SmartRootRedirect />} />
                                    <Route path="/p/:portalToken" element={<ClientPortalPage />} />
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

                                    {/* Public Marketplace */}
                                    <Route path="/marketplace" element={<PublicMarketplacePage />} />
                                    <Route path="/marketplace/listings/:listingId" element={<PublicListingDetailPage />} />

                                    {/* Public Authentication */}
                                    <Route path="/signup" element={<SignUpPage />} />
                                    <Route path="/select-plan" element={<SelectPlanPage />} />
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

                                    {/* Debug Routes */}
                                    <Route path="/debug/button-monitor" element={<ButtonMonitorPage />} />

                                    {/* ==================== LEVEL 1: SUPER ADMIN (Platform) ==================== */}
                                    <Route path="/super-admin/login" element={<SuperAdminLoginPage />} />
                                    <Route path="/super-admin/reset/:token" element={<PasswordResetPage />} />
                                    <Route path="/super-admin/*" element={
                                      <SuperAdminProtectedRouteNew>
                                        <SuperAdminLayout />
                                      </SuperAdminProtectedRouteNew>
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
                                    </Route>

                                    {/* ==================== LEVEL 2: TENANT ADMIN (Business Owner) ==================== */}
                                    <Route path="/:tenantSlug/admin/login" element={<TenantAdminLoginPage />} />
                                    <Route path="/:tenantSlug/admin/reset/:token" element={<PasswordResetPage />} />

                                    {/* Welcome Page (must be before AdminLayout) */}
                                    <Route path="/:tenantSlug/admin/welcome" element={<TenantAdminProtectedRoute><TenantAdminWelcomePage /></TenantAdminProtectedRoute>} />

                                    {/* Trial Expired Page (must be before AdminLayout) */}
                                    <Route path="/:tenantSlug/admin/trial-expired" element={<TenantAdminProtectedRoute><TrialExpiredPage /></TenantAdminProtectedRoute>} />

                                    {/* Help Page */}
                                    <Route path="/:tenantSlug/admin/help" element={<TenantAdminProtectedRoute><HelpPage /></TenantAdminProtectedRoute>} />

                                    {/* Select Plan Page (for adding payment method) */}
                                    <Route path="/:tenantSlug/admin/select-plan" element={<TenantAdminProtectedRoute><TenantAdminSelectPlanPage /></TenantAdminProtectedRoute>} />

                                    {/* Tenant Admin Portal - Exact redirect */}
                                    <Route path="/:tenantSlug/admin" element={<Navigate to="dashboard" replace />} />
                                    <Route
                                      path="/:tenantSlug/admin/*"
                                      element={
                                        <Suspense fallback={<SkeletonAdminLayout />}>
                                          <TenantAdminProtectedRoute>
                                            <SubscriptionGuard>
                                              <AdminLayout />
                                            </SubscriptionGuard>
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
                                      {/* Legacy route redirects - redirect old paths to new paths */}
                                      <Route path="big-plug-dashboard" element={<Navigate to="dashboard" replace />} />
                                      <Route path="big-plug-order" element={<Navigate to="wholesale-orders" replace />} />
                                      <Route path="big-plug-inventory" element={<Navigate to="inventory-dashboard" replace />} />
                                      <Route path="big-plug-financial" element={<Navigate to="financial-center" replace />} />
                                      <Route path="inventory/dispatch" element={<Navigate to="../dispatch-inventory" replace />} />
                                      <Route path="admin-notifications" element={<Navigate to="notifications" replace />} />
                                      <Route path="reports-new" element={<Navigate to="reports" replace />} />
                                      <Route path="route-optimization" element={<Navigate to="route-optimizer" replace />} />
                                      <Route path="risk-factors" element={<Navigate to="risk-management" replace />} />
                                      <Route path="inventory/barcodes" element={<Navigate to="../generate-barcodes" replace />} />
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
                                      <Route path="big-plug-clients/:id" element={<FeatureProtectedRoute featureId="customers"><ClientDetail /></FeatureProtectedRoute>} />
                                      <Route path="generate-barcodes" element={<FeatureProtectedRoute featureId="generate-barcodes"><GenerateBarcodes /></FeatureProtectedRoute>} />
                                      <Route path="wholesale-orders" element={<FeatureProtectedRoute featureId="wholesale-orders"><WholesaleOrders /></FeatureProtectedRoute>} />
                                      <Route path="inventory-dashboard" element={<FeatureProtectedRoute featureId="inventory-dashboard"><InventoryDashboard /></FeatureProtectedRoute>} />
                                      <Route path="inventory-monitoring" element={<FeatureProtectedRoute featureId="inventory-monitoring"><InventoryMonitoringPage /></FeatureProtectedRoute>} />
                                      <Route path="reports" element={<FeatureProtectedRoute featureId="reports"><ReportsPage /></FeatureProtectedRoute>} />
                                      <Route path="billing" element={<FeatureProtectedRoute featureId="billing"><TenantAdminBillingPage /></FeatureProtectedRoute>} />
                                      <Route path="settings" element={<FeatureProtectedRoute featureId="settings"><TenantAdminSettingsPage /></FeatureProtectedRoute>} />

                                      {/* Marketplace Routes */}
                                      <Route path="marketplace/profile" element={<FeatureProtectedRoute featureId="marketplace"><SellerProfilePage /></FeatureProtectedRoute>} />
                                      <Route path="marketplace/profile/edit" element={<FeatureProtectedRoute featureId="marketplace"><SellerProfilePage /></FeatureProtectedRoute>} />
                                      <Route path="marketplace/listings" element={<FeatureProtectedRoute featureId="marketplace"><MyListingsPage /></FeatureProtectedRoute>} />
                                      <Route path="marketplace/listings/new" element={<FeatureProtectedRoute featureId="marketplace"><ListingForm /></FeatureProtectedRoute>} />
                                      <Route path="marketplace/listings/:listingId" element={<FeatureProtectedRoute featureId="marketplace"><ListingDetailPage /></FeatureProtectedRoute>} />
                                      <Route path="marketplace/listings/:listingId/edit" element={<FeatureProtectedRoute featureId="marketplace"><ListingForm /></FeatureProtectedRoute>} />
                                      <Route path="marketplace/orders" element={<FeatureProtectedRoute featureId="marketplace"><MarketplaceOrdersPage /></FeatureProtectedRoute>} />
                                      <Route path="marketplace/orders/:orderId" element={<FeatureProtectedRoute featureId="marketplace"><OrderDetailPage /></FeatureProtectedRoute>} />
                                      <Route path="marketplace/messages" element={<FeatureProtectedRoute featureId="marketplace"><MessagesPage /></FeatureProtectedRoute>} />

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
                                      <Route path="gps-tracking" element={<FeatureProtectedRoute featureId="fleet-management"><RunnerLocationTracking /></FeatureProtectedRoute>} />
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
                                      <Route path="suppliers" element={<FeatureProtectedRoute featureId="suppliers"><SupplierManagementPage /></FeatureProtectedRoute>} />
                                      <Route path="purchase-orders" element={<FeatureProtectedRoute featureId="purchase-orders"><PurchaseOrdersPage /></FeatureProtectedRoute>} />
                                      <Route path="returns" element={<FeatureProtectedRoute featureId="returns"><ReturnsManagementPage /></FeatureProtectedRoute>} />
                                      <Route path="loyalty-program" element={<FeatureProtectedRoute featureId="loyalty-program"><LoyaltyProgramPage /></FeatureProtectedRoute>} />
                                      <Route path="coupons" element={<FeatureProtectedRoute featureId="coupons"><CouponManagementPage /></FeatureProtectedRoute>} />
                                      <Route path="quality-control" element={<FeatureProtectedRoute featureId="quality-control"><QualityControlPage /></FeatureProtectedRoute>} />
                                      <Route path="customer-crm" element={<FeatureProtectedRoute featureId="customer-crm"><CustomerCRMPage /></FeatureProtectedRoute>} />
                                      <Route path="crm/clients" element={<FeatureProtectedRoute featureId="customer-crm"><ClientsPage /></FeatureProtectedRoute>} />
                                      <Route path="crm/clients/:clientId" element={<FeatureProtectedRoute featureId="customer-crm"><ClientDetailPage /></FeatureProtectedRoute>} />
                                      <Route path="crm/invoices" element={<FeatureProtectedRoute featureId="customer-crm"><InvoicesPage /></FeatureProtectedRoute>} />
                                      <Route path="crm/invoices/new" element={<FeatureProtectedRoute featureId="customer-crm"><CreateInvoicePage /></FeatureProtectedRoute>} />
                                      <Route path="crm/invoices/:invoiceId" element={<FeatureProtectedRoute featureId="customer-crm"><InvoiceDetailPage /></FeatureProtectedRoute>} />
                                      <Route path="crm/pre-orders" element={<FeatureProtectedRoute featureId="customer-crm"><PreOrdersPage /></FeatureProtectedRoute>} />
                                      <Route path="crm/pre-orders/new" element={<FeatureProtectedRoute featureId="customer-crm"><CreatePreOrderPage /></FeatureProtectedRoute>} />
                                      <Route path="crm/pre-orders/:preOrderId" element={<FeatureProtectedRoute featureId="customer-crm"><PreOrderDetailPage /></FeatureProtectedRoute>} />
                                      <Route path="crm/settings" element={<FeatureProtectedRoute featureId="customer-crm"><CRMSettingsPage /></FeatureProtectedRoute>} />
                                      <Route path="crm/invites" element={<FeatureProtectedRoute featureId="customer-crm"><InvitesPage /></FeatureProtectedRoute>} />
                                      <Route path="marketing-automation" element={<FeatureProtectedRoute featureId="marketing-automation"><MarketingAutomationPage /></FeatureProtectedRoute>} />
                                      <Route path="appointments" element={<FeatureProtectedRoute featureId="appointments"><AppointmentSchedulerPage /></FeatureProtectedRoute>} />
                                      <Route path="support-tickets" element={<FeatureProtectedRoute featureId="support-tickets"><SupportTicketsPage /></FeatureProtectedRoute>} />
                                      <Route path="batch-recall" element={<FeatureProtectedRoute featureId="batch-recall"><BatchRecallPage /></FeatureProtectedRoute>} />
                                      <Route path="compliance-vault" element={<FeatureProtectedRoute featureId="compliance-vault"><ComplianceVaultPage /></FeatureProtectedRoute>} />
                                      <Route path="compliance" element={<FeatureProtectedRoute featureId="compliance"><CompliancePage /></FeatureProtectedRoute>} />
                                      <Route path="advanced-reporting" element={<FeatureProtectedRoute featureId="advanced-reporting"><AdvancedReportingPage /></FeatureProtectedRoute>} />
                                      <Route path="predictive-analytics" element={<FeatureProtectedRoute featureId="predictive-analytics"><PredictiveAnalyticsPage /></FeatureProtectedRoute>} />

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
                                      <Route path="developer-tools" element={<DeveloperTools />} />
                                      <Route path="button-tester" element={<ButtonTester />} />
                                      <Route path="api-access" element={<FeatureProtectedRoute featureId="api-access"><APIAccessPage /></FeatureProtectedRoute>} />
                                      <Route path="webhooks" element={<FeatureProtectedRoute featureId="webhooks"><WebhooksPage /></FeatureProtectedRoute>} />
                                      <Route path="custom-integrations" element={<FeatureProtectedRoute featureId="custom-integrations"><CustomIntegrationsPage /></FeatureProtectedRoute>} />
                                      <Route path="data-export" element={<FeatureProtectedRoute featureId="data-export"><DataExportPage /></FeatureProtectedRoute>} />
                                      <Route path="audit-trail" element={<FeatureProtectedRoute featureId="audit-trail"><AuditTrailPage /></FeatureProtectedRoute>} />
                                      <Route path="compliance" element={<FeatureProtectedRoute featureId="compliance"><CompliancePage /></FeatureProtectedRoute>} />
                                      <Route path="white-label" element={<FeatureProtectedRoute featureId="white-label"><WhiteLabelPage /></FeatureProtectedRoute>} />
                                      <Route path="custom-domain" element={<FeatureProtectedRoute featureId="custom-domain"><CustomDomainPage /></FeatureProtectedRoute>} />
                                      <Route path="priority-support" element={<FeatureProtectedRoute featureId="priority-support"><PrioritySupportPage /></FeatureProtectedRoute>} />
                                      {/* Coming Soon Pages for missing features */}
                                      <Route path="expense-tracking" element={<ComingSoonPage pageName="Expense Tracking" description="Track and manage business expenses" />} />
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

                                    {/* Catch-all route for /admin/* paths without tenant slug - redirect to login */}
                                    <Route path="/admin/*" element={<Navigate to="/login" replace />} />

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
                                            <Route path="settings" element={<ProtectedCourierRoute><CourierSettingsPage /></ProtectedCourierRoute>} />
                                            <Route path="order/:orderId" element={<ProtectedCourierRoute><CourierActiveOrderPage /></ProtectedCourierRoute>} />
                                            <Route path="delivery/:id" element={<ProtectedCourierRoute><UnifiedActiveDeliveryPage /></ProtectedCourierRoute>} />
                                          </Routes>
                                        </CourierProvider>
                                      }
                                    />

                                    {/* ==================== CUSTOMER LOGIN LANDING (No Tenant) ==================== */}
                                    <Route path="/customer/login" element={<CustomerLoginLanding />} />
                                    <Route path="/shop/login" element={<CustomerLoginLanding />} />

                                    {/* ==================== LEVEL 3: CUSTOMER (End User) ==================== */}
                                    <Route path="/:tenantSlug/customer/login" element={<CustomerLoginPage />} />
                                    <Route path="/:tenantSlug/customer/signup" element={<CustomerSignUpPage />} />
                                    <Route path="/:tenantSlug/customer/verify-email" element={<CustomerVerifyEmailPage />} />
                                    <Route path="/:tenantSlug/customer/forgot-password" element={<CustomerForgotPasswordPage />} />
                                    <Route path="/:tenantSlug/customer/reset-password" element={<CustomerResetPasswordPage />} />
                                    <Route path="/:tenantSlug/shop/login" element={<CustomerLoginPage />} />
                                    <Route path="/:tenantSlug/shop/reset/:token" element={<PasswordResetPage />} />
                                    {/* Public Routes */}
                                    <Route path="/portal/invoice/:token" element={<InvoicePublicPage />} />
                                    <Route path="/:tenantSlug/shop" element={<CustomerProtectedRoute><CustomerPortal /></CustomerProtectedRoute>}>
                                      <Route index element={<Navigate to="dashboard" replace />} />
                                      <Route path="dashboard" element={<CustomerDashboardPage />} />
                                    </Route>
                                    <Route path="/:tenantSlug/shop/cart" element={<CustomerProtectedRoute><ShoppingCartPage /></CustomerProtectedRoute>} />
                                    <Route path="/:tenantSlug/shop/checkout" element={<CustomerProtectedRoute><CheckoutPage /></CustomerProtectedRoute>} />
                                    <Route path="/:tenantSlug/shop/orders" element={<CustomerProtectedRoute><UnifiedOrdersPage /></CustomerProtectedRoute>} />
                                    <Route path="/:tenantSlug/shop/orders/:orderId" element={<CustomerProtectedRoute><OrderTrackingPage /></CustomerProtectedRoute>} />
                                    <Route path="/:tenantSlug/shop/orders/retail/:orderId" element={<CustomerProtectedRoute><OrderTrackingPage /></CustomerProtectedRoute>} />
                                    <Route path="/:tenantSlug/shop/settings" element={<CustomerProtectedRoute><CustomerSettingsPage /></CustomerProtectedRoute>} />
                                    {/* Retail Shopping Routes */}
                                    <Route path="/:tenantSlug/shop/retail/businesses" element={<CustomerProtectedRoute><BusinessFinderPage /></CustomerProtectedRoute>} />
                                    <Route path="/:tenantSlug/shop/retail/businesses/:businessSlug/menu" element={<CustomerProtectedRoute><BusinessMenuPage /></CustomerProtectedRoute>} />
                                    {/* Wholesale Marketplace Routes */}
                                    <Route path="/:tenantSlug/shop/wholesale" element={<CustomerProtectedRoute><WholesaleMarketplacePage /></CustomerProtectedRoute>} />
                                    <Route path="/:tenantSlug/shop/wholesale/cart" element={<CustomerProtectedRoute><WholesaleCartPage /></CustomerProtectedRoute>} />
                                    <Route path="/:tenantSlug/shop/wholesale/checkout" element={<CustomerProtectedRoute><WholesaleCheckoutPage /></CustomerProtectedRoute>} />
                                    <Route path="/:tenantSlug/shop/wholesale/orders" element={<CustomerProtectedRoute><WholesaleOrdersPage /></CustomerProtectedRoute>} />
                                    <Route path="/:tenantSlug/shop/wholesale/orders/:orderId" element={<CustomerProtectedRoute><WholesaleOrderDetailPage /></CustomerProtectedRoute>} />

                                    {/* ==================== VENDOR PORTAL (External Access) ==================== */}
                                    <Route path="/vendor/login" element={<VendorLoginPage />} />
                                    <Route path="/vendor/dashboard" element={<VendorDashboardPage />} />

                                    {/* ==================== COMMUNITY FORUM (Global) ==================== */}
                                    <Route path="/community/auth" element={<CommunityAuthPage />} />
                                    <Route path="/community" element={<CommunityProtectedRoute><CommunityLayout /></CommunityProtectedRoute>}>
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
                          </CustomerAuthProvider>
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
