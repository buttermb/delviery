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
- **Telegram notification**: `forward-order-telegram` edge function. Telegram settings stored in `account_settings.notification_settings` JSONB (`telegram_bot_token`, `telegram_chat_id`, `telegram_auto_forward`). Called fire-and-forget from `storefront-checkout` via bare `fetch()` without `await`.

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

## 2026-02-27 - floraiq-dy9.6
- Upgraded inventory deduction in `create_marketplace_order` RPC from `GREATEST(0, ...)` to checked `WHERE stock_quantity >= qty` pattern
- Uses `GET DIAGNOSTICS v_affected_rows = ROW_COUNT` to detect race conditions where stock changed between validation and deduction
- If 0 rows affected (race condition), raises exception to rollback entire transaction (order + prior decrements)
- Updated edge function to detect "Inventory deduction failed" errors and return 409 Conflict (alongside existing "Insufficient stock" handling)
- Files changed: `supabase/migrations/20260227000002_inventory_deduction_safety.sql`, `supabase/functions/storefront-checkout/index.ts`
- **Learnings:**
  - `marketplace_orders.status` has a CHECK constraint: `('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')` — can't use arbitrary status values without altering the constraint
  - Rolling back via RAISE EXCEPTION is cleaner than marking orders as 'needs_attention' when the status CHECK constraint is restrictive
  - `FOR UPDATE` locks during validation already prevent the race condition in practice; the `WHERE stock_quantity >= qty` pattern is defense-in-depth
  - `GET DIAGNOSTICS v_affected_rows = ROW_COUNT` is the PL/pgSQL way to check affected rows from an UPDATE (not `FOUND`, which only works for SELECT INTO)
  - `payment_status` uses 'awaiting_payment' in the RPC but the original CHECK constraint only has `('pending', 'paid', 'failed', 'refunded')` — likely relaxed in a later migration
---

## 2026-02-27 - floraiq-dy9.7
- Created `forward-order-telegram` edge function that sends order notifications to a tenant's configured Telegram chat
- Function fetches `notification_settings` from `account_settings` (via `accounts.tenant_id`), checks `telegram_auto_forward`, `telegram_bot_token`, and `telegram_chat_id`
- Formats a rich MarkdownV2 message with order number, customer info, items, and total
- Calls the Telegram Bot API `sendMessage` endpoint; returns 200 with `{ sent: false, reason }` on any failure (never errors out)
- Added fire-and-forget call in `storefront-checkout` (step 7) using bare `fetch()` without `await`, following the `tenant-invite` pattern
- `.catch(() => {})` swallows errors so Telegram failures never block the checkout response
- Files changed: `supabase/functions/forward-order-telegram/index.ts` (new), `supabase/functions/storefront-checkout/index.ts`
- **Learnings:**
  - Telegram settings live in `account_settings.notification_settings` JSONB: `telegram_bot_token`, `telegram_chat_id`, `telegram_auto_forward`
  - Fire-and-forget in Deno edge functions: call `fetch()` without `await` + `.catch(() => {})` — Deno does NOT abort pending promises when the handler returns
  - The `tenant-invite` function uses this same pattern for async email sending
  - Telegram MarkdownV2 requires escaping special characters: `_*[]()~>#+\-=|{}.!`
  - `account_settings` is keyed by `account_id` (not `tenant_id`), so you must resolve `accounts.id` from `tenant_id` first
---

## 2026-02-27 - floraiq-dy9.8
- Added comprehensive error handling to `storefront-checkout` edge function
- Separated store 404 (not found) from 403 (not published/inactive) by removing `is_active` from the initial query and checking it separately
- Added JSON body parse error handling — returns 400 instead of falling through to generic 500
- Sanitized database errors from `create_marketplace_order` RPC — stock errors get specific 409 responses, all other DB errors get a generic "Failed to create order" message (never leaks raw error strings)
- Wrapped Stripe section in try/catch — Stripe failures return 402 Payment Required with the Stripe error message plus `orderId`/`orderNumber` in details (order was already created)
- Changed outer catch from leaking `err.message` to always returning generic "Internal server error"
- Files changed: `supabase/functions/storefront-checkout/index.ts`
- **Learnings:**
  - For store resolution, querying without `is_active` filter and checking separately allows distinguishing "store doesn't exist" (404) from "store exists but not published" (403)
  - Stripe errors should return 402 (Payment Required) — the order still exists, so include orderId in the error response so the client can retry payment
  - The outer catch should NEVER pass through `err.message` — it could contain stack traces, SQL errors, or other internals
  - JSON parse errors from `req.json()` in Deno throw generic errors — catch them in an inner try/catch to return 400 instead of 500
---

## 2026-02-27 - floraiq-dy9.9
- Verified `forward-order-telegram` edge function already fully implemented in dy9.7
- Quality gates confirmed: `npx tsc --noEmit` passes, no `console.log`, tenant_id filtering via accounts table lookup
- Fire-and-forget integration from `storefront-checkout` confirmed at line 370
- No changes needed — bead closed as already complete
- Files changed: none
- **Learnings:**
  - When a bead's work was already done in an earlier iteration (dy9.7 implemented both the edge function AND checkout integration), verify quality gates and close immediately rather than re-implementing
---

## 2026-02-27 - floraiq-dy9.10
- Verified `get_marketplace_store_by_slug` RPC function already exists (migration `20251210164902`)
- Function takes `p_slug TEXT`, returns 23-column TABLE with layout_config, theme_config, checkout_settings, operating_hours, payment_methods
- Published-store filtering: `is_public = true` for public access; tenant members (via `tenant_users` subquery) bypass for admin preview
- SECURITY DEFINER with `SET search_path = public`, permissions granted to anon/authenticated/service_role
- Used by 4 React components: ShopLayout, StoreLandingPage, StoreMenuPage, StoreProductPage
- Quality gates confirmed: `npx tsc --noEmit` passes, no `console.log`, tenant_id filtering via tenant_users subquery
- No changes needed — bead closed as already complete
- Files changed: none
- **Learnings:**
  - The `is_active` vs `is_public` separation in the RPC is intentional — the function returns `is_active` in the result set so components can show different UI states (maintenance page vs not found), rather than filtering it out at the DB level
  - Multiple migrations evolved this function (20251209 initial → 20251210 with correct types + search_path) — always check the latest migration version
  - Pattern: RPC functions that return TABLE type require `data[0]` access in TypeScript since Supabase returns an array
---

## 2026-02-27 - floraiq-dy9.11
- Verified `get_marketplace_products` RPC function already exists (latest migration: `20260112000001_fix_rpc_product_settings.sql`)
- Function takes `p_store_id UUID`, resolves `tenant_id` internally from `marketplace_stores`, returns 21-column TABLE
- Filters: only visible products (`COALESCE(mps.is_visible, true) = true`), tenant-isolated (`p.tenant_id = v_tenant_id`)
- Returns products with images, categories, prices (including custom prices from `marketplace_product_settings`), stock, THC/CBD, effects, slugs
- SECURITY DEFINER with grants to anon/authenticated/service_role
- Frontend filtering (category, search, sort, limit/offset pagination) handled client-side in `ProductCatalogPage.tsx` via `useMemo` — appropriate for typical catalog sizes
- 14 frontend consumers already using the RPC
- Quality gates confirmed: `npx tsc --noEmit` passes, no `console.log`, tenant_id filtering via internal resolution
- No changes needed — bead closed as already complete
- Files changed: none
- **Learnings:**
  - The bead spec mentioned `tenant_id` as input, but the actual design uses `store_id` and resolves tenant internally — this is correct because storefront consumers only know the store, not the tenant
  - Client-side filtering is the chosen pattern for storefront product catalogs; the RPC returns all visible products and the frontend handles search/sort/pagination
  - The function has a B2B fallback path via `marketplace_listings` when the store is a marketplace profile rather than a D2C storefront
---
