---
name: api-development
description: Best practices for API development including REST patterns, error handling, validation, authentication, and TypeScript integration.
---

# API Development Patterns

Patterns for building robust APIs with Supabase Edge Functions.

## Edge Function Structure

### Standard Template

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Request validation schema
const RequestSchema = z.object({
  action: z.enum(['create', 'update', 'delete']),
  data: z.object({
    name: z.string().min(1),
    price: z.number().positive(),
  }),
});

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing environment variables');
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate request body
    const body = await req.json();
    const validationResult = RequestSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: validationResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process request
    const { action, data } = validationResult.data;
    
    // ... business logic here ...

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

## Error Handling

### Consistent Error Response

```typescript
interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

function errorResponse(message: string, status: number, code?: string): Response {
  const body: ApiError = { error: message };
  if (code) body.code = code;
  
  return new Response(
    JSON.stringify(body),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// Usage
return errorResponse('Product not found', 404, 'PRODUCT_NOT_FOUND');
return errorResponse('Insufficient credits', 400, 'INSUFFICIENT_CREDITS');
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | User lacks permission |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | Duplicate or state conflict |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Input Validation with Zod

```typescript
// Define schemas for all inputs
const CreateProductSchema = z.object({
  name: z.string().min(1).max(255),
  price: z.number().positive(),
  category_id: z.string().uuid(),
  description: z.string().optional(),
  inventory: z.number().int().nonnegative().default(0),
});

const UpdateProductSchema = CreateProductSchema.partial();

const QueryParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().uuid().optional(),
  search: z.string().optional(),
});
```

## Authentication Patterns

### Extract User from JWT

```typescript
async function getAuthenticatedUser(req: Request, supabase: SupabaseClient) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError('Missing authorization header', 401, 'UNAUTHORIZED');
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new ApiError('Invalid token', 401, 'UNAUTHORIZED');
  }

  return user;
}
```

### Verify Tenant Access

```typescript
async function verifyTenantAccess(userId: string, tenantId: string, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('tenant_users')
    .select('role')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) {
    throw new ApiError('Access denied', 403, 'FORBIDDEN');
  }

  return data.role;
}
```

## Rate Limiting (Basic)

```typescript
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 100; // requests
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(identifier) || [];
  
  // Remove old requests
  const validRequests = requests.filter(t => now - t < RATE_WINDOW);
  
  if (validRequests.length >= RATE_LIMIT) {
    return false;
  }
  
  validRequests.push(now);
  rateLimitMap.set(identifier, validRequests);
  return true;
}
```
