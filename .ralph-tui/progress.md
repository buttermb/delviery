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
- **Edge function fallback pattern**: CheckoutPage tries `storefront-checkout` edge function first (full server-side flow), falls back to direct `create_marketplace_order` RPC if edge function returns 500 or is unreachable. Business errors (400, 403, 409) propagate without fallback. Detect error type via `(error as { name?: string }).name` — `FunctionsFetchError`/`FunctionsRelayError` = network/deployment issue.
- **queryKeys injection corruption**: Previous automated tooling injected `import { queryKeys }` mid-import-block and corrupted `Database['public']['Tables']['x']['Row']` type patterns with `queryKeys.x.all`. Always check for these corruptions after automated `queryKeys` migrations.
- **||/?? mixing**: esbuild (Vite) strictly enforces parenthesization when `||` and `??` are mixed in the same expression. TypeScript may allow it, but the build will fail. Always wrap: `a || (b ?? c)`.

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

## 2026-02-27 - floraiq-dy9.12
- Implemented client-side fallback for checkout when `storefront-checkout` edge function is unavailable
- Restructured `CheckoutPage.tsx` `mutationFn` to try edge function first, fallback to direct `create_marketplace_order` RPC
- `tryEdgeFunction()` returns `null` for 500/network errors (triggers fallback), throws `Error` for business errors (400/403/409), returns `OrderResult` on success
- Edge function handles: order creation, stock validation, customer upsert, Telegram notification, Stripe session — all in one call
- Fallback path uses existing direct RPC with client-side stock check
- `onSuccess` handles `checkoutUrl` from edge function for Stripe redirect; fallback card payments show info toast (payment arranged with store)
- Also fixed broken Stripe integration in `onSuccess` — old code used `store_id`/`order_id` interface that was incompatible with rewritten edge function
- Files changed: `src/pages/shop/CheckoutPage.tsx` (+99/-61)
- **Learnings:**
  - `supabase.functions.invoke` error types: `FunctionsFetchError` (not deployed/network), `FunctionsRelayError` (relay issues), `FunctionsHttpError` (non-2xx) — check via `error.name` string, no need to import classes
  - When edge function is unavailable, Stripe Checkout sessions can't be created client-side (requires server-side Stripe secret key). Graceful degradation: order is created, store follows up on payment
  - The `storefront-checkout` edge function was rewritten (dy9.1) to accept `storeSlug`/`customerInfo` interface, but `onSuccess` was still calling it with the old `store_id`/`order_id` interface — this bead fixed that mismatch
  - `tryEdgeFunction` returning `null | OrderResult` with throws for business errors is cleaner than sentinel objects or custom error classes for a single-use function
---

## 2026-02-27 - floraiq-khy.1
- E2E flow audit: Admin creates store → customer shops → order arrives in admin
- Fixed malformed import in `useStorefrontBuilder.ts` — `queryKeys` and `humanizeError` imports were accidentally embedded inside another `import { }` block (dead code, but broken syntax)
- Edge function `storefront-checkout` now returns `tracking_token` alongside `order_number` — was missing, causing edge function path to lose tracking URL on confirmation page
- Edge function fetches `telegram_video_link` from `account_settings` and returns it as `telegramLink`
- `CheckoutPage.tsx` now extracts `tracking_token` and `telegramLink` from edge function response and passes both to confirmation page
- `OrderConfirmationPage.tsx` shows "Chat with us on Telegram" link when configured
- Files changed: `src/pages/admin/storefront/builder/useStorefrontBuilder.ts`, `supabase/functions/storefront-checkout/index.ts`, `src/pages/shop/CheckoutPage.tsx`, `src/pages/shop/OrderConfirmationPage.tsx`
- **Learnings:**
  - The `useStorefrontBuilder` hook is dead code — exported from barrel `builder/index.ts` but never imported anywhere. `StorefrontBuilder.tsx` manages its own state directly
  - `create_marketplace_order` RPC generates `tracking_token` internally but only returns the UUID — must do a follow-up SELECT to get `tracking_token` and `order_number`
  - `telegram_video_link` in `account_settings` is the public-facing Telegram link for the business; `telegram_bot_token`/`telegram_chat_id` in `notification_settings` JSONB are for admin notifications (private)
  - Edge function vs fallback path divergence: the fallback path in CheckoutPage always fetches `tracking_token` from `storefront_orders`, but the edge function path was missing it — easy to miss when two code paths exist for the same flow
---

## 2026-02-27 - floraiq-khy.2
- E2E verification: Guest checkout with cash — full flow
- Added `preferredContact` field ('text' | 'call' | 'email') to CheckoutData interface, default 'text'
- Added RadioGroup selector for preferred contact method in checkout Step 1 (after phone field)
- Pass preferred contact through to order notes for both edge function and fallback RPC paths (format: "Preferred contact: text | delivery notes")
- Display preferred contact in checkout review step (Step 4)
- Added success toast for cash orders: "Thanks! You'll be contacted." with order number
- Verified full E2E flow: product catalog with filters → cart with quantity adjustment → 4-step checkout → order confirmation page
- Files changed: `src/pages/shop/CheckoutPage.tsx`
- **Learnings:**
  - The `customers` table doesn't have `preferred_contact_method` — that field exists only on the `contacts` table. Best to include contact preference in order notes for now
  - The checkout form persists to localStorage (`shop_checkout_form_<storeId>`), so new fields automatically persist across sessions
  - The edge function Zod schema strips unknown fields — must use an existing accepted field (like `notes`) to pass through additional data
  - Two-path checkout (edge function → fallback RPC) means any new data must be added to both paths
  - Cash orders had no confirmation toast while card orders did — easy gap to miss since most testing focuses on card payments
---

## 2026-02-27 - floraiq-khy.3
- E2E: Guest checkout with Venmo — full flow
- Added `venmo_handle` to `checkout_settings` JSONB on `marketplace_stores` (via StoreInfo and StoreSettings interfaces)
- Admin can configure Venmo handle in StorefrontSettings when Venmo payment is enabled
- Customer checkout: when Venmo selected, shows handle with copy button + "I've sent payment via Venmo" confirmation checkbox
- Validation requires checkbox before proceeding to review step
- Review step shows "Venmo" label for payment summary
- Success toast on order completion for Venmo payments
- Files changed: `src/pages/shop/ShopLayout.tsx`, `src/pages/shop/CheckoutPage.tsx`, `src/pages/admin/storefront/StorefrontSettings.tsx`
- **Learnings:**
  - Store payment details (like Venmo handle) are stored in `checkout_settings` JSONB — not in `payment_methods` (which is a simple `string[]` of enabled method IDs)
  - The `updateCheckoutSetting` helper in StorefrontSettings was typed as `boolean`-only; needed widening to `boolean | string` for text fields
  - ModernCheckoutFlow (disposable menus) already has the copy-button-on-username pattern; the storefront CheckoutPage needed it added
  - `payment_methods` on the store is `Json | null` in the DB but cast to `string[]` in the frontend — no migration needed for adding payment method config, just extend `checkout_settings` JSONB
  - The `&apos;` entity in JSX is needed for apostrophes in string literals to satisfy some linters
---

## 2026-02-27 - floraiq-khy.4
- E2E: Guest checkout with Zelle — full flow
- Added `zelle_email` to `checkout_settings` JSONB on `marketplace_stores` (via StoreInfo and StoreSettings interfaces)
- Admin can configure Zelle email/phone in StorefrontSettings when Zelle payment is enabled
- Customer checkout: when Zelle selected, shows email/phone with copy button + "I've sent payment via Zelle" confirmation checkbox
- Validation requires checkbox before proceeding to review step
- Review step shows "Zelle" label for payment summary
- Success toast on order completion for Zelle payments
- Files changed: `src/pages/shop/ShopLayout.tsx`, `src/pages/shop/CheckoutPage.tsx`, `src/pages/admin/storefront/StorefrontSettings.tsx`
- **Learnings:**
  - Zelle follows exact same pattern as Venmo (khy.3) — `checkout_settings` JSONB field + confirmation checkbox + copy button
  - Three-file change pattern for new payment methods: ShopLayout (StoreInfo type), StorefrontSettings (admin config), CheckoutPage (customer flow)
  - The checkout RadioGroup already had labels for 'zelle' from the initial implementation — only the details section, confirmation state, validation, and success toast were missing
---

## 2026-02-27 - floraiq-1aj.1
- Tightened RLS policies on `marketplace_stores` to enforce role-based write access
- Dropped the overly permissive `FOR ALL` policy ("Tenant members can manage their store") which allowed any tenant member to INSERT/UPDATE/DELETE
- Replaced with 4 granular policies:
  - "Public can view active public stores" (unchanged, SELECT for `is_active AND is_public`)
  - "Tenant members can view their stores" (SELECT for any tenant member, any store status)
  - "Tenant admins can insert stores" (INSERT restricted to `owner`/`admin` roles)
  - "Tenant admins can update stores" (UPDATE restricted to `owner`/`admin` roles)
  - "Tenant admins can delete stores" (DELETE restricted to `owner`/`admin` roles)
- Files changed: `supabase/migrations/20260227000003_marketplace_stores_rls_tighten.sql` (new)
- **Learnings:**
  - The `tenant_users.role` column has values: `('owner', 'admin', 'member', 'viewer')` — use `role IN ('owner', 'admin')` for admin-only policies
  - `FOR ALL` policies are convenient but dangerous — they grant INSERT/UPDATE/DELETE to all matching users without role checks
  - Pattern for role-restricted RLS: separate SELECT (all members) from write operations (admin-only), with both USING and WITH CHECK clauses on UPDATE
  - The `credit_transactions` table already used the `role IN ('owner', 'admin')` pattern — this is the established codebase convention for admin-only access
---

## 2026-02-27 - floraiq-1aj.2
- Tightened RLS policies on `marketplace_orders` and `marketplace_order_items` tables
- Dropped 4 existing overly permissive policies on `marketplace_orders`:
  - "Buyers can view own orders" (SELECT) — replaced with unified buyer+seller SELECT
  - "Sellers can view orders for their products" (SELECT) — merged into unified SELECT
  - "System can create orders" (`WITH CHECK (true)`) — replaced with admin-only INSERT
  - "Sellers can update order status" (no role restriction) — replaced with admin-only UPDATE
- Dropped 2 existing overly permissive policies on `marketplace_order_items`:
  - "Order items inherit order access" (SELECT) — replaced with tenant-scoped SELECT
  - "System can create order items" (`WITH CHECK (true)`) — replaced with admin-only INSERT
- New policies:
  - `mo_tenant_select`: Any tenant member (buyer or seller) can view orders
  - `mo_admin_insert`: Only owner/admin can directly insert (RPC bypasses via SECURITY DEFINER)
  - `mo_admin_update`: Only owner/admin of buyer or seller tenant can update (USING + WITH CHECK)
  - `mo_admin_delete`: Only owner/admin of seller tenant can delete
  - `moi_tenant_select`: Tenant members see items for orders they can access
  - `moi_admin_insert`: Admin-only item inserts (RPC bypasses)
- Customer tracking: `get_marketplace_order_by_token` SECURITY DEFINER RPC already handles this (defined in ignored_migrations, grants to anon/authenticated/service_role)
- Files changed: `supabase/migrations/20260227000004_marketplace_orders_rls_tighten.sql` (new)
- **Learnings:**
  - `marketplace_orders` uses `buyer_tenant_id` and `seller_tenant_id` (not a single `tenant_id`) — SELECT policies must check both columns with OR
  - For D2C storefront orders, `buyer_tenant_id = seller_tenant_id = store's tenant_id` (set by `create_marketplace_order` RPC)
  - `WITH CHECK (true)` on INSERT is a common anti-pattern from initial scaffolding — always replace with proper tenant-scoped checks
  - `storefront_orders` view has `security_invoker = true`, so it inherits RLS from `marketplace_orders` — tightening the table automatically secures the view
  - Customer order tracking uses `get_marketplace_order_by_token` SECURITY DEFINER RPC (in `ignored_migrations/20250128000003_storefront_rpc.sql`), not direct table access — so RLS tightening doesn't break customer flows
  - Pattern: use `USING` + `WITH CHECK` on UPDATE policies — `USING` controls which rows can be selected for update, `WITH CHECK` controls what values can be written
---

## 2026-02-28 - floraiq-1aj.3
- Tightened RLS policies on `customers` table from any-tenant-member to admin-only
- Dropped 4 existing policies (customers_tenant_select/insert/update/delete)
- Created 4 new admin-restricted policies:
  - `customers_admin_select`: SELECT restricted to owner/admin roles
  - `customers_admin_insert`: INSERT restricted to owner/admin roles
  - `customers_admin_update`: UPDATE restricted to owner/admin roles (USING + WITH CHECK)
  - `customers_admin_delete`: DELETE restricted to owner/admin roles
- Edge functions (storefront-checkout, menu-order-place, customer-auth, etc.) use service_role which bypasses RLS — no impact
- SECURITY DEFINER functions (create_pos_transaction_atomic, emergency_wipe) also bypass RLS — no impact
- All frontend consumers (CustomerManagement, CustomerForm, PointOfSale, CustomerImport) are admin pages — no access regression
- Files changed: `supabase/migrations/20260228000001_customers_rls_tighten.sql` (new)
- **Learnings:**
  - The `customers` table is accessed by ~10 edge functions, all using service_role — RLS changes are transparent to them
  - Multiple SECURITY DEFINER RPCs (POS transactions, emergency wipe) update/delete customers — they also bypass RLS
  - All frontend `.from('customers')` queries are in admin-only pages/hooks, so restricting to owner/admin roles doesn't break any existing flows
  - Pattern confirmed: for CRM/admin-only tables, restrict all operations to owner/admin roles (not just writes)
---

## 2026-02-28 - floraiq-1aj.4
- Tightened RLS policies on `products` table from tenant-member to public-read + admin-only-write
- Dropped 4 existing `products_tenant_*` policies (SELECT/INSERT/UPDATE/DELETE for any tenant member)
- Also dropped 20+ legacy policy names from earlier migrations that may still linger
- Created 4 new policies:
  - `products_public_select`: SELECT with `USING (true)` — public read access (anon + authenticated)
  - `products_admin_insert`: INSERT restricted to owner/admin roles
  - `products_admin_update`: UPDATE restricted to owner/admin roles (USING + WITH CHECK)
  - `products_admin_delete`: DELETE restricted to owner/admin roles
- Storefront stock checks (CartStockWarning, CheckoutPage) directly query products by ID — needs public SELECT
- Main catalog uses `get_marketplace_products` SECURITY DEFINER RPC (bypasses RLS)
- Files changed: `supabase/migrations/20260228000002_products_rls_tighten.sql` (new)
- **Learnings:**
  - Products table does NOT have an `is_active` column in the generated types, despite an index `idx_products_tenant_id_is_active` existing — types may be stale or the column was added and types not regenerated
  - For storefront-facing tables: use `USING (true)` for public SELECT — visibility filtering is handled at the application layer (RPCs filter by `marketplace_product_settings.is_visible`, components filter by `in_stock`)
  - Three storefront components directly query the products table: `CartStockWarning` (stock by product IDs), `CheckoutPage` (stock validation), `ProductGridSection` (admin preview only — actual storefront uses RPC)
  - Pattern divergence: CRM-only tables (customers) restrict SELECT to admin-only; storefront-facing tables (products, marketplace_stores) allow public SELECT
  - Products had 20+ historical policy names across migrations — always drop a comprehensive list of old names to avoid conflicts
---

## 2026-02-28 - floraiq-1aj.5
- Verified server-side price validation already fully implemented in `storefront-checkout` edge function (from floraiq-dy9.2)
- Key security measures confirmed:
  - Products fetched from DB by `tenant_id` (line 132-136), client `price` field is always overridden
  - Server-side subtotal/tax/deliveryFee/total calculation (lines 145-213)
  - `clientTotal` discrepancy detection with 1-cent tolerance (lines 218-228)
  - Per-item price adjustment detection (lines 231-250)
  - Response includes `serverTotal`, `subtotal`, `tax`, `deliveryFee` for client reconciliation
  - Stripe line items also use server-side prices (line 472: `Math.round(Number(product.price) * 100)`)
- Quality gates confirmed: `npx tsc --noEmit` passes, no `console.log`, tenant_id filtering on products query
- No changes needed — bead closed as already complete
- Files changed: none
- **Learnings:**
  - When server-side price validation is required, the pattern is: (1) fetch from DB, (2) calculate server-side, (3) detect discrepancy, (4) always use server values — client prices are informational only
  - The `priceAdjusted` / `priceDiscrepancy` / `itemPriceAdjustments` fields in the response serve as a structured "logging" mechanism since edge functions can't use console.log
---

## 2026-02-28 - floraiq-9wi.1
- Optimized storefront homepage for mobile layout at 375px width (iPhone SE)
- Added `overflow-x-hidden` to StorefrontPage root div to prevent horizontal scroll from decorative elements (animated orbs, blurred circles)
- Made HeroSection CTA buttons full-width on mobile with `w-full sm:w-auto` on both Link wrappers and Button components
- Changed product grids from `grid-cols-1` to `grid-cols-2` on mobile in LuxuryProductGridSection, HotItemsSection, and ProductGridSection (including loading skeletons)
- Reduced mobile grid gap from `gap-4` to `gap-3` for tighter 2-column layout at 375px
- FeaturesSection already stacks vertically on mobile (1 column below md breakpoint) — no changes needed
- DealsHighlightSection already uses 1-column on mobile — appropriate for content-heavy deal cards
- Files changed: `StorefrontPage.tsx`, `HeroSection.tsx`, `LuxuryProductGridSection.tsx`, `HotItemsSection.tsx`, `ProductGridSection.tsx`
- **Learnings:**
  - `StorefrontPage` maps `product_grid` type to `LuxuryProductGridSection` (not `ProductGridSection`) — both needed updating for consistency
  - At 375px with `gap-3` (12px) and container `px-4` (32px total), each card in a 2-column grid gets ~(375-32-12)/2 ≈ 165px width — tight but works with the existing mobile-reduced padding (`p-3 sm:p-5`)
  - Hero text uses `clamp(4rem,15vw,9rem)` — at 375px, 15vw=56px < 4rem=64px, so it clamps to 64px minimum. With `font-extralight` and `leading-[0.9]`, three lines fit comfortably on iPhone SE
  - The `overflow-x-hidden` on the page root is a safety net — individual sections like HeroSection and HotItemsSection already have `overflow-hidden`, but decorative elements in other sections could still cause horizontal scroll
---

## 2026-02-28 - floraiq-9wi.2
- Optimized product catalog page for mobile layout at 375px width
- Changed product grid from `grid-cols-1 sm:grid-cols-2` to `grid-cols-2` for 2-column layout on all screen sizes
- Reduced grid gap to `gap-3 sm:gap-4` for tighter fit at 375px
- Updated loading skeleton grid to match 2-column mobile layout
- StorefrontProductCard mobile optimizations:
  - Product name: `text-sm sm:text-lg` (was `text-lg`)
  - Price: `text-base sm:text-xl` (was `text-xl`)
  - Add button: `h-8 px-2 sm:h-10 sm:px-5` — icon-only on mobile, text visible on sm+
  - Added bottom padding to footer for mobile: `pb-3 sm:pb-0`
- Filters already hidden behind "Filters" drawer button (`md:hidden`), search full-width, sort dropdown accessible — no changes needed
- Files changed: `src/pages/shop/ProductCatalogPage.tsx`, `src/components/shop/StorefrontProductCard.tsx`
- **Learnings:**
  - At 375px with `gap-3` (12px) and container `px-4` (32px total), each card in a 2-column grid gets ~165px width — same calculation as homepage grids (9wi.1)
  - StorefrontProductCard already had good responsive padding (`p-3 sm:p-5`) but text sizes and button needed mobile-specific overrides for 2-col fit
  - Icon-only buttons (`hidden sm:inline` on text) are the standard pattern for compact mobile actions — keeps the "Add to cart" tap target visible while saving horizontal space
  - FilterDrawer and FilterTriggerButton were already fully implemented for mobile — the catalog just needed grid column and card sizing changes
---

## 2026-02-28 - floraiq-9wi.3
- Optimized product detail page for mobile layout at 375px width
- Image gallery: added touch swipe handlers (touchstart/touchmove/touchend) for horizontal carousel navigation; mobile dot indicators replace thumbnails (`sm:hidden` / `hidden sm:flex`)
- Info section already stacks below images via `grid-cols-1 lg:grid-cols-12` — reduced gap to `gap-6 sm:gap-12 lg:gap-20`
- Add to Cart: `EnhancedStickyAddToCart` already provides fixed bottom bar on mobile (`md:hidden`); main button also responsive with `py-3 sm:py-4`, `text-base sm:text-lg`
- Related products: changed from grid to `flex overflow-x-auto snap-x` on mobile with `w-[65vw]` cards, reverting to `sm:grid sm:grid-cols-2 lg:grid-cols-4` on desktop
- Breadcrumbs: `text-xs sm:text-sm`, product name truncated at `max-w-[180px]` on mobile
- Text sizing: price `text-2xl sm:text-3xl`, description `text-sm sm:text-lg`, section spacing `mt-12 sm:mt-24`
- Added `overflow-x-hidden` to root div to prevent ambient effects from causing horizontal scroll
- Loading skeleton responsive: `h-[300px] sm:h-[600px]`, `rounded-2xl sm:rounded-3xl`
- Files changed: `src/pages/shop/ProductDetailPage.tsx`
- **Learnings:**
  - Touch swipe pattern: `useRef` for start/end X coordinates, 50px threshold for swipe detection, `useCallback` for stable handlers
  - `snap-x snap-mandatory` + `snap-start` gives native-feeling horizontal scroll with snapping on mobile
  - `w-[65vw]` for horizontal scroll cards shows ~1.3 cards at 375px width — good for discoverability (user sees next card peeking)
  - `EnhancedStickyAddToCart` component was already built for mobile — shows after 400px scroll with stock warnings, haptic feedback, quantity controls
  - Dot indicators pattern: active dot wider (`w-6 h-2`) vs inactive (`w-2 h-2`) with smooth transition
---

## 2026-02-28 - floraiq-9wi.4
- Optimized cart page for mobile layout at 375px width
- Wrapped cart items in `SwipeableCartItem` for swipe-to-delete on touch devices (uses `react-swipeable` with haptic feedback)
- Added separate mobile controls row with 44px touch targets (`h-11 w-11 rounded-full`) for quantity +/- and remove buttons
- Desktop controls remain unchanged (`h-8 w-8`, positioned in right column) — hidden on mobile via `hidden sm:flex`
- Sticky checkout bar: full-width button (`w-full h-12`) with safe-area-inset-bottom padding for notch devices
- Responsive sizing: smaller images on mobile (`w-16 h-16 sm:w-20 sm:h-20`), smaller text (`text-sm sm:text-base`), tighter spacing (`gap-3 sm:gap-4`)
- Card content padding reduced on mobile (`px-3 sm:px-6`) to maximize usable width at 375px
- Mobile controls aligned past image with `ml-[76px]` (64px image + 12px gap)
- Files changed: `src/pages/shop/CartPage.tsx`
- **Learnings:**
  - `SwipeableCartItem` component was already built — wraps children with swipe-to-delete behavior using `react-swipeable`, 60px threshold for delete, haptic feedback via `haptics.medium()`
  - Dual controls pattern (desktop right-column + mobile bottom-row) avoids cramming 44px buttons into narrow right column at 375px
  - `pb-[max(1rem,env(safe-area-inset-bottom))]` is the cross-browser pattern for safe area padding — `max()` ensures minimum padding even without safe areas
  - At 375px with `px-3` card padding + `px-4` container: effective content width is ~343px. Mobile controls row with 3 buttons (44px each) + gaps fits well within `ml-[76px]` offset
---

## 2026-02-28 - floraiq-9wi.5
- Optimized checkout page for mobile layout at 375px width
- Step indicator: replaced circles+icons with compact horizontal pill buttons on mobile (`sm:hidden` / `hidden sm:flex` pattern) — pills show step number or checkmark, step name, colored by theme
- Completed step pills are clickable (navigate back to that step); future steps are disabled
- Form content: reduced card padding on mobile (`px-3 sm:px-6`), tighter heading sizes (`text-lg sm:text-xl`)
- Payment options: tighter padding (`p-3 sm:p-4`), `w-full` already implicit from stacked layout
- Order summary: already had collapsible mobile section — reduced icon/text sizes and padding for 375px
- Place Order: full-width sticky button (`w-full h-12`) with total displayed inline; uses `env(safe-area-inset-bottom)` for notch devices
- Mobile sticky bar: steps 1-3 show compact total + Continue button; step 4 shows total row + full-width "Place Order — $XX.XX" button
- Navigation: desktop buttons hidden on mobile (`hidden sm:flex`); mobile gets ghost "Back" link above sticky bar
- Files changed: `src/pages/shop/CheckoutPage.tsx`
- **Learnings:**
  - Dual step indicator pattern (mobile pills vs desktop circles) uses `sm:hidden` / `hidden sm:flex` — cleaner than trying to make one indicator work at all sizes
  - Pill step indicators at 375px: 4 pills × ~80px each + gaps = ~340px — fits within 375px container with `px-3` padding
  - For sticky checkout bars, separate layout for "Continue" vs "Place Order" steps is better UX — step 4 needs more prominence (full-width button with total)
  - `env(safe-area-inset-bottom)` in `style` prop via `paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))'` works inline — no Tailwind arbitrary needed
  - Mobile nav buttons: hiding the in-form buttons and using the sticky bar as the primary action avoids duplicate CTAs on small screens
---

## 2026-02-28 - floraiq-9wi.6
- Optimized order confirmation page for mobile layout at 375px width
- Success animation: scaled down CheckCircle icon (`w-16 h-16 sm:w-20 sm:h-20`) and title (`text-2xl sm:text-3xl`) for mobile readability
- Status timeline: replaced `grid-cols-1 md:grid-cols-3` centered cards with vertical left-aligned timeline on mobile (`md:hidden`) — colored connector line, icon circles, compact text
- Desktop timeline preserved as `hidden md:grid md:grid-cols-3`
- Telegram link: upgraded from subtle `<a>` tag to full-width prominent Button (`h-12`, `font-semibold`, store primary color) — meets "large, prominent, full-width" requirement
- Tracking URL: `min-w-0` on input prevents overflow at 375px, icon-only copy button on mobile (`hidden sm:inline` on text)
- All cards: reduced padding on mobile (`px-4 sm:px-6`, `pt-4 sm:pt-6`), tighter margins (`mb-4 sm:mb-6`)
- Section headings: `text-base sm:text-lg` for mobile-appropriate sizing
- Bottom action buttons: `h-11 sm:h-10` for 44px touch targets on mobile
- Files changed: `src/pages/shop/OrderConfirmationPage.tsx`
- **Learnings:**
  - Vertical timeline pattern on mobile: `relative pl-8` container with `absolute -left-8` icon circles and absolute vertical connector line — positions icons precisely on the timeline axis
  - `md:hidden` / `hidden md:grid` dual-layout pattern (same as checkout step indicators in 9wi.5) — cleaner than responsive transforms for fundamentally different layouts
  - Tracking URL input at 375px needs `min-w-0` to respect flex container bounds — without it, the URL text causes overflow
  - Telegram button needs to be inside an `<a>` wrapper (not Button `asChild`) because Button from shadcn doesn't pass `target`/`rel` attributes through
---

## 2026-02-28 - floraiq-e82.1
- Prevented double order submission on checkout page
- Added `useRef`-based fast double-click guard (`isSubmittingRef`) — ref updates synchronously, before React re-renders with `isPending`
- Persisted idempotency key to `sessionStorage` (keyed by `storeSlug`) so it survives browser refresh during submission
- On success: clear sessionStorage idempotency key so future checkouts get a fresh key
- Added `onSettled` to mutation to reset `isSubmittingRef` (allows retry after error)
- `handlePlaceOrder` now checks both `isSubmittingRef.current` and `placeOrderMutation.isPending` before proceeding
- Existing `p_idempotency_key` param already passed to both edge function and fallback RPC — no changes needed there
- Files changed: `src/pages/shop/CheckoutPage.tsx`
- **Learnings:**
  - `useRef` for click guards is more reliable than `useState` — refs update synchronously, state updates are batched and async
  - `sessionStorage` is ideal for idempotency keys — persists across refresh but not across tabs/new sessions
  - The gap between button click and `isPending` becoming `true` is real — TanStack Query sets `isPending` asynchronously after `mutate()` is called, so fast double-clicks can sneak through
  - `onSettled` fires for both success and error — perfect for cleanup that should happen regardless of outcome
---

## 2026-02-28 - floraiq-e82.2
- Updated `onError` handler in checkout `placeOrderMutation` to show user-friendly "Something went wrong. Please try again." for retryable errors (network, 500, timeout, internal server error)
- Broadened retryable error detection to include "internal server error", "500", "failed to create order", and empty messages
- Business errors (blocked customer, out of stock, purchase limits) still show specific actionable messages
- Verified existing safeguards: button re-enables via `isPending` + `onSettled`; cart not cleared on error; no navigation on error
- Files changed: `src/pages/shop/CheckoutPage.tsx`
- **Learnings:**
  - Most of the network error handling infrastructure was already in place from dy9.12 and e82.1 — this bead was primarily about matching the exact error message spec
  - The two-path checkout (edge function → fallback RPC) means network/500 errors from the edge function trigger the fallback first; the `onError` handler only fires when BOTH paths fail
  - Retryable error detection should be broad: empty messages, "internal server error", "500" keywords — not just "network"/"fetch"/"timeout"
---

## 2026-02-28 - floraiq-e82.3
- Implemented out-of-stock handling during checkout — when products go out of stock between cart and order placement
- Created `OutOfStockError` class extending `Error` with structured `unavailableProducts` array (productId, productName, requested, available)
- Edge function path: parses `unavailableProducts` from 400 response body when `error === "Insufficient stock"`, throws `OutOfStockError`
- Fallback client-side stock check: builds same `UnavailableProduct[]` structure, throws `OutOfStockError` instead of generic `Error`
- `onError` handler: detects `OutOfStockError` via `instanceof`, shows per-product toast messages ("Sorry, {name} is no longer available."), removes unavailable items from cart via `removeItem`
- Items with `available > 0` but insufficient quantity show additional "Only X left in stock" description
- After removal, if remaining items exist, shows info toast "Your cart has been updated" and keeps user on review step
- If all items removed, existing empty-cart redirect effect navigates to cart page
- Added `removeItem` to destructured `useShopCart` hook
- Files changed: `src/pages/shop/CheckoutPage.tsx`
- **Learnings:**
  - Custom error classes (`extends Error`) with data payloads are the cleanest way to propagate structured error info through mutation `onError` handlers
  - The edge function returns structured `unavailableProducts` in the 400 body, but `tryEdgeFunction` was only extracting the `error` string — needed explicit parsing of the array
  - Two removal strategies: `available <= 0` = fully out of stock, `available > 0 but < requested` = insufficient quantity — both remove from cart but show different messages
  - The existing `useEffect` that redirects on empty cart (`cartItems.length === 0`) serves as a safety net when all items are removed by stock errors
---

## 2026-02-28 - floraiq-e82.4
- Styled the store-not-found 404 page in ShopLayout.tsx
- Files changed: src/pages/shop/ShopLayout.tsx
- **Learnings:**
  - Store resolution happens in ShopLayout.tsx via `get_marketplace_store_by_slug` RPC — when store is null or query errors, the 404 block renders
  - The 404 block is a conditional return before the main layout, so no Outlet/nav/footer renders — just the standalone 404 page
  - Used lucide-react `Store` icon inside a rounded muted circle for the illustration
  - Added gradient background (`from-muted/40 to-background`) for visual depth instead of flat white
---

## 2026-02-28 - floraiq-cyw.1
- What was implemented: Verified and refined StorefrontLiveOrders page — added explicit `seller_tenant_id` filter to orders query and updated empty state message to match spec
- Files changed: src/pages/admin/storefront/StorefrontLiveOrders.tsx
- **Learnings:**
  - `marketplace_orders` table has `seller_tenant_id` (seller's tenant) and `buyer_tenant_id` (buyer's tenant) — use `seller_tenant_id` for admin-facing storefront order queries
  - Filtering by `store_id` alone provides implicit tenant isolation (store is fetched via tenant_id), but adding `seller_tenant_id` filter is belt-and-suspenders for acceptance criteria
  - The page was already largely implemented with kanban + list views, realtime subscription, sound notifications, and status progression
---

## 2026-02-28 - floraiq-cyw.2
- What was implemented: Created `StorefrontLiveOrdersTable` component with all 10 required columns (Order #, Customer, Phone, Items with tooltip, Total, Payment method, Fulfillment badge, Status badge, Relative time, Actions dropdown). Replaced card-based list view with proper table using shadcn/ui Table, Tooltip, and DropdownMenu components. Added payment method derivation from `stripe_payment_intent_id`/`payment_status`/`payment_terms` fields.
- Files changed:
  - `src/components/admin/storefront/StorefrontLiveOrdersTable.tsx` (new)
  - `src/pages/admin/storefront/StorefrontLiveOrders.tsx` (updated interface + wired table)
- **Learnings:**
  - `marketplace_orders` has no explicit `payment_method` column — derive from `stripe_payment_intent_id` (Card) vs fallback (Cash), also check `payment_terms` and `payment_status`
  - The `LiveOrder` interface is exported from `StorefrontLiveOrders.tsx` and shared with child components — extend it when new fields are needed
  - shadcn/ui Table + Tooltip + DropdownMenu with Sub-menus work well together for data-dense admin tables
---

## 2026-02-28 - floraiq-cyw.3
- What was implemented: Created `LiveOrderStatusBadge` component with color-coded status badges for the Live Orders kanban board. Colors follow the task spec: pending=amber, confirmed=blue, preparing=orange, ready=purple, out_for_delivery/in_transit=indigo, delivered/completed=green, cancelled/rejected=red. Integrated badge into KanbanCard header next to order number.
- Files changed:
  - `src/components/admin/live-orders/LiveOrderStatusBadge.tsx` (new)
  - `src/components/admin/live-orders/LiveOrdersKanban.tsx` (added badge import + render)
  - `src/components/admin/live-orders/index.ts` (added export)
- **Learnings:**
  - The kanban groups orders by column status but individual cards benefit from inline status badges for clarity when scrolling
  - Used explicit Tailwind color classes (amber, orange, purple, indigo, green, red, blue) with dark mode variants rather than semantic tokens, since the task requires specific color assignments that differ from the global `statusColors.ts` mapping
  - The `LiveOrderStatusBadge` is intentionally separate from `OrderStatusBadge` (disposable-menus) to keep live order color semantics independent
---

## 2026-02-28 - floraiq-cyw.4
- What was implemented: Status change actions for Live Orders — each order shows ONLY valid next statuses based on its current status and fulfillment type (delivery vs pickup). Added `getValidNextStatuses()` shared function, cancel action on every active status, delivery/pickup-aware "ready" transitions (Out for Delivery vs Mark Completed).
- Files changed:
  - `src/pages/admin/storefront/StorefrontLiveOrders.tsx` — Added `getValidNextStatuses()` export, added completed/cancelled to STATUS_LABELS, fixed mutation to filter by `seller_tenant_id`, fixed toast template literal bug
  - `src/components/admin/storefront/StorefrontLiveOrdersTable.tsx` — Replaced "Change Status" submenu (showing all statuses) with flat dropdown showing only valid next actions, added cancelled/completed status colors
  - `src/components/admin/storefront/StorefrontLiveOrdersKanban.tsx` — Replaced single forward-only button with primary action + cancel button pair using `getValidNextStatuses()`, removed hardcoded `nextStatus` from column config
- **Learnings:**
  - The mutation previously only filtered by `store_id` — must also filter by `seller_tenant_id` for proper tenant isolation on marketplace_orders
  - The toast had a bug using regular quotes instead of backticks for template literal interpolation
  - `getValidNextStatuses()` is exported from the page file and imported by both Table and Kanban components — keeps transition logic in one place
  - The "ready" status branches based on fulfillment type: delivery orders → "Out for Delivery", pickup orders → "Mark Completed"
  - Kanban columns no longer have `nextStatus` property — the card buttons derive actions from the shared function using actual order status + fulfillment type
---

## 2026-02-28 - floraiq-cyw.5
- What was implemented: Order detail slide-over panel that opens when clicking an order # or "View Details"
- Files changed:
  - `src/components/admin/storefront/OrderDetailPanel.tsx` — New component using Sheet (shadcn) for right-side slide-over. Shows order heading, status badge with change buttons, customer info (name/phone/email), delivery address or pickup badge, line items table (product/variant/qty/price/total), price breakdown (subtotal/tax/delivery/total), payment method with status badge, notes section, order timeline from timestamp fields, and footer with contact customer + print buttons.
  - `src/pages/admin/storefront/StorefrontLiveOrders.tsx` — Added `selectedOrderId` and `detailPanelOpen` state. Changed `handleViewDetails` from navigation to opening the slide-over panel. Added `selectedOrder` memo. Rendered `OrderDetailPanel` at the end of JSX.
- **Learnings:**
  - The `LiveOrder` interface is a subset of `marketplace_orders` columns — the query uses `select('*')` with `as unknown as LiveOrder[]` cast, so raw DB fields (tax, shipping_address, shipping_cost, buyer_notes, seller_notes, confirmed_at, shipped_at, delivered_at) are available at runtime but not typed. Used `getRawFields()` helper to access them safely.
  - The DB column is `shipping_address` (not `delivery_address`) and `shipping_cost` (not `delivery_fee`). The `LiveOrder` interface uses different names that don't match the actual DB columns.
  - Timeline can be built from `created_at`, `confirmed_at`, `paid_at`, `shipped_at`, `delivered_at` fields — no separate status history table for marketplace orders (the `order_status_history` table references `orders`, not `marketplace_orders`).
  - Sheet component defaults to `max-w-sm` (384px) which is too narrow for order details — overrode to `max-w-lg sm:max-w-xl`.
---

## 2026-02-28 - floraiq-43c.1
- What was implemented: Verified ShopLayout already fully implemented — no code changes needed
- Files changed: None (already complete)
- **Learnings:**
  - ShopLayout wraps all `/shop/:storeSlug/*` routes via nested React Router v6 `<Route>` with `<Outlet />`
  - Store resolution uses `get_marketplace_store_by_slug` RPC with `p_slug` parameter — returns full store config including theme, colors, checkout settings, payment methods, operating hours, GA4 measurement ID
  - ShopContext provides `store`, `isLoading`, `cartItemCount`, `isPreviewMode`, `openCartDrawer` to all child routes via `useShop()` hook
  - Two theme paths exist: luxury theme (uses LuxuryNav + LuxuryFooter) and default theme (inline header/footer). Theme is determined by `store.theme_config.theme === 'luxury'`
  - CSS variables `--store-primary`, `--store-secondary`, `--store-accent` are set on the root div for theme customization
  - Age verification is store-level via `require_age_verification` + `minimum_age` fields, stored in localStorage per store ID
  - Preview mode (`?preview=true`) bypasses age verification and inactive store checks — used by admin storefront builder
  - Cart state is managed via localStorage + custom `cartUpdated` events + `useShopCart` hook, with a CartDrawer component
---

## 2026-02-28 - floraiq-8od.1
- What was implemented: Added no-store empty state to StorefrontBuilder — when tenant has no store in `marketplace_stores`, a centered "Create Your Store" card is shown with store name input, slug input, theme selector thumbnails (ThemePresetStrip), and a credit-gated Create Store button. Also added a loading spinner while the store query is in-flight. The existing builder UI is now conditionally rendered only when a store exists.
- Files changed: `src/pages/admin/storefront/StorefrontBuilder.tsx`
- **Learnings:**
  - StorefrontBuilder uses `useCreditGatedAction` hook for store creation (500 credits) — the existing `handleCreateStore` function and `createStoreMutation` can be reused for the inline empty-state card
  - The store query uses `.maybeSingle()` which returns `null` for data when no rows match (not an error). The catch block only fires on actual DB errors and falls back to mock data — this is a defensive pattern to keep the builder usable during development
  - `ThemePresetStrip` from `@/components/admin/storefront/ThemePresetSelector` provides compact theme selector thumbnails that work well for inline cards
  - Wrapping conditional render blocks in React fragments (`<>...</>`) is necessary when conditionally rendering multiple sibling elements
---

## 2026-02-28 - floraiq-6w6.2
- **What was implemented**: Fixed all Vite build errors to achieve zero-error build
- **Files changed**: 30 files (26 modified, 4 created)
  - Fixed 10 files with broken `queryKeys` imports injected mid-import-block
  - Fixed `FeatureProtectedRoute.tsx` wrong FeatureGate import path
  - Fixed `InventoryForecastWidget.tsx` wrong InventoryStatusBadge import path
  - Fixed 3 corrupted `Database['public']['Tables']` type definitions
  - Fixed `SoundAlertToggle.tsx` invalid destructured import `STORAGE_KEYS.X`
  - Fixed 4 files with `||`/`??` operator mixing without parentheses
  - Fixed `LiveDeliveryMap.tsx` type assertion + optional chaining syntax
  - Removed dead re-exports: `creditRecovery`, `dashboard`, `LiveOrdersCounter`, `storefrontSettingsSchema`
  - Created stub components: `HealthIndicator`, `SystemStatusIndicator`, `TierComparisonModal`
  - Created `pushNotifications.ts` module for Capacitor native platform
- **Learnings:**
  - Previous automated queryKeys migration tool corrupted files in 3 ways: (1) injected import inside multi-line import blocks, (2) replaced `['tablename']` bracket access with `queryKeys.tablename.all`, (3) injected `STORAGE_KEYS.X` inside destructure braces
  - esbuild (Vite bundler) is stricter than tsc on `||`/`??` mixing and type assertion + optional chain syntax
  - Always run `npx vite build` iteratively — each error stops at the first file, hiding subsequent errors
  - Several barrel `index.ts` files had dead re-exports referencing non-existent modules
---

## 2026-02-28 - floraiq-6w6.3
- Audited admin dashboard (`/:tenantSlug/admin/dashboard`) for runtime console errors
- Route actually loads `src/pages/tenant-admin/DashboardPage.tsx` (not `src/pages/admin/DashboardPage.tsx`)
- Fixed missing `tenant_id` filters in `checkIfEmpty` effect (lines 489-505) — 3 queries to `wholesale_clients`, `products`, `disposable_menus` had no tenant isolation
- Fixed duplicate React key risk in activity feed list (line 1268) — `${timestamp}-${type}` can collide, added index prefix
- Files changed: `src/pages/tenant-admin/DashboardPage.tsx`
- **Learnings:**
  - The `products` table has a public read RLS policy (`products_public_select USING (true)`) — application-layer tenant_id filtering is critical for this table
  - The admin dashboard route maps to `TenantAdminDashboardPage` (tenant-admin dir), not `DashboardPage` (admin dir) — check App.tsx routing, not just file names
  - `CreditContext.tsx` re-exports `useCredits` from `@/hooks/useCredits` with added modal state — both import paths are valid
  - Activity items from multiple sources (menu_access_logs, menu_orders, tenant menus) can share timestamps — always include index in composite keys
---

## 2026-02-28 - floraiq-6w6.4
- Audited storefront builder page (`/:tenantSlug/admin/storefront`) for runtime console errors
- No runtime errors found — page is clean
- Verified: `npx tsc --noEmit` passes, `npx vite build` passes, no `console.log` statements, all Supabase queries filter by `tenant_id`
- All import chains verified: FullScreenEditorPortal, PresetPackSelector/PresetPackStrip, ThemePresetSelector/ThemePresetStrip, SectionEditors, SaveButton, sanitizeHtml, tenantNavigation — all exports exist and match
- Files changed: none (no fixes needed)
- **Learnings:**
  - StorefrontHubPage is the main entry at `src/pages/admin/hubs/StorefrontHubPage.tsx` with 12 lazy-loaded tabs
  - The "builder" tab loads `StorefrontDesignPage` which has two modes: full-screen (via FullScreenEditorPortal) and compact
  - `StorefrontBuilder.tsx` is ~1400 lines with dual mode: Simple (EasyModeEditor) and Advanced (drag-and-drop sections)
  - Easy mode uses `useEasyModeBuilder` hook with preset packs from `storefrontPresets.ts`
  - `marketplace_profiles` is synced alongside `marketplace_stores` so the public shop RPC returns fresh data
  - The `sectionDefaults()` function exists both in `StorefrontBuilder.tsx` (local) and `storefront-builder.config.ts` (shared) — careful with imports
---
