# Supabase Migration Guide

This guide will help you migrate from Lovable Cloud to your own Supabase account.

## Step 1: Create a New Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: FloraIQ (or your preferred name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for project to be ready (~2 minutes)

## Step 2: Get Your Credentials

After project is created, go to **Settings → API** and copy:

1. **Project URL**: `https://YOUR_PROJECT_REF.supabase.co`
2. **anon/public key**: Starts with `eyJ...`
3. **service_role key**: Starts with `eyJ...` (keep secret!)

## Step 3: Install Supabase CLI

```bash
# Install via npm
npm install -g supabase

# Or via Homebrew (Mac)
brew install supabase/tap/supabase

# Login to Supabase
supabase login
```

## Step 4: Link Your Project

```bash
# Navigate to your project
cd /Users/alex/Downloads/delviery-main

# Link to your new Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# When prompted, enter your database password
```

## Step 5: Apply Database Migrations

```bash
# Push all migrations to your new database
supabase db push
```

This will create all your tables with proper structure.

## Step 6: Seed Subscription Plans

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Insert subscription plans
INSERT INTO subscription_plans (id, name, slug, description, price_monthly, features, limits, stripe_price_id, stripe_product_id, is_active, sort_order) VALUES
('9cb2a3f2-1774-4dcc-9a78-5e266eaff4bf', 'Starter', 'starter', 'Perfect for small operations', 79, 
 '["Up to 50 customers","3 disposable menus","100 products","2 team members","100 orders per month","Email support","Basic analytics"]'::jsonb, 
 '{"menus":3,"users":2,"products":100,"customers":50,"orders_per_month":100}'::jsonb, 
 'price_1Sb3ioFWN1Z6rLwAPfzp99zP', 'prod_TYA2kle7mkwTJo', true, 1),

('d7e9e8a6-208d-4ed8-b861-d606d1fabe75', 'Professional', 'professional', 'For growing businesses', 150, 
 '["Up to 500 customers","Unlimited disposable menus","500 products","10 team members","1,000 orders per month","Priority support","Advanced analytics","API access","Custom branding"]'::jsonb, 
 '{"menus":-1,"users":10,"products":500,"customers":500,"orders_per_month":1000}'::jsonb, 
 'price_1Sb3ioFWN1Z6rLwAbjlE24yI', 'prod_TYA2CWSnpNaui9', true, 2),

('4827c227-18a4-4348-b6c9-3e57184e52e7', 'Enterprise', 'enterprise', 'Unlimited power for your operation', 499, 
 '["Unlimited customers","Unlimited disposable menus","Unlimited products","Unlimited team members","Unlimited orders","24/7 dedicated support","Advanced analytics","Full API access","White label","Custom integrations","SLA guarantee"]'::jsonb, 
 '{"menus":-1,"users":-1,"products":-1,"customers":-1,"orders_per_month":-1}'::jsonb, 
 'price_1Sb3ipFWN1Z6rLwAKn1v6P5E', 'prod_TYA2f6LK7qu8i9', true, 3);
```

## Step 7: Deploy Edge Functions

```bash
# Deploy all edge functions
supabase functions deploy --project-ref YOUR_PROJECT_REF
```

## Step 8: Configure Secrets

In Supabase Dashboard → Edge Functions → Secrets, add:

| Secret Name | Value |
|-------------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_51SP853...` (your Stripe secret key) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_Jcub1L...` (your webhook signing secret) |
| `CLERK_SECRET_KEY` | Your Clerk secret key (if using Clerk) |

## Step 9: Update Your Local Environment

Create/update `.env.local` in your project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_CLERK_PUBLISHABLE_KEY=pk_test_... (if using Clerk)
```

## Step 10: Enable Authentication Providers

In Supabase Dashboard → Authentication → Providers:

1. **Email**: Enable email confirmations (optional)
2. **Google**: 
   - Enable Google provider
   - Add your Google OAuth credentials
   - Set redirect URL: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

## Step 11: Update Stripe Webhook

In Stripe Dashboard → Developers → Webhooks:

1. Edit your existing webhook OR create new
2. Update endpoint URL to: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
3. Copy the new signing secret and update in Supabase secrets

## Step 12: Test Your Setup

```bash
# Start local development
npm run dev
```

Try these actions:
- [ ] Sign up a new user
- [ ] Create a tenant
- [ ] Start a trial subscription
- [ ] Complete Stripe checkout

## Troubleshooting

### "relation does not exist" errors
Run `supabase db push` again to ensure all migrations applied.

### Auth errors
Check that your `VITE_SUPABASE_ANON_KEY` matches the key in your Supabase dashboard.

### Edge function errors
Check Supabase Dashboard → Edge Functions → Logs for detailed error messages.

### Stripe webhook not working
1. Verify webhook URL is correct
2. Check STRIPE_WEBHOOK_SECRET is set in secrets
3. Look at Stripe Dashboard → Webhooks → Events for delivery status

---

## Quick Reference

| Item | Where to Find |
|------|---------------|
| Project URL | Supabase Dashboard → Settings → API |
| Anon Key | Supabase Dashboard → Settings → API |
| Service Role Key | Supabase Dashboard → Settings → API |
| Database Password | You set this when creating project |
| Connection String | Supabase Dashboard → Settings → Database |

