# 🚀 Lovable Integration Guide - Forum Menu Feature

## 📋 Overview

This guide provides step-by-step instructions for integrating the Forum Menu feature into your BigMike Wholesale Platform using Lovable. The Forum Menu allows business admins to create menus that automatically redirect customers to the community forum.

---

## 🎯 What This Feature Does

- **Business Admins** can create a special "Forum Menu" template
- **Customers** accessing the menu are automatically redirected to `/community`
- **Seamless Integration** with existing disposable menu system
- **Visual Indicators** show forum menus in admin dashboard
- **Forum-Specific Messaging** in share dialogs (SMS, WhatsApp, Email)

---

## ✅ Pre-Integration Checklist

Before starting, verify you have:

- [ ] Access to Supabase project
- [ ] Database migration access
- [ ] Edge function deployment access
- [ ] Frontend build access
- [ ] Test tenant account

---

## 📦 Step 1: Database Migration

### What Needs to Happen
The database schema already supports forum menus through the `security_settings` JSONB field in `disposable_menus`. No new migration is required, but verify the field exists:

```sql
-- Verify security_settings column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'disposable_menus' 
AND column_name = 'security_settings';
```

**Expected Result:** Should return `security_settings` with type `jsonb`

### If Column Doesn't Exist
```sql
ALTER TABLE disposable_menus 
ADD COLUMN IF NOT EXISTS security_settings JSONB DEFAULT '{}';
```

---

## 🔧 Step 2: Edge Function Update

### File to Update
`supabase/functions/menu-access-validate/index.ts`

### What to Change
The edge function needs to return `security_settings` in the `menu_data` response.

### Current Code (Line ~336)
```typescript
menu_data: {
  id: menu.id,
  name: menu.name,
  description: menu.description,
  products: products,
  menu_id: menu.id,
  whitelist_id: whitelist_entry?.id || null,
  min_order_quantity: menu.min_order_quantity,
  max_order_quantity: menu.max_order_quantity,
  appearance_settings: menu.appearance_settings || {
    show_product_images: true,
    show_availability: true
  }
  // ❌ MISSING: security_settings
}
```

### Updated Code
```typescript
menu_data: {
  id: menu.id,
  name: menu.name,
  description: menu.description,
  products: products,
  menu_id: menu.id,
  whitelist_id: whitelist_entry?.id || null,
  min_order_quantity: menu.min_order_quantity,
  max_order_quantity: menu.max_order_quantity,
  appearance_settings: menu.appearance_settings || {
    show_product_images: true,
    show_availability: true
  },
  security_settings: security_settings // ✅ ADD THIS LINE
}
```

### How to Deploy
1. Navigate to Supabase Dashboard
2. Go to Edge Functions
3. Find `menu-access-validate`
4. Update the code with the change above
5. Deploy the function

---

## 💻 Step 3: Frontend Integration

### 3.1 Add Forum Menu Template

**File:** `src/components/admin/disposable-menus/MenuTemplates.tsx`

**Add to imports:**
```typescript
import { Clock, Zap, Crown, Sparkles, MessageSquare } from 'lucide-react';
```

**Update interface:**
```typescript
interface MenuTemplate {
  // ... existing fields
  menuType?: 'product' | 'forum'; // ADD THIS
}
```

**Add to TEMPLATES array (before 'custom'):**
```typescript
{
  id: 'forum-menu',
  name: 'Forum Menu',
  description: 'Create a menu that links to the community forum',
  icon: MessageSquare,
  expirationDays: 90,
  burnAfterRead: false,
  maxViews: 'unlimited',
  accessType: 'shared',
  requireAccessCode: false,
  color: 'bg-green-500',
  menuType: 'forum',
},
```

**Update expiration display (around line 133):**
```typescript
{template.expirationDays === 1 
  ? '24 hours' 
  : template.expirationDays === 7
  ? '7 days'
  : template.expirationDays === 30
  ? '30 days'
  : template.expirationDays === 90
  ? '90 days'  // ADD THIS
  : 'Custom'}
```

### 3.2 Update Menu Creation Wizard

**File:** `src/components/admin/disposable-menus/MenuCreationWizard.tsx`

**Add import:**
```typescript
import { Eye, CheckCircle2, Shield, Calendar, Lock, Search, X, Loader2, Sparkles, MessageSquare } from 'lucide-react';
```

**Update progress calculation (around line 94):**
```typescript
// Calculate progress - account for forum menus skipping step 3
const totalSteps = selectedTemplate?.menuType === 'forum' ? STEPS.length - 1 : STEPS.length;
const adjustedStep = selectedTemplate?.menuType === 'forum' && currentStep > 3 ? currentStep - 1 : currentStep;
const progress = (adjustedStep / totalSteps) * 100;
```

**Update handleNext (around line 108):**
```typescript
const handleNext = () => {
  if (currentStep === 1 && !selectedTemplate) {
    toast.error('Please select a template');
    return;
  }
  if (currentStep === 2 && !name.trim()) {
    toast.error('Menu name is required');
    return;
  }
  // Skip product validation for forum menus
  if (currentStep === 3 && selectedTemplate?.menuType !== 'forum' && selectedProducts.length === 0) {
    toast.error('Please select at least one product');
    return;
  }
  if (currentStep < STEPS.length) {
    // Skip product step for forum menus
    if (currentStep === 2 && selectedTemplate?.menuType === 'forum') {
      setCurrentStep(4); // Jump directly to settings
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }
};
```

**Update handleBack (around line 132):**
```typescript
const handleBack = () => {
  if (currentStep > 1) {
    // Skip product step when going back from settings for forum menus
    if (currentStep === 4 && selectedTemplate?.menuType === 'forum') {
      setCurrentStep(2); // Go back to details
    } else {
      setCurrentStep(prev => prev - 1);
    }
  }
};
```

**Update handleCreate (around line 154):**
```typescript
const handleCreate = async () => {
  const isForumMenu = selectedTemplate?.menuType === 'forum';
  
  // Validate based on menu type
  if (!name) return;
  if (!isForumMenu && selectedProducts.length === 0) {
    toast.error('Please select at least one product');
    return;
  }

  // ... existing limit check ...

  try {
    const expirationDate = expirationDays !== 'unlimited'
      ? new Date(Date.now() + parseInt(expirationDays) * 24 * 60 * 60 * 1000).toISOString()
      : null;

    await createMenu.mutateAsync({
      tenant_id: tenant?.id || '',
      name,
      description: isForumMenu 
        ? (description || 'Community Forum Access Menu')
        : description,
      product_ids: isForumMenu ? [] : selectedProducts,
      min_order_quantity: isForumMenu ? undefined : parseFloat(minOrder),
      max_order_quantity: isForumMenu ? undefined : parseFloat(maxOrder),
      access_code: requireAccessCode ? accessCode : generateAccessCode(),
      expiration_date: expirationDate || undefined,
      never_expires: !expirationDate,
      security_settings: {
        access_type: accessType,
        require_access_code: requireAccessCode,
        password_protection: requirePassword ? password : undefined,
        burn_after_read: burnAfterRead,
        max_views: maxViews !== 'unlimited' ? parseInt(maxViews) : undefined,
        menu_type: isForumMenu ? 'forum' : 'product', // ADD THIS
        forum_url: isForumMenu ? '/community' : undefined, // ADD THIS
      },
    });

    toast.success('Menu Created', {
      description: isForumMenu 
        ? 'Forum menu created! Customers will be redirected to the community forum.'
        : 'Your disposable menu has been created successfully',
    });
    // ... rest of success handling
  } catch (error: unknown) {
    // ... error handling
  }
};
```

**Update progress bar (around line 242):**
```typescript
{STEPS.map((step) => {
  // Hide Products step for forum menus
  if (step.id === 3 && selectedTemplate?.menuType === 'forum') {
    return null;
  }
  return (
    <div key={step.id} className={cn(...)}>
      {/* ... existing code ... */}
    </div>
  );
})}
```

**Add forum info step (around line 423, after product step):**
```typescript
{/* Step 3: Forum Menu Info (Only for Forum Menus) */}
{currentStep === 3 && selectedTemplate?.menuType === 'forum' && (
  <div className="space-y-4">
    <div className="rounded-lg border bg-muted/50 p-6">
      <div className="flex items-start gap-3">
        <MessageSquare className="h-6 w-6 text-green-600 mt-1" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2">Forum Menu</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This menu will redirect customers to the community forum where they can:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground mb-4">
            <li>Browse and discuss products</li>
            <li>Share reviews and experiences</li>
            <li>Ask questions and get answers</li>
            <li>Connect with other customers</li>
          </ul>
          <div className="rounded-md bg-primary/10 p-3">
            <p className="text-sm font-medium">
              Customers will be redirected to: <code className="text-xs bg-background px-2 py-1 rounded">/community</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
```

### 3.3 Update Menu Hook

**File:** `src/hooks/useDisposableMenus.ts`

**Replace the mutationFn (around line 54):**
```typescript
mutationFn: async (menuData: {
  // ... existing types
}) => {
  // Transform product_ids and custom_prices into products array (only if products exist)
  const products = menuData.product_ids && menuData.product_ids.length > 0
    ? menuData.product_ids.map(productId => ({
        product_id: productId,
        custom_price: menuData.custom_prices?.[productId],
        display_availability: true,
        display_order: 0,
      }))
    : undefined; // Don't pass empty array, use undefined for forum menus

  // Build request body, only including optional fields if they have values
  const requestBody: Record<string, unknown> = {
    tenant_id: menuData.tenant_id,
    name: menuData.name,
    description: menuData.description,
    security_settings: menuData.security_settings || {},
    appearance_settings: menuData.appearance_settings || {},
    access_code: menuData.access_code,
    expiration_date: menuData.expiration_date,
    never_expires: menuData.never_expires ?? true,
  };

  // Only add products if provided (forum menus won't have products)
  if (products && products.length > 0) {
    requestBody.products = products;
  }

  // Only add order quantities if provided (forum menus won't have these)
  if (menuData.min_order_quantity !== undefined && menuData.min_order_quantity > 0) {
    requestBody.min_order_quantity = menuData.min_order_quantity;
  }
  if (menuData.max_order_quantity !== undefined && menuData.max_order_quantity > 0) {
    requestBody.max_order_quantity = menuData.max_order_quantity;
  }

  // Call the new encrypted menu creation edge function
  const { data, error } = await supabase.functions.invoke('create-encrypted-menu', {
    body: requestBody
  });

  // ... rest of error handling
}
```

### 3.4 Update Customer Access Pages

**File:** `src/pages/customer/SecureMenuAccess.tsx`

**Add redirect check (around line 101, after sessionStorage.setItem):**
```typescript
// Check if this is a forum menu and redirect immediately
if (data.menu_data?.security_settings?.menu_type === 'forum') {
  const forumUrl = data.menu_data.security_settings?.forum_url || '/community';
  window.location.href = forumUrl;
  return;
}
```

**File:** `src/pages/customer/SecureMenuView.tsx`

**Add redirect check (around line 104, after parsing storedMenu):**
```typescript
// Check if this is a forum menu and redirect
if (parsed.security_settings?.menu_type === 'forum') {
  const forumUrl = parsed.security_settings?.forum_url || '/community';
  navigate(forumUrl);
  return;
}
```

### 3.5 Update Admin UI Components

**File:** `src/components/admin/disposable-menus/MenuCard.tsx`

**Add import:**
```typescript
import { Eye, Users, ShoppingCart, Flame, Settings, BarChart3, Copy, ExternalLink, Share2, Shield, MapPin, Lock, Clock, QrCode, CopyPlus, Key, MessageSquare } from 'lucide-react';
```

**Add badge (around line 85, after menu name):**
```typescript
{/* @ts-expect-error - security_settings added via migration */}
{menu.security_settings?.menu_type === 'forum' && (
  <Badge variant="secondary" className="gap-1 text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
    <MessageSquare className="h-3 w-3" />
    Forum Menu
  </Badge>
)}
```

**File:** `src/components/admin/disposable-menus/MenuShareDialogEnhanced.tsx`

**Add import:**
```typescript
import { Copy, ExternalLink, MessageCircle, Mail, QrCode, Download, Loader2, CheckCircle2, Users, DollarSign, MessageSquare } from 'lucide-react';
```

**Add forum menu detection (around line 92):**
```typescript
// Check if this is a forum menu
const isForumMenu = menu?.security_settings?.menu_type === 'forum';
```

**Update DialogDescription (around line 240):**
```typescript
<DialogDescription>
  {isForumMenu 
    ? 'Share this forum menu link - customers will be redirected to the community forum'
    : 'Share this encrypted menu via link, QR code, or SMS'}
</DialogDescription>
```

**Update SMS message (around line 95):**
```typescript
const defaultMessage = isForumMenu
  ? `Hi! You've been granted access to our community forum.

Access URL: ${menuUrl}
${accessCode !== 'N/A' ? `Access Code: ${accessCode}\n` : ''}
Join the discussion, share reviews, and connect with other customers!

This link expires ${menu?.expiration_date ? `on ${new Date(menu.expiration_date).toLocaleDateString()}` : 'after use'}.`
  : `Hi! You've been granted access to our wholesale catalog.

Access URL: ${menuUrl}
Access Code: ${accessCode}

This link is confidential and expires ${menu?.expiration_date ? `on ${new Date(menu.expiration_date).toLocaleDateString()}` : 'after use'}.`;
```

**Update WhatsApp handler (around line 200):**
```typescript
const handleWhatsApp = () => {
  const message = isForumMenu
    ? `Hi ${whitelistEntry?.customer_name || 'there'}!\n\n` +
      `You've been granted access to our community forum.\n\n` +
      `Access URL: ${menuUrl}\n` +
      `${accessCode !== 'N/A' ? `Access Code: ${accessCode}\n\n` : '\n'}` +
      `Join the discussion, share reviews, and connect with other customers!\n\n` +
      `This link expires ${menu?.expiration_date ? `on ${new Date(menu.expiration_date).toLocaleDateString()}` : 'after use'}.`
    : `Hi ${whitelistEntry?.customer_name || 'there'}!\n\n` +
      `You've been granted access to our wholesale catalog.\n\n` +
      `Access URL: ${menuUrl}\n` +
      `Access Code: ${accessCode}\n\n` +
      `This link is confidential and expires ${menu?.expiration_date ? `on ${new Date(menu.expiration_date).toLocaleDateString()}` : 'after use'}.`;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
};
```

**Update Email handler (around line 216):**
```typescript
const handleEmail = () => {
  const subject = encodeURIComponent(`Access to ${menu?.name}`);
  const body = isForumMenu
    ? `Hi ${whitelistEntry?.customer_name || 'there'},\n\n` +
      `You've been granted access to our community forum.\n\n` +
      `Access URL: ${menuUrl}\n` +
      `${accessCode !== 'N/A' ? `Access Code: ${accessCode}\n\n` : '\n'}` +
      `Join the discussion, share reviews, and connect with other customers!\n\n` +
      `This link expires ${menu?.expiration_date ? `on ${new Date(menu.expiration_date).toLocaleDateString()}` : 'after use'}.\n\n` +
      `Best regards`
    : `Hi ${whitelistEntry?.customer_name || 'there'},\n\n` +
      `You've been granted access to our wholesale catalog.\n\n` +
      `Access URL: ${menuUrl}\n` +
      `Access Code: ${accessCode}\n\n` +
      `Important: This link is confidential and expires ${menu?.expiration_date ? `on ${new Date(menu.expiration_date).toLocaleDateString()}` : 'after use'}.\n\n` +
      `Best regards`;
  window.open(`mailto:${whitelistEntry?.customer_email}?subject=${subject}&body=${encodeURIComponent(body)}`, '_blank');
};
```

**Hide access code if not required (around line 284):**
```typescript
{/* Access Code - Only show if required */}
{accessCode !== 'N/A' && (
  <div className="space-y-2">
    {/* ... existing access code UI ... */}
  </div>
)}
```

**Add forum menu notice (after access code section):**
```typescript
{/* Forum Menu Notice */}
{isForumMenu && (
  <div className="rounded-lg border bg-green-500/10 border-green-500/20 p-4">
    <div className="flex items-start gap-2">
      <MessageSquare className="h-5 w-5 text-green-600 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-green-900 dark:text-green-100">
          Forum Menu
        </p>
        <p className="text-xs text-green-700 dark:text-green-300 mt-1">
          Customers accessing this menu will be automatically redirected to the community forum at <code className="bg-background px-1 rounded">/community</code>
        </p>
      </div>
    </div>
  </div>
)}
```

---

## 🧪 Step 4: Testing

### 4.1 Test Menu Creation
1. Login as tenant admin
2. Navigate to Disposable Menus
3. Click "Create Menu (Wizard)"
4. Select "Forum Menu" template
5. Enter menu name: "Test Forum Menu"
6. Click Next (should skip to Settings)
7. Configure settings
8. Click "Create Menu"
9. ✅ Verify: Success message mentions forum redirect
10. ✅ Verify: Menu appears in list with "Forum Menu" badge

### 4.2 Test Menu Access
1. Copy menu URL from share dialog
2. Open in incognito/private window
3. Enter access code (if required)
4. Submit access form
5. ✅ Verify: Immediately redirected to `/community`
6. ✅ Verify: Can browse forum

### 4.3 Test Share Dialog
1. Open share dialog for forum menu
2. ✅ Verify: Description mentions forum redirect
3. ✅ Verify: Access code hidden if not required
4. ✅ Verify: Forum menu notice displayed
5. Check SMS tab
6. ✅ Verify: SMS message mentions community forum
7. Test WhatsApp share
8. ✅ Verify: Message mentions community forum
9. Test Email share
10. ✅ Verify: Email body mentions community forum

### 4.4 Test Edge Cases
1. Create forum menu with access code required
2. ✅ Verify: Access code shown in share dialog
3. Create forum menu without access code
4. ✅ Verify: Access code hidden in share dialog
5. Access forum menu link
6. ✅ Verify: Redirects even if access code not required

---

## 🐛 Troubleshooting

### Issue: Forum menu not redirecting
**Check:**
1. Edge function returns `security_settings` in response
2. `menu_type` is set to `'forum'` in security_settings
3. Redirect logic in SecureMenuAccess and SecureMenuView

**Fix:**
- Verify edge function code includes `security_settings: security_settings` in menu_data
- Check browser console for errors
- Verify menu was created with forum template

### Issue: Products step not skipping
**Check:**
1. Template has `menuType: 'forum'`
2. `handleNext` checks `selectedTemplate?.menuType === 'forum'`

**Fix:**
- Verify template definition includes `menuType: 'forum'`
- Check progress calculation accounts for skipped step

### Issue: Menu creation fails
**Check:**
1. Edge function schema accepts empty products array
2. Order quantities not sent for forum menus

**Fix:**
- Verify `useDisposableMenus.ts` conditionally includes fields
- Check edge function logs for validation errors

### Issue: Badge not showing
**Check:**
1. Menu has `security_settings.menu_type === 'forum'`
2. Badge condition checks correct path

**Fix:**
- Verify menu was created with forum template
- Check menu data structure in database

---

## 📊 Integration Checklist

### Database
- [ ] `security_settings` column exists in `disposable_menus`
- [ ] Column type is JSONB

### Edge Functions
- [ ] `menu-access-validate` returns `security_settings` in response
- [ ] Function deployed and active

### Frontend Components
- [ ] Forum menu template added to MenuTemplates
- [ ] Wizard handles forum menus correctly
- [ ] Menu hook builds request correctly
- [ ] Access pages redirect forum menus
- [ ] Admin UI shows forum menu badge
- [ ] Share dialog has forum-specific messaging

### Testing
- [ ] Can create forum menu
- [ ] Forum menu redirects correctly
- [ ] Share dialog works for forum menus
- [ ] All messaging is forum-specific
- [ ] Visual indicators display correctly

---

## 🚀 Deployment Steps

1. **Update Edge Function**
   - Deploy `menu-access-validate` with security_settings in response

2. **Deploy Frontend**
   - Build and deploy frontend with all component updates
   - Verify no build errors

3. **Test in Staging**
   - Create test forum menu
   - Verify redirect works
   - Test all share methods

4. **Deploy to Production**
   - Deploy edge function
   - Deploy frontend
   - Monitor for errors

---

## 📝 Notes

- Forum menus don't require products
- Forum menus don't require order quantities
- Access code is optional for forum menus
- Forum URL defaults to `/community` if not specified
- All existing menu features work (burn, analytics, etc.)

---

## 🎉 Success Criteria

✅ Forum menu template appears in wizard
✅ Product selection skipped for forum menus
✅ Forum menu creates successfully
✅ Customers redirected to `/community`
✅ Visual indicators show forum menus
✅ Share dialog has forum-specific messaging
✅ No errors in console
✅ All tests pass

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs for edge function errors
3. Verify all files updated correctly
4. Test with a fresh menu creation
5. Check database for correct security_settings structure

---

**Last Updated:** January 2025
**Version:** 1.0.0
**Status:** ✅ Production Ready

