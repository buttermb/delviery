# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- **Edge function shared deps**: All edge functions import from `../_shared/deps.ts` (serve, createClient, corsHeaders, z). Use `secureHeadersMiddleware` from `../_shared/secure-headers.ts` for OWASP headers.
- **Store resolution**: Stores are in `marketplace_stores` table with `slug` (unique), `tenant_id`, `is_active`. Resolve by slug for storefront, by id for admin.
- **Order creation**: Use `create_marketplace_order` RPC — it handles inventory validation, stock decrement, idempotency, and order number generation (format: `SF-YYMMDD-XXXXXX`). Inserts into `marketplace_orders` table.
- **storefront_orders**: This is a VIEW on `marketplace_orders WHERE store_id IS NOT NULL`, not a standalone table. Write to `marketplace_orders` directly.
- **Stripe in edge functions**: Tenant Stripe keys are in `account_settings.integration_settings->stripe_secret_key`. Resolve via `accounts` table using `tenant_id`.
- **No console.log in edge functions**: Use structured error responses instead of console.log/error. The quality gate checks for this.

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

