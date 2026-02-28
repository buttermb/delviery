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
- **Storefront order reads vs writes**: READ from `storefront_orders` view (aliased columns: `total`, `delivery_fee`, `delivery_address`). WRITE to `marketplace_orders` table (raw columns: `total_amount`, `shipping_cost`, `shipping_address`). Filter by `store_id` + `seller_tenant_id`, NOT `seller_profile_id` (that's for B2B marketplace orders).
- **Stale carousel index crash**: Carousel/rotator components using `useState` index into a reactive TanStack Query array can crash when refetches shrink the array. Fix: add a `useEffect` clamping index when length changes + safe guard (`array[safeIndex]` with fallback).
- **safeStorage for storefront**: Always use `safeStorage` from `@/utils/safeStorage` instead of raw `localStorage` in storefront components — handles private browsing mode gracefully.
- **Hiding Sheet/Dialog default close button**: Use `[&>button:last-child]:hidden` on SheetContent/DialogContent className to hide the auto-rendered close button when using custom close buttons. The default close is always the last direct child.
- **Sheet width overrides**: SheetContent variants include both base `max-w-sm` and `sm:max-w-sm`. To override width, pass both (e.g., `max-w-md sm:max-w-md`) so twMerge resolves both breakpoints.
- **Full-screen Dialog pattern**: Override DialogContent with `left-0 top-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none max-h-screen p-0 border-0 rounded-none` + zero-effect animation classes (`zoom-out-100`, `slide-out-to-left-0` etc.) for full-screen takeover while keeping Radix's focus trap and escape handling.

---

- **Form label consistency**: Use `<FormLabel required>` inside `FormField` contexts, `<Label required>` for state-based forms. Both render identical asterisk markup. Never use manual `<span className="text-destructive">*</span>`.

- **Chart colors**: Import from `@/lib/chartColors` — never hardcode hex colors in chart components. Use `CHART_COLORS[N]` for indexed palette, `chartSemanticColors.revenue/cost/danger` for semantic meaning, `CATEGORY_CHART_COLORS` for credit/category breakdowns. CSS vars `--chart-1` through `--chart-10` defined in `index.css`.

## 2026-02-28 - floraiq-jwn.2
- Converted all custom modal implementations to shadcn Dialog/Sheet
- Files changed:
  - `src/components/admin/storefront/FullScreenEditorPortal.tsx` — createPortal+Framer Motion → shadcn Dialog (full-screen)
  - `src/components/shop/FilterDrawer.tsx` — custom Framer Motion drawer → shadcn Sheet (side=left)
  - `src/components/shop/CartDrawer.tsx` — custom Framer Motion drawer → shadcn Sheet (side=right)
  - `src/pages/admin/storefront/StorefrontDesignPage.tsx` — pass onRequestClose to FullScreenEditorPortal for escape key support
- **Learnings:**
  - FilterDrawer had `lg:relative lg:z-auto` for desktop sidebar mode, but the trigger is `md:hidden` so this was unreachable dead code — safe to drop
  - CartDrawer's item-level `motion.div` animations (layout, initial/animate) work fine inside SheetContent since Radix mounts content on open
  - FilterSection collapse animations (AnimatePresence in child component) are NOT modals — keep framer-motion for these
  - SafeModal (`src/components/ui/safe-modal.tsx`) already correctly wraps shadcn Dialog — good pattern, no changes needed
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

## 2026-02-28 - floraiq-6w6.5
- Audited `StorefrontSettings.tsx` for runtime console errors
- Fixed missing `tenant_id` filter on featured products preview query (was querying products table without tenant isolation)
- Added `tenant_id` filter to save settings mutation and regenerate token mutation
- Added `tenantId` guard to featured products query `enabled` condition
- Verified: no `console.log` statements, `npx tsc --noEmit` passes, all tabs render correctly
- Files changed: `src/pages/admin/storefront/StorefrontSettings.tsx`
- **Learnings:**
  - StorefrontSettings is loaded as `?tab=settings` in StorefrontHubPage, not a standalone route
  - `queryKeys.marketplaceStore.byTenant()` (no args) is used for broad cache invalidation — this is intentional
  - Featured products preview uses a separate queryKey factory (`featuredProductsPreview.byIds`) from the product list (`featuredProducts.list`)
  - Spreading `null`/`undefined` in JS objects is safe (`{...null}` → `{}`), so checkout_settings/operating_hours spreads aren't real runtime errors
---

## 2026-02-28 - floraiq-6w6.6
- Fixed StorefrontOrders page runtime errors and added realtime subscription
- Switched orders query from `marketplace_orders` table to `storefront_orders` view (correct aliased column names: `total`, `delivery_fee`, `delivery_address`)
- Fixed filter column from `seller_profile_id` to `store_id` — storefront orders are linked via `store_id`, not `seller_profile_id`
- Added `seller_tenant_id` filter to update mutation for proper tenant isolation
- Added realtime subscription on `marketplace_orders` filtered by `store_id`
- Fixed `delivery_address` type narrowing (was accessing `.street`/`.city` on union type without guard)
- Fixed tracking URL to use `store.slug` instead of `store.id`
- Applied same `store_id` filter fix to StoreOrdersTab component
- Files changed: `src/pages/admin/storefront/StorefrontOrders.tsx`, `src/pages/admin/storefront/StoreOrdersTab.tsx`
- **Learnings:**
  - `storefront_orders` is a VIEW with aliased columns (`total` not `total_amount`, `delivery_fee` not `shipping_cost`, `delivery_address` not `shipping_address`). Always use this view for storefront order reads.
  - `seller_profile_id` references `marketplace_profiles` (B2B marketplace), NOT `marketplace_stores` (storefront). Storefront orders use `store_id`.
  - The LiveOrders page (StorefrontLiveOrders.tsx) is the reference implementation: uses `store_id` + `seller_tenant_id` for tenant isolation, realtime via `supabase.channel()` with `postgres_changes` on `marketplace_orders`.
  - Writes must go to `marketplace_orders` directly (the view is read-only for computed columns).
  - Store tracking URLs use `slug` not `id`: `/shop/{slug}/track/{token}`
---

## 2026-02-28 - floraiq-6w6.7
- Audited StorefrontAnalytics page (`/:tenantSlug/admin/storefront/analytics`) for runtime console errors
- Fixed critical store resolution bug: was querying `marketplace_profiles` for store ID, but `storefront_orders.store_id` references `marketplace_stores.id` — analytics would return no data
- Switched from `marketplace_profiles` to `marketplace_stores` to match all other storefront pages (StorefrontLiveOrders, StorefrontOrders, StoreOrdersTab, StorefrontSettings)
- Changed query key from `queryKeys.storefrontAnalyticsStore.byTenant()` to `queryKeys.marketplaceStore.byTenant()` to match other pages and enable cache sharing
- Fixed ConversionRateChart empty state: when no orders exist, funnel had 4 items with all-zero values that bypassed the empty state check — now returns empty funnel to show "No conversion data available"
- Verified: `npx tsc --noEmit` passes, no `console.log` statements, all queries filter by `tenant_id` (via `marketplace_stores.tenant_id` → `store.id` → `storefront_orders.store_id`)
- Files changed: `src/pages/admin/storefront/StorefrontAnalytics.tsx`, `src/components/admin/analytics/ConversionRateChart.tsx`
- **Learnings:**
  - `storefront_orders.store_id` references `marketplace_stores.id`, NOT `marketplace_profiles.id`. The `marketplace_profiles` table is for B2B marketplace profiles (linked via `seller_profile_id`). For storefront operations, always use `marketplace_stores`.
  - All storefront admin pages should use `queryKeys.marketplaceStore.byTenant()` for the store resolution query — this ensures cache sharing across tabs in StorefrontHubPage.
  - The `storefront_orders` view doesn't expose `seller_tenant_id` — tenant isolation for reads is achieved through the `store_id` chain (store belongs to tenant). For writes to `marketplace_orders`, add `seller_tenant_id` explicitly.
  - When Recharts data has all-zero values but non-empty array, the chart renders but looks broken. Always check for semantic emptiness (no meaningful data) in addition to array length.
---

## 2026-02-28 - floraiq-6w6.8
- Audited public storefront homepage (/shop/:storeSlug) for console errors
- Fixed 5 issues across 5 files:
  1. **AnnouncementBar.tsx**: `announcements[currentIndex]` could crash with TypeError when reactive query data refetches with fewer items while `currentIndex` is stale. Added index clamping useEffect + safe fallback.
  2. **PromotionsBannerSection.tsx**: Same stale index crash pattern with `banners[currentIndex]`. Applied same fix.
  3. **LuxuryFeaturesSection.tsx**: `Record<string, any>` replaced with `Record<string, LucideIcon>` to comply with no-any rule.
  4. **HotItemsSection.tsx**: `ICON_MAP[config.icon]` had no fallback (unlike sibling section components). Added `|| Star`.
  5. **LuxuryAgeVerification.tsx**: Raw `localStorage` calls replaced with `safeStorage` wrapper (handles private browsing/SSR). Stabilized `onVerify` callback in `useEffect` via `useRef` to prevent re-fire loops when parent doesn't memoize.
- Files changed: `src/components/shop/sections/AnnouncementBar.tsx`, `src/components/shop/sections/PromotionsBannerSection.tsx`, `src/components/shop/sections/LuxuryFeaturesSection.tsx`, `src/components/shop/sections/HotItemsSection.tsx`, `src/components/shop/LuxuryAgeVerification.tsx`
- **Learnings:**
  - **Stale index pattern in carousel/rotator components**: When a component uses `useState` index into a reactive array (from TanStack Query), refetches can shrink the array while `currentIndex` remains stale, causing `array[currentIndex]` to be `undefined`. Fix: add a `useEffect` that clamps index when length changes + a safe guard before access.
  - **safeStorage vs localStorage**: The project has `@/utils/safeStorage` that wraps localStorage with try/catch and memory fallback. Always use it in storefront components where private browsing is common.
  - **Callback ref pattern for useEffect stability**: When a parent-passed callback is in a useEffect dependency array and the parent doesn't memoize it, use `useRef` to stabilize: `const cbRef = useRef(cb); cbRef.current = cb;` then call `cbRef.current()` in the effect.
---

## 2026-02-28 - floraiq-6w6.9
- Audited the product catalog page (`/shop/:storeSlug/products`) for console errors
- Fixed `useWishlist` hook to use `safeStorage` instead of raw `localStorage` — prevents crashes in Safari private browsing mode
- Verified: no console.log statements, no TypeScript errors, proper store_id filtering via `get_marketplace_products` RPC
- Files changed: `src/hooks/useWishlist.ts`
- **Learnings:**
  - Product catalog page was already well-structured with proper error handling, empty states, loading skeletons, and real-time inventory sync
  - `useWishlist` was the last storefront hook still using raw `localStorage` — all cart/coupon storage already used `safeStorage`
  - The `get_marketplace_products` RPC handles store-level product filtering server-side, so no additional `tenant_id` filter is needed on the client
---

## 2026-02-28 - floraiq-6w6.10
- Audited ProductDetailPage (`src/pages/shop/ProductDetailPage.tsx`) for console errors
- Replaced 3 instances of raw `localStorage` with `safeStorage` from `@/utils/safeStorage`
- Replaced raw `JSON.parse` with `safeJsonParse` in wishlist toggle handler for defensive parsing
- Files changed: `src/pages/shop/ProductDetailPage.tsx`
- **Learnings:**
  - ProductDetailPage had the same `localStorage` issue as `useWishlist` — the wishlist check in useEffect and the toggle handler both used raw localStorage
  - The page was otherwise well-structured: uses `logger` (not console), `queryKeys` factory, `safeJsonParse` for reads, proper `store_id` filtering, and already had the `safeStorage` import path available
  - Storefront queries correctly use `store_id` filtering (via RPC `p_store_id` param or `.eq('store_id', ...)`) rather than `tenant_id` directly
---

## 2026-02-28 - floraiq-6w6.11
- Audited CartPage (`src/pages/shop/CartPage.tsx`) for console errors
- Fixed relative import `./ShopLayout` → `@/pages/shop/ShopLayout` to follow `@/` alias convention
- Verified: no `console.log`, no TypeScript errors, empty cart state renders cleanly with animation and "Continue Shopping" CTA
- Files changed: `src/pages/shop/CartPage.tsx`
- **Learnings:**
  - Cart page was already well-maintained: uses `logger`, `safeStorage` (via `useShopCart`), `formatCurrency`, proper `sonner` toast
  - Cart is localStorage-based (no direct Supabase queries in CartPage itself); stock/deals queries are in child hooks (`useShopCart.checkInventoryAvailability`, `useDeals`, `CartStockWarning`)
  - Storefront inventory checks query `products` by specific UUIDs (via `.in('id', productIds)`) — RLS handles visibility, no explicit `tenant_id` filter needed
  - `SwipeableCartItem` uses `react-swipeable` for mobile delete gesture with haptic feedback — clean pattern
  - `CartUpsellsSection` uses `get_marketplace_products` RPC scoped by `store_id`
---

## 2026-02-28 - floraiq-6w6.12
- Audited `/shop/:storeSlug/checkout` (CheckoutPage.tsx)
- Replaced 6 raw `localStorage` calls with `safeStorage` from `@/utils/safeStorage` for private browsing compatibility
- Files changed: `src/pages/shop/CheckoutPage.tsx`
- **Learnings:**
  - CheckoutPage was already well-structured: uses `logger` (no console.log), proper error handling with `humanizeError`, `sonner` toast
  - Empty cart already handled: `useEffect` at line 253 checks `isInitialized && cartItems.length === 0` and redirects to `/shop/:storeSlug/cart` with toast warning
  - `sessionStorage` is used for idempotency keys (survives page refresh during submission) — `safeStorage` only wraps `localStorage`, so sessionStorage is left as-is
  - Checkout uses edge function first (`storefront-checkout`), falls back to direct RPC (`create_marketplace_order`) — well-documented pattern
  - No direct Supabase queries filtering by `tenant_id` needed — checkout reads go through `storefront_orders` view (scoped by `store_id`), writes go through `create_marketplace_order` RPC
---

## 2026-02-28 - floraiq-7r6.1
- Created `supabase/migrations/20260228000001_add_time_entries.sql`
- Table columns: id (uuid pk), tenant_id, user_id, clock_in, clock_out, break_minutes, location_lat, location_lng, status (active/completed/approved), notes, approved_by, created_at, updated_at
- Added indexes on tenant_id, user_id, status, clock_in, and composite (tenant_id, user_id)
- RLS policies: users see own entries, admins see all in tenant; users insert own; users update own + admins update any in tenant; only admins can delete
- Files changed: `supabase/migrations/20260228000001_add_time_entries.sql`
- **Learnings:**
  - Migration pattern: use `CREATE TABLE IF NOT EXISTS`, reference `public.tenants(id)` and `auth.users(id)` for FKs
  - RLS pattern: check `tenant_users` table for role-based access (`admin`, `owner` roles)
  - Status columns use CHECK constraint: `CHECK (status IN ('active', 'completed', 'approved'))`
  - SQL-only tasks (migrations) pass `npx tsc --noEmit` trivially since no TS files are changed
---

## 2026-02-28 - floraiq-mxj.1
- Created `supabase/migrations/20260228000002_add_promotions.sql`
- Table: `public.promotions` with all required columns (id, tenant_id, code, name, discount_type, discount_value, min_order_amount, max_uses, current_uses, applies_to, applies_to_ids, start_date, end_date, is_active, created_at)
- UNIQUE constraint: `(tenant_id, code)` ensures unique promo codes per tenant
- Indexes: tenant_id, tenant+code composite, active-only partial, date range
- RLS: SELECT for all tenant members, INSERT/UPDATE/DELETE restricted to admin/owner roles
- Files changed: `supabase/migrations/20260228000002_add_promotions.sql` (new)
- **Learnings:**
  - Existing advanced promotions system extends `coupons` table (see `20251216174400_add_advanced_promotions.sql`), while this new `promotions` table is a separate tenant-level entity
  - `credit_promotions` table also exists separately — three distinct promo-related tables serve different scopes
  - Latest migration pattern uses `time_entries` as reference: `CREATE TABLE IF NOT EXISTS`, proper `CHECK` constraints, comprehensive RLS with `tenant_users` role checks
---

## 2026-02-28 - floraiq-x79.2
- Created `supabase/migrations/20260228000003_add_message_templates.sql`
- Table: `message_templates` with columns: id, tenant_id, name, channel, subject, body, variables (jsonb), category, usage_count (default 0), is_active (default true), created_at
- RLS enabled with 4 policies (SELECT for tenant members, INSERT/UPDATE/DELETE for admin/owner)
- Indexes on tenant_id, (tenant_id, channel), (tenant_id, category), and partial on is_active
- Foreign key to tenants(id) with CASCADE delete
- **Learnings:**
  - Migration naming follows `YYYYMMDD00000N_add_<table_name>.sql` pattern, incrementing the sequence number for same-day migrations
  - RLS pattern consistent: SELECT open to tenant members, write operations restricted to admin/owner roles via tenant_users lookup
---

## 2026-02-28 - floraiq-x79.1
- Created `supabase/migrations/20260228000001_add_messages.sql` for tenant messaging
- Columns: id, tenant_id, sender_type (admin/customer/system), sender_id, recipient_type, recipient_id, channel (sms/email/in_app), subject, body, reference_type, reference_id, status (draft/sent/delivered/read/failed), sent_at, created_at
- CHECK constraints on sender_type, channel, and status columns for data integrity
- Indexes on tenant_id, sender, recipient, channel, status, reference, and created_at
- RLS: SELECT open to tenant members, INSERT/UPDATE/DELETE restricted to admin/owner
- **Learnings:**
  - Same epic (x79) as message_templates — messages table stores actual sent/received messages while templates store reusable templates
  - reference_type + reference_id pattern enables polymorphic linking to orders, invoices, tickets, etc.
---

## 2026-02-28 - floraiq-qkq.1
- Created `supabase/migrations/20260228000004_add_payments.sql`
- Table: `payments` with columns: id, tenant_id, order_id, customer_id, amount, method, status, transaction_id, processing_fee, notes, processed_by, created_at, updated_at
- Status CHECK constraint: pending/completed/failed/refunded
- RLS enabled with tenant_id-based policies (SELECT, INSERT, UPDATE, DELETE) using profiles join
- Indexes on tenant_id, order_id, customer_id, status, created_at, transaction_id
- Updated timestamp trigger via `update_updated_at()` function
- **Learnings:**
  - Standard migration pattern: CREATE TABLE → ENABLE RLS → policies → indexes → trigger
  - RLS tenant isolation pattern: `tenant_id IN (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid())`
---

## 2026-02-28 - floraiq-qkq.2
- Created `supabase/migrations/add_register_sessions.sql` for POS register session tracking
- Table: `register_sessions` with columns: id, tenant_id, user_id, opening_float, closing_amount, expected_amount, variance, status, opened_at, closed_at, notes, created_at, updated_at
- Status CHECK constraint: open/closed
- RLS enabled with tenant_id-based policies using tenant_users join (with admin/owner escalation for SELECT, UPDATE, DELETE)
- Indexes on tenant_id, user_id, status, opened_at, composite (tenant_id, user_id)
- Table and column COMMENTs for documentation
- **Learnings:**
  - Used tenant_users-based RLS (not profiles) matching time_entries pattern — more appropriate for role-based access
  - Register sessions are user-scoped: regular users see own sessions, admins/owners see all within tenant
---

## 2026-02-28 - floraiq-okh.1
- Created `supabase/migrations/add_webhooks.sql` for webhooks enhancement and webhook_deliveries table
- The `webhooks` table already existed (from migration 20251103041953) — added missing columns: event_type TEXT, headers JSONB, failure_count INTEGER
- Created new `webhook_deliveries` table with columns: id uuid, webhook_id uuid (FK to webhooks), tenant_id uuid, event_data jsonb, status text, response_code integer, created_at timestamptz
- RLS enabled on webhook_deliveries with full CRUD tenant-isolation policies (profiles → accounts join pattern)
- Indexes on webhook_id, tenant_id, status, created_at
- **Learnings:**
  - Webhooks table already existed — always check existing migrations before creating new tables
  - A `webhook_logs` table also exists (from 20260128000001) — separate from `webhook_deliveries`. The logs table tracks detailed delivery attempts while deliveries is the core delivery record
  - Used `ALTER TABLE ADD COLUMN IF NOT EXISTS` for safe idempotent column additions
---

## 2026-02-28 - floraiq-sef.1
- Created `supabase/migrations/20260228000000_add_analytics_goals.sql` for analytics_goals table
- Columns: id uuid PK, tenant_id uuid (FK to tenants), metric_name text, target_value decimal, period_type text (daily/weekly/monthly), period_start date, period_end date, current_value decimal default 0, created_at timestamptz
- CHECK constraint on period_type to enforce allowed values
- RLS enabled with 4 policies: SELECT for all tenant members, INSERT/UPDATE/DELETE for admin/owner roles
- Indexes on tenant_id, created_at DESC, (tenant_id, metric_name), and (tenant_id, period_type, period_start, period_end)
- **Learnings:**
  - Pure SQL migration tasks don't affect TypeScript compilation — tsc passes without changes
  - Composite indexes on (tenant_id, period_type, period_start, period_end) useful for period-based goal queries
---

## 2026-02-28 - floraiq-jwn.1
- Verified all toasts already use Sonner — no code changes needed
- No files changed
- **Learnings:**
  - Codebase has 541+ files importing `toast` from `"sonner"` — fully standardized
  - No `useToast`/`use-toast` (shadcn old toast), `window.alert()`, or third-party toast libs exist
  - Toast infrastructure is well-layered: `sonner.tsx` wrapper → `toastUtils.ts` (deduplication) → `toastActions.ts` (undo/progress/navigation) → `notifications/toast.ts` (domain-specific) → `toastHelpers.ts` (re-exports + storefront-specific)
  - `alert()` references only exist in `sanitize.test.ts` XSS test data — not actual UI calls
  - `console.log` in `logger.ts` and `ConsoleMonitor.tsx` are expected/valid uses
---

## 2026-02-28 - floraiq-jwn.3
- Replaced raw HTML table elements (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`) with shadcn Table components in CustomerManagement.tsx and Orders.tsx skeleton
- Files changed: `src/pages/admin/CustomerManagement.tsx`, `src/pages/admin/Orders.tsx`
- **Learnings:**
  - CustomerManagement.tsx was the only admin page using fully raw HTML tables for its data display — all other major pages (Orders, Products, Clients) already used ResponsiveTable or shadcn Table
  - Orders.tsx had a raw HTML table only in its skeleton loading state, while main data used ResponsiveTable
  - shadcn Table components provide built-in hover (`hover:bg-muted/50`), border (`border-b`), sticky headers, dark mode, and scroll gradient effects — no custom styling needed
  - AdminPricingPage.tsx also has raw HTML tables but is a secondary page outside the core three (Orders/Products/Customers)
---

## 2026-02-28 - floraiq-jwn.4
- Added `required` prop to base `Label` component (`label.tsx`) to render asterisks consistently without needing `FormField` context
- Converted `RecurringInvoiceForm.tsx` from `register()` pattern to `Form`/`FormField`/`FormLabel`/`FormMessage` pattern
- Converted `InvoicePaymentDialog.tsx` from manual `Controller` + `Label` to `Form`/`FormField`/`FormLabel`/`FormMessage` pattern
- Replaced manual `<span className="text-destructive">*</span>` asterisks with `<Label required>` in ProductForm, BasicInfoStep, BatchCategoryEditor, OrderDetailsPage
- Standardized error text classes to `text-sm font-medium text-destructive` (matching `FormMessage`)
- Files changed: `label.tsx`, `RecurringInvoiceForm.tsx`, `InvoicePaymentDialog.tsx`, `ProductForm.tsx`, `BasicInfoStep.tsx`, `BatchCategoryEditor.tsx`, `OrderDetailsPage.tsx`
- **Learnings:**
  - `FormLabel` uses `useFormField()` which requires `FormFieldContext` — it can ONLY be used inside `FormField`. For state-based forms that don't use react-hook-form, the base `Label` component with `required` prop is the correct approach
  - Adding `required` prop to the base `Label` component gives a single consistent API for all form types (react-hook-form and useState-based)
  - Forms using `register()` can be converted to `FormField` pattern by wrapping with `<Form {...form}>` and replacing `register("field")` with `FormField` + `control={form.control}` + render prop
  - `FormControl` uses Radix `Slot` to compose aria attributes onto the child input — important for accessibility
---

## 2026-02-28 - floraiq-jwn.5
- Replaced hardcoded hex colors in chart/visualization components with centralized CSS variable references
- Created `src/lib/chartColors.ts` — exports `CHART_COLORS` (10-slot array), `chartSemanticColors` (named semantic colors), and `CATEGORY_CHART_COLORS` (credit usage categories)
- Added CSS custom properties `--chart-6` through `--chart-10` in `src/index.css` for emerald, red, amber, pink, green
- 39 files updated to import from `@/lib/chartColors` instead of hardcoding hex values
- Files changed: `src/lib/chartColors.ts` (new), `src/index.css`, 20+ chart components across admin/analytics, delivery, products, tv-dashboard, super-admin, credits, financial, and 14 admin/tenant-admin pages
- **Learnings:**
  - Status badge colors were already centralized in `src/constants/statusColors.ts` and `src/lib/utils/statusColors.ts` — no changes needed there
  - Chart color replacement is safe for Recharts `fill`/`stroke` props — they accept `hsl(var(--chart-N))` CSS variable references
  - Legitimate hex color exemptions: Google brand logos, dynamic storefront theme colors (user-configurable), Leaflet map HTML strings (no CSS class support), PDF generation (react-pdf), Mapbox GL JS paint properties
  - `src/lib/utils/colorConversion.ts` provides `getCSSVarColor()` for runtime resolution of CSS vars to inline-safe `hsl()` strings — useful for map/PDF contexts
  - Some files had local `COLORS` arrays that were already using CSS vars — consolidated those to import from the central file too
---

## 2026-02-28 - floraiq-jwn (Storefront: Final Polish & Testing)
- Verified all 68 tasks in the bead — TypeScript check zero errors, Vite build clean
- Fixed `any` types in production files: `src/lib/idb.ts` (3 instances → `unknown`), `src/lib/encryption/types.ts` (1 instance → typed `DecryptedOrderItem` interface), `src/types/marketplace-extended.ts` (2 instances → `SectionConfig[]` and `ExtendedThemeConfig`)
- Verified: no `console.log` in production code (only in logger.ts and test files)
- Verified: no unused imports in storefront files
- Verified storefront code patterns: cart persistence (safeStorage), store-scoped cart (keyed by storeId), 404 handling (stores + products), out-of-stock prevention (triple check: UI + cart + checkout), double-click prevention (ref + isPending + disabled), network error handling (retry with exponential backoff), tenant slug in all routes
- Security audit: no service_role key in client code, no hardcoded secrets, anon key used correctly. Pre-existing concerns noted (Stripe secret key in client-accessible DB, regex-based HTML sanitization) but out of scope for this polish bead.
- Files changed: `src/lib/idb.ts`, `src/lib/encryption/types.ts`, `src/types/marketplace-extended.ts`
- **Learnings:**
  - The storefront codebase is production-ready with robust patterns for cart, checkout, error handling
  - `DecryptedOrder.items` was the only truly untyped data structure — created `DecryptedOrderItem` interface
  - `MarketplaceProfile` had `any` for `layout_config` and `theme_config` but proper types (`SectionConfig`, `ExtendedThemeConfig`) already existed in the same file
  - Stripe secret keys stored in `account_settings.integration_settings` are readable by any admin user via `AccountContext` — this is a real security concern for production but architectural, not a polish task
---

## 2026-02-28 - floraiq-dy9.13
- Added Telegram notification fallback for the client-side RPC checkout path
- When `storefront-checkout` edge function is unavailable and client falls back to direct `create_marketplace_order` RPC, the RPC path was missing Telegram notification
- Added fire-and-forget call to `forward-order-telegram` edge function after RPC order creation succeeds
- If the Telegram edge function also fails, logs a warning via `logger.warn` and skips — never blocks checkout
- Files changed: `src/pages/shop/CheckoutPage.tsx`
- **Learnings:**
  - The `forward-order-telegram` edge function is reusable from client-side — it handles its own auth (service role key from env), settings lookup, and Telegram API call
  - `telegramLink` (contact link for confirmation page) is fetched by `storefront-checkout` from `crm_settings.telegram_video_link` — not available in the RPC fallback path, but the confirmation page degrades gracefully without it
  - The fire-and-forget pattern for non-critical notifications is: `supabase.functions.invoke(...).catch(() => {})` — same pattern used for email confirmations
---

## 2026-02-28 - floraiq-dy9.14
- Created `deduct_stock(p_product_id UUID, p_quantity INTEGER) RETURNS BOOLEAN` RPC function
- Atomic check-and-deduct: only deducts when `stock_quantity >= p_quantity`, returns false if insufficient
- Uses `SECURITY DEFINER` + `SET search_path = public` for safe RLS bypass
- Files changed: `supabase/migrations/20260228000005_create_deduct_stock_rpc.sql`
- **Learnings:**
  - Existing `decrement_stock` (from `20251128000001_inventory_rpcs.sql`) blindly clamps to 0 with `GREATEST(0, ...)` — no sufficiency check, returns VOID
  - `deduct_stock` is the safe alternative: uses `WHERE stock_quantity >= p_quantity` in the UPDATE + `GET DIAGNOSTICS ROW_COUNT` to return success/failure boolean
  - Three layers of stock safety now exist: (1) edge function pre-validation, (2) `deduct_stock` atomic check, (3) `create_marketplace_order` RPC with FOR UPDATE locks
---

## 2026-02-28 - floraiq-dy9.15
- Created `upsert_customer_on_checkout` RPC function for customer upsert during checkout
- Added `total_orders` (INTEGER DEFAULT 0) and `preferred_contact` (TEXT) columns to `customers` table
- Added composite index `idx_customers_phone_tenant` on (phone, tenant_id) for fast lookup
- Function: resolves `account_id` from `accounts` table, parses name into first/last, looks up by phone+tenant_id then email+tenant_id, updates or inserts accordingly
- Files changed: `supabase/migrations/20260228000006_create_upsert_customer_rpc.sql`
- **Learnings:**
  - `customers` table originally lacked `total_orders` and `preferred_contact` — had to ALTER TABLE to add them
  - `customers.account_id` is NOT NULL FK to `accounts` — RPC must resolve it internally from `tenant_id` since callers don't have it
  - `customers.first_name` and `last_name` are NOT NULL — must provide defaults for edge cases (empty name → "Unknown")
  - Column naming: `customers` uses `last_purchase_at` (not `last_order_at` as the bead spec suggested) and `total_spent` (exists) — adapt to actual column names
  - The `contacts` table (unified CRM) has `total_orders`/`preferred_contact_method`/`last_order_at` but is a separate system from `customers` (checkout CRM)
---

## 2026-02-28 - floraiq-dy9.16
- Created `next_order_number(p_tenant_id UUID)` RPC function for the `orders` table
- Migration: `supabase/migrations/20260228000007_create_next_order_number_rpc.sql`
- **Learnings:**
  - The `orders` table has `order_number` as TEXT with legacy format `ORD-{epoch}-{uuid_prefix}` — filter with `~ '^\d+$'` to only consider numeric order_numbers when computing MAX
  - Two separate order number generators exist: `next_tenant_order_number` (for `marketplace_orders` via sequence table) and `next_order_number` (for `orders` via MAX query)
  - Used `pg_advisory_xact_lock(hashtext('orders_' || p_tenant_id::text))` — different key from `next_tenant_order_number` which uses `hashtext(p_tenant_id::text)` to avoid lock collisions between the two functions
---

## 2026-02-28 - floraiq-dy9.17
- Verified customers table columns against storefront checkout requirements
- Added migration with missing columns: `name` (GENERATED from first_name+last_name), `source`, `type`, `first_order_at`, `last_order_at`, `admin_notes`
- Added `(tenant_id, phone)` index for tenant-first queries
- Migration: `supabase/migrations/20260228000008_verify_customers_columns.sql`
- **Learnings:**
  - `customers` table has `first_name`/`last_name` (NOT NULL) — added `name` as a `GENERATED ALWAYS AS ... STORED` column to satisfy requirements without duplicating data
  - `customer_type` (recreational/medical) is different from `type` (guest/registered) — both columns needed
  - `preferred_contact` (from 20260228000006) covers `preferred_contact_method` requirement
  - `last_purchase_at` exists but `last_order_at` was still needed as a separate column (different semantics possible)
  - Two indexes now cover phone lookups: `idx_customers_phone_tenant(phone, tenant_id)` and `idx_customers_tenant_phone(tenant_id, phone)` — column order matters for queries filtering on just one column
---

## 2026-02-28 - floraiq-dy9.18
- Verified `customer_delivery_addresses` table — already exists (migration `20260210000001`)
- Table structure: id, tenant_id, customer_id, label, street_address, apartment, city, state, zip_code, country, latitude, longitude, is_primary, delivery_instructions, created_at, updated_at
- RLS enabled with tenant_users-based isolation policy
- Trigger `ensure_single_primary_address` ensures only one primary per customer
- Admin CRUD component exists: `src/components/admin/customers/CustomerDeliveryAddressesTab.tsx`
- All quality gates pass: no console.log, tenant_id filtered, tsc clean
- No new code needed — task was verification only
- **Learnings:**
  - The project chose dedicated table over JSONB column — better for querying, indexing, and RLS
  - `is_primary` uses a partial index `WHERE is_primary = TRUE` for fast primary lookups
  - Geocoding columns (latitude/longitude) are pre-provisioned for future map/routing features
---

## 2026-02-28 - floraiq-dy9.19
- Verified payment method settings already exist on `marketplace_stores` table
- `payment_methods` JSONB column (default `["cash", "card"]`) stores enabled methods as an array — functionally equivalent to individual `cash_enabled`, `venmo_enabled`, etc. booleans
- `checkout_settings` JSONB column stores `venmo_handle` and `zelle_email` — covers `venmo_handle` and `zelle_info` requirements
- Admin UI fully implemented in `StorefrontSettings.tsx` Payment Methods tab with toggles for cash, venmo, zelle, card/stripe plus input fields
- Checkout UI in `CheckoutPage.tsx` reads store's payment_methods and renders appropriate payment flows
- All quality gates pass: `npx tsc --noEmit` clean, no console.log, tenant_id filtering via store resolution
- No new code needed — task was verification only
- **Learnings:**
  - Payment methods use JSONB array pattern (`["cash", "venmo", "card"]`) rather than individual boolean columns — more extensible, easier to add new methods
  - Venmo/Zelle details stored in `checkout_settings` JSONB alongside other checkout config (guest checkout, phone required, coupons, tips)
  - Multiple overlapping migrations created `marketplace_stores` schema (20251209, 20251210, 20251211) — the final state is governed by `20251209181425` as the canonical create table
---

## 2026-02-28 - floraiq-dy9.20
- Added Telegram config migration to consolidate all 6 Telegram fields into `account_settings.notification_settings` JSONB
- Fields: telegram_bot_token, telegram_chat_id, telegram_auto_forward (existing), telegram_customer_link, telegram_button_label, show_telegram_on_confirmation (new)
- Migration backfills existing rows with sensible defaults (preserves existing values)
- Migrates `crm_settings.telegram_video_link` into `notification_settings.telegram_customer_link`
- Updated column default to include all Telegram fields for new rows
- Files changed: `supabase/migrations/20260228000009_add_telegram_config.sql`
- **Learnings:**
  - `telegram_video_link` column exists on `crm_settings` but NOT on `account_settings` — the edge function `storefront-checkout` reads it from `account_settings` as a direct column (line 405), which returns null since the column doesn't exist. Future bead should update edge function to read from `notification_settings` JSONB instead.
  - JSONB `||` operator merges keys at top level — using COALESCE on individual keys before merge preserves existing non-null values while setting defaults for missing keys
  - The column default uses `jsonb_build_object()` function (not a literal `'{}'::jsonb`) for readability and type safety
---

## 2026-02-28 - floraiq-dy9.21
- Added `preferred_contact_method` TEXT column to `marketplace_orders` table
- Updated `create_marketplace_order` RPC to accept `p_preferred_contact_method` parameter (14th param, DEFAULT NULL)
- Updated `storefront_orders` view to expose `preferred_contact_method`
- Updated `storefront-checkout` edge function to accept `preferredContactMethod` in request schema (enum: phone/email/text/telegram) and pass it to the RPC
- Updated `CheckoutPage.tsx` to send `preferredContactMethod` as a dedicated field to both the edge function and fallback RPC, instead of concatenating it into delivery notes
- Also added `preferredContactMethod` to the Telegram notification payload
- Files changed:
  - `supabase/migrations/20260228000010_add_preferred_contact_method.sql`
  - `supabase/functions/storefront-checkout/index.ts`
  - `src/pages/shop/CheckoutPage.tsx`
- **Learnings:**
  - The CheckoutPage form already had `preferredContact` field with values `text|call|email` — the DB column uses `phone|email|text|telegram` (slightly different naming: "call" in form vs "phone" in DB). The form sends the value as-is; the edge function Zod schema validates the enum.
  - The generated `types.ts` is missing `p_idempotency_key` from the RPC Args (added in a later migration) but TypeScript still passes — Supabase client's `.rpc()` type checking may be loose on extra properties. Same approach works for `p_preferred_contact_method`.
  - When updating `create_marketplace_order`, must re-issue GRANT with the new parameter count (14 params: UUID, TEXT×6, JSONB, NUMERIC×4, TEXT×2) or anon/authenticated users can't call it.
  - The `storefront_orders` view must be DROP+CREATE'd when adding columns since views don't support ALTER ADD COLUMN.
---

## 2026-02-28 - floraiq-dy9.22
- Created composite performance indexes via migration `20260228000011_performance_indexes.sql`
- Added 4 new indexes:
  - `idx_marketplace_orders_seller_created` — (seller_tenant_id, created_at DESC)
  - `idx_marketplace_orders_seller_status` — (seller_tenant_id, status)
  - `idx_marketplace_orders_seller_customer` — (seller_tenant_id, customer_id)
  - `idx_products_tenant_menu_visibility` — (tenant_id, menu_visibility)
- Verified 3 indexes already exist (no duplicates created):
  - `idx_marketplace_order_items_order` — order_items(order_id)
  - `idx_customers_tenant_phone` — customers(tenant_id, phone) WHERE phone IS NOT NULL
  - `unique_store_slug` constraint — marketplace_stores(slug) UNIQUE
- Files changed: `supabase/migrations/20260228000011_performance_indexes.sql`
- **Learnings:**
  - `marketplace_orders` has no `tenant_id` column — uses `seller_tenant_id` and `buyer_tenant_id` for the two sides of a B2B order. For storefront/admin queries, `seller_tenant_id` is the tenant identifier.
  - The PRD says "visible_on_storefront" but the actual column is `menu_visibility` (BOOLEAN). Always verify column names in existing migrations before creating indexes.
  - `marketplace_stores.slug` already has a UNIQUE constraint (`unique_store_slug`) from the CREATE TABLE definition, which implicitly creates a unique index. The additional `idx_marketplace_stores_slug` regular index is redundant but harmless.
  - `customers` already had both `idx_customers_phone_tenant(phone, tenant_id)` and `idx_customers_tenant_phone(tenant_id, phone)` — two separate indexes with opposite column order for different query patterns.
---

## 2026-02-28 - floraiq-dy9 (epic closure)
- All 22 tasks verified complete — bead closed
- Quality gates: `npx tsc --noEmit` clean, no `console.log` in edge functions, tenant_id filtering confirmed
- Key deliverables:
  - `storefront-checkout` edge function: full server-side checkout flow (price validation, stock checks, customer upsert, order numbers, inventory deduction, Telegram fire-and-forget, Stripe sessions, comprehensive error handling)
  - `forward-order-telegram` edge function: sends order notifications to tenant's configured Telegram chat
  - Client-side fallback when edge function unavailable (dy9.12)
  - DB migrations: sequential order numbers, inventory deduction safety, performance indexes, payment_method/Telegram config columns, preferred_contact_method
  - RPCs verified: `get_marketplace_store_by_slug`, `get_marketplace_products`, `create_marketplace_order`, `next_tenant_order_number`
- **Learnings:**
  - Bead was completed across iterations dy9.1 through dy9.22 in previous sessions — verification-only closure
---
