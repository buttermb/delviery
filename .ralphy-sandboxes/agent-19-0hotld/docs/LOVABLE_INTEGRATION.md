# Lovable Integration Guide

This guide explains how to integrate and work with Lovable AI on the FloraIQ project.

## Overview

FloraIQ uses Lovable for AI-powered features and development assistance. This document covers:
- Project structure for Lovable compatibility
- Edge Functions for AI features
- Best practices for AI-assisted development

---

## Project Structure

```
delviery-main/
├── src/
│   ├── components/       # React components
│   ├── pages/           # Route pages
│   ├── hooks/           # Custom hooks
│   ├── lib/             # Utilities
│   └── integrations/    # Supabase client
├── supabase/
│   └── functions/       # Edge Functions (AI endpoints)
└── .cursorrules         # AI coding guidelines
```

---

## AI-Powered Features

### 1. Pricing Advisor
**Location:** `supabase/functions/pricing-advisor/index.ts`

An AI-powered pricing recommendation engine that analyzes business context.

**Environment Variables:**
```bash
LOVABLE_API_KEY=your-api-key
```

**Usage:**
```typescript
const response = await supabase.functions.invoke('pricing-advisor', {
  body: { businessType, teamSize, monthlyOrders }
});
```

---

## Edge Function Template

Create new AI edge functions in `supabase/functions/`:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  const { prompt } = await req.json();
  
  // Call Lovable API
  const response = await fetch('https://api.lovable.dev/v1/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  
  return new Response(JSON.stringify(await response.json()), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## Development Best Practices

### Code Style
- Use TypeScript with strict types
- Follow existing component patterns
- Use `lucide-react` for icons
- Use shadcn/ui components

### AI-Assisted Development
1. **Context is key** - Provide clear descriptions in PRs and comments
2. **Use .cursorrules** - AI respects project conventions
3. **Test edge functions** - Use Supabase CLI locally
4. **Iterate** - AI excels at refactoring and polish

### Component Patterns
```typescript
// Standard component structure
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

export function MyComponent() {
  const { tenant } = useTenantAdminAuth();
  // Component logic
}
```

---

## Deploying Edge Functions

```bash
# Login to Supabase
supabase login

# Deploy function
supabase functions deploy pricing-advisor

# Set secrets
supabase secrets set LOVABLE_API_KEY=your-key
```

---

## Useful Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Run linter

# Supabase
supabase start       # Local Supabase
supabase db push     # Apply migrations
supabase functions serve  # Test edge functions locally
```

---

## Resources
- [Lovable Documentation](https://docs.lovable.dev)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [shadcn/ui Components](https://ui.shadcn.com)
