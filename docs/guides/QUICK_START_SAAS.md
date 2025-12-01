# 🚀 SAAS Platform - Quick Start Guide

## **Getting Started**

### **1. Database Setup**

Run migrations:
```bash
supabase migration up
```

This creates:
- `tenants` table
- `tenant_users` table  
- `subscription_events` table
- `usage_events` table
- `feature_flags` table
- Adds `tenant_id` to all existing tables

### **2. Create Your First Tenant**

**Option A: Via Sign Up Page**
1. Navigate to `/saas/signup`
2. Fill out business information
3. System creates tenant with 14-day trial
4. Verify email at `/saas/verify-email`
5. Complete onboarding at `/saas/onboarding`

**Option B: Via Super Admin**
1. Navigate to `/saas/admin`
2. Use tenant management tools
3. Create tenant manually if needed

### **3. Configure White-Label (Enterprise)**

1. Navigate to `/saas/whitelabel`
2. Enable white-label
3. Upload logo
4. Customize theme colors
5. Set email/SMS branding
6. Configure custom domain (requires DNS setup)

### **4. Integrate Usage Tracking**

**Example: Adding a customer**
```tsx
import { LimitGuard } from '@/components/whitelabel/LimitGuard';
import { updateResourceUsage } from '@/utils/usageTracking';
import { useTenant } from '@/contexts/TenantContext';

function AddCustomerButton() {
  const { tenant } = useTenant();

  const handleCreate = async () => {
    // Create customer
    await createCustomer(data);
    
    // Update usage
    if (tenant?.id) {
      await updateResourceUsage(tenant.id, 'customers', 1);
    }
  };

  return (
    <LimitGuard resource="customers">
      <Button onClick={handleCreate}>Add Customer</Button>
    </LimitGuard>
  );
}
```

### **5. Check Subscription Status**

```tsx
import { useTenant } from '@/contexts/TenantContext';
import { isSubscriptionActive } from '@/lib/tenant';

function ProtectedFeature() {
  const { tenant } = useTenant();

  if (!tenant || !isSubscriptionActive(tenant)) {
    return <SubscriptionExpired />;
  }

  return <FeatureContent />;
}
```

---

## **Key Features**

### **✅ Multi-Tenant Isolation**
- All data automatically scoped to tenant
- RLS policies enforce isolation
- Super admin can view all tenants

### **✅ Usage Limits**
- Automatic limit checking
- Warnings at 80% usage
- Blocks when limit reached
- Upgrade prompts

### **✅ White-Label (Enterprise)**
- Custom themes
- Logo & favicon
- Email/SMS branding
- Custom domains

### **✅ Billing Dashboard**
- Real-time usage tracking
- Plan management
- Payment methods
- Billing history

### **✅ Super Admin**
- Platform overview
- Tenant management
- Health monitoring
- Feature flags

---

## **Routes**

- `/saas/signup` - Register new tenant
- `/saas/verify-email` - Email verification
- `/saas/onboarding` - Onboarding wizard
- `/saas/billing` - Billing dashboard
- `/saas/admin` - Super admin panel
- `/saas/whitelabel` - White-label settings

---

## **Pricing Plans**

| Plan | Price | Limits |
|------|-------|--------|
| Starter | $99/mo | 50 customers, 3 menus, 100 products |
| Professional | $299/mo | 500 customers, unlimited menus/products |
| Enterprise | $799/mo | Unlimited everything + white-label |

---

## **Next Steps**

1. ✅ Database migrations run
2. ✅ Tenant context integrated
3. ✅ White-label enabled (if Enterprise)
4. ⏳ Configure Stripe for payments
5. ⏳ Set up email sending (SMTP)
6. ⏳ Configure SMS provider (Twilio)
7. ⏳ Deploy to production

---

**Platform is ready! 🎉**

