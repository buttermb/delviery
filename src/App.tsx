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
import { Analytics } from "@vercel/analytics/react";
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
import { lazy, Suspense, useEffect } from "react";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { ErrorBoundary } from "./components/ErrorBoundary";
// AdminErrorBoundary and AuthErrorBoundary - available for future use
// import { AdminErrorBoundary } from "./components/admin/AdminErrorBoundary";
// import { AuthErrorBoundary } from "./components/auth/AuthErrorBoundary";
import { SkipToContent } from "./components/SkipToContent";
import { LoadingFallback } from "./components/LoadingFallback";
import { SkeletonAdminLayout } from "./components/loading/SkeletonAdminLayout";
import { SkeletonDashboard } from "./components/loading/SkeletonDashboard";
import { SmartRootRedirect } from "./components/SmartRootRedirect";
import { setupGlobalErrorHandlers } from "./utils/reactErrorHandler";
import { FeatureProtectedRoute } from "./components/tenant-admin/FeatureProtectedRoute";
import { SubscriptionGuard } from "./components/tenant-admin/SubscriptionGuard";
import { PublicOnlyRoute } from "./components/auth/PublicOnlyRoute";
import { RoleProtectedRoute } from "./components/auth/RoleProtectedRoute";
import { TenantContextGuard } from "./components/auth/TenantContextGuard";
import { runProductionHealthCheck } from "@/utils/productionHealthCheck";
import { productionLogger } from "@/utils/productionLogger";
import { toast } from "./hooks/use-toast";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

// NotificationPreferences - available for future use
// import { NotificationPreferences } from "./components/NotificationPreferences";
import OfflineBanner from "./components/OfflineBanner";
import { UpdateBanner } from "./components/mobile/UpdateBanner";
import { ScrollToTop } from "./components/ScrollToTop";
import { InstallPWA } from "./components/InstallPWA";
import { DeviceTracker } from "./components/DeviceTracker";
import { initializeGlobalButtonMonitoring } from "./lib/utils/globalButtonInterceptor";
import { useVersionCheck } from "./hooks/useVersionCheck";
import { FeatureFlagsProvider } from "./config/featureFlags";
import { AdminDebugPanel } from "./components/admin/AdminDebugPanel";
import { PerformanceMonitor } from "./utils/performance";
import { runRouteAudit } from "./utils/routeAudit";
import { STARTER_SIDEBAR, PROFESSIONAL_SIDEBAR, ENTERPRISE_SIDEBAR } from "./lib/sidebar/sidebarConfigs";
// Clerk removed - using Supabase Auth only

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
const InteractiveDemoPage = lazy(() => import("./pages/InteractiveDemoPage"));
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

// Super Admin Credit Management Pages
const SuperAdminCreditsOverviewPage = lazy(() => import("./pages/super-admin/CreditsOverviewPage"));
const SuperAdminTenantCreditsPage = lazy(() => import("./pages/super-admin/TenantCreditsPage"));
const SuperAdminCreditAuditLogPage = lazy(() => import("./pages/super-admin/CreditAuditLogPage"));
const SuperAdminPromoCodeManagementPage = lazy(() => import("./pages/super-admin/PromoCodeManagementPage"));
const SuperAdminCreditPackagesPage = lazy(() => import("./pages/super-admin/CreditPackagesPage"));
const SuperAdminCreditAnalyticsPage = lazy(() => import("./pages/super-admin/CreditAnalyticsPage"));
const SuperAdminReferralManagementPage = lazy(() => import("./pages/super-admin/ReferralManagementPage"));
const SuperAdminProtectedRouteNew = lazy(() => import("./components/auth/SuperAdminProtectedRoute").then(m => ({ default: m.SuperAdminProtectedRoute })));
const SuperAdminLayout = lazyWithRetry(() => import("./layouts/SuperAdminLayout").then(m => ({ default: m.SuperAdminLayout })));
const SignUpPage = lazyWithRetry(() => import("./pages/saas/SignUpPage"));
const SelectPlanPage = lazyWithRetry(() => import("./pages/saas/SelectPlanPage"));
const SaasLoginPage = lazyWithRetry(() => import("./pages/saas/LoginPage").then(m => ({ default: m.LoginPage })));
const VerifyEmailPage = lazyWithRetry(() => import("./pages/saas/VerifyEmailPage"));
import { EncodedUrlRedirect } from "./components/EncodedUrlRedirect";
import { UrlEncodingFixer } from "./components/UrlEncodingFixer";
const TenantAdminWelcomePage = lazy(() => import("./pages/tenant-admin/WelcomePage"));
const TenantAdminVerifyEmailPage = lazy(() => import("./pages/tenant-admin/VerifyEmailPage"));
const PasswordResetPage = lazy(() => import("./pages/auth/PasswordResetPage").then(m => ({ default: m.PasswordResetPage })));
const SignupSuccessPage = lazy(() => import("./pages/auth/SignupSuccessPage").then(m => ({ default: m.SignupSuccessPage })));
const AccountSettingsPage = lazy(() => import("./pages/auth/AccountSettingsPage").then(m => ({ default: m.AccountSettingsPage })));
const ChangePasswordPage = lazy(() => import("./pages/auth/ChangePasswordPage").then(m => ({ default: m.ChangePasswordPage })));

// Tenant Admin Pages
const TenantAdminLoginPage = lazy(() => import("./pages/tenant-admin/LoginPage"));
const TenantAdminProtectedRoute = lazy(() => import("./components/auth/TenantAdminProtectedRoute").then(m => ({ default: m.TenantAdminProtectedRoute })));
const AdminLayout = lazyWithRetry(() => import("./pages/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));
const TenantAdminDashboardPage = lazy(() => import("./pages/tenant-admin/DashboardPage"));
const HotboxPage = lazy(() => import("./pages/admin/HotboxPage"));
const FinancialCommandCenterPage = lazy(() => import("./pages/admin/FinancialCommandCenter"));
const CollectionModePage = lazy(() => import("./pages/admin/CollectionMode"));
// Billing is now handled in Settings - redirect below
// const TenantAdminBillingPage = lazy(() => import("./pages/tenant-admin/BillingPage"));
const TenantAdminSettingsPage = lazy(() => import("./pages/tenant-admin/SettingsPage"));
const TenantAdminSelectPlanPage = lazy(() => import("./pages/tenant-admin/SelectPlanPage"));
const TrialExpiredPage = lazy(() => import("./pages/tenant-admin/TrialExpired"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const HelpHubPage = lazy(() => import("./pages/admin/hubs/HelpHubPage"));

// Tenant Admin Feature Pages
const DisposableMenus = lazy(() => import("./pages/admin/DisposableMenus"));
const DisposableMenuAnalytics = lazy(() => import("./pages/admin/DisposableMenuAnalytics"));
const MenuAnalytics = lazy(() => import("./pages/admin/MenuAnalytics"));
const MenuMigration = lazy(() => import("./pages/admin/MenuMigration").then(m => ({ default: m.MenuMigration })));
// const ProductManagement = lazy(() => import("./pages/admin/ProductManagement")); // Moved to InventoryHub
const ClientDetail = lazy(() => import("./pages/admin/ClientDetail"));
const GenerateBarcodes = lazy(() => import("./pages/admin/GenerateBarcodes"));
const NewWholesaleOrder = lazy(() => import("./pages/admin/NewWholesaleOrder"));
const NewPurchaseOrder = lazy(() => import("./pages/admin/NewPurchaseOrder"));
const OfflineOrderCreate = lazy(() => import("./pages/admin/OfflineOrderCreate"));
const ReportsPage = lazy(() => import("./pages/admin/ReportsPage"));
const BoardReportPage = lazy(() => import("./pages/admin/BoardReportPage"));
const StrategicDashboardPage = lazy(() => import("./pages/admin/StrategicDashboardPage"));
const ExpansionAnalysisPage = lazy(() => import("./pages/admin/ExpansionAnalysisPage"));

// Built pages missing routes (currently locked in sidebar)
const TeamManagement = lazy(() => import("./pages/admin/TeamManagement"));
const FrontedInventory = lazy(() => import("./pages/admin/FrontedInventory"));
const FrontedInventoryDetails = lazy(() => import("./pages/admin/FrontedInventoryDetails"));
const CustomerInvoices = lazy(() => import("./pages/admin/CustomerInvoices"));
const RunnerLocationTracking = lazy(() => import("./pages/admin/RunnerLocationTracking"));
const LiveMap = lazy(() => import("./pages/admin/LiveMap"));
// const PointOfSale = lazy(() => import("./pages/admin/PointOfSale")); // Available for future use
const LocationsManagement = lazy(() => import("./pages/admin/LocationsManagement"));

// Hidden gems - pages that exist but aren't in config
const AdminLiveChat = lazy(() => import("./pages/admin/AdminLiveChat"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
// Tenant-admin versions (if they exist)
const OrderAnalyticsPage = lazy(() => import("./pages/tenant-admin/OrderAnalyticsPage"));
const SalesDashboardPage = lazy(() => import("./pages/tenant-admin/SalesDashboardPage"));
// const CustomerInsightsPage = lazy(() => import("./pages/tenant-admin/CustomerInsightsPage")); // Available for future use
const CustomerReports = lazy(() => import("./pages/admin/CustomerReports"));
const DispatchInventory = lazy(() => import("./pages/admin/DispatchInventory"));
// const FinancialCenter = lazy(() => import("./pages/admin/FinancialCenterReal")); // Available for future use
const FrontedInventoryAnalytics = lazy(() => import("./pages/admin/FrontedInventoryAnalytics"));
// Commented out - available for future use:
// const SupplierManagementPage = lazy(() => import("./pages/admin/SupplierManagementPage"));
// const PurchaseOrdersPage = lazy(() => import("./pages/admin/PurchaseOrdersPage"));
// const ReturnsManagementPage = lazy(() => import("./pages/admin/ReturnsManagementPage"));
// const LoyaltyProgramPage = lazy(() => import("./pages/admin/LoyaltyProgramPage"));
// const CouponManagementPage = lazy(() => import("./pages/admin/CouponManagementPage"));
// const QualityControlPage = lazy(() => import("./pages/admin/QualityControlPage"));
const ClientsPage = lazy(() => import("./pages/admin/ClientsPage"));
const ClientDetailPage = lazy(() => import("./pages/admin/ClientDetailPage"));
const InvoicesPage = lazy(() => import("./pages/admin/InvoicesPage").then(m => ({ default: m.InvoicesPage })));
const CreateInvoicePage = lazy(() => import("./pages/admin/CreateInvoicePage"));
const InvoiceDetailPage = lazy(() => import("./pages/admin/InvoiceDetailPage"));
const CreatePreOrderPage = lazy(() => import("./pages/admin/CreatePreOrderPage"));
const PreOrderDetailPage = lazy(() => import("./pages/admin/PreOrderDetailPage"));
const CRMSettingsPage = lazy(() => import("./pages/admin/CRMSettingsPage"));
const InvitesPage = lazy(() => import("./pages/admin/InvitesPage"));
const InvoicePublicPage = lazy(() => import("./pages/portal/InvoicePublicPage"));
const DeliveryTrackingPage = lazy(() => import("./pages/portal/DeliveryTrackingPage"));
// Commented out - available for future use:
// const MarketingAutomationPage = lazy(() => import("./pages/admin/MarketingAutomationPage"));
// const AppointmentSchedulerPage = lazy(() => import("./pages/admin/AppointmentSchedulerPage"));
// const SupportTicketsPage = lazy(() => import("./pages/admin/SupportTicketsPage"));
// const BatchRecallPage = lazy(() => import("./pages/admin/BatchRecallPage"));
// const ComplianceVaultPage = lazy(() => import("./pages/admin/ComplianceVaultPage"));
const AdvancedReportingPage = lazy(() => import("./pages/admin/AdvancedReportingPage"));
const VendorLoginPage = lazy(() => import("./pages/vendor/VendorLoginPage").then(m => ({ default: m.VendorLoginPage })));
const VendorDashboardPage = lazy(() => import("./pages/vendor/VendorDashboardPage"));
const VendorOrderDetailPage = lazy(() => import("./pages/vendor/VendorOrderDetailPage").then(m => ({ default: m.VendorOrderDetailPage })));
const ProtectedVendorRoute = lazy(() => import("./components/vendor/ProtectedVendorRoute"));
// const PredictiveAnalyticsPage = lazy(() => import("./pages/admin/PredictiveAnalyticsPage")); // Available for future use
const GlobalSearch = lazy(() => import("./pages/admin/GlobalSearch"));
const RiskFactorManagement = lazy(() => import("./pages/admin/RiskFactorManagement"));
const SystemSettings = lazy(() => import("./pages/admin/SystemSettings"));
const VendorManagement = lazy(() => import("./pages/admin/VendorManagement").then(m => ({ default: m.VendorManagement })));
const VendorDashboard = lazy(() => import("./pages/admin/VendorDashboard"));
const PurchaseOrders = lazy(() => import("./pages/admin/PurchaseOrders"));
const ImagesPage = lazy(() => import("./pages/admin/catalog/ImagesPage"));
const BatchesPage = lazy(() => import("./pages/admin/catalog/BatchesPage"));
const CategoriesPage = lazy(() => import("./pages/admin/catalog/CategoriesPage"));
const ReceivingPage = lazy(() => import("./pages/admin/operations/ReceivingPage"));
const WarehousesPage = lazy(() => import("./pages/admin/locations/WarehousesPage"));
const RunnersPage = lazy(() => import("./pages/admin/locations/RunnersPage"));
const AdminPricingPage = lazy(() => import("./pages/admin/sales/PricingPage"));
const PricingTiersPage = lazy(() => import("./pages/admin/wholesale/PricingTiersPage"));
// const InventoryMonitoringPage = lazy(() => import("./pages/admin/InventoryMonitoringPage")); // Moved to InventoryHub
const DeveloperTools = lazy(() => import("./pages/admin/DeveloperTools"));
const ButtonTester = lazy(() => import("./pages/admin/ButtonTester"));
const ReviewsPage = lazy(() => import("./pages/admin/ReviewsPage"));
const DeliveryZonesPage = lazy(() => import("./pages/admin/DeliveryZones"));

// GitHub Repos Integration Pages
const AnalyticsPage = lazy(() => import("./pages/admin/AnalyticsPage"));

const AdvancedInvoicePage = lazy(() => import("./pages/admin/AdvancedInvoicePage"));
const LocalAIPage = lazy(() => import("./pages/admin/LocalAIPage"));
const WorkflowAutomationPage = lazy(() => import("./pages/admin/WorkflowAutomationPage"));

// White-Label Storefront Pages (Admin) - commented out, available for future use
// const StorefrontDashboard = lazy(() => import("./pages/admin/storefront/StorefrontDashboard"));
// const StorefrontSettings = lazy(() => import("@/pages/admin/storefront/StorefrontSettings"));
// const StorefrontBuilder = lazy(() => import("@/pages/admin/storefront/StorefrontBuilder").then(m => ({ default: m.StorefrontBuilder })));
// const StorefrontProducts = lazy(() => import("./pages/admin/storefront/StorefrontProducts"));
// const StorefrontOrders = lazy(() => import("./pages/admin/storefront/StorefrontOrders"));
// const StorefrontBundles = lazy(() => import("./pages/admin/storefront/StorefrontBundles"));
// const StorefrontLiveOrders = lazy(() => import("./pages/admin/storefront/StorefrontLiveOrders"));
// const StorefrontCustomers = lazy(() => import("./pages/admin/storefront/StorefrontCustomers"));
// const StorefrontCoupons = lazy(() => import("./pages/admin/storefront/StorefrontCoupons"));
// const StorefrontAnalytics = lazy(() => import("./pages/admin/storefront/StorefrontAnalytics"));

// Marketplace Admin (B2C)
const MarketplaceDashboard = lazy(() => import("./pages/admin/marketplace/MarketplaceDashboard"));
const StoreSettings = lazy(() => import("./pages/admin/marketplace/StoreSettings"));
const ProductVisibilityManager = lazy(() => import("./pages/admin/marketplace/ProductVisibilityManager"));
const CouponManager = lazy(() => import("./pages/admin/marketplace/CouponManager"));
const MarketplaceCategoryManager = lazy(() => import("./pages/admin/marketplace/MarketplaceCategoryManager"));
const ProductSyncPage = lazy(() => import("./pages/admin/marketplace/ProductSyncPage"));

// Customer-Facing Shop Pages
const ShopLayout = lazy(() => import("./pages/shop/ShopLayout"));
const ShopStorefrontPage = lazy(() => import("./pages/shop/StorefrontPage"));
const ShopProductCatalogPage = lazy(() => import("./pages/shop/ProductCatalogPage").then(m => ({ default: m.ProductCatalogPage })));
const ShopProductDetailPage = lazy(() => import("./pages/shop/ProductDetailPage").then(m => ({ default: m.ProductDetailPage })));
const ShopCartPage = lazy(() => import("./pages/shop/CartPage"));
const ShopCheckoutPage = lazy(() => import("./pages/shop/CheckoutPage"));
const ShopOrderConfirmationPage = lazy(() => import("./pages/shop/OrderConfirmationPage"));
const ShopAccountPage = lazy(() => import("./pages/shop/AccountPage"));
const ShopOrderTrackingPage = lazy(() => import("./pages/shop/OrderTrackingPage"));
const ShopOrderDetailPage = lazy(() => import("./pages/shop/OrderDetailPage").then(m => ({ default: m.OrderDetailPage })));
const SinglePageCheckout = lazy(() => import("./components/shop/SinglePageCheckout"));
const EncryptedStorePage = lazy(() => import("./pages/shop/EncryptedStorePage"));
const RevenueReportsPage = lazy(() => import("./pages/tenant-admin/RevenueReportsPage"));
const RouteOptimizationPage = lazy(() => import("./pages/tenant-admin/RouteOptimizationPage"));
const DeliveryAnalyticsPage = lazy(() => import("./pages/tenant-admin/DeliveryAnalyticsPage"));
const CashRegisterPage = lazy(() => import("./pages/tenant-admin/CashRegisterPage").then(m => ({ default: m.CashRegisterPage })));
const POSAnalyticsPage = lazy(() => import("./pages/tenant-admin/POSAnalyticsPage"));
const POSShiftsPage = lazy(() => import("./pages/tenant-admin/POSShiftsPage"));
const ZReportPage = lazy(() => import("./pages/tenant-admin/ZReportPage"));
const POSHubPage = lazy(() => import("./pages/admin/hubs/POSHubPage"));
const OrdersHubPage = lazy(() => import("./pages/admin/hubs/OrdersHubPage"));
const InventoryHubPage = lazy(() => import("./pages/admin/hubs/InventoryHubPage"));
const CustomerHubPage = lazy(() => import("./pages/admin/hubs/CustomerHubPage"));
const AnalyticsHubPage = lazy(() => import("./pages/admin/hubs/AnalyticsHubPage"));
const SettingsHubPage = lazy(() => import("./pages/admin/hubs/SettingsHubPage"));
const FinanceHubPage = lazy(() => import("./pages/admin/hubs/FinanceHubPage"));
// const IntegrationsHubPage = lazy(() => import("./pages/admin/hubs/IntegrationsHubPage")); // Available for future use
const StorefrontHubPage = lazy(() => import("./pages/admin/hubs/StorefrontHubPage"));
const OperationsHubPage = lazy(() => import("./pages/admin/hubs/OperationsHubPage"));
const FulfillmentHubPage = lazy(() => import("./pages/admin/hubs/FulfillmentHubPage"));
const DashboardHubPage = lazy(() => import("./pages/admin/hubs/DashboardHubPage").then(m => ({ default: m.DashboardHubPage })));

// Smart TV Dashboard (Big Screen Operations View)
const SmartTVDashboard = lazy(() => import("./pages/admin/SmartTVDashboard"));

const MarketingHubPage = lazy(() => import("./pages/admin/hubs/MarketingHubPage"));
const RoleManagement = lazy(() => import("./pages/admin/RoleManagement"));
const ActivityLogsPage = lazy(() => import("./pages/tenant-admin/ActivityLogsPage").then(m => ({ default: m.ActivityLogsPage })));
const LocationAnalyticsPage = lazy(() => import("./pages/tenant-admin/LocationAnalyticsPage"));
const BulkOperationsPage = lazy(() => import("./pages/tenant-admin/BulkOperationsPage"));
const APIAccessPage = lazy(() => import("./pages/tenant-admin/APIAccessPage"));
const WebhooksPage = lazy(() => import("./pages/tenant-admin/WebhooksPage"));
const CustomIntegrationsPage = lazy(() => import("./pages/tenant-admin/CustomIntegrationsPage"));
// const AutomationPage = lazy(() => import("./pages/tenant-admin/AutomationPage")); // Available for future use
const DataExportPage = lazy(() => import("./pages/tenant-admin/DataExportPage"));
const AuditTrailPage = lazy(() => import("./pages/tenant-admin/AuditTrailPage"));
const CompliancePage = lazy(() => import("./pages/tenant-admin/CompliancePage"));
const WhiteLabelPage = lazy(() => import("./pages/tenant-admin/WhiteLabelPage"));
const CustomDomainPage = lazy(() => import("./pages/tenant-admin/CustomDomainPage"));
const PrioritySupportPage = lazy(() => import("./pages/tenant-admin/PrioritySupportPage"));
const CreditPurchaseSuccessPage = lazy(() => import("./pages/tenant-admin/credits/CreditPurchaseSuccessPage"));
const CreditPurchaseCancelledPage = lazy(() => import("./pages/tenant-admin/credits/CreditPurchaseCancelledPage"));
const CreditAnalyticsPage = lazy(() => import("./pages/tenant-admin/credits/CreditAnalyticsPage").then(m => ({ default: m.CreditAnalyticsPage })));
const CustomerDetails = lazy(() => import("./pages/admin/CustomerDetails"));
const StockAlertsPage = lazy(() => import("./pages/tenant-admin/StockAlertsPage"));
const InventoryTransfersPage = lazy(() => import("./pages/tenant-admin/InventoryTransfersPage"));
const InventoryAuditPage = lazy(() => import("./pages/admin/InventoryAudit"));
const CustomerAnalyticsPage = lazy(() => import("./pages/tenant-admin/CustomerAnalyticsPage"));
const AdvancedAnalyticsPage = lazy(() => import("./pages/tenant-admin/AdvancedAnalyticsPage"));
const RealtimeDashboardPage = lazy(() => import("./pages/tenant-admin/RealtimeDashboardPage"));
const CustomReportsPage = lazy(() => import("./pages/tenant-admin/CustomReportsPage"));
const CommissionTrackingPage = lazy(() => import("./pages/tenant-admin/CommissionTrackingPage"));

// Marketplace Pages
const SellerProfilePage = lazy(() => import("./pages/tenant-admin/marketplace/SellerProfilePage"));
const MyListingsPage = lazy(() => import("./pages/tenant-admin/marketplace/MyListingsPage"));
const ListingForm = lazy(() => import("./pages/tenant-admin/marketplace/ListingForm").then(m => ({ default: m.ListingForm })));
const ListingDetailPage = lazy(() => import("./pages/tenant-admin/marketplace/ListingDetailPage"));
const MarketplaceOrdersPage = lazy(() => import("./pages/admin/marketplace/OrdersPage"));
const OrderDetailPage = lazy(() => import("./pages/admin/marketplace/OrderDetailPage"));
const MarketplaceBrowsePage = lazy(() => import("./pages/tenant-admin/marketplace/MarketplaceBrowsePage"));
const MarketplaceProductDetailPage = lazy(() => import("./pages/tenant-admin/marketplace/MarketplaceProductDetailPage"));
const MarketplaceCartPage = lazy(() => import("./pages/tenant-admin/marketplace/MarketplaceCartPage"));
const MarketplacePurchasesPage = lazy(() => import('@/pages/tenant-admin/marketplace/MarketplacePurchasesPage'));
const PurchaseOrderDetailPage = lazy(() => import('@/pages/tenant-admin/marketplace/PurchaseOrderDetailPage'));
const VendorPayoutsPage = lazy(() => import('@/pages/tenant-admin/marketplace/VendorPayoutsPage'));
const MessagesPage = lazy(() => import("./pages/tenant-admin/marketplace/MessagesPage"));

// Platform Admin Routes
const PlatformAdminLayout = lazy(() => import('@/layouts/PlatformAdminLayout'));
const AllTenantsPage = lazy(() => import('@/pages/platform-admin/AllTenantsPage'));
// const CommissionTrackingPage = lazy(() => import('@/pages/platform-admin/CommissionTrackingPage'));
const DesignSystemPage = lazy(() => import('@/pages/platform-admin/DesignSystemPage'));

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

const PlatformPayoutsPage = lazy(() => import("@/pages/platform-admin/PlatformPayoutsPage"));

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
// const OrdersListPage = lazy(() => import("./pages/customer/OrdersListPage")); // Available for future use
const SecureMenuAccess = lazy(() => import("./pages/customer/SecureMenuAccess").then(m => ({ default: m.SecureMenuAccess })));
const SecureMenuView = lazy(() => import("./pages/customer/SecureMenuView"));
const WholesaleMarketplacePage = lazy(() => import("./pages/customer/WholesaleMarketplacePage"));
const WholesaleCartPage = lazy(() => import("./pages/customer/WholesaleCartPage"));
const WholesaleCheckoutPage = lazy(() => import("./pages/customer/WholesaleCheckoutPage"));
const CustomerWholesaleOrdersPage = lazy(() => import("./pages/customer/WholesaleOrdersPage"));
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

// Auth Callback Pages
const TenantAdminAuthCallback = lazy(() => import("./pages/auth/AuthCallbackPage").then(m => ({ default: m.TenantAdminAuthCallback })));
const SuperAdminAuthCallback = lazy(() => import("./pages/auth/AuthCallbackPage").then(m => ({ default: m.SuperAdminAuthCallback })));
const CustomerAuthCallback = lazy(() => import("./pages/auth/AuthCallbackPage").then(m => ({ default: m.CustomerAuthCallback })));
const MFAChallengePage = lazy(() => import("./pages/auth/MFAChallengePage"));
const AuthConfirmPage = lazy(() => import("./pages/auth/AuthConfirmPage"));
const SecureAccountPage = lazy(() => import("./pages/auth/SecureAccountPage").then(m => ({ default: m.SecureAccountPage })));

// Feature Pages (Marketing)
import FeatureCompliancePage from "./pages/features/CompliancePage";
import FeatureLogisticsPage from "./pages/features/LogisticsPage";
import FeatureEcommercePage from "./pages/features/EcommercePage";

// Use the singleton QueryClient from centralized config
const queryClient = appQueryClient;

// Setup global error handlers
setupGlobalErrorHandlers();

const MobileTestPage = lazy(() => import("@/pages/mobile/MobileTestPage"));

const App = () => {
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
    initializeGlobalButtonMonitoring();
  }, []);

  // Initialize performance monitoring (Core Web Vitals)
  useEffect(() => {
    PerformanceMonitor.init();

    // Log performance report in development
    if (import.meta.env.DEV) {
      const reportTimer = setTimeout(() => {
        logger.info(PerformanceMonitor.getReport());
      }, 5000);
      return () => clearTimeout(reportTimer);
    }

    return () => PerformanceMonitor.disconnect();
  }, []);

  // Run route audit on startup (dev mode only)
  useEffect(() => {
    if (import.meta.env.DEV) {
      // Audit all sidebar configurations
      runRouteAudit(STARTER_SIDEBAR);
      runRouteAudit(PROFESSIONAL_SIDEBAR);
      runRouteAudit(ENTERPRISE_SIDEBAR);
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
      <Analytics />
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
                                  <UpdateBanner />
                                  <InstallPWA />
                                  <DeviceTracker />

                                  <Sonner />
                                  <Suspense fallback={<SuspenseProgressFallback />}>
                                    <UrlEncodingFixer />
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

                                      {/* Encrypted Store Link (Private Shareable) */}
                                      <Route path="/s/:token" element={<EncryptedStorePage />} />

                                      {/* White-Label Shop (Customer Storefront) */}
                                      <Route path="/shop/:storeSlug" element={<ShopLayout />}>
                                        <Route index element={<ShopStorefrontPage />} />
                                        <Route path="products" element={<ShopProductCatalogPage />} />
                                        <Route path="products/:productId" element={<ShopProductDetailPage />} />
                                        {/* SEO-friendly slug-based product URLs */}
                                        <Route path="product/:productSlug" element={<ShopProductDetailPage />} />
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
                                      {/* Handle encoded URLs with %3F - React Router doesn't match encoded chars */}
                                      <Route path="/select-plan%3Ftenant_id/*" element={<EncodedUrlRedirect />} />
                                      <Route path="/select-plan%3F/*" element={<EncodedUrlRedirect />} />
                                      <Route path="/saas/login" element={<PublicOnlyRoute portal="saas"><SaasLoginPage /></PublicOnlyRoute>} />
                                      <Route path="/verify-email" element={<VerifyEmailPage />} />
                                      <Route path="/signup-success" element={<SignupSuccessPage />} />
                                      <Route path="/auth/confirm" element={<AuthConfirmPage />} />
                                      <Route path="/auth/secure-account" element={<SecureAccountPage />} />


                                      {/* Redirect admin routes without tenant slug - go directly to business login */}
                                      <Route path="/admin/*" element={<Navigate to="/saas/login" replace />} />

                                      {/* Invitation Acceptance */}
                                      <Route path="/invite/:token" element={<InvitationAcceptPage />} />

                                      {/* Public Menu Access */}
                                      <Route path="/m/:token" element={<SecureMenuAccess />} />
                                      <Route path="/m/:token/view" element={<SecureMenuView />} />
                                      <Route path="/menu/:token" element={<MenuAccess />} />

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

                                        <Route path="analytics-hub" element={<FeatureProtectedRoute featureId="analytics"><AnalyticsHubPage /></FeatureProtectedRoute>} />
                                        <Route path="analytics/comprehensive" element={<FeatureProtectedRoute featureId="analytics"><AnalyticsPage /></FeatureProtectedRoute>} />
                                        <Route path="disposable-menus" element={<FeatureProtectedRoute featureId="disposable-menus"><DisposableMenus /></FeatureProtectedRoute>} />
                                        <Route path="menu-migration" element={<FeatureProtectedRoute featureId="menu-migration"><MenuMigration /></FeatureProtectedRoute>} />
                                        <Route path="orders" element={<FeatureProtectedRoute featureId="basic-orders"><OrdersHubPage /></FeatureProtectedRoute>} />

                                        {/* Orders Hub Redirects */}
                                        <Route path="disposable-menu-orders" element={<Navigate to="orders?tab=menu" replace />} />
                                        <Route path="disposable-menu-analytics" element={<FeatureProtectedRoute featureId="disposable-menu-analytics"><DisposableMenuAnalytics /></FeatureProtectedRoute>} />
                                        <Route path="menu-analytics" element={<FeatureProtectedRoute featureId="menu-analytics"><MenuAnalytics /></FeatureProtectedRoute>} />

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
                                        <Route path="wholesale-orders/new-po" element={<FeatureProtectedRoute featureId="wholesale-orders"><NewPurchaseOrder /></FeatureProtectedRoute>} />
                                        <Route path="orders/offline-create" element={<OfflineOrderCreate />} />

                                        <Route path="inventory-hub" element={<FeatureProtectedRoute featureId="inventory-dashboard"><InventoryHubPage /></FeatureProtectedRoute>} />
                                        <Route path="inventory-dashboard" element={<Navigate to="inventory-hub?tab=stock" replace />} />
                                        <Route path="inventory-monitoring" element={<Navigate to="inventory-hub?tab=monitoring" replace />} />
                                        <Route path="reports" element={<FeatureProtectedRoute featureId="reports"><ReportsPage /></FeatureProtectedRoute>} />
                                        {/* Billing redirects to Settings */}
                                        <Route path="billing" element={<Navigate to="../settings?section=billing" replace />} />
                                        {/* Credit Routes */}
                                        <Route path="credits/analytics" element={<CreditAnalyticsPage />} />
                                        <Route path="credits/success" element={<CreditPurchaseSuccessPage />} />
                                        <Route path="credits/cancelled" element={<CreditPurchaseCancelledPage />} />
                                        <Route path="settings" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><FeatureProtectedRoute featureId="settings"><TenantAdminSettingsPage /></FeatureProtectedRoute></RoleProtectedRoute>} />
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

                                        {/* Marketplace (Buyer & Seller) */}
                                        <Route path="marketplace/listings" element={<MyListingsPage />} />
                                        <Route path="marketplace/listings/new" element={<ListingForm />} />
                                        <Route path="marketplace/listings/:id" element={<ListingForm />} />

                                        <Route path="marketplace/profile" element={<SellerProfilePage />} />

                                        {/* Marketplace Buyer Routes */}
                                        <Route path="marketplace/browse" element={<MarketplaceBrowsePage />} />
                                        <Route path="marketplace/product/:productId" element={<MarketplaceProductDetailPage />} />
                                        <Route path="marketplace/cart" element={<MarketplaceCartPage />} />
                                        <Route path="marketplace/purchases" element={<MarketplacePurchasesPage />} />
                                        <Route path="marketplace/purchases/:orderId" element={<PurchaseOrderDetailPage />} />

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
                                        <Route path="storefront/settings" element={<Navigate to="../storefront?tab=settings" replace />} />


                                        {/* Marketplace Admin (B2C) */}
                                        <Route path="marketplace" element={<FeatureProtectedRoute featureId="marketplace"><MarketplaceDashboard /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/settings" element={<FeatureProtectedRoute featureId="marketplace"><StoreSettings /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/products" element={<FeatureProtectedRoute featureId="marketplace"><ProductVisibilityManager /></FeatureProtectedRoute>} />
                                        <Route path="marketplace/coupons" element={<FeatureProtectedRoute featureId="marketplace"><CouponManager /></FeatureProtectedRoute>} />
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
                                        <Route path="fleet-management" element={<Navigate to="fulfillment-hub?tab=fleet" replace />} />
                                        <Route path="delivery-hub" element={<Navigate to="fulfillment-hub" replace />} />
                                        <Route path="fulfillment-hub" element={<FeatureProtectedRoute featureId="delivery-management"><FulfillmentHubPage /></FeatureProtectedRoute>} />
                                        <Route path="finance-hub" element={<FeatureProtectedRoute featureId="financial-center"><FinanceHubPage /></FeatureProtectedRoute>} />
                                        <Route path="settings-hub" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><FeatureProtectedRoute featureId="settings"><SettingsHubPage /></FeatureProtectedRoute></RoleProtectedRoute>} />
                                        <Route path="integrations-hub" element={<Navigate to="settings-hub?tab=integrations" replace />} />
                                        <Route path="storefront-hub" element={<FeatureProtectedRoute featureId="storefront"><StorefrontHubPage /></FeatureProtectedRoute>} />
                                        <Route path="operations-hub" element={<FeatureProtectedRoute featureId="suppliers"><OperationsHubPage /></FeatureProtectedRoute>} />
                                        <Route path="compliance-hub" element={<Navigate to="operations-hub?tab=compliance" replace />} />
                                        <Route path="marketing-hub" element={<FeatureProtectedRoute featureId="loyalty-program"><MarketingHubPage /></FeatureProtectedRoute>} />
                                        <Route path="marketing/reviews" element={<FeatureProtectedRoute featureId="storefront"><ReviewsPage /></FeatureProtectedRoute>} />
                                        <Route path="delivery-management" element={<Navigate to="operations-hub?tab=delivery" replace />} />
                                        <Route path="live-map" element={<FeatureProtectedRoute featureId="live-map"><LiveMap /></FeatureProtectedRoute>} />
                                        <Route path="gps-tracking" element={<FeatureProtectedRoute featureId="fleet-management"><RunnerLocationTracking /></FeatureProtectedRoute>} />
                                        <Route path="pos-system" element={<FeatureProtectedRoute featureId="pos-system"><POSHubPage /></FeatureProtectedRoute>} />
                                        <Route path="locations" element={<FeatureProtectedRoute featureId="locations"><LocationsManagement /></FeatureProtectedRoute>} />
                                        <Route path="locations/warehouses" element={<FeatureProtectedRoute featureId="locations"><WarehousesPage /></FeatureProtectedRoute>} />
                                        <Route path="locations/runners" element={<FeatureProtectedRoute featureId="locations"><RunnersPage /></FeatureProtectedRoute>} />
                                        <Route path="sales/pricing" element={<FeatureProtectedRoute featureId="sales"><AdminPricingPage /></FeatureProtectedRoute>} />

                                        {/* 13 Hidden gem pages */}
                                        <Route path="live-chat" element={<FeatureProtectedRoute featureId="live-chat"><AdminLiveChat /></FeatureProtectedRoute>} />
                                        <Route path="notifications" element={<FeatureProtectedRoute featureId="notifications"><AdminNotifications /></FeatureProtectedRoute>} />
                                        <Route path="couriers" element={<Navigate to="operations-hub?tab=delivery" replace />} />
                                        <Route path="customer-details" element={<FeatureProtectedRoute featureId="customer-details"><CustomerDetails /></FeatureProtectedRoute>} />
                                        <Route path="customer-reports" element={<FeatureProtectedRoute featureId="customer-reports"><CustomerReports /></FeatureProtectedRoute>} />
                                        <Route path="delivery-tracking" element={<Navigate to="operations-hub?tab=delivery" replace />} />
                                        <Route path="delivery-zones" element={<FeatureProtectedRoute featureId="delivery-management"><DeliveryZonesPage /></FeatureProtectedRoute>} />
                                        <Route path="dispatch-inventory" element={<FeatureProtectedRoute featureId="dispatch-inventory"><DispatchInventory /></FeatureProtectedRoute>} />
                                        <Route path="financial-center" element={<Navigate to="command-center" replace />} />
                                        <Route path="fronted-inventory-analytics" element={<FeatureProtectedRoute featureId="fronted-inventory-analytics"><FrontedInventoryAnalytics /></FeatureProtectedRoute>} />
                                        <Route path="global-search" element={<FeatureProtectedRoute featureId="global-search"><GlobalSearch /></FeatureProtectedRoute>} />
                                        <Route path="suppliers" element={<Navigate to="operations-hub?tab=suppliers" replace />} />
                                        <Route path="purchase-orders" element={<FeatureProtectedRoute featureId="suppliers"><PurchaseOrders /></FeatureProtectedRoute>} />
                                        <Route path="returns" element={<Navigate to="operations-hub?tab=returns" replace />} />
                                        <Route path="loyalty-program" element={<Navigate to="marketing-hub?tab=loyalty" replace />} />
                                        <Route path="coupons" element={<Navigate to="marketing-hub?tab=coupons" replace />} />
                                        <Route path="quality-control" element={<Navigate to="operations-hub?tab=quality" replace />} />
                                        <Route path="customer-crm" element={<Navigate to="customer-hub?tab=crm" replace />} />
                                        <Route path="crm/clients" element={<FeatureProtectedRoute featureId="customer-crm"><ClientsPage /></FeatureProtectedRoute>} />
                                        <Route path="crm/clients/:clientId" element={<FeatureProtectedRoute featureId="customer-crm"><ClientDetailPage /></FeatureProtectedRoute>} />
                                        <Route path="crm/invoices" element={<FeatureProtectedRoute featureId="customer-crm"><InvoicesPage /></FeatureProtectedRoute>} />
                                        <Route path="crm/invoices/new" element={<FeatureProtectedRoute featureId="customer-crm"><CreateInvoicePage /></FeatureProtectedRoute>} />
                                        <Route path="crm/invoices/:invoiceId" element={<FeatureProtectedRoute featureId="customer-crm"><InvoiceDetailPage /></FeatureProtectedRoute>} />
                                        <Route path="crm/pre-orders" element={<Navigate to="orders?tab=preorders" replace />} />
                                        <Route path="crm/pre-orders/new" element={<FeatureProtectedRoute featureId="customer-crm"><CreatePreOrderPage /></FeatureProtectedRoute>} />
                                        <Route path="crm/pre-orders/:preOrderId" element={<FeatureProtectedRoute featureId="customer-crm"><PreOrderDetailPage /></FeatureProtectedRoute>} />
                                        <Route path="crm/settings" element={<FeatureProtectedRoute featureId="customer-crm"><CRMSettingsPage /></FeatureProtectedRoute>} />
                                        <Route path="crm/invites" element={<FeatureProtectedRoute featureId="customer-crm"><InvitesPage /></FeatureProtectedRoute>} />
                                        <Route path="marketing-automation" element={<Navigate to="marketing-hub?tab=campaigns" replace />} />
                                        <Route path="appointments" element={<Navigate to="operations-hub?tab=appointments" replace />} />
                                        <Route path="support-tickets" element={<Navigate to="operations-hub?tab=support" replace />} />
                                        <Route path="batch-recall" element={<Navigate to="compliance-hub?tab=batch-recall" replace />} />
                                        <Route path="compliance-vault" element={<Navigate to="compliance-hub?tab=vault" replace />} />
                                        <Route path="compliance" element={<Navigate to="compliance-hub" replace />} />
                                        <Route path="advanced-reporting" element={<FeatureProtectedRoute featureId="advanced-reporting"><AdvancedReportingPage /></FeatureProtectedRoute>} />
                                        <Route path="predictive-analytics" element={<Navigate to="analytics-hub?tab=forecasting" replace />} />
                                        <Route path="board-report" element={<BoardReportPage />} />
                                        <Route path="strategic-dashboard" element={<StrategicDashboardPage />} />
                                        <Route path="expansion" element={<ExpansionAnalysisPage />} />

                                        {/* Professional Tier - Analytics */}
                                        <Route path="order-analytics" element={<FeatureProtectedRoute featureId="order-analytics"><OrderAnalyticsPage /></FeatureProtectedRoute>} />
                                        <Route path="sales-dashboard" element={<FeatureProtectedRoute featureId="sales-dashboard"><SalesDashboardPage /></FeatureProtectedRoute>} />
                                        <Route path="customer-insights" element={<Navigate to="customer-hub?tab=insights" replace />} />

                                        {/* Additional routes that don't need FeatureProtectedRoute or need different paths */}
                                        <Route path="risk-management" element={<FeatureProtectedRoute featureId="risk-management"><RiskFactorManagement /></FeatureProtectedRoute>} />
                                        <Route path="system-settings" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><FeatureProtectedRoute featureId="system-settings"><SystemSettings /></FeatureProtectedRoute></RoleProtectedRoute>} />
                                        <Route path="vendor-management" element={<FeatureProtectedRoute featureId="vendor-management"><VendorManagement /></FeatureProtectedRoute>} />
                                        <Route path="vendor-dashboard" element={<FeatureProtectedRoute featureId="vendor-management"><VendorDashboard /></FeatureProtectedRoute>} />

                                        {/* Coming Soon Pages - Professional & Enterprise Features */}
                                        <Route path="stock-alerts" element={<FeatureProtectedRoute featureId="stock-alerts"><StockAlertsPage /></FeatureProtectedRoute>} />
                                        <Route path="inventory-transfers" element={<FeatureProtectedRoute featureId="inventory-transfers"><InventoryTransfersPage /></FeatureProtectedRoute>} />
                                        <Route path="inventory-audit" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><InventoryAuditPage /></RoleProtectedRoute>} />
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
                                        <Route path="role-management" element={<RoleProtectedRoute allowedRoles={['owner', 'admin']}><FeatureProtectedRoute featureId="role-management"><RoleManagement /></FeatureProtectedRoute></RoleProtectedRoute>} />
                                        <Route path="activity-logs" element={<RoleProtectedRoute allowedRoles={['owner', 'admin', 'manager']}><FeatureProtectedRoute featureId="activity-logs"><ActivityLogsPage /></FeatureProtectedRoute></RoleProtectedRoute>} />

                                        {/* GitHub Repos Integration Routes */}
                                        <Route path="analytics-dashboard" element={<FeatureProtectedRoute featureId="analytics"><AnalyticsPage /></FeatureProtectedRoute>} />
                                        <Route path="route-optimizer" element={<FeatureProtectedRoute featureId="route-optimization"><RouteOptimizationPage /></FeatureProtectedRoute>} />
                                        <Route path="wholesale-pricing-tiers" element={<PricingTiersPage />} />
                                        <Route path="advanced-invoice" element={<FeatureProtectedRoute featureId="invoice-management"><AdvancedInvoicePage /></FeatureProtectedRoute>} />
                                        <Route path="local-ai" element={<FeatureProtectedRoute featureId="ai"><LocalAIPage /></FeatureProtectedRoute>} />
                                        <Route path="workflow-automation" element={<FeatureProtectedRoute featureId="automation"><WorkflowAutomationPage /></FeatureProtectedRoute>} />
                                        <Route path="location-analytics" element={<FeatureProtectedRoute featureId="location-analytics"><LocationAnalyticsPage /></FeatureProtectedRoute>} />
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

                                      {/* Catch-all route for /admin/* paths without tenant slug - go directly to business login */}
                                      <Route path="/admin/*" element={<Navigate to="/saas/login" replace />} />

                                      {/* ==================== COURIER PORTAL ==================== */}
                                      <Route path="/courier/login" element={<CourierLoginPage />} />
                                      <Route
                                        path="/courier/*"
                                        element={
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
                                      <Route path="/:tenantSlug/customer/auth/callback" element={<CustomerAuthCallback />} />
                                      <Route path="/:tenantSlug/customer/auth/mfa-challenge" element={<MFAChallengePage portal="customer" />} />
                                      <Route path="/:tenantSlug/shop/login" element={<CustomerLoginPage />} />
                                      <Route path="/:tenantSlug/shop/reset/:token" element={<PasswordResetPage />} />
                                      {/* Public Routes */}
                                      <Route path="/portal/invoice/:token" element={<InvoicePublicPage />} />
                                      <Route path="/track" element={<DeliveryTrackingPage />} />
                                      <Route path="/track/:trackingCode" element={<DeliveryTrackingPage />} />
                                      <Route path="/:tenantSlug/shop" element={
                                        <ErrorBoundary title="Shop Unavailable" description="We encountered an error loading the shop. Please try refreshing the page.">
                                          <CustomerProtectedRoute><CustomerPortal /></CustomerProtectedRoute>
                                        </ErrorBoundary>
                                      }>
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
                                      {/* Component renamed to avoid duplicate import */}
                                      <Route path="/:tenantSlug/shop/wholesale/orders" element={<CustomerProtectedRoute><CustomerWholesaleOrdersPage /></CustomerProtectedRoute>} />
                                      <Route path="/:tenantSlug/shop/wholesale/orders/:orderId" element={<CustomerProtectedRoute><WholesaleOrderDetailPage /></CustomerProtectedRoute>} />

                                      {/* ==================== VENDOR PORTAL (External Access) ==================== */}
                                      <Route
                                        path="/vendor/*"
                                        element={
                                          <ErrorBoundary title="Vendor Portal Unavailable" description="We encountered an error loading the vendor portal. Please try refreshing the page.">
                                            <VendorAuthProvider>
                                              <Routes>
                                                <Route path="login" element={<VendorLoginPage />} />
                                                <Route path="dashboard" element={<ProtectedVendorRoute><VendorDashboardPage /></ProtectedVendorRoute>} />
                                                <Route path="order/:orderId" element={<ProtectedVendorRoute><VendorOrderDetailPage /></ProtectedVendorRoute>} />
                                              </Routes>
                                            </VendorAuthProvider>
                                          </ErrorBoundary>
                                        }
                                      />

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
                            </CreditProvider>
                          </CustomerAuthProvider>
                          {/* Debug Panel - Only visible to admins or in development */}
                          <AdminDebugPanel />
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
