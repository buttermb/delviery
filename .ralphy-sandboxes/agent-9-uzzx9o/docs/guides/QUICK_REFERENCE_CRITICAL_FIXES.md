# Quick Reference Guide - Critical Fixes

## 🚀 Quick Start

### 1. Apply Database Migration
```bash
supabase migration up
# Or via SQL Editor: Run 20251111135327_add_foreign_keys_and_constraints.sql
```

### 2. Deploy Edge Functions
```bash
supabase functions deploy send-invitation-email
supabase functions deploy tenant-invite
supabase functions deploy tenant-admin-auth
supabase functions deploy customer-auth
supabase functions deploy tenant-signup
```

### 3. Verify Permissions Seeded
```sql
SELECT COUNT(*) FROM permissions; -- Should be 50+
SELECT role, COUNT(*) FROM role_permissions GROUP BY role;
```

---

## 📋 File Locations

### Permissions System
- **Matrix**: `src/lib/permissions/rolePermissions.ts`
- **Utilities**: `src/lib/permissions/checkPermissions.ts`
- **Component**: `src/components/auth/PermissionGuard.tsx`
- **Hook**: `src/hooks/usePermissions.ts`
- **Database**: `supabase/migrations/20251111134805_role_permissions.sql`

### Email Invitations
- **Function**: `supabase/functions/send-invitation-email/index.ts`
- **Integration**: `supabase/functions/tenant-invite/index.ts` (line 133-160)

### User Limits
- **Enforcement**: `supabase/functions/tenant-invite/index.ts` (line 107-142)
- **UI**: `src/pages/admin/TeamManagement.tsx` (line 241-270)

### Cross-Table Validation
- **Customer Auth**: `supabase/functions/customer-auth/index.ts` (line 136-157)
- **Tenant Signup**: `supabase/functions/tenant-signup/index.ts` (line 101-116)
- **Tenant Invite**: `supabase/functions/tenant-invite/index.ts` (line 107-128)

### Audit Logging
- **Impersonation**: `supabase/functions/tenant-admin-auth/index.ts` (line 390-417)

### Slug Fallback
- **Implementation**: `supabase/functions/tenant-signup/index.ts` (line 136-150)

### Database Constraints
- **Migration**: `supabase/migrations/20251111135327_add_foreign_keys_and_constraints.sql`

---

## 🔑 Key Functions

### Permission Checks
```typescript
import { hasPermission, checkPermission } from '@/lib/permissions/checkPermissions';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

// In component
const canCreate = hasPermission(role, 'orders:create');

// In JSX
<PermissionGuard permission="orders:create">
  <Button>Create Order</Button>
</PermissionGuard>
```

### User Limit Check
```typescript
// In edge function (already implemented)
const activeUsers = await countActiveUsers(tenantId);
if (activeUsers >= tenant.limits.users) {
  return { error: 'User limit reached' };
}
```

### Cross-Table Email Check
```typescript
// Already implemented in edge functions
const tenantUserExists = await checkTenantUsers(email, tenantId);
if (tenantUserExists) {
  return { error: 'Email registered as staff account' };
}
```

---

## 🗄️ Database Queries

### Check Permissions
```sql
SELECT has_permission('admin', 'orders:create'); -- Returns boolean
```

### Check User Limits
```sql
SELECT COUNT(*) FROM tenant_users 
WHERE tenant_id = '{tenant_id}' 
AND status = 'active';
```

### Check Audit Logs
```sql
SELECT * FROM audit_logs 
WHERE action = 'impersonate_started' 
ORDER BY created_at DESC;
```

### Verify Constraints
```sql
-- Foreign keys
SELECT COUNT(*) FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';

-- Unique constraints
SELECT COUNT(*) FROM information_schema.table_constraints 
WHERE constraint_type = 'UNIQUE' AND table_schema = 'public';
```

---

## ⚙️ Environment Variables

Required for email sending:
```bash
KLAVIYO_API_KEY=your_key_here
SITE_URL=https://your-domain.com
FROM_EMAIL=noreply@your-domain.com
```

---

## 🐛 Troubleshooting

### Email Not Sending
- Check `KLAVIYO_API_KEY` is set
- Check email service logs
- Verify invitation was created (check database)

### Permission Checks Failing
- Verify permissions table seeded: `SELECT COUNT(*) FROM permissions;`
- Check role_permissions table: `SELECT * FROM role_permissions WHERE role = 'admin';`
- Verify user role in tenant_users table

### User Limit Not Working
- Check tenant.limits.users value
- Verify subscription_plan is not 'enterprise'
- Check active user count: `SELECT COUNT(*) FROM tenant_users WHERE tenant_id = '{id}' AND status = 'active';`

### Foreign Key Violations
- Check for orphaned records before migration
- Clean up orphaned data first
- Verify all referenced tables exist

---

## 📞 Support

For issues:
1. Check migration logs
2. Check edge function logs
3. Check database constraint violations
4. Review audit_logs table
5. Check email service logs

---

## ✅ Verification Checklist

- [ ] Database migration applied
- [ ] Permissions seeded (50+ permissions)
- [ ] Edge functions deployed
- [ ] Environment variables set
- [ ] Invitation emails sending
- [ ] Permission checks working
- [ ] User limits enforcing
- [ ] Cross-table validation working
- [ ] Audit logs capturing
- [ ] Slug fallback working

