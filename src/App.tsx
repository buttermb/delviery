/**
 * New York Minute NYC - Root Application Component
 * 
 * Built by WebFlow Studios Team (2024)
 * Lead: Sarah Chen | UI/UX: Marcus Rodriguez
 * Backend: Aisha Kumar | DevOps: James Martinez
 * 
 * Tech Stack:
 * - React 18.3 with SWC compiler
 * - TanStack Query v5 for state management
 * - React Router v6 for routing
 * - Radix UI primitives
 * - Tailwind CSS utility framework
 * 
 * Architecture Pattern: Lazy-loaded route-based code splitting
 * Error Handling: Global ErrorBoundary with analytics tracking
 * 
 * Contact: contact@webflowstudios.dev
 */

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AccountProvider } from "./contexts/AccountContext";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { CourierProvider } from "./contexts/CourierContext";
import { DeviceTracker } from "./components/DeviceTracker";
import { CourierPinProvider } from "./contexts/CourierPinContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { lazy, Suspense, useEffect } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AdminErrorBoundary } from "./components/admin/AdminErrorBoundary";
import { SkipToContent } from "./components/SkipToContent";
import { LoadingFallback } from "./components/LoadingFallback";
import { DevTools } from "./components/dev/DevTools";
import { setupGlobalErrorHandlers, handleQueryError, handleMutationError } from "./utils/reactErrorHandler";
import { useVersionCheck } from "./hooks/useVersionCheck";
import { runProductionHealthCheck } from "@/utils/productionHealthCheck";
import { productionLogger } from "@/utils/productionLogger";
import { toast } from "./hooks/use-toast";

import { NotificationPreferences } from "./components/NotificationPreferences";
import OfflineBanner from "./components/OfflineBanner";
import InstallPWA from "./components/InstallPWA";
import { CartBadgeAnimation } from "./components/CartBadgeAnimation";
import { KeyboardShortcutsDialog } from "./components/KeyboardShortcutsDialog";

// Eager load critical pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy load non-critical pages
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Blog = lazy(() => import("./pages/Blog"));
const MarketingHome = lazy(() => import("./pages/MarketingHome"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const AccountSignup = lazy(() => import("./pages/AccountSignup"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const SuperAdminCustomers = lazy(() => import("./pages/SuperAdminCustomers"));
const SuperAdminSubscriptions = lazy(() => import("./pages/SuperAdminSubscriptions"));
const SuperAdminSupport = lazy(() => import("./pages/SuperAdminSupport"));
const SuperAdminAnalytics = lazy(() => import("./pages/SuperAdminAnalytics"));
const AccountSubscription = lazy(() => import("./pages/AccountSubscription"));
const LocationsManagement = lazy(() => import("./pages/admin/LocationsManagement"));
const VendorManagement = lazy(() => import("./pages/admin/VendorManagement"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Support = lazy(() => import("./pages/Support"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const About = lazy(() => import("./pages/About"));
const BecomeCourier = lazy(() => import("./pages/BecomeCourier"));
const PartnerShops = lazy(() => import("./pages/PartnerShops"));
const OrderLookup = lazy(() => import("./pages/OrderLookup"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const TrackOrderLive = lazy(() => import("./pages/TrackOrderLive"));
const CustomerTrackingPage = lazy(() => import("./pages/CustomerTrackingPage"));
const CourierLogin = lazy(() => import("./pages/CourierLogin"));
const ProtectedCourierRoute = lazy(() => import("./components/ProtectedCourierRoute"));
const CourierDashboard = lazy(() => import("./pages/CourierDashboard"));
const CourierEarnings = lazy(() => import("./pages/CourierEarnings"));
const CourierHistory = lazy(() => import("./pages/CourierHistory"));
const CourierProfile = lazy(() => import("./pages/CourierProfile"));
const MerchantDashboard = lazy(() => import("./pages/MerchantDashboard"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const ProtectedRoute = lazy(() => import("./components/ProtectedRoute"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const OrderTracking = lazy(() => import("./pages/OrderTracking"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const AdminProtectedRoute = lazy(() => import("./components/admin/AdminProtectedRoute"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminLiveMap = lazy(() => import("./pages/admin/AdminLiveMap"));
const AdminLiveOrders = lazy(() => import("./pages/admin/AdminLiveOrders"));
const AdminCouriers = lazy(() => import("./pages/admin/AdminCouriers"));
const AdminCourierDetails = lazy(() => import("./pages/admin/AdminCourierDetails"));
const AdminCompliance = lazy(() => import("./pages/admin/AdminCompliance"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminUserDetails = lazy(() => import("./pages/admin/AdminUserDetails"));
const RiskFactorManagement = lazy(() => import("./pages/admin/RiskFactorManagement"));
const UserAccount = lazy(() => import("./pages/UserAccount"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminQuickExport = lazy(() => import("./pages/admin/AdminQuickExport"));
const AdminAgeVerification = lazy(() => import("./pages/admin/AdminAgeVerification"));
const AdminCourierApplications = lazy(() => import("./pages/admin/AdminCourierApplications"));
const BugScanner = lazy(() => import("./components/admin/BugScanner"));
const AdminDeliverySafety = lazy(() => import("./pages/admin/AdminDeliverySafety"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const ProductForm = lazy(() => import("./pages/admin/ProductForm"));
const ProductAnalytics = lazy(() => import("./pages/admin/ProductAnalytics"));
const InventoryManagement = lazy(() => import("./pages/admin/InventoryManagement"));
const MediaLibrary = lazy(() => import("./pages/admin/MediaLibrary"));
const ProductTemplates = lazy(() => import("./pages/admin/ProductTemplates"));
const ImportExport = lazy(() => import("./pages/admin/ImportExport"));
const COAManagement = lazy(() => import("./pages/admin/COAManagement"));
const Giveaway = lazy(() => import("./pages/Giveaway"));
const AdminGiveaway = lazy(() => import("./pages/admin/AdminGiveaway"));
const AdminGiveaways = lazy(() => import("./pages/admin/AdminGiveaways"));
const AdminGiveawayManagement = lazy(() => import("./pages/admin/AdminGiveawayManagement"));
const AdminGiveawayAnalytics = lazy(() => import("./pages/admin/AdminGiveawayAnalytics"));
const AdminGiveawayWinners = lazy(() => import("./pages/admin/AdminGiveawayWinners"));
const AdminGiveawayForm = lazy(() => import("./pages/admin/AdminGiveawayForm"));
const GiveawayRules = lazy(() => import("./pages/GiveawayRules"));
const MyGiveawayEntries = lazy(() => import("./pages/MyGiveawayEntries"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const CouponList = lazy(() => import("./pages/admin/CouponList"));
const CouponForm = lazy(() => import("./pages/admin/CouponForm"));
const CouponEdit = lazy(() => import("./pages/admin/CouponEdit"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const GlobalSearch = lazy(() => import("./pages/admin/GlobalSearch"));
const SystemSettings = lazy(() => import("./pages/admin/SystemSettings"));
const ButtonTester = lazy(() => import("./pages/admin/ButtonTester"));
const AdminLiveChat = lazy(() => import("./pages/admin/AdminLiveChat"));

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
  // Version check disabled - service worker handles updates
  // useVersionCheck();

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
                <DeviceTracker />
                <CourierProvider>
                <CourierPinProvider>
                  <TooltipProvider>
                      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                        <SkipToContent />
                        <OfflineBanner />
                        <InstallPWA />
                        <CartBadgeAnimation />
                        <KeyboardShortcutsDialog />
                    
                    <Toaster />
                    <Sonner />
                    <Suspense fallback={<LoadingFallback />}>
                    <Routes>
                      {/* Marketing & Public Routes */}
                      <Route path="/" element={<Index />} />
                      <Route path="/marketing" element={<MarketingHome />} />
                      <Route path="/pricing" element={<PricingPage />} />
                      <Route path="/signup" element={<AccountSignup />} />
                      
                      {/* Super Admin Routes */}
                      <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
                      <Route path="/super-admin/customers" element={<SuperAdminCustomers />} />
                      <Route path="/super-admin/customers/:id" element={<SuperAdminCustomers />} />
                      <Route path="/super-admin/subscriptions" element={<SuperAdminSubscriptions />} />
                      <Route path="/super-admin/support" element={<SuperAdminSupport />} />
                      <Route path="/super-admin/analytics" element={<SuperAdminAnalytics />} />
                      
                      {/* Account Management */}
                      <Route path="/account/subscription" element={<ProtectedRoute><AccountSubscription /></ProtectedRoute>} />
                      
                      <Route path="/product/:id" element={<ProductDetail />} />
                      <Route path="/blog" element={<Blog />} />
                      <Route path="/blog/:slug" element={<BlogPost />} />
                      <Route path="/faq" element={<FAQ />} />
                      <Route path="/support" element={<Support />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/become-courier" element={<BecomeCourier />} />
                      <Route path="/partner-shops" element={<PartnerShops />} />
                      <Route path="/track-order" element={<OrderLookup />} />
                      
                      {/* Giveaway */}
                      <Route path="/giveaway/:slug" element={<Giveaway />} />
                      <Route path="/giveaway/rules" element={<GiveawayRules />} />
                      <Route path="/account/giveaway-entries" element={
                        <ProtectedRoute>
                          <MyGiveawayEntries />
                        </ProtectedRoute>
                      } />
                      
                      {/* Public Order Tracking */}
                      <Route path="/track/:code" element={<CustomerTrackingPage />} />
                      <Route path="/track" element={<TrackOrder />} />
                      <Route path="/track-live/:code" element={<TrackOrderLive />} />
                      
                      {/* Courier Routes */}
                      <Route path="/courier/login" element={<CourierLogin />} />
                      <Route path="/courier/dashboard" element={
                        <ProtectedCourierRoute><CourierDashboard /></ProtectedCourierRoute>
                      } />
                      <Route path="/courier/earnings" element={
                        <ProtectedCourierRoute><CourierEarnings /></ProtectedCourierRoute>
                      } />
                      <Route path="/courier/history" element={
                        <ProtectedCourierRoute><CourierHistory /></ProtectedCourierRoute>
                      } />
                      <Route path="/courier/profile" element={
                        <ProtectedCourierRoute><CourierProfile /></ProtectedCourierRoute>
                      } />

                      {/* Merchant Dashboard */}
                      <Route path="/merchant/dashboard" element={<MerchantDashboard />} />

                      {/* Admin Login */}
                      <Route path="/admin/login" element={<AdminLogin />} />

                      {/* Guest-accessible Routes */}
                      <Route path="/cart" element={<Cart />} />
                      <Route path="/checkout" element={<Checkout />} />
                      <Route path="/order-confirmation" element={<OrderConfirmation />} />
                      
                      {/* Protected User Routes */}
                      <Route path="/order-tracking" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
                      <Route path="/my-orders" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />
                      <Route path="/account" element={<ProtectedRoute><UserAccount /></ProtectedRoute>} />
                      <Route path="/account/settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
                      <Route path="/settings/notifications" element={
                        <ProtectedRoute><NotificationPreferences /></ProtectedRoute>
                      } />

                      {/* Admin Routes */}
                      <Route path="/admin" element={<AdminProtectedRoute><AdminErrorBoundary><AdminLayout /></AdminErrorBoundary></AdminProtectedRoute>}>
                        <Route index element={<Navigate to="/admin/dashboard" replace />} />
                        <Route path="dashboard" element={<AdminErrorBoundary><AdminDashboard /></AdminErrorBoundary>} />
                        <Route path="orders" element={<AdminErrorBoundary><AdminOrders /></AdminErrorBoundary>} />
                        <Route path="live-map" element={<AdminErrorBoundary><AdminLiveMap /></AdminErrorBoundary>} />
                        <Route path="live-orders" element={<AdminErrorBoundary><AdminLiveOrders /></AdminErrorBoundary>} />
                        <Route path="couriers" element={<AdminErrorBoundary><AdminCouriers /></AdminErrorBoundary>} />
                        <Route path="couriers/:id" element={<AdminErrorBoundary><AdminCourierDetails /></AdminErrorBoundary>} />
                        <Route path="compliance" element={<AdminErrorBoundary><AdminCompliance /></AdminErrorBoundary>} />
                        <Route path="users" element={<AdminErrorBoundary><AdminUsers /></AdminErrorBoundary>} />
                        <Route path="users/:id" element={<AdminErrorBoundary><AdminUserDetails /></AdminErrorBoundary>} />
                        <Route path="risk-factors" element={<AdminErrorBoundary><RiskFactorManagement /></AdminErrorBoundary>} />
                        <Route path="analytics" element={<AdminErrorBoundary><AdminAnalytics /></AdminErrorBoundary>} />
                        <Route path="audit-logs" element={<AdminErrorBoundary><AdminAuditLogs /></AdminErrorBoundary>} />
                        <Route path="age-verification" element={<AdminErrorBoundary><AdminAgeVerification /></AdminErrorBoundary>} />
                        <Route path="courier-applications" element={<AdminErrorBoundary><AdminCourierApplications /></AdminErrorBoundary>} />
                        <Route path="delivery-safety" element={<AdminErrorBoundary><AdminDeliverySafety /></AdminErrorBoundary>} />
                        <Route path="products" element={<AdminErrorBoundary><AdminProducts /></AdminErrorBoundary>} />
                        <Route path="products/new" element={<AdminErrorBoundary><ProductForm /></AdminErrorBoundary>} />
                        <Route path="products/:id/edit" element={<AdminErrorBoundary><ProductForm /></AdminErrorBoundary>} />
                        <Route path="products/:id/duplicate" element={<AdminErrorBoundary><ProductForm /></AdminErrorBoundary>} />
                        <Route path="products/analytics" element={<AdminErrorBoundary><ProductAnalytics /></AdminErrorBoundary>} />
                        <Route path="inventory" element={<AdminErrorBoundary><InventoryManagement /></AdminErrorBoundary>} />
                        <Route path="media" element={<AdminErrorBoundary><MediaLibrary /></AdminErrorBoundary>} />
                        <Route path="templates" element={<AdminErrorBoundary><ProductTemplates /></AdminErrorBoundary>} />
                        <Route path="import-export" element={<AdminErrorBoundary><ImportExport /></AdminErrorBoundary>} />
                        <Route path="coa-management" element={<AdminErrorBoundary><COAManagement /></AdminErrorBoundary>} />
                <Route path="giveaway" element={<AdminErrorBoundary><AdminGiveaway /></AdminErrorBoundary>} />
                <Route path="giveaways" element={<AdminErrorBoundary><AdminGiveaways /></AdminErrorBoundary>} />
                <Route path="giveaways/manage" element={<AdminErrorBoundary><Suspense fallback={<LoadingFallback />}><AdminGiveawayManagement /></Suspense></AdminErrorBoundary>} />
                <Route path="giveaways/new" element={<AdminErrorBoundary><AdminGiveawayForm /></AdminErrorBoundary>} />
                <Route path="giveaways/:id/edit" element={<AdminErrorBoundary><AdminGiveawayForm /></AdminErrorBoundary>} />
                <Route path="giveaways/:id/analytics" element={<AdminErrorBoundary><AdminGiveawayAnalytics /></AdminErrorBoundary>} />
                <Route path="giveaways/:id/winners" element={<AdminErrorBoundary><AdminGiveawayWinners /></AdminErrorBoundary>} />
                <Route path="coupons" element={<AdminErrorBoundary><CouponList /></AdminErrorBoundary>} />
                <Route path="coupons/create" element={<AdminErrorBoundary><CouponForm /></AdminErrorBoundary>} />
                <Route path="coupons/:id/edit" element={<AdminErrorBoundary><CouponEdit /></AdminErrorBoundary>} />
                <Route path="notifications" element={<AdminErrorBoundary><AdminNotifications /></AdminErrorBoundary>} />
                <Route path="search" element={<AdminErrorBoundary><GlobalSearch /></AdminErrorBoundary>} />
                <Route path="settings" element={<AdminErrorBoundary><SystemSettings /></AdminErrorBoundary>} />
                <Route path="button-tester" element={<AdminErrorBoundary><ButtonTester /></AdminErrorBoundary>} />
                <Route path="bug-scanner" element={<AdminErrorBoundary><BugScanner /></AdminErrorBoundary>} />
                        <Route path="live-chat" element={<AdminErrorBoundary><AdminLiveChat /></AdminErrorBoundary>} />
                        <Route path="quick-export" element={<AdminErrorBoundary><AdminQuickExport /></AdminErrorBoundary>} />
                        <Route path="locations" element={<AdminErrorBoundary><LocationsManagement /></AdminErrorBoundary>} />
                        <Route path="vendors" element={<AdminErrorBoundary><VendorManagement /></AdminErrorBoundary>} />
                      </Route>

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                 </BrowserRouter>
                <DevTools />
              </TooltipProvider>
                </CourierPinProvider>
              </CourierProvider>
            </AdminAuthProvider>
            </AccountProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
