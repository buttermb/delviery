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
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TenantProvider } from "./contexts/TenantContext";
import { WhiteLabelProvider } from "./components/whitelabel/WhiteLabelProvider";
import { lazy, Suspense, useEffect } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AdminErrorBoundary } from "./components/admin/AdminErrorBoundary";
import { SkipToContent } from "./components/SkipToContent";
import { LoadingFallback } from "./components/LoadingFallback";
import { setupGlobalErrorHandlers, handleMutationError } from "./utils/reactErrorHandler";
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
const AccountSignup = lazy(() => import("./pages/AccountSignup"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Support = lazy(() => import("./pages/Support"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const About = lazy(() => import("./pages/About"));

// Super Admin Pages
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const SuperAdminCustomers = lazy(() => import("./pages/SuperAdminCustomers"));
const SuperAdminSubscriptions = lazy(() => import("./pages/SuperAdminSubscriptions"));
const SuperAdminSupport = lazy(() => import("./pages/SuperAdminSupport"));
const SuperAdminAnalytics = lazy(() => import("./pages/SuperAdminAnalytics"));
const PointOfSale = lazy(() => import("./pages/admin/PointOfSale"));
const CustomerDetails = lazy(() => import("./pages/admin/CustomerDetails"));
const CustomerManagement = lazy(() => import("./pages/admin/CustomerManagement"));
const CustomerForm = lazy(() => import("./pages/admin/CustomerForm"));
const CustomerReports = lazy(() => import("./pages/admin/CustomerReports"));
const DeliveryManagement = lazy(() => import("./pages/admin/DeliveryManagement"));
const AccountSubscription = lazy(() => import("./pages/AccountSubscription"));

// Admin Pages
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const ProtectedRoute = lazy(() => import("./components/ProtectedRoute"));
const AdminProtectedRoute = lazy(() => import("./components/admin/AdminProtectedRoute"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminCompliance = lazy(() => import("./pages/admin/AdminCompliance"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminUserDetails = lazy(() => import("./pages/admin/AdminUserDetails"));
const RiskFactorManagement = lazy(() => import("./pages/admin/RiskFactorManagement"));
const UserAccount = lazy(() => import("./pages/UserAccount"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminQuickExport = lazy(() => import("./pages/admin/AdminQuickExport"));
const AdminAgeVerification = lazy(() => import("./pages/admin/AdminAgeVerification"));
const BugScanner = lazy(() => import("./pages/admin/BugScanner"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const GlobalSearch = lazy(() => import("./pages/admin/GlobalSearch"));
const Orders = lazy(() => import("./pages/admin/Orders"));
const Couriers = lazy(() => import("./pages/admin/Couriers"));
const LiveOrders = lazy(() => import("./pages/admin/LiveOrders"));
const LiveMap = lazy(() => import("./pages/admin/LiveMap"));
const SystemSettings = lazy(() => import("./pages/admin/SystemSettings"));
const ButtonTester = lazy(() => import("./pages/admin/ButtonTester"));
const AdminLiveChat = lazy(() => import("./pages/admin/AdminLiveChat"));

// New Multi-Tenant SaaS Pages
const LocationsManagement = lazy(() => import("./pages/admin/LocationsManagement"));
const VendorManagement = lazy(() => import("./pages/admin/VendorManagement"));
const TeamManagement = lazy(() => import("./pages/admin/TeamManagement"));
const CustomerInvoices = lazy(() => import("./pages/admin/CustomerInvoices"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const CompanySettings = lazy(() => import("./pages/admin/CompanySettings"));
const OrderManagement = lazy(() => import("./pages/admin/OrderManagement"));
const CustomerPortal = lazy(() => import("./pages/customer/CustomerPortal"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const BillingPortal = lazy(() => import("./pages/BillingPortal"));
const ServiceRequests = lazy(() => import("./pages/ServiceRequests"));

// SAAS Platform Pages
const SignUpPage = lazy(() => import("./pages/saas/SignUpPage"));
const OnboardingWizard = lazy(() => import("./pages/saas/OnboardingWizard"));
const BillingDashboard = lazy(() => import("./pages/saas/BillingDashboard"));
const SuperAdminPlatform = lazy(() => import("./pages/saas/SuperAdminDashboard"));
const DeliveryTracking = lazy(() => import("./pages/admin/DeliveryTracking"));

// Fronted Inventory Pages
const FrontedInventory = lazy(() => import("./pages/admin/FrontedInventory"));
const DispatchInventory = lazy(() => import("./pages/admin/DispatchInventory"));

// Wholesale CRM Pages
const WholesaleDashboard = lazy(() => import("./pages/admin/WholesaleDashboard"));
const WholesaleClients = lazy(() => import("./pages/admin/WholesaleClients"));
const ClientDetail = lazy(() => import("./pages/admin/ClientDetail"));
const WholesaleInventory = lazy(() => import("./pages/admin/WholesaleInventory"));
const FinancialCenter = lazy(() => import("./pages/admin/FinancialCenterReal"));
const FleetManagement = lazy(() => import("./pages/admin/FleetManagement"));
const DisposableMenus = lazy(() => import("./pages/admin/DisposableMenus"));
const DisposableMenuOrders = lazy(() => import("./pages/admin/DisposableMenuOrders"));
const MenuAccess = lazy(() => import("./pages/MenuAccess"));
const NewWholesaleOrder = lazy(() => import("./pages/admin/NewWholesaleOrderReal"));
const WholesaleSetup = lazy(() => import("./pages/admin/WholesaleSetup"));
const InventoryManagement = lazy(() => import("./pages/admin/InventoryManagement"));
const GenerateBarcodes = lazy(() => import("./pages/admin/GenerateBarcodes"));
const RecordFrontedSale = lazy(() => import("./pages/admin/RecordFrontedSale"));
const RecordFrontedPayment = lazy(() => import("./pages/admin/RecordFrontedPayment"));
const FrontedInventoryDetails = lazy(() => import("./pages/admin/FrontedInventoryDetails"));
const RecordFrontedReturn = lazy(() => import("./pages/admin/RecordFrontedReturn"));
const ProductManagement = lazy(() => import("./pages/admin/ProductManagement"));
const FrontedInventoryAnalytics = lazy(() => import("./pages/admin/FrontedInventoryAnalytics"));
const InventoryDashboard = lazy(() => import("./pages/admin/InventoryDashboard"));
const DriverPortal = lazy(() => import("./pages/mobile/DriverPortal"));
const SecureMenuAccess = lazy(() => import("./pages/customer/SecureMenuAccess"));
const SecureMenuView = lazy(() => import("./pages/customer/SecureMenuView"));
const MenuAnalytics = lazy(() => import("./pages/admin/MenuAnalytics"));
const ComprehensiveAnalytics = lazy(() => import("./pages/admin/ComprehensiveAnalytics"));
const BigPlugExecutiveDashboard = lazy(() => import("./pages/admin/BigPlugExecutiveDashboard").then(m => ({ default: m.BigPlugExecutiveDashboard })));
const BigPlugClientManagement = lazy(() => import("./pages/admin/BigPlugClientManagement").then(m => ({ default: m.BigPlugClientManagement })));
const BigPlugFinancialCenter = lazy(() => import("./pages/admin/BigPlugFinancialCenter").then(m => ({ default: m.BigPlugFinancialCenter })));
const BigPlugInventory = lazy(() => import("./pages/admin/BigPlugInventory").then(m => ({ default: m.BigPlugInventory })));
const BigPlugOrderWorkflow = lazy(() => import("./pages/admin/BigPlugOrderWorkflow").then(m => ({ default: m.BigPlugOrderWorkflow })));
const BigPlugRunnerPortal = lazy(() => import("./pages/mobile/BigPlugRunnerPortal").then(m => ({ default: m.BigPlugRunnerPortal })));
const ModernDashboard = lazy(() => import("./components/admin/ModernDashboard").then(m => ({ default: m.ModernDashboard })));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const ReportsPage = lazy(() => import("./pages/admin/ReportsPage"));
const DisposableMenusHelp = lazy(() => import("./pages/admin/DisposableMenusHelp"));
const ProductImagesPage = lazy(() => import("./pages/admin/catalog/ProductImagesPage"));
const BatchesPage = lazy(() => import("./pages/admin/catalog/BatchesPage"));
const CategoriesPage = lazy(() => import("./pages/admin/catalog/CategoriesPage"));
const ReceivingPage = lazy(() => import("./pages/admin/operations/ReceivingPage"));
const AdminPricingPage = lazy(() => import("./pages/admin/sales/PricingPage"));
const WarehousesPage = lazy(() => import("./pages/admin/locations/WarehousesPage"));
const RunnersPage = lazy(() => import("./pages/admin/locations/RunnersPage"));

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
              <AdminAuthProvider>
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
                        {/* Root redirects to marketing */}
                        <Route path="/" element={<Navigate to="/marketing" replace />} />
                        
                        {/* Marketing & Public Routes */}
                        <Route path="/marketing" element={<MarketingHome />} />
                        <Route path="/pricing" element={<PricingPage />} />
                        <Route path="/signup" element={<AccountSignup />} />
                        <Route path="/faq" element={<FAQ />} />
                        <Route path="/support" element={<Support />} />
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/about" element={<About />} />
                        
                        {/* SAAS Platform Routes */}
                        <Route path="/saas/signup" element={<SignUpPage />} />
                        <Route path="/saas/onboarding" element={<OnboardingWizard />} />
                        <Route path="/saas/billing" element={<BillingDashboard />} />
                        <Route path="/saas/admin" element={<SuperAdminPlatform />} />
                        <Route path="/saas/whitelabel" element={<WhiteLabelSettings />} />
                        
                        {/* Super Admin Routes */}
                        <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
                        <Route path="/super-admin/customers" element={<SuperAdminCustomers />} />
                        <Route path="/super-admin/customers/:id" element={<SuperAdminCustomers />} />
                        <Route path="/super-admin/subscriptions" element={<SuperAdminSubscriptions />} />
                        <Route path="/super-admin/support" element={<SuperAdminSupport />} />
                        <Route path="/super-admin/analytics" element={<SuperAdminAnalytics />} />
                        
                        {/* Account Management */}
                        <Route path="/account/subscription" element={<ProtectedRoute><AccountSubscription /></ProtectedRoute>} />
                        <Route path="/account" element={<ProtectedRoute><UserAccount /></ProtectedRoute>} />
                        <Route path="/account/settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
                        <Route path="/settings/notifications" element={
                          <ProtectedRoute><NotificationPreferences /></ProtectedRoute>
                        } />

                        {/* Customer Routes */}
                        <Route path="/portal" element={<CustomerPortal />} />
                        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                        <Route path="/billing" element={<ProtectedRoute><BillingPortal /></ProtectedRoute>} />
                        <Route path="/service-requests" element={<ProtectedRoute><ServiceRequests /></ProtectedRoute>} />

                        {/* Admin Login */}
                        <Route path="/admin/login" element={<AdminLogin />} />

                        {/* Admin Routes */}
                        <Route path="/admin" element={<AdminProtectedRoute><AdminErrorBoundary><AdminLayout /></AdminErrorBoundary></AdminProtectedRoute>}>
                          <Route index element={<Navigate to="/admin/dashboard" replace />} />
                          <Route path="dashboard" element={<AdminErrorBoundary><AdminDashboard /></AdminErrorBoundary>} />
                          <Route path="modern-dashboard" element={<AdminErrorBoundary><ModernDashboard /></AdminErrorBoundary>} />
                          <Route path="users" element={<AdminErrorBoundary><AdminUsers /></AdminErrorBoundary>} />
                          <Route path="users/:id" element={<AdminErrorBoundary><AdminUserDetails /></AdminErrorBoundary>} />
                          <Route path="compliance" element={<AdminErrorBoundary><AdminCompliance /></AdminErrorBoundary>} />
                          <Route path="risk-factors" element={<AdminErrorBoundary><RiskFactorManagement /></AdminErrorBoundary>} />
                          <Route path="analytics" element={<AdminErrorBoundary><AdminAnalytics /></AdminErrorBoundary>} />
                          <Route path="audit-logs" element={<AdminErrorBoundary><AdminAuditLogs /></AdminErrorBoundary>} />
                          <Route path="age-verification" element={<AdminErrorBoundary><AdminAgeVerification /></AdminErrorBoundary>} />
                          <Route path="notifications" element={<AdminErrorBoundary><AdminNotifications /></AdminErrorBoundary>} />
                          <Route path="search" element={<AdminErrorBoundary><GlobalSearch /></AdminErrorBoundary>} />
                          <Route path="orders" element={<AdminErrorBoundary><Orders /></AdminErrorBoundary>} />
                          <Route path="couriers" element={<AdminErrorBoundary><Couriers /></AdminErrorBoundary>} />
                          <Route path="live-orders" element={<AdminErrorBoundary><LiveOrders /></AdminErrorBoundary>} />
                          <Route path="live-map" element={<AdminErrorBoundary><LiveMap /></AdminErrorBoundary>} />
                          <Route path="settings-old" element={<AdminErrorBoundary><SystemSettings /></AdminErrorBoundary>} />
                          <Route path="settings" element={<AdminErrorBoundary><SettingsPage /></AdminErrorBoundary>} />
                          <Route path="reports-new" element={<AdminErrorBoundary><ReportsPage /></AdminErrorBoundary>} />
                          
                          {/* Catalog Pages */}
                          <Route path="catalog/images" element={<AdminErrorBoundary><ProductImagesPage /></AdminErrorBoundary>} />
                          <Route path="catalog/batches" element={<AdminErrorBoundary><BatchesPage /></AdminErrorBoundary>} />
                          <Route path="catalog/categories" element={<AdminErrorBoundary><CategoriesPage /></AdminErrorBoundary>} />
                          
                          {/* Operations Pages */}
                          <Route path="operations/receiving" element={<AdminErrorBoundary><ReceivingPage /></AdminErrorBoundary>} />
                          
                          {/* Sales Pages */}
                          <Route path="sales/pricing" element={<AdminErrorBoundary><AdminPricingPage /></AdminErrorBoundary>} />
                          
                          {/* Locations Pages */}
                          <Route path="locations/warehouses" element={<AdminErrorBoundary><WarehousesPage /></AdminErrorBoundary>} />
                          <Route path="locations/runners" element={<AdminErrorBoundary><RunnersPage /></AdminErrorBoundary>} />
                          
                          <Route path="button-tester" element={<AdminErrorBoundary><ButtonTester /></AdminErrorBoundary>} />
                          <Route path="bug-scanner" element={<AdminErrorBoundary><BugScanner /></AdminErrorBoundary>} />
                          <Route path="live-chat" element={<AdminErrorBoundary><AdminLiveChat /></AdminErrorBoundary>} />
                          <Route path="quick-export" element={<AdminErrorBoundary><AdminQuickExport /></AdminErrorBoundary>} />
                          
                          {/* Multi-Tenant SaaS Routes */}
                          <Route path="locations" element={<AdminErrorBoundary><LocationsManagement /></AdminErrorBoundary>} />
                          <Route path="vendors" element={<AdminErrorBoundary><VendorManagement /></AdminErrorBoundary>} />
                          <Route path="team" element={<AdminErrorBoundary><TeamManagement /></AdminErrorBoundary>} />
                          <Route path="invoices" element={<AdminErrorBoundary><CustomerInvoices /></AdminErrorBoundary>} />
                          <Route path="reports" element={<AdminErrorBoundary><Reports /></AdminErrorBoundary>} />
                          <Route path="company-settings" element={<AdminErrorBoundary><CompanySettings /></AdminErrorBoundary>} />
                          <Route path="order-management" element={<AdminErrorBoundary><OrderManagement /></AdminErrorBoundary>} />
                          <Route path="customer-management" element={<AdminErrorBoundary><CustomerManagement /></AdminErrorBoundary>} />
                          <Route path="customers/:id" element={<AdminErrorBoundary><CustomerDetails /></AdminErrorBoundary>} />
                          <Route path="customers/:id/invoices" element={<AdminErrorBoundary><CustomerInvoices /></AdminErrorBoundary>} />
                          <Route path="customers/new" element={<AdminErrorBoundary><CustomerForm /></AdminErrorBoundary>} />
                          <Route path="customer-management/:id/edit" element={<AdminErrorBoundary><CustomerForm /></AdminErrorBoundary>} />
                          <Route path="customer-reports" element={<AdminErrorBoundary><CustomerReports /></AdminErrorBoundary>} />
                          <Route path="pos" element={<AdminErrorBoundary><PointOfSale /></AdminErrorBoundary>} />
                          <Route path="deliveries" element={<AdminErrorBoundary><DeliveryManagement /></AdminErrorBoundary>} />
                          
                          {/* Wholesale CRM Routes */}
                          <Route path="wholesale-setup" element={<AdminErrorBoundary><WholesaleSetup /></AdminErrorBoundary>} />
                          <Route path="wholesale-dashboard" element={<AdminErrorBoundary><WholesaleDashboard /></AdminErrorBoundary>} />
                          <Route path="big-plug-dashboard" element={<AdminErrorBoundary><BigPlugExecutiveDashboard /></AdminErrorBoundary>} />
                          <Route path="big-plug-clients" element={<AdminErrorBoundary><BigPlugClientManagement /></AdminErrorBoundary>} />
                          <Route path="big-plug-inventory" element={<AdminErrorBoundary><BigPlugInventory /></AdminErrorBoundary>} />
                          <Route path="big-plug-financial" element={<AdminErrorBoundary><BigPlugFinancialCenter /></AdminErrorBoundary>} />
                          <Route path="big-plug-order" element={<AdminErrorBoundary><BigPlugOrderWorkflow /></AdminErrorBoundary>} />
                          <Route path="wholesale-clients" element={<AdminErrorBoundary><WholesaleClients /></AdminErrorBoundary>} />
                          <Route path="wholesale-clients/:id" element={<AdminErrorBoundary><ClientDetail /></AdminErrorBoundary>} />
                          <Route path="wholesale-clients/new-order" element={<AdminErrorBoundary><NewWholesaleOrder /></AdminErrorBoundary>} />
                          <Route path="wholesale-inventory" element={<AdminErrorBoundary><WholesaleInventory /></AdminErrorBoundary>} />
                          <Route path="wholesale-inventory-manage" element={<AdminErrorBoundary><InventoryManagement /></AdminErrorBoundary>} />
                          <Route path="financial-center" element={<AdminErrorBoundary><FinancialCenter /></AdminErrorBoundary>} />
                          <Route path="fleet-management" element={<AdminErrorBoundary><FleetManagement /></AdminErrorBoundary>} />
                          <Route path="disposable-menus" element={<AdminErrorBoundary><DisposableMenus /></AdminErrorBoundary>} />
                          <Route path="disposable-menus/orders" element={<AdminErrorBoundary><DisposableMenuOrders /></AdminErrorBoundary>} />
                          <Route path="disposable-menus/help" element={<AdminErrorBoundary><DisposableMenusHelp /></AdminErrorBoundary>} />
                          <Route path="menu-analytics/:menuId" element={<AdminErrorBoundary><MenuAnalytics /></AdminErrorBoundary>} />
                          <Route path="analytics/comprehensive" element={<AdminErrorBoundary><ComprehensiveAnalytics /></AdminErrorBoundary>} />
                          <Route path="delivery-tracking/:id" element={<AdminErrorBoundary><DeliveryTracking /></AdminErrorBoundary>} />
                          
                          {/* Mobile Runner Portal */}
                          <Route path="runner-portal" element={<BigPlugRunnerPortal />} />
                          
                          {/* Fronted Inventory Routes */}
                          <Route path="inventory" element={<AdminErrorBoundary><InventoryDashboard /></AdminErrorBoundary>} />
                          <Route path="inventory/products" element={<AdminErrorBoundary><ProductManagement /></AdminErrorBoundary>} />
                          <Route path="inventory/fronted" element={<AdminErrorBoundary><FrontedInventory /></AdminErrorBoundary>} />
                          <Route path="inventory/dispatch" element={<AdminErrorBoundary><DispatchInventory /></AdminErrorBoundary>} />
                          <Route path="inventory/barcodes" element={<AdminErrorBoundary><GenerateBarcodes /></AdminErrorBoundary>} />
                          <Route path="inventory/analytics" element={<AdminErrorBoundary><FrontedInventoryAnalytics /></AdminErrorBoundary>} />
                          <Route path="inventory/fronted/:id" element={<AdminErrorBoundary><FrontedInventoryDetails /></AdminErrorBoundary>} />
                          <Route path="inventory/fronted/:id/sale" element={<AdminErrorBoundary><RecordFrontedSale /></AdminErrorBoundary>} />
                          <Route path="inventory/fronted/:id/payment" element={<AdminErrorBoundary><RecordFrontedPayment /></AdminErrorBoundary>} />
                          <Route path="inventory/fronted/:id/return" element={<AdminErrorBoundary><RecordFrontedReturn /></AdminErrorBoundary>} />
                        </Route>
                        
                        {/* Driver Portal */}
                        <Route path="/driver" element={<DriverPortal />} />
                        
                        {/* Secure Menu Access (Public) */}
                        <Route path="/m/:token" element={<SecureMenuAccess />} />
                        <Route path="/m/:token/view" element={<SecureMenuView />} />
                        
                        {/* Public Disposable Menu Access */}
                        <Route path="/menu/:token" element={<MenuAccess />} />

                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                    </BrowserRouter>
                  </TooltipProvider>
                  </WhiteLabelProvider>
                </TenantProvider>
              </AdminAuthProvider>
            </AccountProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
