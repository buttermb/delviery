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
const BugScanner = lazy(() => import("./components/admin/BugScanner"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const GlobalSearch = lazy(() => import("./pages/admin/GlobalSearch"));
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

// Fronted Inventory Pages
const FrontedInventory = lazy(() => import("./pages/admin/FrontedInventory"));
const DispatchInventory = lazy(() => import("./pages/admin/DispatchInventory"));
const GenerateBarcodes = lazy(() => import("./pages/admin/GenerateBarcodes"));
const RecordFrontedSale = lazy(() => import("./pages/admin/RecordFrontedSale"));
const RecordFrontedPayment = lazy(() => import("./pages/admin/RecordFrontedPayment"));

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
                          <Route path="users" element={<AdminErrorBoundary><AdminUsers /></AdminErrorBoundary>} />
                          <Route path="users/:id" element={<AdminErrorBoundary><AdminUserDetails /></AdminErrorBoundary>} />
                          <Route path="compliance" element={<AdminErrorBoundary><AdminCompliance /></AdminErrorBoundary>} />
                          <Route path="risk-factors" element={<AdminErrorBoundary><RiskFactorManagement /></AdminErrorBoundary>} />
                          <Route path="analytics" element={<AdminErrorBoundary><AdminAnalytics /></AdminErrorBoundary>} />
                          <Route path="audit-logs" element={<AdminErrorBoundary><AdminAuditLogs /></AdminErrorBoundary>} />
                          <Route path="age-verification" element={<AdminErrorBoundary><AdminAgeVerification /></AdminErrorBoundary>} />
                          <Route path="notifications" element={<AdminErrorBoundary><AdminNotifications /></AdminErrorBoundary>} />
                          <Route path="search" element={<AdminErrorBoundary><GlobalSearch /></AdminErrorBoundary>} />
                          <Route path="settings" element={<AdminErrorBoundary><SystemSettings /></AdminErrorBoundary>} />
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
                          
                          {/* Fronted Inventory Routes */}
                          <Route path="inventory/fronted" element={<AdminErrorBoundary><FrontedInventory /></AdminErrorBoundary>} />
                          <Route path="inventory/dispatch" element={<AdminErrorBoundary><DispatchInventory /></AdminErrorBoundary>} />
                          <Route path="inventory/barcodes" element={<AdminErrorBoundary><GenerateBarcodes /></AdminErrorBoundary>} />
                          <Route path="inventory/fronted/:id/sale" element={<AdminErrorBoundary><RecordFrontedSale /></AdminErrorBoundary>} />
                          <Route path="inventory/fronted/:id/payment" element={<AdminErrorBoundary><RecordFrontedPayment /></AdminErrorBoundary>} />
                        </Route>

                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </BrowserRouter>
                </TooltipProvider>
              </AdminAuthProvider>
            </AccountProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
