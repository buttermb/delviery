# 📋 Disposable Menu - Complete Order Flow Documentation

## 🎯 Overview

This document provides **complete step-by-step flow** for disposable menus from creation to customer checkout, including all database operations, edge functions, and user interactions.

---

## 📊 Complete Flow Diagram

```
ADMIN CREATES MENU
    ↓
MENU SHARED WITH CUSTOMER
    ↓
CUSTOMER ACCESSES MENU LINK
    ↓
CUSTOMER ENTERS ACCESS CODE
    ↓
ACCESS VALIDATION (Security Checks)
    ↓
CUSTOMER VIEWS MENU
    ↓
CUSTOMER ADDS ITEMS TO CART
    ↓
CUSTOMER PLACES ORDER
    ↓
ORDER PROCESSED & STORED
    ↓
ADMIN RECEIVES ORDER NOTIFICATION
```

---

## 🔄 Phase 1: Menu Creation (Admin Side)

### Step 1.1: Admin Navigates to Disposable Menus

**Route**: `/admin/disposable-menus`  
**File**: `src/pages/admin/DisposableMenus.tsx`

**Flow**:
1. Admin logs in → Tenant Admin Dashboard
2. Clicks "Disposable Menus" in sidebar
3. Page loads:
   - Lists all existing menus (active, burned, draft)
   - Shows menu statistics (total views, today's orders)
   - Displays security alerts

**Database Query**:
```typescript
// Query disposable_menus with related data
const { data: menus } = await supabase
  .from('disposable_menus')
  .select(`
    *,
    menu_products:disposable_menu_products(*),
    menu_access_logs:menu_access_logs(count),
    menu_orders:menu_orders(*)
  `)
  .eq('tenant_id', tenant.id)
  .order('created_at', { ascending: false });
```

---

### Step 1.2: Admin Creates New Menu

**Two Options Available**:

#### Option A: Quick Create Dialog
**Component**: `src/components/admin/disposable-menus/CreateMenuDialog.tsx`

**Flow**:
1. Admin clicks "Quick Create" button
2. 6-step wizard opens:
   - **Step 1: Basic Info**
     - Menu name
     - Description
     - Min/max order quantities
   - **Step 2: Products**
     - Search and select products from inventory
     - Set custom prices per product (optional)
   - **Step 3: Access Control**
     - Access type: `invite_only` | `shared` | `hybrid`
     - Require access code (8-character alphanumeric)
     - Auto-generate or custom access code
   - **Step 4: Security**
     - Geofencing (location restrictions)
     - Time restrictions (allowed hours)
     - View limits
     - Screenshot protection
     - Device locking
     - Auto-burn settings
   - **Step 5: Notifications**
     - Notify on suspicious IP
     - Notify on failed code attempts
     - Notify on high views
     - Notify on share attempts
     - Notify on geofence violations
   - **Step 6: Appearance**
     - Style: `professional` | `minimal` | `anonymous`
     - Show product images
     - Show availability
     - Show contact info
     - Custom message

3. Admin clicks "Create Menu"

**Frontend Action**:
```typescript
const createMenu = useCreateDisposableMenu();

await createMenu.mutateAsync({
  name,
  description,
  selectedProducts,
  minOrder,
  maxOrder,
  accessType,
  requireAccessCode,
  accessCode,
  securitySettings: {
    requireGeofence,
    geofenceRadius,
    geofenceLocation,
    timeRestrictions,
    allowedHoursStart,
    allowedHoursEnd,
    viewLimit,
    screenshotProtection,
    deviceLocking,
    autoBurnHours
  },
  notificationSettings: {
    notifyOnSuspiciousIp,
    notifyOnFailedCode,
    notifyOnHighViews,
    notifyOnShareAttempt,
    notifyOnGeofenceViolation
  },
  appearanceSettings: {
    appearanceStyle,
    showProductImages,
    showAvailability,
    showContactInfo,
    customMessage
  }
});
```

**Database Operations** (via `useCreateDisposableMenu` hook):
```typescript
// 1. Insert disposable_menus record
const { data: menu, error } = await supabase
  .from('disposable_menus')
  .insert({
    tenant_id: tenant.id,
    name,
    description,
    access_code: requireAccessCode ? accessCode : null,
    access_type: accessType,
    min_order_quantity: parseInt(minOrder),
    max_order_quantity: parseInt(maxOrder),
    status: 'active',
    security_settings: {
      geofencing: requireGeofence ? {
        enabled: true,
        radius: parseInt(geofenceRadius),
        location: geofenceLocation
      } : null,
      time_restrictions: timeRestrictions ? {
        enabled: true,
        start_hour: parseInt(allowedHoursStart),
        end_hour: parseInt(allowedHoursEnd)
      } : null,
      view_limit: viewLimit === 'unlimited' ? null : parseInt(viewLimit),
      screenshot_protection: screenshotProtection,
      device_locking: deviceLocking,
      auto_burn_hours: autoBurnHours === 'never' ? null : parseInt(autoBurnHours)
    },
    notification_settings: notificationSettings,
    appearance_settings: appearanceSettings
  })
  .select()
  .single();

// 2. Insert menu_products for each selected product
const menuProducts = selectedProducts.map(productId => ({
  menu_id: menu.id,
  product_id: productId,
  custom_price: customPrices[productId] || null
}));

await supabase
  .from('disposable_menu_products')
  .insert(menuProducts);

// 3. Generate encrypted URL token (if not exists)
const encryptedToken = generateEncryptedToken(menu.id);
await supabase
  .from('disposable_menus')
  .update({ encrypted_url_token: encryptedToken })
  .eq('id', menu.id);
```

**Response**:
- Menu created successfully
- Access code generated (if required)
- Encrypted URL token generated
- Menu appears in list

---

### Step 1.3: Admin Shares Menu with Customer

**Component**: `src/components/admin/disposable-menus/MenuAccessDetails.tsx`

**Flow**:
1. Admin clicks on menu card
2. Menu detail modal opens
3. Admin clicks "Share" button
4. Share dialog opens with tabs:
   - **Link & QR Tab**:
     - Display menu URL: `https://[domain]/m/[encrypted_token]`
     - Display QR code (downloadable PNG)
     - Copy link button
     - Share via WhatsApp button
     - Share via Email button
   - **SMS Blast Tab**:
     - Select customers (multi-select from `wholesale_clients`)
     - Customize message
     - Click "Send SMS" (requires SMS provider)
   - **Customers Tab**:
     - View whitelist entries
     - See invitation dates and status

**If Invite-Only Menu**:
```typescript
// Create whitelist entry for customer
const { data: whitelist } = await supabase
  .from('menu_access_whitelist')
  .insert({
    menu_id: menu.id,
    customer_name: customer.name,
    customer_phone: customer.phone,
    customer_email: customer.email,
    unique_access_token: generateUniqueToken(), // 32-char token
    status: 'active',
    invited_at: new Date().toISOString()
  })
  .select()
  .single();

// Generate shareable URL with unique token
const shareableUrl = `https://[domain]/m/${menu.encrypted_url_token}?u=${whitelist.unique_access_token}`;
```

**If Shared Menu**:
```typescript
// No whitelist needed, just share the URL
const shareableUrl = `https://[domain]/m/${menu.encrypted_url_token}`;
```

**Sending Access Link** (Edge Function):
```typescript
// Edge Function: send-menu-access-link
await supabase.functions.invoke('send-menu-access-link', {
  body: {
    menu_id: menu.id,
    whitelist_id: whitelist?.id,
    customer_phone: customer.phone,
    customer_email: customer.email,
    access_code: menu.access_code,
    shareable_url: shareableUrl
  }
});
```

**Edge Function Process** (`supabase/functions/send-menu-access-link/index.ts`):
1. Validates menu exists and is active
2. If whitelist_id provided: Validates whitelist entry
3. Sends SMS via Twilio (if phone provided)
4. Sends Email via Klaviyo (if email provided)
5. Message includes:
   - Shareable URL
   - Access code (if required)
   - Instructions

---

## 🔄 Phase 2: Customer Access (Customer Side)

### Step 2.1: Customer Receives Menu Link

**Delivery Methods**:
- **SMS**: Customer receives text with link and access code
- **Email**: Customer receives email with link and access code
- **Direct Share**: Admin shares link directly (WhatsApp, etc.)

**Link Format**:
- **Invite-Only**: `https://[domain]/m/[encrypted_token]?u=[unique_token]`
- **Shared**: `https://[domain]/m/[encrypted_token]`

---

### Step 2.2: Customer Clicks Menu Link

**Route**: `/m/:token`  
**Component**: `src/pages/customer/SecureMenuAccess.tsx`

**Flow**:
1. Customer clicks link → Navigates to `/m/[encrypted_token]`
2. Page loads:
   - Requests location permission (for geofencing)
   - Generates device fingerprint
   - Shows access code input form
3. Customer enters 8-character access code
4. Customer clicks "Access Menu"

**Device Fingerprint Generation**:
```typescript
const generateDeviceFingerprint = () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
  }
  
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screen: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvas: canvas.toDataURL()
  };
};

const fingerprint = generateDeviceFingerprint();
const deviceHash = btoa(JSON.stringify(fingerprint));
```

**Access Validation Request**:
```typescript
const { data, error } = await supabase.functions.invoke('menu-access-validate', {
  body: {
    encrypted_url_token: token, // from URL
    access_code: accessCode.toUpperCase(),
    unique_access_token: uniqueToken, // from ?u= query param (if invite-only)
    device_fingerprint: deviceHash,
    location: {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    },
    ip_address: 'client', // Will be extracted server-side
    user_agent: navigator.userAgent
  }
});
```

---

### Step 2.3: Access Validation (Edge Function)

**Edge Function**: `supabase/functions/menu-access-validate/index.ts`

**Process**:
1. **Extract IP Address** (server-side):
   ```typescript
   const ip_address = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
   ```

2. **Decrypt and Validate Token**:
   ```typescript
   // Query menu by encrypted_url_token
   const { data: menu } = await supabase
     .from('disposable_menus')
     .where('encrypted_url_token', encrypted_url_token)
     .single();
   
   if (!menu || menu.status !== 'active') {
     return { error: 'Menu not available' };
   }
   ```

3. **Validate Access Code**:
   ```typescript
   if (menu.access_code && access_code !== menu.access_code) {
     // Log failed attempt
     await logSecurityEvent('failed_access_code', menu.id);
     return { error: 'Invalid access code' };
   }
   ```

4. **Validate Whitelist** (if invite-only):
   ```typescript
   if (menu.access_type === 'invite_only' && unique_access_token) {
     const { data: whitelist } = await supabase
       .from('menu_access_whitelist')
       .where('menu_id', menu.id)
       .where('unique_access_token', unique_access_token)
       .where('status', 'active')
       .single();
     
     if (!whitelist) {
       return { error: 'Access not authorized' };
     }
   }
   ```

5. **Geofencing Check**:
   ```typescript
   if (menu.security_settings?.geofencing?.enabled) {
     const geofence = menu.security_settings.geofencing;
     const distance = calculateDistance(
       location,
       geofence.location,
       geofence.radius
     );
     
     if (distance > geofence.radius) {
       await logSecurityEvent('geofence_violation', menu.id);
       return { 
         error: 'Location not authorized',
         violations: ['Geofence violation']
       };
     }
   }
   ```

6. **Time Restrictions Check**:
   ```typescript
   if (menu.security_settings?.time_restrictions?.enabled) {
     const now = new Date();
     const currentHour = now.getHours();
     const { start_hour, end_hour } = menu.security_settings.time_restrictions;
     
     if (currentHour < start_hour || currentHour > end_hour) {
       return { 
         error: 'Access outside allowed hours',
         violations: ['Time restriction violation']
       };
     }
   }
   ```

7. **View Limit Check**:
   ```typescript
   if (menu.security_settings?.view_limit) {
     const { count } = await supabase
       .from('menu_access_logs')
       .where('menu_id', menu.id)
       .where('access_whitelist_id', whitelist?.id)
       .count();
     
     if (count >= menu.security_settings.view_limit) {
       return { error: 'View limit exceeded' };
     }
   }
   ```

8. **Device Locking Check**:
   ```typescript
   if (menu.security_settings?.device_locking) {
     const { data: existingDevice } = await supabase
       .from('menu_device_locks')
       .where('menu_id', menu.id)
       .where('access_whitelist_id', whitelist?.id)
       .where('device_fingerprint', device_fingerprint)
       .single();
     
     if (!existingDevice) {
       // Lock to this device
       await supabase
         .from('menu_device_locks')
         .insert({
           menu_id: menu.id,
           access_whitelist_id: whitelist?.id,
           device_fingerprint: device_fingerprint
         });
     }
   }
   ```

9. **Load Menu Data**:
   ```typescript
   // Query products for menu
   const { data: menuProducts } = await supabase
     .from('disposable_menu_products')
     .select(`
       *,
       product:products(*)
     `)
     .where('menu_id', menu.id);
   
   // Format menu data
   const menuData = {
     menu_id: menu.id,
     whitelist_id: whitelist?.id,
     name: menu.name,
     description: menu.description,
     products: menuProducts.map(mp => ({
       ...mp.product,
       custom_price: mp.custom_price || mp.product.price
     })),
     appearance_settings: menu.appearance_settings,
     min_order_quantity: menu.min_order_quantity,
     max_order_quantity: menu.max_order_quantity
   };
   ```

10. **Log Access**:
    ```typescript
    await supabase
      .from('menu_access_logs')
      .insert({
        menu_id: menu.id,
        access_whitelist_id: whitelist?.id,
        access_type: 'view',
        device_fingerprint: device_fingerprint,
        ip_address: ip_address,
        location: location,
        actions_taken: { action: 'menu_viewed' }
      });
    ```

11. **Return Response**:
    ```typescript
    return {
      access_granted: true,
      menu_data: menuData
    };
    ```

---

### Step 2.4: Customer Views Menu

**Route**: `/m/:token/view`  
**Component**: `src/pages/customer/SecureMenuView.tsx`

**Flow**:
1. Access validation successful
2. Menu data stored in `sessionStorage`:
   ```typescript
   sessionStorage.setItem(`menu_${token}`, JSON.stringify(menuData));
   ```
3. Redirect to `/m/${token}/view`
4. Page loads menu data from sessionStorage
5. Display:
   - Menu header (name, description)
   - Product grid/list
   - Shopping cart sidebar
   - Security indicators (encrypted badge, etc.)

**Product Display**:
- Product cards with:
  - Image (if `appearance_settings.show_product_images`)
  - Name, description
  - Price (custom price if set, else product price)
  - Weight options (if product has multiple weights)
  - Availability (if `appearance_settings.show_availability`)
  - Add to cart button

**Cart Management** (Zustand Store):
```typescript
// Cart items stored in Zustand store
const cartItems = useMenuCartStore((state) => state.items);

// Add item to cart
addItem({
  productId: product.id,
  weight: selectedWeight,
  price: getProductPrice(product, selectedWeight),
  productName: product.name
});

// Update quantity
updateQuantity(productId, delta);

// Remove item
removeItem(productId);
```

**Cart Persistence**:
- Cart stored in Zustand store (in-memory)
- Persisted to `sessionStorage` with menu token
- Survives page refresh

---

## 🔄 Phase 3: Order Placement (Customer Side)

### Step 3.1: Customer Adds Items to Cart

**Flow**:
1. Customer browses products
2. Selects weight option (if multiple available)
3. Clicks "Add to Cart" or adjusts quantity
4. Cart updates in real-time:
   - Item count
   - Total price
   - Item list

**Cart State**:
```typescript
interface CartItem {
  productId: string;
  weight: string;
  price: number;
  quantity: number;
  productName: string;
}

// Cart stored in Zustand store
const cartItems: CartItem[] = [
  {
    productId: 'prod-123',
    weight: '1oz',
    price: 150.00,
    quantity: 2,
    productName: 'Product Name'
  },
  // ... more items
];
```

---

### Step 3.2: Customer Clicks "Place Order"

**Flow**:
1. Customer reviews cart
2. Clicks "Place Order" button
3. Prompt for contact phone:
   ```typescript
   const contact_phone = prompt("Enter your contact phone number for order updates:");
   if (!contact_phone?.trim()) {
     toast.error('Phone number is required to place an order');
     return;
   }
   ```

4. Order placement request:
   ```typescript
   const orderItems = cartItems.map(item => {
     const product = menuData.products.find(p => p.id === item.productId);
     return {
       product_id: item.productId,
       quantity: item.quantity,
       price: item.price,
       weight: item.weight
     };
   });

   const { data, error } = await supabase.functions.invoke('menu-order-place', {
     body: {
       menu_id: menuData.menu_id,
       access_token: menuData.whitelist_id, // if invite-only
       order_items: orderItems,
       contact_phone: contact_phone.trim(),
       delivery_method: 'pickup', // default
       payment_method: 'cash', // default
       delivery_address: '',
       customer_notes: ''
     }
   });
   ```

---

### Step 3.3: Order Processing (Edge Function)

**Edge Function**: `supabase/functions/menu-order-place/index.ts`

**Process**:
1. **Validate Input**:
   ```typescript
   if (!menu_id || !order_items || order_items.length === 0 || !contact_phone) {
     return { error: 'Missing required fields' };
   }
   ```

2. **Verify Menu is Active**:
   ```typescript
   const { data: menu } = await supabase
     .from('disposable_menus')
     .select('*')
     .eq('id', menu_id)
     .single();

   if (!menu || menu.status !== 'active') {
     return { error: 'Menu not available' };
   }
   ```

3. **Validate Whitelist** (if invite-only):
   ```typescript
   let whitelistEntry = null;
   if (access_token) {
     const { data: whitelist } = await supabase
       .from('menu_access_whitelist')
       .select('*')
       .eq('menu_id', menu_id)
       .eq('unique_access_token', access_token)
       .eq('status', 'active')
       .single();

     if (whitelist) {
       whitelistEntry = whitelist;
     }
   }
   ```

4. **Calculate Total**:
   ```typescript
   const total_amount = order_items.reduce((sum, item) => {
     return sum + (parseFloat(item.price) * parseFloat(item.quantity));
   }, 0);
   ```

5. **Check Min/Max Order Quantities**:
   ```typescript
   const totalQuantity = order_items.reduce((sum, item) => 
     sum + parseFloat(item.quantity), 0);
   
   if (menu.min_order_quantity && totalQuantity < menu.min_order_quantity) {
     return { 
       error: `Minimum order quantity is ${menu.min_order_quantity}` 
     };
   }

   if (menu.max_order_quantity && totalQuantity > menu.max_order_quantity) {
     return { 
       error: `Maximum order quantity is ${menu.max_order_quantity}` 
     };
   }
   ```

6. **Create Order Record**:
   ```typescript
   const { data: order, error: orderError } = await supabase
     .from('menu_orders')
     .insert({
       menu_id,
       access_whitelist_id: whitelistEntry?.id || null,
       order_data: { 
         items: order_items,
         customer_phone: contact_phone
       },
       total_amount,
       delivery_method,
       payment_method,
       contact_phone,
       delivery_address,
       customer_notes,
       status: 'pending'
     })
     .select()
     .single();
   ```

7. **Log Order Action**:
   ```typescript
   if (whitelistEntry) {
     await supabase
       .from('menu_access_logs')
       .insert({
         menu_id,
         access_whitelist_id: whitelistEntry.id,
         actions_taken: { 
           action: 'placed_order', 
           order_id: order.id 
         }
       });
   }
   ```

8. **Return Success Response**:
   ```typescript
   return {
     success: true,
     order_id: order.id,
     order_number: `MENU-${order.id.slice(0, 8).toUpperCase()}`,
     total: total_amount,
     status: 'pending'
   };
   ```

---

### Step 3.4: Order Confirmation (Customer Side)

**Flow**:
1. Edge function returns success
2. Frontend shows success toast:
   ```typescript
   showSuccessToast('Order Placed', 'Your order has been submitted successfully');
   ```
3. Cart cleared:
   ```typescript
   clearCart();
   setSelectedWeights({});
   ```
4. Session cleared (after 2 seconds):
   ```typescript
   setTimeout(() => {
     sessionStorage.removeItem(`menu_${token}`);
     navigate('/');
   }, 2000);
   ```

---

## 🔄 Phase 4: Order Management (Admin Side)

### Step 4.1: Admin Views Orders

**Route**: `/admin/disposable-menu-orders`  
**Component**: `src/pages/admin/DisposableMenuOrders.tsx`

**Flow**:
1. Admin navigates to "Menu Orders" page
2. Page loads all menu orders:
   ```typescript
   const { data: orders } = await supabase
     .from('menu_orders')
     .select(`
       *,
       menu:disposable_menus(name),
       whitelist:menu_access_whitelist(customer_name, customer_phone)
     `)
     .eq('tenant_id', tenant.id)
     .order('created_at', { ascending: false });
   ```

3. Display:
   - Order list (table)
   - Filter by menu, status, date
   - Search by order number, customer phone
   - Order details modal

**Order Display**:
- Order number
- Menu name
- Customer info (name, phone)
- Total amount
- Status (pending, processing, completed, cancelled)
- Created date
- Order items (expandable)

---

### Step 4.2: Admin Updates Order Status

**Flow**:
1. Admin clicks order row
2. Order detail modal opens
3. Admin changes status (dropdown)
4. Update request:
   ```typescript
   await supabase
     .from('menu_orders')
     .update({ status: newStatus })
     .eq('id', orderId);
   ```

5. If status = "completed":
   - Send completion notification (SMS/Email)
   - Update inventory (if needed)
   - Log completion event

---

## 📊 Database Tables Used

### Core Tables

1. **`disposable_menus`**
   - Menu records
   - Security settings (JSONB)
   - Notification settings (JSONB)
   - Appearance settings (JSONB)

2. **`disposable_menu_products`**
   - Menu-product relationships
   - Custom prices

3. **`menu_access_whitelist`**
   - Customer whitelist entries (invite-only menus)
   - Unique access tokens

4. **`menu_orders`**
   - Order records
   - Order data (JSONB)
   - Customer contact info

5. **`menu_access_logs`**
   - Access tracking
   - Security events
   - Actions taken (JSONB)

6. **`menu_device_locks`**
   - Device locking (if enabled)
   - Device fingerprints

### Related Tables

- `products` - Product catalog
- `wholesale_clients` - Customer records
- `tenants` - Tenant information

---

## 🔐 Security Features

### Access Control
- **Access Codes**: 8-character alphanumeric codes
- **Whitelist**: Invite-only menu access
- **Device Locking**: Lock menu to specific device

### Geofencing
- Location-based access restrictions
- Radius-based validation
- Violation logging

### Time Restrictions
- Allowed hours configuration
- Outside-hours access blocked

### View Limits
- Maximum view count per customer
- Prevents link sharing

### Screenshot Protection
- Watermark on screenshots
- Screenshot detection (if enabled)

### Monitoring
- IP address tracking
- Device fingerprinting
- Access attempt logging
- Security event alerts

---

## 📱 Edge Functions

1. **`menu-access-validate`**
   - Validates customer access
   - Checks security settings
   - Returns menu data

2. **`menu-order-place`**
   - Processes customer orders
   - Validates order constraints
   - Creates order records

3. **`send-menu-access-link`**
   - Sends access links via SMS/Email
   - Generates whitelist entries

4. **`menu-burn`**
   - Burns/destroys menus
   - Invalidates access

5. **`menu-whitelist-manage`**
   - Manages whitelist entries
   - Adds/revokes access

---

## 🎯 Complete Flow Summary

### Admin Side
1. Create menu (6-step wizard)
2. Configure security settings
3. Share menu with customers
4. Monitor access and orders
5. Process orders

### Customer Side
1. Receive menu link (SMS/Email)
2. Click link → Access page
3. Enter access code
4. Access validated (security checks)
5. View menu products
6. Add items to cart
7. Place order
8. Receive confirmation

### System Side
1. Menu created in database
2. Access tokens generated
3. Security checks enforced
4. Orders stored
5. Notifications sent
6. Analytics tracked

---

**Document End** - Complete disposable menu flow from creation to checkout documented.

