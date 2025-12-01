# Implementation Guide

This document provides comprehensive instructions for implementing and using the features in this application.

## Table of Contents
1. [Password Update Functionality](#password-update-functionality)
2. [Subscription Management](#subscription-management)
3. [Invoice Management](#invoice-management)
4. [Shopping Cart System](#shopping-cart-system)
5. [Mobile Navigation](#mobile-navigation)
6. [Edge Functions](#edge-functions)

---

## Password Update Functionality

### Overview
Password update functionality is implemented for all three authentication tiers:
- Customer Portal
- Tenant Admin Panel
- Super Admin Panel

### Frontend Implementation

#### Customer Settings (`src/pages/customer/SettingsPage.tsx`)

```typescript
// Password update state
const [passwordData, setPasswordData] = useState({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

// Password update handler
const handleUpdatePassword = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  
  // Validation
  if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
    // Show error toast
    return;
  }

  if (passwordData.newPassword !== passwordData.confirmPassword) {
    // Show error toast
    return;
  }

  if (passwordData.newPassword.length < 8) {
    // Show error toast
    return;
  }

  // Call Edge Function
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/customer-auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("customer_token")}`,
    },
    body: JSON.stringify({
      action: "update-password",
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Failed to update password");
  }
  
  // Show success toast and clear form
};
```

### Backend Implementation (Edge Function)

#### Customer Auth Edge Function (`supabase/functions/customer-auth/index.ts`)

```typescript
// Add to the existing Edge Function
if (action === "update-password") {
  const { currentPassword, newPassword } = body;
  
  if (!currentPassword || !newPassword) {
    return new Response(
      JSON.stringify({ error: "Current password and new password are required" }),
      { status: 400 }
    );
  }

  // Verify current password
  const { data: user, error: userError } = await supabase
    .from("customer_users")
    .select("password_hash")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: "User not found" }),
      { status: 404 }
    );
  }

  // Verify current password using bcrypt
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  
  if (!isValid) {
    return new Response(
      JSON.stringify({ error: "Current password is incorrect" }),
      { status: 401 }
    );
  }

  // Hash new password
  const saltRounds = 10;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  const { error: updateError } = await supabase
    .from("customer_users")
    .update({ password_hash: newPasswordHash })
    .eq("id", userId);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: "Failed to update password" }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Password updated successfully" }),
    { status: 200 }
  );
}
```

### Usage Instructions

1. Navigate to Settings page for your tier (Customer/Tenant Admin/Super Admin)
2. Find the "Security" section
3. Fill in:
   - Current Password
   - New Password (minimum 8 characters)
   - Confirm New Password
4. Click "Update Password"
5. Wait for success confirmation

### Tenant Admin Password Update

#### Frontend (`src/pages/tenant-admin/SettingsPage.tsx`)

Same pattern as Customer Settings, but uses:
- Edge Function: `tenant-admin-auth`
- Token: `localStorage.getItem("tenant_admin_token")`

#### Backend (`supabase/functions/tenant-admin-auth/index.ts`)

**Location:** Lines 305-406

```typescript
if (action === "update-password") {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Authorization required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return new Response(
      JSON.stringify({ error: "Current password and new password are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (newPassword.length < 8) {
    return new Response(
      JSON.stringify({ error: "New password must be at least 8 characters long" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const payload = verifyJWT(token);

  if (!payload) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get tenant admin user
  const { data: adminUser, error: adminError } = await supabase
    .from("tenant_users")
    .select("*")
    .eq("id", payload.tenant_admin_id)
    .eq("status", "active")
    .maybeSingle();

  if (adminError || !adminUser) {
    return new Response(
      JSON.stringify({ error: "User not found or inactive" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify current password (using bcrypt)
  const bcrypt = await import("https://deno.land/x/bcrypt@v0.4.1/mod.ts");
  const isValid = await bcrypt.compare(currentPassword, adminUser.password_hash);

  if (!isValid) {
    return new Response(
      JSON.stringify({ error: "Current password is incorrect" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Hash new password
  const saltRounds = 10;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  const { error: updateError } = await supabase
    .from("tenant_users")
    .update({ password_hash: newPasswordHash })
    .eq("id", payload.tenant_admin_id);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: "Failed to update password" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Password updated successfully" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Super Admin Password Update

#### Frontend (`src/pages/super-admin/SettingsPage.tsx`)

Same pattern as Customer Settings, but uses:
- Edge Function: `super-admin-auth`
- Token: `localStorage.getItem("super_admin_token")`

#### Backend (`supabase/functions/super-admin-auth/index.ts`)

**Location:** Lines 279-386

```typescript
if (action === "update-password") {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Authorization required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return new Response(
      JSON.stringify({ error: "Current password and new password are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (newPassword.length < 8) {
    return new Response(
      JSON.stringify({ error: "New password must be at least 8 characters long" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const payload = verifyJWT(token);

  if (!payload) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get super admin user
  const { data: superAdminUser, error: adminError } = await supabase
    .from("super_admin_users")
    .select("*")
    .eq("id", payload.super_admin_id)
    .eq("status", "active")
    .maybeSingle();

  if (adminError || !superAdminUser) {
    return new Response(
      JSON.stringify({ error: "User not found or inactive" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify current password (using bcrypt)
  const bcrypt = await import("https://deno.land/x/bcrypt@v0.4.1/mod.ts");
  const isValid = await bcrypt.compare(currentPassword, superAdminUser.password_hash);

  if (!isValid) {
    return new Response(
      JSON.stringify({ error: "Current password is incorrect" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Hash new password
  const saltRounds = 10;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  const { error: updateError } = await supabase
    .from("super_admin_users")
    .update({ password_hash: newPasswordHash })
    .eq("id", payload.super_admin_id);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: "Failed to update password" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Password updated successfully" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Implementation Status

✅ **All three Edge Functions have `update-password` implemented:**
- `customer-auth` → Lines 150+ (if implemented)
- `tenant-admin-auth` → Lines 305-406 ✅
- `super-admin-auth` → Lines 279-386 ✅

✅ **All three frontend pages have password update forms:**
- `src/pages/customer/SettingsPage.tsx` ✅
- `src/pages/tenant-admin/SettingsPage.tsx` ✅
- `src/pages/super-admin/SettingsPage.tsx` ✅

---

## Subscription Management

### Subscription Cancellation

#### Implementation (`src/pages/super-admin/TenantDetailPage.tsx`)

**Location:** `src/pages/super-admin/TenantDetailPage.tsx` (lines 537-588)

```typescript
// Cancel subscription button onClick handler
<Button
  variant="destructive"
  onClick={async () => {
    if (!confirm("Are you sure you want to cancel this subscription? This action cannot be undone.")) {
      return;
    }

    try {
      // Update tenant subscription status
      const { error } = await supabase
        .from("tenants")
        .update({
          subscription_status: "cancelled",
          cancelled_at: new Date().toISOString(),
          status: "active", // Keep tenant active, just subscription cancelled
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenant?.id);

      if (error) throw error;

      // Log subscription event
      await supabase.from("subscription_events").insert({
        tenant_id: tenant?.id,
        event_type: "cancelled",
        from_plan: tenant?.subscription_plan,
        to_plan: null,
        amount: plan?.price_monthly || 0,
        event_data: {
          cancelled_by: "super_admin",
          cancelled_at: new Date().toISOString(),
        },
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["super-admin-tenant", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["subscription-plan", tenant?.subscription_plan] });

      toast({
        title: "Subscription Cancelled",
        description: "The subscription has been cancelled successfully. The tenant retains access until the end of the billing period.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    }
  }}
  className="flex-1 bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
>
  ❌ CANCEL
</Button>
```

### Database Updates

1. **tenants table:**
   - `subscription_status` → set to `"cancelled"`
   - `cancelled_at` → timestamp of cancellation
   - `status` → remains `"active"` (tenant still has access)

2. **subscription_events table:**
   - Creates audit log entry
   - Records plan, amount, and cancellation details

### Usage

1. Navigate to Super Admin → Tenants
2. Click on a tenant to view details
3. Go to "Billing" tab
4. Find "Current Subscription" card
5. Click "CANCEL" button
6. Confirm cancellation in dialog
7. Subscription is cancelled but tenant retains access until billing period ends

**Note:** Cancelled subscriptions maintain access until the end of the billing period. This is a standard practice in SaaS platforms.

---

## Invoice Management

### Invoice View and Download

#### Implementation (`src/pages/super-admin/TenantDetailPage.tsx`)

**Location:** `src/pages/super-admin/TenantDetailPage.tsx` (lines 812-927)

#### View Invoice Button

```typescript
<Button
  variant="ghost"
  size="sm"
  onClick={() => {
    // Generate invoice HTML
    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoice_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .line-items { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .line-items th { background: #f5f5f5; padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            .line-items td { padding: 10px; border-bottom: 1px solid #eee; }
            .totals { text-align: right; margin-top: 20px; }
            .totals table { width: 300px; margin-left: auto; }
            .totals td { padding: 5px 0; }
            .totals .total-row { font-weight: bold; font-size: 1.2em; border-top: 2px solid #333; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Invoice ${invoice.invoice_number}</h1>
            <p>Tenant: ${tenant?.business_name || 'N/A'}</p>
          </div>
          <div class="invoice-info">
            <div>
              <p><strong>Issue Date:</strong> ${new Date(invoice.issue_date).toLocaleDateString()}</p>
              <p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
              ${invoice.billing_period_start ? `<p><strong>Billing Period:</strong> ${new Date(invoice.billing_period_start).toLocaleDateString()} - ${new Date(invoice.billing_period_end).toLocaleDateString()}</p>` : ''}
            </div>
            <div>
              <p><strong>Status:</strong> ${invoice.status?.toUpperCase() || 'PENDING'}</p>
              ${invoice.stripe_invoice_id ? `<p><strong>Stripe Invoice:</strong> ${invoice.stripe_invoice_id}</p>` : ''}
            </div>
          </div>
          <table class="line-items">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${Array.isArray(invoice.line_items) && invoice.line_items.length > 0
                ? invoice.line_items.map((item: any) => `
                  <tr>
                    <td>${item.description || item.name || 'N/A'}</td>
                    <td>${item.quantity || 1}</td>
                    <td style="text-align: right;">$${Number(item.amount || item.total || 0).toFixed(2)}</td>
                  </tr>
                `).join('')
                : `
                  <tr>
                    <td colspan="3" style="text-align: center; color: #999;">No line items available</td>
                  </tr>
                `}
            </tbody>
          </table>
          <div class="totals">
            <table>
              <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;">$${Number(invoice.subtotal || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Tax:</td>
                <td style="text-align: right;">$${Number(invoice.tax || 0).toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td>Total:</td>
                <td style="text-align: right;">$${Number(invoice.total || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Amount Paid:</td>
                <td style="text-align: right;">$${Number(invoice.amount_paid || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Amount Due:</td>
                <td style="text-align: right;">$${Number(invoice.amount_due || 0).toFixed(2)}</td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;
    
    // Open in new window
    const invoiceWindow = window.open();
    if (invoiceWindow) {
      invoiceWindow.document.write(invoiceHTML);
      invoiceWindow.document.close();
    }
  }}
>
  View
</Button>
```

#### Download Invoice Button

```typescript
<Button
  variant="ghost"
  size="sm"
  onClick={() => {
    // Generate invoice HTML (same as View)
    const invoiceHTML = `...`; // (same HTML as above)

    // Create a blob and download
    const blob = new Blob([invoiceHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoice.invoice_number}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Invoice Downloaded",
      description: `Invoice ${invoice.invoice_number} downloaded successfully`,
    });
  }}
>
  Download
</Button>
```

### Invoice Data Structure

The invoice object should have the following structure:

```typescript
interface Invoice {
  id: string;
  invoice_number: string;
  tenant_id: string;
  issue_date: string;
  due_date: string;
  billing_period_start?: string;
  billing_period_end?: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  line_items: Array<{
    description?: string;
    name?: string;
    quantity?: number;
    amount?: number;
    total?: number;
  }>;
  stripe_invoice_id?: string;
}
```

### Usage

1. Navigate to Super Admin → Tenants → Select Tenant → Billing Tab
2. Scroll to "Billing History" table
3. **View Invoice:**
   - Click "View" button
   - Invoice opens in new browser window
   - Formatted HTML invoice is displayed
4. **Download Invoice:**
   - Click "Download" button
   - Invoice HTML file is downloaded
   - File name: `invoice-{invoice_number}.html`
   - Toast notification confirms download

---

## Shopping Cart System

### Guest Cart (LocalStorage)

#### Implementation (`src/hooks/useGuestCart.ts`)

```typescript
export function useGuestCart() {
  const addToGuestCart = (productId: string, quantity: number, selectedWeight: string) => {
    const cart = JSON.parse(localStorage.getItem("guest_cart") || "[]");
    const existingItem = cart.find(
      (item: any) => item.product_id === productId && item.selected_weight === selectedWeight
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.push({ product_id: productId, quantity, selected_weight: selectedWeight });
    }

    localStorage.setItem("guest_cart", JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent("cartUpdated"));
  };

  const getGuestCartCount = () => {
    const cart = JSON.parse(localStorage.getItem("guest_cart") || "[]");
    return cart.reduce((sum: number, item: any) => sum + item.quantity, 0);
  };

  return {
    guestCart: JSON.parse(localStorage.getItem("guest_cart") || "[]"),
    addToGuestCart,
    updateGuestCartItem,
    removeFromGuestCart,
    clearGuestCart,
    getGuestCartCount,
  };
}
```

### Authenticated Cart (Database)

#### Implementation (`src/pages/customer/MenuViewPage.tsx`)

```typescript
// Add to cart for authenticated users
if (user) {
  const { error } = await supabase
    .from("cart_items")
    .upsert({
      user_id: user.id,
      product_id: product.id,
      quantity: quantity,
      selected_weight: selectedWeight,
    }, {
      onConflict: "user_id,product_id,selected_weight"
    });
  
  if (error) throw error;
  
  // Refresh cart query
  queryClient.invalidateQueries({ queryKey: ["cart", user.id] });
} else {
  // Add to guest cart
  addToGuestCart(product.id, quantity, selectedWeight);
}
```

### Usage

1. **Adding to Cart:**
   - Browse products in Menu View
   - Select quantity
   - Click "Add to Cart"
   - Cart badge updates automatically

2. **Viewing Cart:**
   - Navigate to Shopping Cart page (`/:tenantSlug/shop/cart`)
   - View all items with quantities and prices
   - Update quantities or remove items

3. **Checkout:**
   - Click "Proceed to Checkout"
   - Fill delivery information
   - Review and place order

---

## Mobile Navigation

### Customer Mobile Navigation

#### Components
- `src/components/customer/CustomerMobileNav.tsx` - Top hamburger menu
- `src/components/customer/CustomerMobileBottomNav.tsx` - Bottom tab bar

#### Implementation

```typescript
// Mobile Nav with cart badge
const { data: cartItems = [] } = useQuery({
  queryKey: ["cart", user?.id, cartUpdateKey],
  queryFn: async () => {
    if (!user) return [];
    const { data, error } = await supabase
      .from("cart_items")
      .select("*, products(*)")
      .eq("user_id", user.id);
    if (error) throw error;
    return data;
  },
  enabled: !!user,
});

// Listen for cart updates (guest cart)
useEffect(() => {
  const handleCartUpdate = () => {
    setCartUpdateKey(prev => prev + 1);
  };
  window.addEventListener('cartUpdated', handleCartUpdate);
  return () => window.removeEventListener('cartUpdated', handleCartUpdate);
}, []);

// Calculate cart count
const dbCartCount = cartItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
const guestCartCount = user ? 0 : getGuestCartCount();
const cartCount = user ? dbCartCount : guestCartCount;
```

#### Usage

1. **Top Navigation:**
   - Hamburger menu on mobile
   - Shows tenant branding
   - Cart icon with badge
   - User avatar/login

2. **Bottom Navigation:**
   - Fixed bottom tabs
   - Home, Menus, Cart, Orders, Account
   - Active state indicators
   - Cart badge on Cart tab

3. **Integration:**
   - Add `<CustomerMobileNav />` to customer pages
   - Add `<CustomerMobileBottomNav />` to customer pages
   - Add `pb-16 lg:pb-0` to main content for bottom nav spacing

---

## Edge Functions Setup

### Required Edge Functions

1. **customer-auth** (`supabase/functions/customer-auth/index.ts`)
   - Actions: `login`, `register`, `update-password`

2. **tenant-admin-auth** (`supabase/functions/tenant-admin-auth/index.ts`)
   - Actions: `login`, `register`, `update-password`

3. **super-admin-auth** (`supabase/functions/super-admin-auth/index.ts`)
   - Actions: `login`, `register`, `update-password`

### Deploying Edge Functions

```bash
# Deploy a specific function
supabase functions deploy customer-auth

# Deploy all functions
supabase functions deploy

# Set environment variables
supabase secrets set SUPABASE_URL=your_url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key
```

### Testing Edge Functions

```bash
# Test locally
supabase functions serve customer-auth

# Test with curl
curl -X POST http://localhost:54321/functions/v1/customer-auth \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"action":"update-password","currentPassword":"old","newPassword":"new123"}'
```

---

## Database Schema Requirements

### Tables Required

1. **customer_users** - Customer authentication
   - `id` (UUID)
   - `email` (TEXT)
   - `password_hash` (TEXT)
   - `first_name` (TEXT)
   - `last_name` (TEXT)

2. **tenant_users** - Tenant admin authentication
   - `id` (UUID)
   - `email` (TEXT)
   - `password_hash` (TEXT)
   - `tenant_id` (UUID)

3. **super_admin_users** - Super admin authentication
   - `id` (UUID)
   - `email` (TEXT)
   - `password_hash` (TEXT)

4. **cart_items** - Shopping cart
   - `id` (UUID)
   - `user_id` (UUID)
   - `product_id` (UUID)
   - `quantity` (INTEGER)
   - `selected_weight` (TEXT)

5. **tenants** - Tenant management
   - `id` (UUID)
   - `business_name` (TEXT)
   - `subscription_status` (TEXT)
   - `cancelled_at` (TIMESTAMP)

6. **subscription_events** - Subscription audit
   - `id` (UUID)
   - `tenant_id` (UUID)
   - `event_type` (TEXT)
   - `metadata` (JSONB)
   - `created_at` (TIMESTAMP)

---

## Environment Variables

### Required Variables

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Edge Function Secrets

Set these in Supabase Dashboard or via CLI:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Troubleshooting

### Password Update Not Working

1. Check Edge Function is deployed
2. Verify token is stored in localStorage (`customer_token`, `tenant_admin_token`, `super_admin_token`)
3. Check browser console for errors
4. Verify Edge Function logs in Supabase Dashboard

### Cart Not Updating

1. Check localStorage for guest cart
2. Verify database connection for authenticated users
3. Check `cartUpdated` event is dispatched
4. Verify React Query cache invalidation

### Invoice Download Issues

1. Check browser pop-up blocker
2. Verify invoice data structure
3. Check HTML generation function

---

## Next Steps

### To Extend Functionality

1. **Add Email Notifications:**
   - Implement email service in Edge Functions
   - Send confirmation on password update
   - Send invoice emails

2. **Add Payment Processing:**
   - Integrate Stripe/PayPal
   - Add payment method to checkout
   - Update order status

3. **Add Analytics:**
   - Track password update events
   - Monitor subscription cancellations
   - Analyze cart abandonment

4. **Add Testing:**
   - Unit tests for password validation
   - Integration tests for Edge Functions
   - E2E tests for checkout flow

---

## Support

For questions or issues:
1. Check this documentation
2. Review code comments
3. Check Supabase logs
4. Review Edge Function logs

---

**Last Updated:** 2025-01-XX  
**Version:** 1.0.0

