# Security Audit Required: Tenant ID Injection

## Issue
Multiple Edge Functions may be vulnerable to tenant_id injection attacks where attackers can supply a tenant_id in the request body and bypass tenant isolation.

## Fixed Functions
- ✅ `supabase/functions/wholesale-order-create/index.ts` - Fixed on 2026-03-23

## Functions Requiring Review
The following functions accept `tenant_id` from request body and need security audit:

1. `supabase/functions/update-trial-status/index.ts`
2. `supabase/functions/send-trial-reminder/index.ts`
3. `supabase/functions/create-stripe-connect/index.ts`
4. `supabase/functions/create-admin-user/index.ts`
5. `supabase/functions/stripe-customer-portal/index.ts`
6. `supabase/functions/update-subscription/index.ts`
7. `supabase/functions/verify-tenant-stripe/index.ts`
8. `supabase/functions/process-return/index.ts`
9. `supabase/functions/create-checkout/index.ts`
10. `supabase/functions/create-setup-session/index.ts`
11. `supabase/functions/create-purchase-order/index.ts`
12. `supabase/functions/cancel-trial/index.ts`
13. `supabase/functions/start-trial/index.ts`

## Vulnerability Pattern
```typescript
// VULNERABLE: Accepts tenant_id from client
const { tenant_id, ...otherFields } = await req.json();
const resolvedTenantId = tenant_id;  // Trusts client input!
```

## Secure Pattern
```typescript
// SECURE: Use JWT-resolved tenant from creditGate wrapper
return withCreditGate(req, ACTION_KEY, async (creditTenantId, serviceClient) => {
  const resolvedTenantId = creditTenantId;  // From JWT, not from client
  // Never extract tenant_id from request body
});
```

## Fix Instructions for Each Function

For each function listed above:

1. Check if it uses `withCreditGate` or `withCreditGateAndRefund` wrapper
2. If yes: Use the `creditTenantId` parameter, ignore request body `tenant_id`
3. If no: Add JWT authentication and resolve tenant from `tenant_users` table
4. Remove `tenant_id` from validation schemas
5. Add security comments explaining the fix
6. Test thoroughly to ensure tenant isolation

## Priority
**CRITICAL** - These vulnerabilities allow cross-tenant data access and must be fixed immediately.

## Testing Checklist
After fixing each function:
- [ ] Verify tenant_id is resolved from JWT only
- [ ] Verify client-supplied tenant_id is ignored
- [ ] Test that user cannot access another tenant's resources
- [ ] Test that missing JWT returns 401/403
- [ ] Test that valid JWT with wrong tenant returns 403
