# Quick Start Guide

Get up and running with the new features in 5 minutes.

## 🚀 Quick Setup

### 1. Apply Database Migrations

```bash
supabase db push
```

This applies:
- Billing RPC functions
- Activity logs table
- Invoice RPC functions

### 2. Deploy Edge Functions

```bash
supabase functions deploy billing
supabase functions deploy staff-management
supabase functions deploy invoice-management
supabase functions deploy panic-reset
```

### 3. Update Existing Functions

```bash
supabase functions deploy tenant-invite
supabase functions deploy stripe-customer-portal
```

### 4. Test Authentication

Login as tenant admin and verify:
- ✅ No 401 errors in console
- ✅ Edge Functions work correctly
- ✅ Data loads properly

---

## 📖 Using New Features

### Real-Time Sync

Real-time sync is **automatic**! Just use the hook:

```typescript
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

function MyComponent() {
  const { tenant } = useTenantAdminAuth();
  
  useRealtimeSync({
    tenantId: tenant?.id,
    tables: ['orders', 'inventory'],
    enabled: !!tenant?.id,
  });
  
  // Your component will automatically update when data changes!
}
```

### Activity Logging

Log user actions:

```typescript
import { logActivityAuto, ActivityActions } from '@/lib/activityLogger';

await logActivityAuto(
  tenantId,
  ActivityActions.CREATE_ORDER,
  'order',
  orderId,
  { amount: 100, customer_id: customerId }
);
```

### Invoice Management

Use the Edge Function:

```typescript
import { callAdminFunction } from '@/utils/adminFunctionHelper';

// Create invoice
const { data, error } = await callAdminFunction({
  functionName: 'invoice-management',
  body: {
    action: 'create',
    tenant_id: tenantId,
    invoice_data: {
      subtotal: 100,
      tax: 8.88,
      total: 108.88,
      line_items: [],
      issue_date: '2025-01-01',
      due_date: '2025-01-31',
      status: 'draft'
    }
  }
});
```

### Panic Reset (Super Admin Only)

Navigate to `/super-admin/tools` and use the Panic Reset Tool:
1. Select tenant
2. Choose reset type
3. Click "Preview" to see what will be deleted
4. Type `CONFIRM_RESET` to proceed

---

## 🔍 Troubleshooting

### "401 Unauthorized" errors
- Check JWT token is valid
- Verify user has tenant access
- Check Edge Function authentication code

### JSON coercion errors
- Verify RPC functions exist
- Check RPC returns single JSON object
- Use Edge Function fallback

### Real-time not working
- Check Supabase Realtime enabled
- Verify channel subscriptions
- Check browser console for errors

---

## 📚 Documentation

- **Full Implementation**: `IMPLEMENTATION_SUMMARY.md`
- **Edge Functions**: `EDGE_FUNCTIONS_REFERENCE.md`
- **Deployment**: `DEPLOYMENT_CHECKLIST.md`

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Migrations applied
- [ ] Edge Functions deployed
- [ ] Can login as tenant admin
- [ ] No console errors
- [ ] Real-time updates work
- [ ] Activity logs appear
- [ ] Invoices can be created

---

**Ready to go!** 🎉
