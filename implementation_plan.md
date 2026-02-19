# FloraIQ R5 Implementation Plan — 150 Tasks

## Phase 1: Feature Flag System (18 tasks)

- [x] Task 1: Create feature flag constants — New file: src/lib/featureFlags.ts. Export FEATURE_FLAGS object with keys and boolean defaults. Core ON by default: orders, products, menus, invoices, customers, storefront, inventory. Advanced OFF by default: pos, crm_advanced, delivery_tracking, live_map, courier_portal, analytics_advanced, marketing_hub, purchase_orders, quality_control, credits_system, live_chat, fleet_management, vendor_management, storefront_builder_advanced. Export type FeatureFlag = keyof typeof FEATURE_FLAGS.

- [x] Task 2: Create useTenantFeatureToggles hook — New file: src/hooks/useTenantFeatureToggles.ts. Reads feature toggles from tenant_settings table (JSONB column) or falls back to FEATURE_FLAGS defaults. Returns: { isEnabled: (flag: FeatureFlag) => boolean, toggleFeature: (flag: FeatureFlag, enabled: boolean) => Promise<void>, flags: Record<FeatureFlag, boolean>, isLoading: boolean }. Uses TanStack Query with 5min staleTime. toggleFeature upserts to tenant_settings and invalidates query. If tenant_settings table or column doesn't exist, just return defaults — don't crash.

- [x] Task 3: Create FeatureGate component — New file: src/components/admin/FeatureGate.tsx. Props: feature: FeatureFlag, children: ReactNode, fallback?: ReactNode. Renders children only if isEnabled(feature) returns true. Otherwise renders fallback or null. Simple and lightweight.

- [x] Task 4: Create FeatureTogglesPanel — New file: src/components/admin/settings/FeatureTogglesPanel.tsx. Card-based grid showing all feature flags. Each card: icon, title, description, Switch toggle. Group into sections: "Core Features" (always on, switches disabled), "Advanced Features" (toggleable). Uses useTenantFeatureToggles().toggleFeature on switch change. Shows toast on toggle.

- [x] Task 5: Wire FeatureTogglesPanel to Settings page — In SettingsPage.tsx or SettingsHubPage.tsx, add a "Features" tab. Import and render FeatureTogglesPanel. Place logically after General/Billing tabs.

- [x] Task 6: Map sidebar items to feature flags — Find sidebar config (src/lib/constants/navigation.ts or sidebarConfigs.ts). Add featureFlag?: FeatureFlag property to each nav item. Map: POS items → 'pos', Delivery items → 'delivery_tracking', CRM Hub → 'crm_advanced', Analytics → 'analytics_advanced', Marketing/Coupons → 'marketing_hub', Purchase Orders → 'purchase_orders', Vendor Management → 'vendor_management', Quality Control → 'quality_control'.

- [x] Task 7: Filter sidebar by feature flags — In the sidebar rendering component, import useTenantFeatureToggles. Filter nav items: if item.featureFlag exists and !isEnabled(item.featureFlag), hide the item. Core items (no featureFlag) always show.

- [x] Task 8: Create FeatureProtectedRoute wrapper — File: src/components/admin/FeatureProtectedRoute.tsx. Wraps route content. Checks useTenantFeatureToggles.isEnabled(featureId). If disabled: show card with lock icon, "This feature is not enabled", "Enable it in Settings → Features" with link to settings page. Don't redirect — let them see where they are.

- [x] Task 9: Apply FeatureGate to POS routes — Wrap POS pages (CashRegister, POSHub, Shifts, ZReport) with FeatureProtectedRoute featureId="pos" in App.tsx.

- [x] Task 10: Apply FeatureGate to Delivery routes — Wrap DeliveryDashboard, LiveMap, FleetManagement, CourierManagement with featureId="delivery_tracking".

- [x] Task 11: Apply FeatureGate to Analytics routes — Wrap analytics hub/pages with featureId="analytics_advanced".

- [x] Task 12: Apply FeatureGate to Marketing routes — Wrap CouponManagement, Campaigns with featureId="marketing_hub".

- [x] Task 13: Apply FeatureGate to CRM routes — Wrap CRM Hub pages with featureId="crm_advanced".

- [x] Task 14: Apply FeatureGate to remaining advanced routes — Purchase Orders → 'purchase_orders', Vendor pages → 'vendor_management', QC → 'quality_control', Live Chat → 'live_chat', Fleet → 'fleet_management'.

- [x] Task 15: Add feature flag count to sidebar footer — Below sidebar nav, show small text: "X features enabled • Manage" where "Manage" links to Settings → Features tab.

- [x] Task 16: Add "Enable Feature" inline prompts — When a core page references a disabled feature (e.g. Orders page has "Assign Courier" but delivery_tracking is off), show the button as disabled with tooltip "Enable Delivery Tracking in Settings".

- [x] Task 17: Verify feature flag toggle flow end-to-end — Toggle POS on in settings → POS items appear in sidebar → navigate to CashRegister → page loads. Toggle off → items disappear → direct URL shows disabled message. Fix any issues.

- [x] Task 18: Run npx tsc --noEmit — Fix all TS errors from Phase 1. Checkpoint.

## Phase 2: Search Sanitization (12 tasks)

- [x] Task 19: Create sanitizeSearchInput utility — New file: src/lib/sanitizeSearch.ts. Export function that: strips leading/trailing whitespace, escapes Postgres LIKE special chars (%, _, \), limits to 100 chars, returns empty string for null/undefined. Also export sanitizeForIlike() that wraps result in % for partial matching.

- [x] Task 20: Sanitize search in Orders.tsx — No .ilike() calls found; search is client-side via JS .filter()/.includes(). No changes needed.

- [x] Task 21: Sanitize search in WholesaleClients.tsx — No .ilike() calls found; search is client-side via JS .filter()/.includes(). No changes needed.

- [x] Task 22: Sanitize search in CustomerManagement.tsx — No .ilike() calls found; search is client-side via JS .filter()/.includes(). No changes needed.

- [x] Task 23: Sanitize search in InvoicesPage.tsx — No .ilike() calls found; search is client-side via JS .filter()/.includes(). No changes needed.

- [x] Task 24: Sanitize search in Products/Inventory pages — No .ilike() calls found; search is client-side via JS .filter()/.includes(). No changes needed.

- [x] Task 25: Sanitize search in DisposableMenuOrders.tsx — No .ilike() calls found; search is client-side via JS .filter()/.includes(). No changes needed.

- [x] Task 26: Sanitize search in CRM pages — No unsanitized .ilike() calls found; CRM pages use client-side search, and useCRMInvoices.ts already uses escapePostgresLike(). No changes needed.

- [x] Task 27: Sanitize search in Marketplace pages — No .ilike() calls found; Marketplace pages use client-side filtering or don't have search. No changes needed.

- [x] Task 28: Sanitize search in any remaining pages — All .ilike() calls already use escapePostgresLike() from @/lib/utils/searchSanitize. No unsanitized calls found.

- [x] Task 29: Add debounce to all search inputs — All search inputs that trigger server-side queries already use useDebounce(value, 300) from @/hooks/useDebounce.ts. Verified 15+ consumers. Client-side search inputs (filtering in-memory arrays) don't trigger API calls and don't need debounce.

- [x] Task 30: Run npx tsc --noEmit — Fix all TS errors from Phase 2. Checkpoint.

## Phase 3: POS Refunds & Receipt (10 tasks)

- [x] Task 31: Create POSRefundDialog — New file: src/components/admin/pos/POSRefundDialog.tsx. Dialog for POS returns. Fields: search previous transaction (order number text input), items to refund (checkboxes from found order), refund amount (auto-calc, editable for partial), refund method (select: cash, original_method). React Hook Form + Zod validation. Props: open, onOpenChange, onSuccess, shiftId?. Must filter by tenant_id when looking up orders.

- [x] Task 32: Wire POSRefundDialog to CashRegister — In CashRegister.tsx: import POSRefundDialog, add useState<boolean> for open, add "Refund" button in POS header/action area, render dialog, onSuccess invalidates POS queries + shows toast.

- [x] Task 33: Create POS refund mutation — On POSRefundDialog submit: create negative transaction record in pos_transactions (or orders with type='refund'), restore stock for returned items (increment stock_quantity on products table), link to original order via original_order_id. Filter by tenant_id. Toast success with refund amount.

- [x] Task 34: Add refund totals to Z-Report — In ZReport.tsx: query refund transactions for shift period. Add section showing: Refund Count, Total Refunds ($), Net Sales = Gross Sales - Refunds.

- [x] Task 35: Add refund totals to shift summary — In shift end summary (ShiftManager or end-of-shift dialog), include refund count and total alongside gross sales.

- [x] Task 36: Improve POS receipt layout — In CashRegister handlePrintReceipt: ensure receipt includes store name, date/time, items with qty and price, subtotal, tax, total, payment method, receipt number. Format for 80mm thermal printer width. Add "REFUND" header for refund receipts.

- [x] Task 37: Add keyboard shortcuts to CashRegister — Add: F2 = New Sale, F3 = Search Product, F4 = Refund, F8 = Pay Cash, F9 = Pay Card, Esc = Clear. Show shortcut hints on buttons. Use useEffect with keydown listener, clean up on unmount.

- [x] Task 38: Add quick-add product grid to POS — If CashRegister only has search, add a grid of top/favorite products (last 12 sold or manually pinned) for one-tap adding. Query products ordered by sale frequency, limit 12.

- [x] Task 39: Add customer lookup to POS — Add customer search field in CashRegister. When customer selected: show name, apply any loyalty discounts, link sale to customer for history. Optional — can process sale without customer.

- [x] Task 40: Run npx tsc --noEmit — Fix all TS errors from Phase 3. Checkpoint.

## Phase 4: Invoice Partial Payments (12 tasks)

- [x] Task 41: Create InvoicePaymentDialog — New file: src/components/admin/invoices/InvoicePaymentDialog.tsx. Props: open, onOpenChange, invoice (with total, amount_paid, balance), onSuccess. Fields: payment amount (default: remaining balance, editable for partial), payment method (select: cash, check, bank_transfer, card), payment date (default today), reference/note (optional text). Zod validation: amount > 0, amount <= remaining balance. RHF form.

- [x] Task 42: Wire InvoicePaymentDialog to InvoiceDetailPage — Import dialog, add useState<boolean>, add "Record Payment" button (visible when balance > 0), pass invoice data, onSuccess invalidates invoice detail query + shows toast "Payment of $X recorded".

- [x] Task 43: Create payment recording mutation — On InvoicePaymentDialog submit: insert into invoice_payments (or update invoice amount_paid). If amount_paid + new payment >= total: auto-update invoice status to 'paid'. If partial: update status to 'partial'. Invalidate invoice queries. Filter by tenant_id.

- [x] Task 44: Add payment history to InvoiceDetailPage — Below invoice details, add "Payment History" section. Query invoice_payments for this invoice. Show table: Date, Amount, Method, Reference. Show running balance. If no payments table exists, store payments as JSONB array on the invoice record.

- [x] Task 45: Add VOID watermark to cancelled invoices — In InvoiceDetailPage, when invoice.status === 'cancelled': overlay a semi-transparent red "VOID" text rotated 45deg across the invoice preview. Disable all action buttons except "Delete".

- [x] Task 46: Add overdue auto-detection to InvoiceDetailPage — Compute: isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && ['sent','partial'].includes(invoice.status). If true: render red "Overdue" Badge next to status badge. Show days overdue count.

- [x] Task 47: Add overdue badges to InvoicesPage list — In InvoicesPage.tsx table, add same overdue computation per row. Show red "Overdue" badge in status column for qualifying invoices. Add "Overdue" as a filter option.

- [x] Task 48: Add payment columns to InvoicesPage list — Ensure columns show: Amount (total), Paid, Balance. Color code: green if fully paid, yellow if partial, red if overdue. Add sort by balance.

- [x] Task 49: Add isPending to all InvoiceDetailPage action buttons — Every button (Record Payment, Void, Send, Print, Edit, Delete) must have disabled={isPending} during mutations. Check each and fix missing ones.

- [x] Task 50: Add partial payment indicator to invoice PDF/print — If invoice has partial payments, show "Amount Paid: $X / Amount Due: $Y" on the printed invoice. If using OrderInvoiceGenerator, update the template.

- [x] Task 51: Wire invoice creation to finance dashboard — After creating any invoice, invalidate finance hub queries so revenue totals update without page refresh.

- [x] Task 52: Run npx tsc --noEmit — Fix all TS errors from Phase 4. Checkpoint.

## Phase 5: Empty States & Onboarding Polish (16 tasks)

- [x] Task 53: Create reusable EmptyState component — New file: src/components/ui/EmptyState.tsx. Props: icon (LucideIcon), title (string), description (string), actionLabel? (string), onAction? (function). Renders centered card with icon, title, description, and optional CTA button. Use across all pages.

- [x] Task 54: Add empty state to Dashboard — When tenant has zero orders AND zero products, show welcome card: "Welcome to FloraIQ! Get started by adding your first product." with "Add Product" CTA. Hide KPI cards (they'd all be zero).

- [x] Task 55: Add empty state to Products page — Zero products: Package icon, "No products yet", "Add your inventory to start selling", "Add Product" button that opens the add product flow.

- [x] Task 56: Add empty state to Orders page — Zero orders: ShoppingBag icon, "No orders yet", "Orders appear here when customers purchase from your menus or storefront", secondary "Create Menu" link.

- [x] Task 57: Add empty state to Menus page — Zero menus: Link icon, "No menus yet", "Create disposable menus to share with customers", "Create Menu" CTA.

- [x] Task 58: Add empty state to Customers page — Zero customers: Users icon, "No customers yet", "Customers are automatically added when they place orders", secondary "Import Customers" if import feature exists.

- [x] Task 59: Add empty state to Invoices page — Zero invoices: FileText icon, "No invoices yet", "Create invoices to track payments from wholesale clients", "Create Invoice" CTA.

- [x] Task 60: Add empty state to WholesaleClients page — Zero clients: Building icon, "No wholesale clients yet", "Add clients to manage wholesale relationships", "Add Client" CTA.

- [x] Task 61: Add empty state to LiveOrders page — Zero live orders: Radio icon, "No active orders right now", "Live orders appear here in real-time when customers place orders". No CTA needed.

- [x] Task 62: Add empty state to DisposableMenuOrders page — Zero orders: ClipboardList icon, "No menu orders yet", "Orders appear here when customers order from your disposable menus".

- [x] Task 63: Add empty state to CashRegister shift — No active shift: Clock icon, "No active shift", "Start a shift to begin processing sales", "Start Shift" CTA.

- [x] Task 64: Add empty state to Z-Report — No completed shifts: BarChart icon, "No shift reports yet", "Reports are generated when you complete a shift".

- [x] Task 65: Fix demo data loader — Verify Dashboard handleGenerateDemoData() works: creates sample products (5), orders (10), customers (5). Add ConfirmDialog before loading. If broken, fix. If missing, create it.

- [x] Task 66: Verify setup wizard — Navigate to /admin/setup. Walk through all steps. Each step should save. Final step redirects to dashboard. Fix any broken steps.

- [x] Task 67: Add skip on optional wizard steps — Delivery zones step and invite driver step: add "Skip for now" text link below main CTA. Advances to next step without saving that section.

- [x] Task 68: Run npx tsc --noEmit — Fix all TS errors from Phase 5. Checkpoint.

## Phase 6: Customer Portal & Storefront Flow (16 tasks)

- [x] Task 69: Audit shop homepage — Navigate to /{tenantSlug}/shop or /shop/:storeSlug. Verify: page loads, shows store name/logo, displays products, has navigation. Fix if broken or blank.

- [x] Task 70: Fix product browsing — On shop page: verify category filters work, search filters products, sorting (price, name, newest) works. Fix any that don't function.

- [x] Task 71: Fix product detail page — Click a product in shop. Verify: image displays, description shows, price is correct, "Add to Cart" button works. Fix if broken.

- [x] Task 72: Fix cart functionality — Add items to cart. Verify: cart badge updates, cart page shows items, can update quantity, can remove items, subtotal updates. Cart should persist across page navigations (use localStorage or context). Fix any broken parts.

- [x] Task 73: Fix checkout flow — From cart, click checkout. Verify: shipping/delivery form works, payment method selection works, can place order, shows confirmation. Fix any broken steps.

- [x] Task 74: Fix order confirmation page — After placing order, verify customer sees confirmation with order number, items ordered, estimated delivery. Fix if redirects wrong or shows blank.

- [x] Task 75: Fix customer order tracking — In customer portal, verify customer can see their orders list and click into order details with status timeline. Fix if broken or missing.

- [x] Task 76: Fix customer profile page — In customer portal, verify customer can update their name, phone, address. Fix if form doesn't save or fields are missing.

- [x] Task 77: Fix disposable menu customer flow — Generate a disposable menu link from admin. Open link in incognito. Verify: menu loads, products display, can browse, can place order. Fix any broken steps.

- [x] Task 78: Fix menu link expiry — If disposable menu has expiry, verify expired menus show "This menu has expired" instead of broken page or empty products.

- [x] Task 79: Fix mobile shop layout — Open shop page on mobile viewport (375px). Verify: navigation works, products display in single column, cart is accessible, checkout form is usable. Fix responsive issues.

- [x] Task 80: Fix mobile cart/checkout — On mobile: verify cart drawer/page works, checkout form fields aren't overlapping, submit button is visible, keyboard doesn't cover inputs.

- [x] Task 81: Verify storefront builder → live store — Make a change in admin StorefrontBuilder (color, logo, store name). Refresh /shop/:slug. Verify change appears. Fix if disconnected.

- [x] Task 82: Add order status realtime to customer portal — In customer order tracking page, add Supabase realtime subscription on the order's status. When admin changes status, customer sees update without refresh. If already exists, verify it works.

- [x] Task 83: Fix shop empty state — New store with zero products: shop page should show "This store doesn't have any products yet" instead of blank page or loading spinner.

- [x] Task 84: Run npx tsc --noEmit — Fix all TS errors from Phase 6. Checkpoint.

## Phase 7: Table & List Polish (14 tasks)

- [x] Task 85: Fix long text overflow in Orders table — Check customer name, product name, address columns. Apply max-w-[200px] truncate or TruncatedText component. Tooltip on hover to show full text.

- [x] Task 86: Fix long text overflow in Products table — Product name, description, SKU columns. Apply truncation.

- [x] Task 87: Fix long text overflow in Customers table — Name, email, address columns. Apply truncation.

- [x] Task 88: Fix long text overflow in WholesaleClients table — Business name, contact, notes columns. Apply truncation.

- [x] Task 89: Fix long text overflow in Invoices table — Customer name, invoice number columns. Apply truncation.

- [x] Task 90: Add sorting to Orders table — Ensure columns are sortable: Date (default desc), Total, Status, Customer. If sort doesn't work, wire it to query orderBy.

- [x] Task 91: Add sorting to Products table — Sortable: Name, Price, Stock, Category. Wire to query.

- [x] Task 92: Add sorting to Invoices table — Sortable: Date, Due Date, Amount, Balance, Status. Wire to query.

- [x] Task 93: Add sorting to WholesaleClients table — Sortable: Name, Balance, Last Order, Status.

- [x] Task 94: Verify pagination on Orders page — With many orders, verify pagination controls appear and work. Next/prev, page numbers, items per page selector. Fix if broken.

- [x] Task 95: Verify pagination on Products page — Same pagination check.

- [x] Task 96: Verify pagination on Customers page — Same pagination check.

- [x] Task 97: Add row count display to all tables — Show "Showing X-Y of Z results" below each table. Use total count from query.

- [x] Task 98: Run npx tsc --noEmit — Fix all TS errors from Phase 7. Checkpoint.

## Phase 8: Form Validation Hardening (14 tasks)

- [x] Task 99: Add negative number blocking to product price fields — In AddProduct/EditProduct forms, Zod schema: price must be z.number().min(0, "Price cannot be negative"). Also cost_price, wholesale_price. Apply to all product forms.

- [x] Task 100: Add negative number blocking to quantity fields — Stock quantity, order quantity, reorder point: z.number().int().min(0). Apply to all inventory and order forms.

- [x] Task 101: Add negative number blocking to invoice amounts — Invoice total, payment amount, discount: z.number().min(0). Apply to all invoice forms.

- [x] Task 102: Add character limits to text fields — Product name: max 200. Description: max 2000. Customer name: max 100. Notes: max 1000. Apply limits in Zod schemas AND as maxLength on inputs.

- [x] Task 103: Add email validation to customer/client forms — All email fields: z.string().email("Invalid email address"). Apply to customer creation, wholesale client, team invite forms.

- [x] Task 104: Add phone validation to relevant forms — Phone fields: z.string().regex(/^[\d\s\-\+\(\)]+$/, "Invalid phone number").min(7).max(20). Apply to customer, client, team forms.

- [x] Task 105: Add duplicate product name check — In AddProduct form onSubmit: before creating, query products table for same name + tenant_id. If exists, show error "A product with this name already exists". Prevent duplicate creation.

- [x] Task 106: Add duplicate client check — In AddWholesaleClient form: check business_name + tenant_id uniqueness before creating. Show error if duplicate.

- [x] Task 107: Add required field indicators — All required form fields should show red asterisk (*) after label. Check: product name, price, customer name, client business_name, invoice amount. Add to any missing.

- [x] Task 108: Fix form error messages visibility — All Zod validation errors should show below the field in red text. Check forms use FormMessage or ErrorMessage component. Fix any that don't show errors.

- [x] Task 109: Add confirmation dialog to all delete actions — Every delete button across the app must show ConfirmDeleteDialog before executing. Check: products, orders, customers, clients, invoices, menus, team members. Add missing ones.

- [x] Task 110: Verify modal close after success — All dialog/modal forms: after successful submit, modal should close (onOpenChange(false)). Check: AddProduct, EditProduct, AddClient, InvoicePayment, POSRefund, OrderEdit, OrderRefund. Fix any that stay open.

- [x] Task 111: Add form dirty state warning — In major forms (product, settings, storefront builder): if user has unsaved changes and tries to navigate away, show "You have unsaved changes" warning. Use beforeunload event or React Router blocker.

- [x] Task 112: Run npx tsc --noEmit — Fix all TS errors from Phase 8. Checkpoint.

## Phase 9: Error Handling & Loading States (12 tasks)

- [x] Task 113: Add error boundaries to hub pages — Create or verify ErrorBoundary component exists. Wrap each Hub page's lazy-loaded tabs with ErrorBoundary that shows "Something went wrong" + "Try Again" button instead of white screen of death.

- [x] Task 114: Add error state to Dashboard — If dashboard queries fail, show error card with retry button instead of broken KPI cards with NaN/undefined.

- [x] Task 115: Add error state to Orders page — If orders query fails, show error message with retry. Don't show empty table that looks like zero orders.

- [x] Task 116: Add error state to Products page — Same pattern: error message + retry on query failure.

- [x] Task 117: Add loading skeletons to Dashboard — Replace loading spinners with skeleton placeholders (Skeleton component from shadcn) that match KPI card shapes. Feels faster.

- [x] Task 118: Add loading skeletons to table pages — Orders, Products, Customers, Invoices: show skeleton rows (5-8 rows of gray bars) while loading instead of spinner or blank.

- [x] Task 119: Fix 404 page for admin routes — Navigate to /{tenantSlug}/admin/nonexistent-page. Should show "Page not found" with link back to dashboard. If shows white screen, add catch-all route.

- [x] Task 120: Fix 404 for invalid tenant slug — Navigate to /invalid-slug/admin. Should show "Business not found" or redirect to signup. Fix if shows error.

- [x] Task 121: Add not-found state to ProductDetailPage — Navigate to /admin/products/fake-uuid. Should show "Product not found" card with "Back to Products" link. Fix if infinite loading.

- [x] Task 122: Add not-found state to ClientDetailPage — Navigate to /admin/clients/fake-uuid. Same pattern. Fix if broken.

- [x] Task 123: Add not-found state to InvoiceDetailPage — Navigate to /admin/invoices/fake-uuid. Same pattern.

- [x] Task 124: Run npx tsc --noEmit — Fix all TS errors from Phase 9. Checkpoint.

## Phase 10: Cross-Feature Integration (10 tasks)

- [x] Task 125: Stock decrement on order delivery — When order status changes to 'delivered': decrement product stock_quantity for each line item. Verify this happens or add it. Don't double-decrement if already implemented.

- [x] Task 126: Stock restore on order cancel — When order status changes to 'cancelled': restore stock_quantity for each line item. Verify or add.

- [x] Task 127: Low stock alert on dashboard — Dashboard should show "X products low on stock" card when any product's stock_quantity < reorder_point (or < 10 default). Link to inventory page filtered to low stock.

- [x] Task 128: Invoice auto-creation from orders — When a wholesale order is completed/delivered, offer to auto-generate invoice. Add "Create Invoice" button on OrderDetailsPage that pre-fills invoice from order data.

- [x] Task 129: Customer lifetime value on customer detail — On customer detail/profile page, show: total orders count, total spent, average order value, first order date. Query from orders table.

- [x] Task 130: Dashboard KPI click-through — Each KPI card on dashboard should link somewhere: Total Revenue → Finance Hub, Total Orders → Orders page, Total Customers → Customers page, Low Stock → Inventory filtered. Wrap in Link components.

- [x] Task 131: Verify notification bell — If notification bell exists in header: verify it shows count, clicking opens dropdown, clicking notification navigates to relevant page. If not implemented, hide the bell icon.

- [x] Task 132: Coupon validation in checkout — In customer checkout/cart: if coupon code field exists, verify flow: enter code → validate against coupons table (active, not expired, usage limit not reached) → apply discount → show updated total. Fix if broken. If no coupon table, hide the field.

- [x] Task 133: Role changes reflect in sidebar — After changing a team member's role via team management, their sidebar should reflect new permissions. Ensure role change invalidates the auth/permissions query.

- [x] Task 134: Run npx tsc --noEmit — Fix all TS errors from Phase 10. Checkpoint.

## Phase 11: Mobile Responsiveness (12 tasks)

- [x] Task 135: Fix admin sidebar on mobile — Sidebar should collapse to hamburger menu on screens < 768px. Verify: hamburger button visible, clicking opens overlay sidebar, clicking nav item closes sidebar, clicking outside closes sidebar.

- [x] Task 136: Fix admin dashboard on mobile — KPI cards should stack 2x2 or 1 column on mobile. Charts should be full width. No horizontal scrolling.

- [x] Task 137: Fix admin tables on mobile — Tables with many columns should: either show condensed card view on mobile, or have horizontal scroll with sticky first column. Check Orders, Products, Invoices tables.

- [x] Task 138: Fix all modals on mobile — Modals should be nearly full-screen on mobile (max-w-full on small screens). Form inputs shouldn't be cut off. Submit button must be visible without scrolling past the fold.

- [x] Task 139: Fix CashRegister on tablet — POS should be optimized for iPad-size screens (1024px). Product grid + cart side by side. Touch-friendly button sizes (min 44px).

- [x] Task 140: Fix date pickers on mobile — Date inputs should use native date picker on mobile (type="date") or ensure custom date picker is touch-friendly and doesn't overflow viewport.

- [x] Task 141: Fix dropdown menus on mobile — All Select/Combobox dropdowns should not overflow screen edges. Apply max-h and position properly on small screens.

- [x] Task 142: Fix command palette on mobile — If Command/search palette exists (Cmd+K): verify it's usable on mobile with proper sizing and keyboard handling.

- [x] Task 143: Add pull-to-refresh on mobile pages — For LiveOrders page on mobile: add pull-to-refresh gesture that invalidates queries. Use native overscroll or library.

- [x] Task 144: Fix print layouts — Invoice print, receipt print, Z-report print: verify @media print CSS hides sidebar, header, and non-essential UI. Content fills page width. Test with browser print preview.

- [x] Task 145: Fix touch targets across admin — Audit all icon buttons (edit, delete, view). Minimum 44x44px touch target. Common offenders: table action buttons, modal close X, pagination arrows. Add min-w-[44px] min-h-[44px] where needed.

- [x] Task 146: Run npx tsc --noEmit — Fix all TS errors from Phase 11. Checkpoint.

## Phase 12: Final Verification & Cleanup (4 tasks)

- [x] Task 147: Remove all console.log statements — Run grep -rn "console\.\(log\|warn\|error\|debug\)" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v logger.ts. Replace with logger.debug/warn/error or remove. Skip test files.

- [x] Task 148: Remove all @ts-ignore and @ts-nocheck — Run grep -rn "@ts-ignore\|@ts-nocheck" src/. Remove each one and fix the underlying TS error properly.

- [x] Task 149: Full TypeScript check — Run npx tsc --noEmit. Fix ALL remaining errors. Zero errors required.

- [x] Task 150: Production build — Run npx vite build. Must succeed with zero errors. Fix any build failures.

## Checkpoint: Project builds clean. All 150 tasks complete.

# ================================================================
# PART B: FEATURE TASKS (Tasks 151-300)
# ================================================================

## Phase B1: Feature Flag System (18 tasks)

- [x] Task 151: Create feature flag constants � src/lib/featureFlags.ts. FEATURE_FLAGS with defaults. Core ON: orders, products, menus, invoices, customers, storefront, inventory. Advanced OFF: pos, crm_advanced, delivery_tracking, live_map, courier_portal, analytics_advanced, marketing_hub, purchase_orders, quality_control, credits_system, live_chat, fleet_management, vendor_management, storefront_builder_advanced.
- [x] Task 152: Create useTenantFeatureToggles hook � src/hooks/useTenantFeatureToggles.ts. Reads tenant_settings JSONB, falls back to defaults. Returns isEnabled, toggleFeature, flags, isLoading.
- [x] Task 153: Create FeatureGate component — src/components/admin/FeatureGate.tsx. Props: feature, children, fallback?. Already exists with full implementation.
- [x] Task 154: Create FeatureTogglesPanel — src/components/admin/settings/FeatureTogglesPanel.tsx already exists with full implementation (card grid, switch toggles, grouped Core/Advanced, toast on toggle).
- [x] Task 155: Wire FeatureTogglesPanel to Settings page — Already wired: imported at line 28, Features tab trigger at line 523, TabsContent with FeatureTogglesPanel at line 762 of SettingsPage.tsx.
- [x] Task 156: Map sidebar items to feature flags — Add featureFlag property to nav items.
- [x] Task 157: Filter sidebar by feature flags — Already implemented in both Sidebar.tsx (lines 197-201) and SidebarSection.tsx (lines 40-47). Both use useTenantFeatureToggles to hide items where !isEnabled(featureFlag).
- [x] Task 158: Create FeatureProtectedRoute — Already exists in src/components/admin/FeatureProtectedRoute.tsx and src/components/tenant-admin/FeatureProtectedRoute.tsx. Shows lock icon, "This feature is not enabled" message, settings link. Used extensively in App.tsx.
- [x] Task 159: Apply FeatureGate to POS routes — Already implemented: all POS routes (pos-system, cash-register, pos-analytics, pos-shifts, z-reports) wrapped with FeatureProtectedRoute feature="pos" in App.tsx.
- [x] Task 160: Apply FeatureGate to Delivery routes
- [x] Task 161: Apply FeatureGate to Analytics routes
- [x] Task 162: Apply FeatureGate to Marketing routes — Already implemented: marketplace/coupons (line 912), marketing-hub (line 935), marketing/reviews (line 936), loyalty-program (line 961), marketing-automation (line 975) all wrapped with FeatureProtectedRoute feature="marketing_hub"
- [x] Task 163: Apply FeatureGate to CRM routes — Already implemented: all CRM routes (crm/clients, crm/invoices, crm/pre-orders, crm/settings, crm/invites) wrapped with FeatureProtectedRoute feature="crm_advanced" in App.tsx
- [x] Task 164: Apply FeatureGate to remaining routes (PO, Vendor, QC, Chat, Fleet) — Already implemented: purchase-orders (feature="purchase_orders"), vendor-management + vendor-dashboard (feature="vendor_management"), quality-control (feature="quality_control"), live-chat (feature="live_chat"), fleet-management (feature="fleet_management") all wrapped with FeatureProtectedRoute in App.tsx
- [x] Task 165: Feature flag count in sidebar footer
- [x] Task 166: Enable Feature tooltips on disabled buttons
- [x] Task 167: Verify toggle flow end-to-end
- [x] Task 168: Run npx tsc --noEmit — Checkpoint. Zero errors.

## Phase B2: Search Sanitization (12 tasks)

- [x] Task 169: Create sanitizeSearchInput — src/lib/sanitizeSearch.ts. Escape %, _, \. Limit 100 chars. sanitizeForIlike(). Already exists with full implementation.
- [x] Task 170: Sanitize search in Orders.tsx — No .ilike() calls found; search is client-side via JS .filter()/.includes(). OrderSearchBar and OrderFilters already use escapePostgresLike(). No changes needed.
- [x] Task 171: Sanitize search in WholesaleClients.tsx — No .ilike() calls found; search is client-side via JS .filter()/.includes(). No changes needed.
- [x] Task 172: Sanitize search in CustomerManagement.tsx — No .ilike() calls found; search is client-side via JS .filter()/.includes(). No changes needed.
- [x] Task 173: Sanitize search in InvoicesPage.tsx — No .ilike() calls found; search is client-side via JS .filter()/.includes(). useCRMInvoices.ts already uses escapePostgresLike(). No changes needed.
- [x] Task 174: Sanitize search in Products/Inventory pages — No .ilike() calls found; search is client-side via JS .filter()/.includes(). useProductTags.ts already uses escapePostgresLike(). No changes needed.
- [ ] Task 175: Sanitize search in DisposableMenuOrders.tsx
- [ ] Task 176: Sanitize search in CRM pages
- [ ] Task 177: Sanitize search in Marketplace pages
- [ ] Task 178: Sanitize ALL remaining .ilike() � grep and fix every one
- [ ] Task 179: Add 300ms debounce to all search inputs
- [ ] Task 180: Run npx tsc --noEmit � Checkpoint.

## Phase B3: POS Refunds and Receipt (10 tasks)

- [ ] Task 181: Create POSRefundDialog � src/components/admin/pos/POSRefundDialog.tsx. RHF + Zod. Search transaction, select items, amount, method.
- [ ] Task 182: Wire POSRefundDialog to CashRegister
- [ ] Task 183: Create POS refund mutation � Negative record, restore stock, link original.
- [ ] Task 184: Add refund totals to Z-Report
- [ ] Task 185: Add refund totals to shift summary
- [ ] Task 186: Improve POS receipt layout � 80mm thermal, REFUND header for refunds.
- [ ] Task 187: Add keyboard shortcuts to CashRegister � F2/F3/F4/F8/F9/Esc.
- [ ] Task 188: Add quick-add product grid � Top 12 by frequency.
- [ ] Task 189: Add customer lookup to POS
- [ ] Task 190: Run npx tsc --noEmit � Checkpoint.

## Phase B4: Invoice Partial Payments (12 tasks)

- [ ] Task 191: Create InvoicePaymentDialog � src/components/admin/invoices/InvoicePaymentDialog.tsx. Amount, method, date, reference. Zod validation.
- [ ] Task 192: Wire InvoicePaymentDialog to InvoiceDetailPage
- [ ] Task 193: Create payment mutation � Update paid/partial status.
- [ ] Task 194: Payment history section on InvoiceDetailPage
- [ ] Task 195: VOID watermark on cancelled invoices
- [ ] Task 196: Overdue auto-detection on InvoiceDetailPage
- [ ] Task 197: Overdue badges on InvoicesPage list
- [ ] Task 198: Payment columns on InvoicesPage � Amount, Paid, Balance, color-coded.
- [ ] Task 199: isPending on all InvoiceDetailPage buttons
- [ ] Task 200: Partial payment on printed invoice
- [ ] Task 201: Invoice creation to finance dashboard invalidation
- [ ] Task 202: Run npx tsc --noEmit � Checkpoint.

## Phase B5: Empty States and Onboarding (16 tasks)

- [ ] Task 203: Create EmptyState component � src/components/ui/EmptyState.tsx
- [ ] Task 204: Empty state � Dashboard
- [ ] Task 205: Empty state � Products
- [ ] Task 206: Empty state � Orders
- [ ] Task 207: Empty state � Menus
- [ ] Task 208: Empty state � Customers
- [ ] Task 209: Empty state � Invoices
- [ ] Task 210: Empty state � WholesaleClients
- [ ] Task 211: Empty state � LiveOrders
- [ ] Task 212: Empty state � DisposableMenuOrders
- [ ] Task 213: Empty state � CashRegister no shift
- [ ] Task 214: Empty state � Z-Report
- [ ] Task 215: Fix demo data loader
- [ ] Task 216: Verify setup wizard end-to-end
- [ ] Task 217: Skip on optional wizard steps
- [ ] Task 218: Run npx tsc --noEmit � Checkpoint.

## Phase B6: Customer Portal and Storefront (16 tasks)

- [ ] Task 219: Audit shop homepage loads
- [ ] Task 220: Fix product browsing (filters, search, sort)
- [ ] Task 221: Fix product detail page
- [ ] Task 222: Fix cart functionality
- [ ] Task 223: Fix checkout flow
- [ ] Task 224: Fix order confirmation
- [ ] Task 225: Fix customer order tracking
- [ ] Task 226: Fix customer profile page
- [ ] Task 227: Fix disposable menu customer flow
- [ ] Task 228: Fix menu link expiry
- [ ] Task 229: Fix mobile shop layout
- [ ] Task 230: Fix mobile cart/checkout
- [ ] Task 231: Verify storefront builder to live store
- [ ] Task 232: Order status realtime in customer portal
- [ ] Task 233: Shop empty state (zero products)
- [ ] Task 234: Run npx tsc --noEmit � Checkpoint.

## Phase B7: Table and List Polish (14 tasks)

- [ ] Task 235: Fix text overflow � Orders table
- [ ] Task 236: Fix text overflow � Products table
- [ ] Task 237: Fix text overflow � Customers table
- [ ] Task 238: Fix text overflow � WholesaleClients table
- [ ] Task 239: Fix text overflow � Invoices table
- [ ] Task 240: Sorting � Orders table
- [ ] Task 241: Sorting � Products table
- [ ] Task 242: Sorting � Invoices table
- [ ] Task 243: Sorting � WholesaleClients table
- [ ] Task 244: Pagination � Orders
- [ ] Task 245: Pagination � Products
- [ ] Task 246: Pagination � Customers
- [ ] Task 247: Row count display on all tables
- [ ] Task 248: Run npx tsc --noEmit � Checkpoint.

## Phase B8: Form Validation (14 tasks)

- [ ] Task 249: Block negative prices
- [ ] Task 250: Block negative quantities
- [ ] Task 251: Block negative invoice amounts
- [ ] Task 252: Character limits on text fields
- [ ] Task 253: Email validation
- [ ] Task 254: Phone validation
- [ ] Task 255: Duplicate product name check
- [ ] Task 256: Duplicate client check
- [ ] Task 257: Required field indicators (*)
- [ ] Task 258: Form error visibility
- [ ] Task 259: ConfirmDeleteDialog on all deletes
- [ ] Task 260: Modal close after success
- [ ] Task 261: Dirty state warning on navigate
- [ ] Task 262: Run npx tsc --noEmit � Checkpoint.

## Phase B9: Error Handling and Loading (12 tasks)

- [ ] Task 263: Error boundaries on hub pages
- [ ] Task 264: Error state � Dashboard
- [ ] Task 265: Error state � Orders
- [ ] Task 266: Error state � Products
- [ ] Task 267: Loading skeletons � Dashboard
- [ ] Task 268: Loading skeletons � table pages
- [ ] Task 269: 404 for admin routes
- [ ] Task 270: 404 for invalid tenant slug
- [ ] Task 271: Not-found � ProductDetail
- [ ] Task 272: Not-found � ClientDetail
- [ ] Task 273: Not-found � InvoiceDetail
- [ ] Task 274: Run npx tsc --noEmit � Checkpoint.

## Phase B10: Cross-Feature Integration (10 tasks)

- [ ] Task 275: Stock decrement on delivery
- [ ] Task 276: Stock restore on cancel
- [ ] Task 277: Low stock alert on dashboard
- [ ] Task 278: Invoice auto-creation from orders
- [ ] Task 279: Customer lifetime value on detail page
- [ ] Task 280: Dashboard KPI click-through links
- [ ] Task 281: Verify notification bell
- [ ] Task 282: Coupon validation in checkout
- [ ] Task 283: Role changes reflect in sidebar
- [ ] Task 284: Run npx tsc --noEmit � Checkpoint.

## Phase B11: Mobile Responsiveness (12 tasks)

- [ ] Task 285: Admin sidebar mobile hamburger
- [ ] Task 286: Dashboard mobile stacking
- [ ] Task 287: Tables mobile (card view or scroll)
- [ ] Task 288: Modals mobile full-screen
- [ ] Task 289: CashRegister tablet layout
- [ ] Task 290: Date pickers mobile
- [ ] Task 291: Dropdowns mobile positioning
- [ ] Task 292: Command palette mobile
- [ ] Task 293: Pull-to-refresh LiveOrders
- [ ] Task 294: Print layouts media print
- [ ] Task 295: Touch targets 44x44px
- [ ] Task 296: Run npx tsc --noEmit � Checkpoint.

## Phase B12: Final Cleanup (4 tasks)

- [ ] Task 297: Remove all console.log � replace with logger or remove
- [ ] Task 298: Remove all ts-ignore and ts-nocheck
- [ ] Task 299: Full TypeScript check � npx tsc --noEmit, zero errors
- [ ] Task 300: Production build � npx vite build, zero errors

## Checkpoint: All 300 tasks complete. Clean build.
