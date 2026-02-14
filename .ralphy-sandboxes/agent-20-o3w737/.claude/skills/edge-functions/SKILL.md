---
name: edge-functions
description: Supabase Edge Functions patterns for FloraIQ. Deno runtime with shared deps, CORS handling, Zod validation, and zen-firewall protection.
---

# Edge Functions Skill

## Template Structure

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { withZenProtection } from "../_shared/zen-firewall.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Request validation schema
const RequestSchema = z.object({
  action: z.string(),
  data: z.record(z.unknown()).optional(),
});

serve(withZenProtection(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate request body
    const body = RequestSchema.parse(await req.json());
    
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user from JWT (NEVER trust client-side data)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Business logic here
    const result = { success: true };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
```

## Critical Rules

### Imports
```typescript
// ✅ ALWAYS import from _shared/deps.ts
import { serve, createClient, corsHeaders } from "../_shared/deps.ts";

// ✅ Use zen-firewall for protection
import { withZenProtection } from "../_shared/zen-firewall.ts";
```

### CORS (Required on ALL responses)
```typescript
// ✅ Handle OPTIONS
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

// ✅ Include CORS headers in EVERY response
return new Response(data, {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

### Validation
```typescript
// ✅ ALWAYS validate with Zod
const schema = z.object({
  tenantId: z.string().uuid(),
  amount: z.number().positive(),
});

const validated = schema.parse(await req.json());
```

### Environment Variables
```typescript
// ✅ Validate before use
const url = Deno.env.get('SUPABASE_URL');
if (!url) throw new Error('SUPABASE_URL not set');
```

### Authentication
```typescript
// ✅ Extract user from JWT, never trust client data
const { data: { user } } = await supabase.auth.getUser();

// ✅ Use user.id for tenant lookups
const { data: profile } = await supabase
  .from('profiles')
  .select('tenant_id')
  .eq('id', user.id)
  .maybeSingle();
```

## Deployment

```bash
# Deploy single function
supabase functions deploy function-name

# Deploy all functions
supabase functions deploy
```
