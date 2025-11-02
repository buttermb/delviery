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

### Similar Implementation for Tenant Admin and Super Admin

The same pattern is used for:
- `src/pages/tenant-admin/SettingsPage.tsx` → `tenant-admin-auth` Edge Function
- `src/pages/super-admin/SettingsPage.tsx` → `super-admin-auth` Edge Function

**Important:** Each Edge Function must be updated with the same `update-password` action handler.

---

## Subscription Management

### Subscription Cancellation

#### Implementation (`src/pages/super-admin/TenantDetailPage.tsx`)

```typescript
const handleCancelSubscription = async () => {
  if (!confirm("Are you sure you want to cancel this subscription?")) {
    return;
  }

  try {
    // Update tenant subscription status
    const { error: updateError } = await supabase
      .from("tenants")
      .update({
        subscription_status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    if (updateError) throw updateError;

    // Log subscription event
    const { error: eventError } = await supabase
      .from("subscription_events")
      .insert({
        tenant_id: tenantId,
        event_type: "cancelled",
        metadata: {
          cancelled_by: "super_admin",
          cancelled_at: new Date().toISOString(),
        },
      });

    if (eventError) throw eventError;

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ["super-admin-tenant", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["subscription-plan"] });

    toast({
      title: "Subscription Cancelled",
      description: "The subscription has been cancelled successfully.",
    });
  } catch (error: any) {
    toast({
      title: "Error",
      description: error.message || "Failed to cancel subscription",
      variant: "destructive",
    });
  }
};
```

### Usage

1. Navigate to Super Admin → Tenants
2. Click on a tenant to view details
3. Go to "Billing" tab
4. Find "Current Subscription" card
5. Click "Cancel" button
6. Confirm cancellation

**Note:** Cancelled subscriptions maintain access until the end of the billing period.

---

## Invoice Management

### Invoice View and Download

#### Implementation (`src/pages/super-admin/TenantDetailPage.tsx`)

```typescript
// Generate invoice HTML
const generateInvoiceHTML = (invoice: any, tenant: any) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice ${invoice.invoice_number}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
        .invoice-details { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        .total { font-weight: bold; font-size: 1.2em; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Invoice ${invoice.invoice_number}</h1>
        <p><strong>Tenant:</strong> ${tenant.business_name}</p>
      </div>
      <div class="invoice-details">
        <p><strong>Date:</strong> ${new Date(invoice.created_at).toLocaleDateString()}</p>
        <p><strong>Status:</strong> ${invoice.status}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.line_items?.map((item: any) => `
            <tr>
              <td>${item.description}</td>
              <td>$${item.amount.toFixed(2)}</td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr class="total">
            <td>Total</td>
            <td>$${invoice.total_amount.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </body>
    </html>
  `;
};

// View invoice
const handleViewInvoice = (invoice: any) => {
  const html = generateInvoiceHTML(invoice, tenant);
  const newWindow = window.open();
  if (newWindow) {
    newWindow.document.write(html);
    newWindow.document.close();
  }
};

// Download invoice
const handleDownloadInvoice = (invoice: any) => {
  const html = generateInvoiceHTML(invoice, tenant);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoice-${invoice.invoice_number}.html`;
  link.click();
  URL.revokeObjectURL(url);
};
```

### Usage

1. Navigate to Super Admin → Tenants → Select Tenant → Billing Tab
2. Scroll to "Billing History" table
3. Click "View" to open invoice in new window
4. Click "Download" to download invoice as HTML file

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

