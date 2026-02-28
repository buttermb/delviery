# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- **Edge function shared deps**: All edge functions import from `../_shared/deps.ts` (serve, createClient, corsHeaders, z). Use `secureHeadersMiddleware` from `../_shared/secure-headers.ts` for OWASP headers.
- **Store resolution**: Stores are in `marketplace_stores` table with `slug` (unique), `tenant_id`, `is_active`. Resolve by slug for storefront, by id for admin.
- **Order creation**: Use `create_marketplace_order` RPC — it handles inventory validation, stock decrement, idempotency, and sequential order number generation (per-tenant, starting from 1001). Inserts into `marketplace_orders` table.
- **Sequential order numbers**: `tenant_order_sequences` table + `next_tenant_order_number(tenant_id)` function. Uses `pg_advisory_xact_lock` keyed on tenant_id to prevent race conditions. Numbers are plain integers as text (e.g., "1001", "1002").
- **storefront_orders**: This is a VIEW on `marketplace_orders WHERE store_id IS NOT NULL`, not a standalone table. Write to `marketplace_orders` directly.
- **Stripe in edge functions**: Tenant Stripe keys are in `account_settings.integration_settings->stripe_secret_key`. Resolve via `accounts` table using `tenant_id`.
- **No console.log in edge functions**: Use structured error responses instead of console.log/error. The quality gate checks for this.
- **Customer upsert pattern**: Two customer tables exist — `customers` (CRM, uses `account_id` + `tenant_id`) and `marketplace_customers` (storefront, uses `store_id` + `email`). The `customers` table requires `account_id` (from `accounts` table via `tenant_id`). Lookup by phone + tenant_id, fallback to email + tenant_id.

---

## 2026-02-27 - floraiq-dy9.1
- Rewrote `supabase/functions/storefront-checkout/index.ts` to match bead spec
- Changed interface from store_id/order_id based to storeSlug/customerInfo/fulfillmentMethod/paymentMethod
- Function now creates orders via `create_marketplace_order` RPC (previously required pre-created order)
- Returns `{ orderId, orderNumber }` (previously returned `{ url, session_id }`)
- Card payments still create Stripe session, returning `checkoutUrl` alongside orderId/orderNumber
- Added Zod validation for all input fields
- Removed all console.error statements, using structured error responses
- Files changed: `supabase/functions/storefront-checkout/index.ts`
- **Learnings:**
  - `storefront_orders` is a VIEW, not a table — write to `marketplace_orders` directly
  - `create_marketplace_order` RPC handles idempotency, inventory, and order number generation
  - The RPC returns just the UUID; need a follow-up SELECT to get order_number
  - Edge functions use Deno runtime; `@/lib/logger` doesn't apply, but console.log is still flagged by quality gates
---

## 2026-02-27 - floraiq-dy9.3
- Added stock validation to `storefront-checkout` edge function (step 3, before order creation)
- Fetches `stock_quantity` alongside product data from the `products` table
- Iterates cart items and checks `stock_quantity >= requested quantity` for each
- If any items have insufficient stock, returns 400 with `{ error: "Insufficient stock", unavailableProducts: [...] }` — includes productId, productName, requested, and available quantities
- All-or-nothing: no partial orders — entire request fails if any item is unavailable
- The RPC (`create_marketplace_order`) also validates stock with row locks as a second safety net; this pre-check gives better UX with structured errors before hitting the DB
- Files changed: `supabase/functions/storefront-checkout/index.ts`
- **Learnings:**
  - `stock_quantity` on `products` is nullable — use `?? 0` for safe comparison
  - Pre-validation at the edge function layer gives structured error responses; RPC validation is the authoritative check with row-level locks for concurrency safety
  - Two-layer stock validation (edge function + RPC) is defense-in-depth: fast feedback to client + race-condition safety in DB
---

## 2026-02-27 - floraiq-dy9.4
- Added customer upsert to `storefront-checkout` edge function (step 6, after order creation)
- Looks up existing customer by phone + tenant_id, falls back to email + tenant_id
- If found: updates `last_purchase_at` and increments `total_spent` by order total
- If not found: creates new customer with firstName, lastName, email, phone, total_spent, last_purchase_at
- Requires `account_id` from `accounts` table — reused for Stripe section (eliminated duplicate account query)
- Returns `customerId` in the response so clients can track the CRM customer
- Files changed: `supabase/functions/storefront-checkout/index.ts`
- **Learnings:**
  - Two separate customer systems: `customers` (CRM, admin/POS) and `marketplace_customers` (storefront B2B). The `create_marketplace_order` RPC originally handled marketplace_customers upsert but the newer version (20260128 migration) dropped that logic
  - `customers.account_id` is required — must fetch from `accounts` table by `tenant_id` before inserting
  - `customers` table has `last_purchase_at` (not `last_order_at`) and `total_spent` but no `total_orders` column
  - The `marketplace_orders` table types don't include `customer_id` — customer info is denormalized as `customer_name`, `customer_email`, `customer_phone` columns
---

## 2026-02-27 - floraiq-dy9.2
- Added server-side price validation to `storefront-checkout` edge function
- Schema now accepts optional `clientTotal` and per-item `price` fields for discrepancy detection
- Server always uses DB prices; if client total or item prices differ (beyond 1 cent tolerance), response includes `priceAdjusted`, `priceDiscrepancy`, and `itemPriceAdjustments`
- Response now returns `serverTotal`, `subtotal`, `tax`, `deliveryFee` so client can reconcile
- Extracted `tax` into a named variable (currently 0) for future tax rule extensibility
- Files changed: `supabase/functions/storefront-checkout/index.ts`
- **Learnings:**
  - For "logging" discrepancies in edge functions (where console.log is banned), include discrepancy data in the structured response — clients can log/track it
  - Use 0.01 tolerance for floating-point price comparisons to avoid false positives from rounding
  - The previous iteration already had the core server-side price fetching; this bead focused on the comparison/reporting layer
---

## 2026-02-27 - floraiq-dy9.5
- Replaced random hex order numbers (`SF-YYMMDD-XXXXXX`) with sequential per-tenant numbers starting from 1001
- Created `tenant_order_sequences` table to track last allocated number per tenant
- Created `next_tenant_order_number(p_tenant_id UUID)` helper function with `pg_advisory_xact_lock` for race-condition safety
- Updated `create_marketplace_order` RPC to call the helper instead of generating random hex
- Order numbers are now plain sequential integers stored as text (e.g., "1001", "1002")
- RLS on `tenant_order_sequences` blocks direct access — only SECURITY DEFINER functions can read/write
- Files changed: `supabase/migrations/20260227000001_sequential_order_numbers.sql`
- **Learnings:**
  - `pg_advisory_xact_lock(hashtext(uuid::text))` is the standard pattern for tenant-scoped advisory locks in PostgreSQL
  - Using INSERT ... ON CONFLICT DO UPDATE (upsert) for the sequence table is cleaner than separate SELECT + UPDATE, and atomic within the advisory lock
  - Existing order numbers in `SF-YYMMDD-XXXXXX` format are unaffected — new orders simply get sequential numbers going forward
  - The `order_number` column is TEXT with a UNIQUE constraint, so sequential integers as text work without schema changes
---

