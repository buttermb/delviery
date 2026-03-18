# Edge Functions Reference Guide

Quick reference for all Edge Functions created/updated in this implementation.

## Authentication Pattern

All Edge Functions follow this authentication pattern:

```typescript
// 1. Get auth token from request
const authHeader = req.headers.get('Authorization');
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401 });
}

const token = authHeader.replace('Bearer ', '');

// 2. Verify user is authenticated
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
if (authError || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}

// 3. Verify tenant access
const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
const isOwner = tenant.owner_email?.toLowerCase() === user.email?.toLowerCase();
const { data: tenantUser } = await serviceClient
  .from('tenant_users')
  .select('role')
  .eq('tenant_id', tenantId)
  .eq('user_id', user.id)
  .maybeSingle();

const isAdmin = tenantUser?.role === 'admin' || tenantUser?.role === 'owner';
if (!isOwner && !isAdmin) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
}
```

---

## Edge Functions

### 1. `billing`

**Purpose**: Get tenant billing information and payment methods

**Endpoint**: `POST /functions/v1/billing`

**Actions**:
- `get_billing` (default) - Get billing information
- `get_payment_methods` - Get payment methods

**Request Body**:
```json
{
  "action": "get_billing",
  "tenant_id": "uuid" // optional, auto-detected from user context
}
```

**Response**:
```json
{
  "billing": {
    "plan": "professional",
    "status": "active",
    "limits": {},
    "usage": {},
    "stripe_customer_id": "cus_xxx"
  }
}
```

**Usage**:
```typescript
const { data, error } = await supabase.functions.invoke('billing', {
  body: { action: 'get_billing', tenant_id: tenantId }
});
```

---

### 2. `staff-management`

**Purpose**: CRUD operations for tenant_users (staff members)

**Endpoint**: `POST /functions/v1/staff-management`

**Actions**:
- `list` - List all staff members
- `create` - Create new staff member
- `update` - Update staff member
- `delete` - Delete staff member

**Request Body**:
```json
{
  "action": "list",
  "tenant_id": "uuid", // optional
  "user_id": "uuid", // for update/delete
  "email": "user@example.com", // for create
  "role": "admin", // for create/update
  "name": "John Doe" // for create/update
}
```

**Response**:
```json
{
  "success": true,
  "staff": { /* staff member object */ }
}
```

**Usage**:
```typescript
// List staff
const { data } = await supabase.functions.invoke('staff-management', {
  body: { action: 'list', tenant_id: tenantId }
});

// Create staff
const { data } = await supabase.functions.invoke('staff-management', {
  body: {
    action: 'create',
    tenant_id: tenantId,
    email: 'new@example.com',
    role: 'admin',
    name: 'New Admin'
  }
});
```

---

### 3. `invoice-management`

**Purpose**: Complete invoice CRUD operations

**Endpoint**: `POST /functions/v1/invoice-management`

**Actions**:
- `list` (default) - List all invoices
- `create` - Create new invoice
- `update` - Update invoice
- `get` - Get single invoice
- `delete` - Delete draft invoice

**Request Body**:
```json
{
  "action": "create",
  "tenant_id": "uuid",
  "invoice_data": {
    "subtotal": 100.00,
    "tax": 8.88,
    "total": 108.88,
    "line_items": [],
    "issue_date": "2025-01-01",
    "due_date": "2025-01-31",
    "status": "draft"
  }
}
```

**Response**:
```json
{
  "success": true,
  "invoice": { /* invoice object */ }
}
```

**Usage**:
```typescript
// Create invoice
const { data } = await supabase.functions.invoke('invoice-management', {
  body: {
    action: 'create',
    tenant_id: tenantId,
    invoice_data: {
      subtotal: 100,
      tax: 8.88,
      total: 108.88,
      line_items: [],
      issue_date: new Date().toISOString().split('T')[0],
      due_date: dueDate,
      status: 'draft'
    }
  }
});
```

---

### 4. `panic-reset`

**Purpose**: Super admin tool to reset tenant data (dangerous operation)

**Endpoint**: `POST /functions/v1/panic-reset`

**Access**: Super admin only

**Actions**:
- `preview` - Preview what would be deleted
- `reset` - Actually delete data (requires confirmation)

**Request Body**:
```json
{
  "action": "preview",
  "tenant_id": "uuid"
}
```

```json
{
  "action": "reset",
  "tenant_id": "uuid",
  "reset_type": "orders", // "orders", "inventory", "deliveries", "invoices", "all"
  "confirmation": "CONFIRM_RESET" // Required for reset action
}
```

**Response (Preview)**:
```json
{
  "tenant": {
    "id": "uuid",
    "business_name": "Tenant Name"
  },
  "preview": {
    "orders": 150,
    "inventory": 200,
    "deliveries": 50
  }
}
```

**Response (Reset)**:
```json
{
  "success": true,
  "message": "Reset completed for tenant: Tenant Name",
  "reset_type": "orders",
  "results": {
    "orders": { "deleted": 150 },
    "order_items": { "deleted": 450 }
  }
}
```

**Usage**:
```typescript
// Preview (safe)
const { data } = await supabase.functions.invoke('panic-reset', {
  body: { action: 'preview', tenant_id: tenantId }
});

// Reset (dangerous - requires confirmation)
const { data } = await supabase.functions.invoke('panic-reset', {
  body: {
    action: 'reset',
    tenant_id: tenantId,
    reset_type: 'orders',
    confirmation: 'CONFIRM_RESET'
  }
});
```

---

## Updated Edge Functions

### `tenant-invite`

**Updates**:
- Enhanced authentication to check both owner and tenant_users
- Improved admin validation for `send_invitation` action
- Added authorization check for `list_invitations` action

### `stripe-customer-portal`

**Updates**:
- Enhanced tenant validation to check both owner and tenant_users
- Improved permission checks for admin/owner roles

---

## Frontend Helper

Use `callAdminFunction` helper for consistent Edge Function calls:

```typescript
import { callAdminFunction } from '@/utils/adminFunctionHelper';

const { data, error } = await callAdminFunction({
  functionName: 'billing',
  body: { action: 'get_billing', tenant_id: tenantId },
  errorMessage: 'Failed to load billing',
  showToast: true,
});
```

This helper:
- Automatically gets auth token from context
- Handles errors consistently
- Shows toast notifications
- Reports errors to bug finder

---

## Error Handling

All Edge Functions return consistent error format:

```json
{
  "error": "Error message",
  "details": "Additional details" // optional
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

## Testing

Test Edge Functions using Supabase CLI:

```bash
# Deploy function
supabase functions deploy billing

# Test locally
supabase functions serve billing

# Test with curl
curl -X POST http://localhost:54321/functions/v1/billing \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_billing", "tenant_id": "uuid"}'
```

---

## Security Notes

1. **Always validate tenant access** - Check both owner and tenant_users
2. **Use service role client** - For cross-table queries, use service role key
3. **Log all actions** - Audit logging for destructive operations
4. **Require confirmation** - For dangerous operations (panic reset)
5. **Validate input** - Check all required fields before processing

---

## Best Practices

1. **Use RPC functions** - When possible, use RPC functions to avoid JSON coercion
2. **Fallback gracefully** - If RPC doesn't exist, fallback to direct queries
3. **Return single objects** - Avoid returning arrays when single object expected
4. **Handle errors** - Always return proper error responses
5. **Log operations** - Use activity logging for important operations

