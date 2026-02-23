import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Maps path segments to human-readable titles.
 * Covers known route segments that don't title-case cleanly.
 */
const SEGMENT_LABELS: Record<string, string> = {
  // Top-level sections
  "super-admin": "Super Admin",
  "platform-admin": "Platform Admin",
  admin: "Admin",
  shop: "Shop",
  courier: "Courier",
  vendor: "Vendor",
  community: "Community",

  // Common admin pages
  dashboard: "Dashboard",
  "dashboard-hub": "Dashboard",
  hotbox: "Hotbox",
  "tv-dashboard": "TV Dashboard",
  "command-center": "Command Center",
  "collection-mode": "Collection Mode",
  "analytics-hub": "Analytics",
  "customer-hub": "Customers",
  "orders-hub": "Orders",
  orders: "Orders",
  "inventory-hub": "Inventory",
  "finance-hub": "Finance",
  "fulfillment-hub": "Fulfillment",
  "settings-hub": "Settings",
  "integrations-hub": "Integrations",
  "storefront-hub": "Storefront",
  "operations-hub": "Operations",
  "marketing-hub": "Marketing",
  storefront: "Storefront",
  settings: "Settings",
  "account-settings": "Account Settings",
  "system-settings": "System Settings",
  reports: "Reports",
  notifications: "Notifications",
  "pos-system": "POS",
  "pos-hub": "POS",

  // Inventory & Products
  "inventory-dashboard": "Inventory",
  "inventory-monitoring": "Inventory Monitoring",
  "advanced-inventory": "Advanced Inventory",
  "fronted-inventory": "Fronted Inventory",
  "dispatch-inventory": "Dispatch Inventory",
  "generate-barcodes": "Generate Barcodes",
  "stock-alerts": "Stock Alerts",
  "inventory-transfers": "Inventory Transfers",
  "inventory-audit": "Inventory Audit",
  products: "Products",
  catalog: "Catalog",
  batches: "Batches",
  categories: "Categories",
  images: "Images",

  // Orders & Sales
  "wholesale-orders": "Wholesale Orders",
  "live-orders": "Live Orders",
  "sales-dashboard": "Sales Dashboard",
  "order-analytics": "Order Analytics",

  // CRM & Customers
  "customer-crm": "CRM",
  crm: "CRM",
  clients: "Clients",
  invoices: "Invoices",
  "pre-orders": "Pre-Orders",
  "customer-details": "Customer Details",
  "customer-reports": "Customer Reports",
  "customer-insights": "Customer Insights",
  "customer-analytics": "Customer Analytics",
  "invoice-management": "Invoices",
  "customer-invoices": "Invoices",
  "advanced-invoice": "Advanced Invoice",

  // Finance
  "financial-center": "Financial Center",
  "expense-tracking": "Expense Tracking",
  "commission-tracking": "Commission Tracking",
  "revenue-reports": "Revenue Reports",
  credits: "Credits",
  billing: "Billing",

  // Delivery & Logistics
  "delivery-hub": "Delivery",
  "delivery-management": "Delivery Management",
  "delivery-tracking": "Delivery Tracking",
  "delivery-zones": "Delivery Zones",
  "delivery-analytics": "Delivery Analytics",
  "fleet-management": "Fleet Management",
  "route-optimizer": "Route Optimizer",
  "live-map": "Live Map",
  "gps-tracking": "GPS Tracking",

  // Team & Roles
  "staff-management": "Staff Management",
  "team-members": "Team Members",
  "team-management": "Team Management",
  "role-management": "Roles",
  "activity-logs": "Activity Logs",
  "audit-trail": "Audit Trail",

  // Marketing
  "loyalty-program": "Loyalty Program",
  coupons: "Coupons",
  "marketing-automation": "Marketing Automation",
  "marketing/reviews": "Reviews",

  // Marketplace
  marketplace: "Marketplace",
  listings: "Listings",
  messages: "Messages",
  financials: "Financials",

  // Analytics & Reports
  analytics: "Analytics",
  "advanced-analytics": "Advanced Analytics",
  "realtime-dashboard": "Realtime Dashboard",
  "custom-reports": "Custom Reports",
  "advanced-reporting": "Advanced Reporting",
  "predictive-analytics": "Predictive Analytics",
  "board-report": "Board Report",
  "strategic-dashboard": "Strategic Dashboard",
  expansion: "Expansion Analysis",
  "analytics-dashboard": "Analytics",
  "location-analytics": "Location Analytics",
  "fronted-inventory-analytics": "Fronted Inventory Analytics",

  // Operations
  suppliers: "Suppliers",
  "purchase-orders": "Purchase Orders",
  returns: "Returns",
  "quality-control": "Quality Control",
  compliance: "Compliance",
  "compliance-hub": "Compliance",
  "batch-recall": "Batch Recall",
  "compliance-vault": "Compliance Vault",
  appointments: "Appointments",
  "support-tickets": "Support Tickets",
  "risk-management": "Risk Management",
  locations: "Locations",
  warehouses: "Warehouses",
  runners: "Runners",
  "vendor-management": "Vendor Management",
  "vendor-dashboard": "Vendor Dashboard",
  "bulk-operations": "Bulk Operations",
  receiving: "Receiving",

  // Developer & Integrations
  "developer-tools": "Developer Tools",
  "api-access": "API Access",
  webhooks: "Webhooks",
  "custom-integrations": "Custom Integrations",
  "data-export": "Data Export",
  "workflow-automation": "Workflow Automation",
  "local-ai": "Local AI",

  // Enterprise Features
  "white-label": "White Label",
  "custom-domain": "Custom Domain",
  "priority-support": "Priority Support",

  // POS
  "cash-register": "Cash Register",
  "pos-analytics": "POS Analytics",
  "pos-shifts": "POS Shifts",
  "z-reports": "Z Reports",

  // Menus
  "disposable-menus": "Disposable Menus",
  "menu-migration": "Menu Migration",
  "disposable-menu-orders": "Menu Orders",
  "disposable-menu-analytics": "Menu Analytics",
  "menu-analytics": "Menu Analytics",

  // Super Admin specific
  tenants: "Tenants",
  monitoring: "Monitoring",
  "data-explorer": "Data Explorer",
  "api-usage": "API Usage",
  "audit-logs": "Audit Logs",
  "revenue-analytics": "Revenue Analytics",
  "report-builder": "Report Builder",
  "executive-dashboard": "Executive Dashboard",
  workflows: "Workflows",
  communication: "Communication",
  "feature-flags": "Feature Flags",
  "system-config": "System Config",
  security: "Security",
  "forum-approvals": "Forum Approvals",
  "admin-users": "Admin Users",
  tools: "Tools",
  "marketplace/moderation": "Marketplace Moderation",
  "promo-codes": "Promo Codes",
  packages: "Credit Packages",
  referrals: "Referrals",
  transactions: "Transactions",

  // Auth pages
  login: "Login",
  signup: "Sign Up",
  "verify-email": "Verify Email",
  "forgot-password": "Forgot Password",
  "reset-password": "Reset Password",
  "change-password": "Change Password",
  "mfa-challenge": "MFA Challenge",
  "secure-account": "Secure Account",
  "signup-success": "Sign Up Success",
  "select-plan": "Select Plan",
  "setup-wizard": "Setup Wizard",
  welcome: "Welcome",
  "trial-expired": "Trial Expired",

  // Courier pages
  earnings: "Earnings",
  history: "History",
  delivery: "Active Delivery",

  // Customer shop
  cart: "Cart",
  checkout: "Checkout",
  "order-confirmation": "Order Confirmation",
  track: "Order Tracking",
  account: "Account",
  wishlist: "Wishlist",
  deals: "Deals",
  "express-checkout": "Express Checkout",
  wholesale: "Wholesale",

  // Public pages
  marketing: "Home",
  features: "Features",
  pricing: "Pricing",
  about: "About",
  contact: "Contact",
  demo: "Demo",
  integrations: "Integrations",
  docs: "Documentation",
  status: "Status",
  faq: "FAQ",
  support: "Support",
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  careers: "Careers",
  press: "Press",
  blog: "Blog",
  cookie: "Cookie Policy",
  cookies: "Cookie Policy",

  // Community
  create: "Create Post",
  search: "Search",
  approval: "Approvals",

  // Misc
  help: "Help",
  "help-hub": "Help Center",
  "global-search": "Search",
  "live-chat": "Live Chat",
  "wholesale-pricing-tiers": "Pricing Tiers",
  "sales/pricing": "Pricing",
};

/**
 * Converts a kebab-case path segment to Title Case.
 * e.g. "order-analytics" → "Order Analytics"
 */
function segmentToTitle(segment: string): string {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Determines if a segment looks like a dynamic parameter (UUID, numeric ID, slug).
 */
function isDynamicSegment(segment: string): boolean {
  // UUID pattern
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return true;
  // Numeric ID
  if (/^\d+$/.test(segment)) return true;
  // Short hex (common for tokens)
  if (/^[0-9a-f]{20,}$/i.test(segment)) return true;
  return false;
}

/**
 * Derives a page title from the current pathname.
 */
function getTitleFromPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return "FloraIQ";

  // Determine the portal prefix and meaningful segments
  let prefix = "";
  let meaningful: string[] = [];

  if (segments[0] === "super-admin") {
    prefix = "Super Admin";
    meaningful = segments.slice(1);
  } else if (segments[0] === "platform-admin") {
    prefix = "Platform Admin";
    meaningful = segments.slice(1);
  } else if (segments[0] === "courier") {
    prefix = "Courier";
    meaningful = segments.slice(1);
  } else if (segments[0] === "vendor") {
    prefix = "Vendor";
    meaningful = segments.slice(1);
  } else if (segments[0] === "community") {
    prefix = "Community";
    meaningful = segments.slice(1);
  } else if (segments.length >= 2 && segments[1] === "admin") {
    // Tenant admin: /:tenantSlug/admin/...
    meaningful = segments.slice(2);
  } else if (segments.length >= 2 && (segments[1] === "shop" || segments[1] === "customer")) {
    // Customer portal: /:tenantSlug/shop/... or /:tenantSlug/customer/...
    prefix = "Shop";
    meaningful = segments.slice(2);
  } else if (segments[0] === "shop" && segments.length >= 2) {
    // Public shop: /shop/:storeSlug/...
    prefix = "Shop";
    meaningful = segments.slice(2);
  } else if (segments[0] === "store" && segments.length >= 2) {
    // Public store: /store/:slug/...
    prefix = "Store";
    meaningful = segments.slice(2);
  } else {
    // Public pages
    meaningful = segments;
  }

  // Filter out dynamic segments (UUIDs, IDs)
  meaningful = meaningful.filter((s) => !isDynamicSegment(s));

  // If no meaningful segments remain, use the prefix or default
  if (meaningful.length === 0) {
    return prefix ? `FloraIQ — ${prefix}` : "FloraIQ";
  }

  // Try compound paths first (e.g. "credits/analytics")
  const compoundPath = meaningful.join("/");
  if (SEGMENT_LABELS[compoundPath]) {
    const label = SEGMENT_LABELS[compoundPath];
    return prefix ? `FloraIQ — ${prefix} — ${label}` : `FloraIQ — ${label}`;
  }

  // Use the last meaningful segment as the page title
  const lastSegment = meaningful[meaningful.length - 1];
  const label = SEGMENT_LABELS[lastSegment] || segmentToTitle(lastSegment);

  return prefix ? `FloraIQ — ${prefix} — ${label}` : `FloraIQ — ${label}`;
}

/**
 * DocumentTitleManager
 *
 * Automatically updates document.title on every route change based on
 * the current pathname. Placed inside BrowserRouter alongside
 * RouteProgressManager.
 *
 * Pages that use usePageTitle() will override this with their own title
 * since their effect runs after this component's effect.
 */
export function DocumentTitleManager() {
  const location = useLocation();
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    const newTitle = getTitleFromPath(location.pathname);
    document.title = newTitle;
    previousPath.current = location.pathname;
  }, [location.pathname]);

  return null;
}
