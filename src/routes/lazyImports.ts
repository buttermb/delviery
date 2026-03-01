/**
 * Lazy-loaded page imports for the application router.
 * Extracted from App.tsx to reduce monolith size.
 */
import { lazy } from "react";
import { lazyWithRetry } from "@/utils/lazyWithRetry";

// Eager-loaded critical pages
export { default as NotFoundPage } from "@/pages/NotFoundPage";

// Admin shell
export const AdminNotFoundPage = lazy(() => import("@/pages/admin/AdminNotFoundPage"));
export const ButtonMonitorPage = lazy(() => import("@/pages/debug/ButtonMonitorPage"));

// ─── Marketing & Public ─────────────────────────────────────────────────────
export const MarketingHome = lazy(() => import("@/pages/MarketingHome"));
export const PricingPage = lazy(() => import("@/pages/PricingPage"));
export const Contact = lazy(() => import("@/pages/Contact"));
export const Features = lazy(() => import("@/pages/Features"));
export const FAQPage = lazy(() => import("@/pages/FAQPage"));
export const SupportPage = lazy(() => import("@/pages/SupportPage"));
export const TermsPage = lazy(() => import("@/pages/TermsPage"));
export const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
export const About = lazy(() => import("@/pages/About"));
export const InteractiveDemoPage = lazy(() => import("@/pages/InteractiveDemoPage"));
export const DemoRequest = lazy(() => import("@/pages/DemoRequest"));
export const DemoConfirmation = lazy(() => import("@/pages/DemoConfirmation"));
export const IntegrationsPage = lazy(() => import("@/pages/IntegrationsPage"));
export const DocsPage = lazy(() => import("@/pages/DocsPage"));
export const GettingStartedPage = lazy(() => import("@/pages/docs/GettingStartedPage"));
export const ApiReferencePage = lazy(() => import("@/pages/docs/ApiReferencePage"));
export const AuthenticationPage = lazy(() => import("@/pages/docs/AuthenticationPage"));
export const SecurityDocsPage = lazy(() => import("@/pages/docs/SecurityPage"));
export const StatusPage = lazy(() => import("@/pages/StatusPage"));
export const Careers = lazy(() => import("@/pages/Careers"));
export const Press = lazy(() => import("@/pages/Press"));
export const Blog = lazy(() => import("@/pages/Blog"));
export const Security = lazy(() => import("@/pages/Security"));
export const Cookie = lazy(() => import("@/pages/Cookie"));
export const LoginDirectory = lazy(() => import("@/pages/LoginDirectory"));
export const PublicMarketplacePage = lazy(() => import("@/pages/marketplace/PublicMarketplacePage"));
export const PublicListingDetailPage = lazy(() => import("@/pages/marketplace/PublicListingDetailPage"));
export const ClientPortalPage = lazy(() => import("@/pages/customer/ClientPortalPage"));

// ─── Super Admin ─────────────────────────────────────────────────────────────
export const SuperAdminLoginPage = lazy(() => import("@/pages/super-admin/LoginPage"));
export const SuperAdminDashboardPage = lazy(() => import("@/pages/super-admin/DashboardPage"));
export const SuperAdminTenantsListPage = lazy(() => import("@/pages/super-admin/TenantsListPage"));
export const SuperAdminCreateTenantPage = lazy(() => import("@/pages/super-admin/CreateTenantPage"));
export const SuperAdminTenantDetailPage = lazy(() => import("@/pages/super-admin/TenantDetailPage"));
export const SuperAdminSettingsPage = lazy(() => import("@/pages/super-admin/SettingsPage"));
export const SuperAdminMonitoringPage = lazy(() => import("@/pages/super-admin/MonitoringPage"));
export const SuperAdminAnalyticsPage = lazy(() => import("@/pages/super-admin/AnalyticsPage"));
export const SuperAdminDataExplorerPage = lazy(() => import("@/pages/super-admin/DataExplorerPage"));
export const SuperAdminAPIUsagePage = lazy(() => import("@/pages/super-admin/APIUsagePage"));
export const SuperAdminAuditLogsPage = lazy(() => import("@/pages/super-admin/AuditLogsPage"));
export const SuperAdminRevenueAnalyticsPage = lazy(() => import("@/pages/super-admin/RevenueAnalyticsPage"));
export const SuperAdminReportBuilderPage = lazy(() => import("@/pages/super-admin/ReportBuilderPage"));
export const SuperAdminExecutiveDashboardPage = lazy(() => import("@/pages/super-admin/ExecutiveDashboardPage"));
export const SuperAdminWorkflowsPage = lazy(() => import("@/pages/super-admin/WorkflowsPage"));
export const SuperAdminCommunicationPage = lazy(() => import("@/pages/super-admin/CommunicationPage"));
export const SuperAdminFeatureFlagsPage = lazy(() => import("@/pages/super-admin/FeatureFlagsPage"));
export const SuperAdminSystemConfigPage = lazy(() => import("@/pages/super-admin/SystemConfigPage"));
export const SuperAdminSecurityPage = lazy(() => import("@/pages/super-admin/SecurityPage"));
export const ForumApprovalsPage = lazy(() => import("@/pages/super-admin/ForumApprovalsPage"));
export const AdminUsersPage = lazy(() => import("@/pages/super-admin/AdminUsersPage"));
export const SuperAdminToolsPage = lazy(() => import("@/pages/super-admin/ToolsPage"));
export const MarketplaceModerationPage = lazy(() => import("@/pages/super-admin/MarketplaceModerationPage"));

// Super Admin Credit Management
export const SuperAdminCreditsOverviewPage = lazy(() => import("@/pages/super-admin/CreditsOverviewPage"));
export const SuperAdminTenantCreditsPage = lazy(() => import("@/pages/super-admin/TenantCreditsPage"));
export const SuperAdminCreditAuditLogPage = lazy(() => import("@/pages/super-admin/CreditAuditLogPage"));
export const SuperAdminPromoCodeManagementPage = lazy(() => import("@/pages/super-admin/PromoCodeManagementPage"));
export const SuperAdminCreditPackagesPage = lazy(() => import("@/pages/super-admin/CreditPackagesPage"));
export const SuperAdminCreditAnalyticsPage = lazy(() => import("@/pages/super-admin/CreditAnalyticsPage"));
export const SuperAdminReferralManagementPage = lazy(() => import("@/pages/super-admin/ReferralManagementPage"));
export const SuperAdminProtectedRouteNew = lazy(() => import("@/components/auth/SuperAdminProtectedRoute").then(m => ({ default: m.SuperAdminProtectedRoute })));
export const SuperAdminLayout = lazyWithRetry(() => import("@/layouts/SuperAdminLayout").then(m => ({ default: m.SuperAdminLayout })));

// ─── SaaS Auth ───────────────────────────────────────────────────────────────
export const SignUpPage = lazyWithRetry(() => import("@/pages/saas/SignUpPage"));
export const SelectPlanPage = lazyWithRetry(() => import("@/pages/saas/SelectPlanPage"));
export const SaasLoginPage = lazyWithRetry(() => import("@/pages/saas/LoginPage").then(m => ({ default: m.LoginPage })));
export const VerifyEmailPage = lazyWithRetry(() => import("@/pages/saas/VerifyEmailPage"));

export const TenantAdminWelcomePage = lazy(() => import("@/pages/tenant-admin/WelcomePage"));
export const SetupWizardPage = lazy(() => import("@/pages/admin/SetupWizardPage"));
export const TenantAdminVerifyEmailPage = lazy(() => import("@/pages/tenant-admin/VerifyEmailPage"));
export const PasswordResetPage = lazy(() => import("@/pages/auth/PasswordResetPage").then(m => ({ default: m.PasswordResetPage })));
export const SignupSuccessPage = lazy(() => import("@/pages/auth/SignupSuccessPage").then(m => ({ default: m.SignupSuccessPage })));
export const AccountSettingsPage = lazy(() => import("@/pages/auth/AccountSettingsPage").then(m => ({ default: m.AccountSettingsPage })));
export const ChangePasswordPage = lazy(() => import("@/pages/auth/ChangePasswordPage").then(m => ({ default: m.ChangePasswordPage })));

// ─── Tenant Admin ────────────────────────────────────────────────────────────
export const TenantAdminLoginPage = lazy(() => import("@/pages/tenant-admin/LoginPage"));
export const TenantAdminProtectedRoute = lazy(() => import("@/components/auth/TenantAdminProtectedRoute").then(m => ({ default: m.TenantAdminProtectedRoute })));
export const AdminLayout = lazyWithRetry(() => import("@/pages/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));
export const TenantAdminDashboardPage = lazy(() => import("@/pages/tenant-admin/DashboardPage"));
export const HotboxPage = lazy(() => import("@/pages/admin/HotboxPage"));
export const FinancialCommandCenterPage = lazy(() => import("@/pages/admin/FinancialCommandCenter"));
export const CollectionModePage = lazy(() => import("@/pages/admin/CollectionMode"));
export const TenantAdminSelectPlanPage = lazy(() => import("@/pages/tenant-admin/SelectPlanPage"));
export const TrialExpiredPage = lazy(() => import("@/pages/tenant-admin/TrialExpired"));
export const HelpPage = lazy(() => import("@/pages/HelpPage"));
export const HelpHubPage = lazy(() => import("@/pages/admin/hubs/HelpHubPage"));

// Tenant Admin Feature Pages
export const DisposableMenus = lazy(() => import("@/pages/admin/DisposableMenus"));
export const DisposableMenuAnalytics = lazy(() => import("@/pages/admin/DisposableMenuAnalytics"));
export const MenuAnalytics = lazy(() => import("@/pages/admin/MenuAnalytics"));
export const MenuMigration = lazy(() => import("@/pages/admin/MenuMigration").then(m => ({ default: m.MenuMigration })));
export const ClientDetail = lazy(() => import("@/pages/admin/ClientDetail"));
export const GenerateBarcodes = lazy(() => import("@/pages/admin/GenerateBarcodes"));
export const NewWholesaleOrder = lazy(() => import("@/pages/admin/NewWholesaleOrder"));
export const NewPurchaseOrder = lazy(() => import("@/pages/admin/NewPurchaseOrder"));
export const OfflineOrderCreate = lazy(() => import("@/pages/admin/OfflineOrderCreate"));
export const ReportsPage = lazy(() => import("@/pages/admin/ReportsPage"));
export const BoardReportPage = lazy(() => import("@/pages/admin/BoardReportPage"));
export const StrategicDashboardPage = lazy(() => import("@/pages/admin/StrategicDashboardPage"));
export const ExpansionAnalysisPage = lazy(() => import("@/pages/admin/ExpansionAnalysisPage"));
export const TeamManagement = lazy(() => import("@/pages/admin/TeamManagement"));
export const FrontedInventory = lazy(() => import("@/pages/admin/FrontedInventory"));
export const FrontedInventoryDetails = lazy(() => import("@/pages/admin/FrontedInventoryDetails"));
export const CustomerInvoices = lazy(() => import("@/pages/admin/CustomerInvoices"));
export const RunnerLocationTracking = lazy(() => import("@/pages/admin/RunnerLocationTracking"));
export const LiveMap = lazy(() => import("@/pages/admin/LiveMap"));
export const LocationsManagement = lazy(() => import("@/pages/admin/LocationsManagement"));
export const AdminLiveChat = lazy(() => import("@/pages/admin/AdminLiveChat"));
export const AdminNotifications = lazy(() => import("@/pages/admin/AdminNotifications"));
export const OrderAnalyticsPage = lazy(() => import("@/pages/tenant-admin/OrderAnalyticsPage"));
export const SalesDashboardPage = lazy(() => import("@/pages/tenant-admin/SalesDashboardPage"));
export const CustomerReports = lazy(() => import("@/pages/admin/CustomerReports"));
export const DispatchInventory = lazy(() => import("@/pages/admin/DispatchInventory"));
export const FrontedInventoryAnalytics = lazy(() => import("@/pages/admin/FrontedInventoryAnalytics"));
export const ClientsPage = lazy(() => import("@/pages/admin/ClientsPage"));
export const ClientDetailPage = lazy(() => import("@/pages/admin/ClientDetailPage"));
export const InvoicesPage = lazy(() => import("@/pages/admin/InvoicesPage").then(m => ({ default: m.InvoicesPage })));
export const CreateInvoicePage = lazy(() => import("@/pages/admin/CreateInvoicePage"));
export const InvoiceDetailPage = lazy(() => import("@/pages/admin/InvoiceDetailPage"));
export const CreatePreOrderPage = lazy(() => import("@/pages/admin/CreatePreOrderPage"));
export const PreOrderDetailPage = lazy(() => import("@/pages/admin/PreOrderDetailPage"));
export const ProductDetailsPage = lazy(() => import("@/pages/admin/ProductDetailsPage"));
export const CRMSettingsPage = lazy(() => import("@/pages/admin/CRMSettingsPage"));
export const InvitesPage = lazy(() => import("@/pages/admin/InvitesPage"));
export const InvoicePublicPage = lazy(() => import("@/pages/portal/InvoicePublicPage"));
export const DeliveryTrackingPage = lazy(() => import("@/pages/portal/DeliveryTrackingPage"));
export const AdvancedReportingPage = lazy(() => import("@/pages/admin/AdvancedReportingPage"));
export const VendorLoginPage = lazy(() => import("@/pages/vendor/VendorLoginPage").then(m => ({ default: m.VendorLoginPage })));
export const VendorDashboardPage = lazy(() => import("@/pages/vendor/VendorDashboardPage"));
export const VendorOrderDetailPage = lazy(() => import("@/pages/vendor/VendorOrderDetailPage").then(m => ({ default: m.VendorOrderDetailPage })));
export const ProtectedVendorRoute = lazy(() => import("@/components/vendor/ProtectedVendorRoute"));
export const GlobalSearch = lazy(() => import("@/pages/admin/GlobalSearch"));
export const RiskFactorManagement = lazy(() => import("@/pages/admin/RiskFactorManagement"));
export const SystemSettings = lazy(() => import("@/pages/admin/SystemSettings"));
export const VendorManagement = lazy(() => import("@/pages/admin/VendorManagement").then(m => ({ default: m.VendorManagement })));
export const VendorDashboard = lazy(() => import("@/pages/admin/VendorDashboard"));
export const PurchaseOrders = lazy(() => import("@/pages/admin/PurchaseOrders"));
export const ImagesPage = lazy(() => import("@/pages/admin/catalog/ImagesPage"));
export const BatchesPage = lazy(() => import("@/pages/admin/catalog/BatchesPage"));
export const CategoriesPage = lazy(() => import("@/pages/admin/catalog/CategoriesPage"));
export const ReceivingPage = lazy(() => import("@/pages/admin/operations/ReceivingPage"));
export const WarehousesPage = lazy(() => import("@/pages/admin/locations/WarehousesPage"));
export const RunnersPage = lazy(() => import("@/pages/admin/locations/RunnersPage"));
export const AdminPricingPage = lazy(() => import("@/pages/admin/sales/PricingPage"));
export const PricingTiersPage = lazy(() => import("@/pages/admin/wholesale/PricingTiersPage"));
export const DeveloperTools = lazy(() => import("@/pages/admin/DeveloperTools"));
export const ButtonTester = lazy(() => import("@/pages/admin/ButtonTester"));
export const ReviewsPage = lazy(() => import("@/pages/admin/ReviewsPage"));
export const DeliveryZonesPage = lazy(() => import("@/pages/admin/DeliveryZones"));
export const AnalyticsPage = lazy(() => import("@/pages/admin/AnalyticsPage"));
export const AdvancedInvoicePage = lazy(() => import("@/pages/admin/AdvancedInvoicePage"));
export const LocalAIPage = lazy(() => import("@/pages/admin/LocalAIPage"));
export const WorkflowAutomationPage = lazy(() => import("@/pages/admin/WorkflowAutomationPage"));

// Marketplace Admin (B2C)
export const MarketplaceDashboard = lazy(() => import("@/pages/admin/marketplace/MarketplaceDashboard"));
export const StoreSettings = lazy(() => import("@/pages/admin/marketplace/StoreSettings"));
export const ProductVisibilityManager = lazy(() => import("@/pages/admin/marketplace/ProductVisibilityManager"));
export const CouponManager = lazy(() => import("@/pages/admin/marketplace/CouponManager"));
export const MarketplaceCategoryManager = lazy(() => import("@/pages/admin/marketplace/MarketplaceCategoryManager"));
export const ProductSyncPage = lazy(() => import("@/pages/admin/marketplace/ProductSyncPage"));

// Customer-Facing Shop Pages
export const ShopLayout = lazy(() => import("@/pages/shop/ShopLayout"));
export const ShopStorefrontPage = lazy(() => import("@/pages/shop/StorefrontPage"));
export const ShopProductCatalogPage = lazy(() => import("@/pages/shop/ProductCatalogPage").then(m => ({ default: m.ProductCatalogPage })));
export const ShopProductDetailPage = lazyWithRetry(() => import("@/pages/shop/ProductDetailPage").then(m => ({ default: m.ProductDetailPage })));
export const ShopCartPage = lazy(() => import("@/pages/shop/CartPage"));
export const ShopCheckoutPage = lazy(() => import("@/pages/shop/CheckoutPage"));
export const ShopOrderConfirmationPage = lazy(() => import("@/pages/shop/OrderConfirmationPage"));
export const ShopAccountPage = lazy(() => import("@/pages/shop/AccountPage"));
export const ShopOrderTrackingPage = lazy(() => import("@/pages/shop/OrderTrackingPage"));
export const ShopOrderDetailPage = lazy(() => import("@/pages/shop/OrderDetailPage").then(m => ({ default: m.OrderDetailPage })));
export const ShopDealsPage = lazy(() => import("@/pages/shop/DealsPage"));
export const SinglePageCheckout = lazy(() => import("@/components/shop/SinglePageCheckout"));
export const EncryptedStorePage = lazy(() => import("@/pages/shop/EncryptedStorePage"));
export const StoreLandingPage = lazy(() => import("@/pages/store/StoreLandingPage"));
export const StoreMenuPage = lazy(() => import("@/pages/store/StoreMenuPage"));
export const StoreProductPage = lazy(() => import("@/pages/store/StoreProductPage"));
export const RevenueReportsPage = lazy(() => import("@/pages/tenant-admin/RevenueReportsPage"));
export const RouteOptimizationPage = lazy(() => import("@/pages/tenant-admin/RouteOptimizationPage"));
export const DeliveryAnalyticsPage = lazy(() => import("@/pages/tenant-admin/DeliveryAnalyticsPage"));
export const CashRegisterPage = lazy(() => import("@/pages/tenant-admin/CashRegisterPage").then(m => ({ default: m.CashRegisterPage })));
export const POSAnalyticsPage = lazy(() => import("@/pages/tenant-admin/POSAnalyticsPage"));
export const POSShiftsPage = lazy(() => import("@/pages/tenant-admin/POSShiftsPage"));
export const ZReportPage = lazy(() => import("@/pages/tenant-admin/ZReportPage"));

// Hub Pages
export const POSHubPage = lazy(() => import("@/pages/admin/hubs/POSHubPage"));
export const OrdersHubPage = lazy(() => import("@/pages/admin/hubs/OrdersHubPage"));
export const OrderDetailsPage = lazy(() => import("@/pages/admin/OrderDetailsPage"));
export const InventoryHubPage = lazy(() => import("@/pages/admin/hubs/InventoryHubPage"));
export const CustomerHubPage = lazy(() => import("@/pages/admin/hubs/CustomerHubPage"));
export const AnalyticsHubPage = lazy(() => import("@/pages/admin/hubs/AnalyticsHubPage"));
export const SettingsHubPage = lazy(() => import("@/pages/admin/hubs/SettingsHubPage"));
export const FinanceHubPage = lazy(() => import("@/pages/admin/hubs/FinanceHubPage"));
export const StorefrontHubPage = lazy(() => import("@/pages/admin/hubs/StorefrontHubPage"));
export const OperationsHubPage = lazy(() => import("@/pages/admin/hubs/OperationsHubPage"));
export const FulfillmentHubPage = lazy(() => import("@/pages/admin/hubs/FulfillmentHubPage"));
export const DashboardHubPage = lazy(() => import("@/pages/admin/hubs/DashboardHubPage").then(m => ({ default: m.DashboardHubPage })));
export const SmartTVDashboard = lazy(() => import("@/pages/admin/SmartTVDashboard"));
export const MarketingHubPage = lazy(() => import("@/pages/admin/hubs/MarketingHubPage"));

// Tenant Admin Enterprise
export const RoleManagement = lazy(() => import("@/pages/admin/RoleManagement"));
export const ActivityLogsPage = lazy(() => import("@/pages/tenant-admin/ActivityLogsPage").then(m => ({ default: m.ActivityLogsPage })));
export const LocationAnalyticsPage = lazy(() => import("@/pages/tenant-admin/LocationAnalyticsPage"));
export const BulkOperationsPage = lazy(() => import("@/pages/tenant-admin/BulkOperationsPage"));
export const APIAccessPage = lazy(() => import("@/pages/tenant-admin/APIAccessPage"));
export const WebhooksPage = lazy(() => import("@/pages/tenant-admin/WebhooksPage"));
export const CustomIntegrationsPage = lazy(() => import("@/pages/tenant-admin/CustomIntegrationsPage"));
export const DataExportPage = lazy(() => import("@/pages/tenant-admin/DataExportPage"));
export const AuditTrailPage = lazy(() => import("@/pages/tenant-admin/AuditTrailPage"));
export const CompliancePage = lazy(() => import("@/pages/tenant-admin/CompliancePage"));
export const WhiteLabelPage = lazy(() => import("@/pages/tenant-admin/WhiteLabelPage"));
export const CustomDomainPage = lazy(() => import("@/pages/tenant-admin/CustomDomainPage"));
export const PrioritySupportPage = lazy(() => import("@/pages/tenant-admin/PrioritySupportPage"));
export const CreditPurchaseSuccessPage = lazy(() => import("@/pages/tenant-admin/credits/CreditPurchaseSuccessPage"));
export const CreditPurchaseCancelledPage = lazy(() => import("@/pages/tenant-admin/credits/CreditPurchaseCancelledPage"));
export const CreditAnalyticsPage = lazy(() => import("@/pages/tenant-admin/credits/CreditAnalyticsPage").then(m => ({ default: m.CreditAnalyticsPage })));
export const CustomerDetails = lazy(() => import("@/pages/admin/CustomerDetails"));
export const StockAlertsPage = lazy(() => import("@/pages/tenant-admin/StockAlertsPage"));
export const InventoryTransfersPage = lazy(() => import("@/pages/tenant-admin/InventoryTransfersPage"));
export const InventoryAuditPage = lazy(() => import("@/pages/admin/InventoryAudit"));
export const CustomerAnalyticsPage = lazy(() => import("@/pages/tenant-admin/CustomerAnalyticsPage"));
export const AdvancedAnalyticsPage = lazy(() => import("@/pages/tenant-admin/AdvancedAnalyticsPage"));
export const RealtimeDashboardPage = lazy(() => import("@/pages/tenant-admin/RealtimeDashboardPage"));
export const CustomReportsPage = lazy(() => import("@/pages/tenant-admin/CustomReportsPage"));
export const CommissionTrackingPage = lazy(() => import("@/pages/tenant-admin/CommissionTrackingPage"));

// Marketplace (B2B Tenant)
export const SellerProfilePage = lazy(() => import("@/pages/tenant-admin/marketplace/SellerProfilePage"));
export const MyListingsPage = lazy(() => import("@/pages/tenant-admin/marketplace/MyListingsPage"));
export const ListingForm = lazy(() => import("@/pages/tenant-admin/marketplace/ListingForm").then(m => ({ default: m.ListingForm })));
export const ListingDetailPage = lazy(() => import("@/pages/tenant-admin/marketplace/ListingDetailPage"));
export const MarketplaceOrdersPage = lazy(() => import("@/pages/admin/marketplace/OrdersPage"));
export const OrderDetailPage = lazy(() => import("@/pages/admin/marketplace/OrderDetailPage"));
export const VendorPayoutsPage = lazy(() => import("@/pages/tenant-admin/marketplace/VendorPayoutsPage"));
export const MessagesPage = lazy(() => import("@/pages/tenant-admin/marketplace/MessagesPage"));

// Platform Admin
export const PlatformAdminLayout = lazy(() => import("@/layouts/PlatformAdminLayout"));
export const AllTenantsPage = lazy(() => import("@/pages/platform-admin/AllTenantsPage"));
export const DesignSystemPage = lazy(() => import("@/pages/platform-admin/DesignSystemPage"));
export const PlatformPayoutsPage = lazy(() => import("@/pages/platform-admin/PlatformPayoutsPage"));

// ─── Courier ─────────────────────────────────────────────────────────────────
export const CourierLoginPage = lazy(() => import("@/pages/courier/LoginPage"));
export const CourierDashboardPage = lazy(() => import("@/pages/courier/DashboardPage"));
export const CourierEarningsPage = lazy(() => import("@/pages/courier/EarningsPage"));
export const CourierHistoryPage = lazy(() => import("@/pages/courier/HistoryPage"));
export const CourierActiveOrderPage = lazy(() => import("@/pages/courier/ActiveOrderPage"));
export const UnifiedActiveDeliveryPage = lazy(() => import("@/pages/courier/UnifiedActiveDeliveryPage"));
export const CourierSettingsPage = lazy(() => import("@/pages/courier/SettingsPage"));
export const ProtectedCourierRoute = lazy(() => import("@/components/ProtectedCourierRoute").then(m => ({ default: m.default })));

// ─── Customer ────────────────────────────────────────────────────────────────
export const CustomerLoginPage = lazy(() => import("@/pages/customer/LoginPage"));
export const CustomerSignUpPage = lazy(() => import("@/pages/customer/SignUpPage"));
export const CustomerVerifyEmailPage = lazy(() => import("@/pages/customer/VerifyEmailPage"));
export const CustomerForgotPasswordPage = lazy(() => import("@/pages/customer/ForgotPasswordPage"));
export const CustomerResetPasswordPage = lazy(() => import("@/pages/customer/ResetPasswordPage"));
export const CustomerLoginLanding = lazy(() => import("@/pages/customer/CustomerLoginLanding"));
export const CustomerProtectedRoute = lazy(() => import("@/components/auth/CustomerProtectedRoute").then(m => ({ default: m.CustomerProtectedRoute })));
export const CustomerPortal = lazy(() => import("@/pages/customer/CustomerPortal"));
export const CustomerDashboardPage = lazy(() => import("@/pages/customer/DashboardPage"));
export const CustomerSettingsPage = lazy(() => import("@/pages/customer/SettingsPage"));
export const ShoppingCartPage = lazy(() => import("@/pages/customer/ShoppingCartPage"));
export const CheckoutPage = lazy(() => import("@/pages/customer/CheckoutPage"));
export const OrderTrackingPage = lazy(() => import("@/pages/customer/OrderTrackingPage"));
export const SecureMenuAccess = lazy(() => import("@/pages/customer/SecureMenuAccess").then(m => ({ default: m.SecureMenuAccess })));
export const SecureMenuView = lazy(() => import("@/pages/customer/SecureMenuView"));
export const StaticMenuPage = lazy(() => import("@/pages/public/StaticMenuPage"));
export const WholesaleMarketplacePage = lazy(() => import("@/pages/customer/WholesaleMarketplacePage"));
export const WholesaleCartPage = lazy(() => import("@/pages/customer/WholesaleCartPage"));
export const WholesaleCheckoutPage = lazy(() => import("@/pages/customer/WholesaleCheckoutPage"));
export const CustomerWholesaleOrdersPage = lazy(() => import("@/pages/customer/WholesaleOrdersPage"));
export const WholesaleOrderDetailPage = lazy(() => import("@/pages/customer/WholesaleOrderDetailPage"));
export const BusinessFinderPage = lazy(() => import("@/pages/customer/retail/BusinessFinderPage"));
export const BusinessMenuPage = lazy(() => import("@/pages/customer/retail/BusinessMenuPage"));
export const UnifiedOrdersPage = lazy(() => import("@/pages/customer/UnifiedOrdersPage"));

// ─── Community ───────────────────────────────────────────────────────────────
export const CommunityAuthPage = lazy(() => import("@/pages/community/AuthPage").then(m => ({ default: m.AuthPage })));
export const CommunityProtectedRoute = lazy(() => import("@/components/auth/CommunityProtectedRoute").then(m => ({ default: m.CommunityProtectedRoute })));
export const CommunityLayout = lazy(() => import("@/pages/community/CommunityLayout").then(m => ({ default: m.CommunityLayout })));
export const CommunityHomePage = lazy(() => import("@/pages/community/HomePage").then(m => ({ default: m.HomePage })));
export const CategoryPage = lazy(() => import("@/pages/community/CategoryPage").then(m => ({ default: m.CategoryPage })));
export const PostDetailPage = lazy(() => import("@/pages/community/PostDetailPage").then(m => ({ default: m.PostDetailPage })));
export const CreatePostPage = lazy(() => import("@/pages/community/CreatePostPage").then(m => ({ default: m.CreatePostPage })));
export const UserProfilePage = lazy(() => import("@/pages/community/UserProfilePage").then(m => ({ default: m.UserProfilePage })));
export const SearchPage = lazy(() => import("@/pages/community/SearchPage").then(m => ({ default: m.SearchPage })));
export const ApprovalPage = lazy(() => import("@/pages/community/ApprovalPage").then(m => ({ default: m.ApprovalPage })));

// ─── Misc ────────────────────────────────────────────────────────────────────
export const InvitationAcceptPage = lazy(() => import("@/pages/InvitationAcceptPage"));
export const MenuAccess = lazy(() => import("@/pages/MenuAccess"));
export const ComingSoonPage = lazy(() => import("@/pages/ComingSoonPage"));
export const MobileTestPage = lazy(() => import("@/pages/mobile/MobileTestPage"));

// Auth Callbacks
export const TenantAdminAuthCallback = lazy(() => import("@/pages/auth/AuthCallbackPage").then(m => ({ default: m.TenantAdminAuthCallback })));
export const SuperAdminAuthCallback = lazy(() => import("@/pages/auth/AuthCallbackPage").then(m => ({ default: m.SuperAdminAuthCallback })));
export const CustomerAuthCallback = lazy(() => import("@/pages/auth/AuthCallbackPage").then(m => ({ default: m.CustomerAuthCallback })));
export const MFAChallengePage = lazy(() => import("@/pages/auth/MFAChallengePage"));
export const AuthConfirmPage = lazy(() => import("@/pages/auth/AuthConfirmPage"));
export const SecureAccountPage = lazy(() => import("@/pages/auth/SecureAccountPage").then(m => ({ default: m.SecureAccountPage })));

// Feature Pages (Marketing)
export const FeatureCompliancePage = lazy(() => import("@/pages/features/CompliancePage"));
export const FeatureLogisticsPage = lazy(() => import("@/pages/features/LogisticsPage"));
export const FeatureEcommercePage = lazy(() => import("@/pages/features/EcommercePage"));
