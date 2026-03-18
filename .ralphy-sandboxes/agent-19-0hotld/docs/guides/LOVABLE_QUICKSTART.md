# 🚀 Lovable Integration - Quick Start Guide

**For Full Details**: See `LOVABLE_MASTER_INTEGRATION_GUIDE.md`

---

## 📦 5-Minute Setup

### 1. Clone & Install
```bash
cd /path/to/delviery-main
npm install
```

### 2. Configure Environment
Create `.env.local`:
```env
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1...
```

### 3. Run Migrations
```bash
supabase migration up
```

### 4. Start Dev Server
```bash
npm run dev
```

---

## 🔑 Essential Lovable Configuration

### Lovable Environment Variables
Add in Lovable Dashboard → Settings → Environment:

| Variable | Example | Secret? |
|----------|---------|---------|
| `VITE_SUPABASE_URL` | `https://xyz.supabase.co` | No |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` | No |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | No |
| `VITE_STRIPE_SECRET_KEY` | `sk_test_...` | **Yes** |
| `VITE_MAPBOX_ACCESS_TOKEN` | `pk.eyJ1...` | **Yes** |

### Build Configuration
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "devCommand": "npm run dev"
}
```

---

## 🗄️ Database Quick Setup

### Required Extensions
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
```

### Migration Order
1. `20231101000000_initial_schema.sql` - Core tables
2. `20231102000000_tenant_schema.sql` - Multi-tenancy
3. `20250122000012_admin_panel_tables.sql` - Admin features
4. `20231104000000_rls_policies.sql` - Security policies

### Most Important Tables
- `accounts` - Stripe billing integration
- `tenants` - Multi-tenant configuration
- `tenant_users` - User-tenant mapping
- `products` - Product catalog
- `orders` - Order management
- `customers` - Customer data
- `disposable_menus` - Temporary menus

---

## ⚡ Edge Functions

### Deploy All Functions
```bash
# Deploy individually
supabase functions deploy tenant-admin-auth
supabase functions deploy customer-auth
supabase functions deploy create-order
supabase functions deploy menu-generate
supabase functions deploy stripe-webhook
supabase functions deploy wholesale-order-create

# Or use loop for all
for dir in supabase/functions/*/; do
  supabase functions deploy "$(basename "$dir")"
done
```

### Set Secrets
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set TWILIO_ACCOUNT_SID=AC...
supabase secrets set SENDGRID_API_KEY=SG...
```

---

## 🎨 Feature Tiers

### Trap Tier (Free)
- Basic dashboard
- Product catalog
- Manual orders

### Small Tier ($99/mo)
- Trap +
- Disposable menus
- Customer management
- Basic CRM

### Medium Tier ($299/mo)
- Small +
- Suppliers & Purchase Orders
- Returns management
- Loyalty program
- Coupons

### Large Tier ($599/mo)
- Medium +
- Advanced CRM
- Marketing automation
- Support tickets
- Quality control

### Enterprise (Custom)
- Large +
- Predictive analytics
- Vendor portal
- White-label
- Custom integrations

---

## 🧪 Testing Checklist

### Core Functionality
- [ ] Super admin login works
- [ ] Tenant admin login works
- [ ] Customer login works
- [ ] Tenant isolation works (RLS)
- [ ] Feature gating by tier works
- [ ] Stripe checkout works
- [ ] Menu generation works
- [ ] Order creation works

### Performance
- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] Mobile responsive
- [ ] Dark mode works
- [ ] Fast page loads

---

## 🚀 Deployment

### Lovable Auto-Deploy
Push to main branch → Lovable deploys automatically

### Manual Deploy
1. Go to Lovable dashboard
2. Click "Deploy"
3. Wait for build
4. Check deployment logs

### Post-Deploy Checks
- [ ] All environment variables set
- [ ] Database migrations applied
- [ ] Edge functions deployed
- [ ] Test critical user flows
- [ ] Check error logs

---

## 🐛 Quick Troubleshooting

### Build Fails
```bash
npm install
npm run type-check
npm run build
```

### Database Issues
- Check Supabase project is not paused
- Verify URL and anon key are correct
- Check network connectivity

### RLS Blocking Queries
- Verify RLS policies exist
- Check `tenant_id` in WHERE clause
- Confirm user is authenticated

### Feature Not Showing
- Check `src/lib/sidebar/featureRegistry.ts`
- Verify tier requirements met
- Clear browser cache

### Edge Function Errors
- Check Supabase dashboard → Logs
- Verify all secrets are set
- Test locally: `supabase functions serve`

---

## 📚 Key Files

### Configuration
- `src/lib/sidebar/featureRegistry.ts` - Feature definitions
- `src/lib/queryKeys.ts` - Query key factory
- `src/integrations/supabase/types.ts` - Database types

### Authentication
- `src/contexts/TenantAdminAuthContext.tsx` - Tenant admin auth
- `src/contexts/SuperAdminAuthContext.tsx` - Super admin auth
- `src/contexts/AuthContext.tsx` - Customer auth

### Routing
- `src/App.tsx` - All routes
- `src/components/tenant-admin/TenantAdminSidebar.tsx` - Admin menu

### Edge Functions
- `supabase/functions/tenant-admin-auth/` - Admin login
- `supabase/functions/create-order/` - Order creation
- `supabase/functions/stripe-webhook/` - Billing events

---

## 💡 Common Patterns

### Data Fetching
```typescript
const { data, isLoading } = useQuery({
  queryKey: queryKeys.products.all(),
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("tenant_id", tenant.id);
    if (error) throw error;
    return data;
  },
  enabled: !!tenant?.id,
});
```

### Mutations
```typescript
const mutation = useMutation({
  mutationFn: async (formData) => {
    const { error } = await supabase
      .from("products")
      .insert([{ tenant_id: tenant.id, ...formData }]);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all() });
    toast.success("Created successfully");
  },
});
```

### RLS Policy
```sql
CREATE POLICY "Tenants manage own data"
  ON table_name FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id FROM tenant_users 
      WHERE user_id = auth.uid()
    )
  );
```

---

## 🔗 Resources

- **Master Guide**: `LOVABLE_MASTER_INTEGRATION_GUIDE.md`
- **Lovable Docs**: https://docs.lovable.dev
- **Supabase Docs**: https://supabase.com/docs
- **TanStack Query**: https://tanstack.com/query/latest
- **Stripe Testing**: https://stripe.com/docs/testing

---

## 🆘 Getting Help

1. Check `LOVABLE_MASTER_INTEGRATION_GUIDE.md`
2. Check browser console (F12)
3. Check Supabase dashboard → Logs
4. Use React Query Devtools
5. Use Sidebar Debugger (Settings → Debug)

---

**🎉 Ready to build!** Start with `npm run dev` and open http://localhost:5173
