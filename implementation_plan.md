# FloraIQ R4 Implementation Plan

## Phase 1: CRITICAL — Broken Core Flow (4 tasks)

- [x] Task 1: Delete duplicate unguarded marketplace routes in App.tsx (lines 882-887). These duplicate lines 869-880 but WITHOUT FeatureProtectedRoute, bypassing subscription gating. Delete the second set only.

- [x] Task 2: Fix SettingsHubPage importing SuperAdmin SecurityPage. In src/pages/admin/hubs/SettingsHubPage.tsx line 29, it imports SecurityPage from '@/pages/super-admin/SecurityPage'. Replace with a simple tenant-scoped security settings panel (password change, 2FA toggle, session management) or redirect to the existing SettingsPage security tab.

- [ ] Task 3: Migrate CustomerManagement.tsx from useEffect/useState data fetching to useQuery. Replace the loadCustomers() function (line 111) with useQuery using queryKeys.customers pattern. Replace manual loadCustomers() calls after mutations with queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }).

- [ ] Task 4: Fix build errors from schema mismatches. Apply targeted fixes: (a) useProductsForMenu.ts — remove or alias 'sku' reference, (b) useTenantFeatureToggles.ts — remove 'feature_toggles' column reference, (c) WholesaleClients.tsx — remove 'risk_score' reference, (d) marketplace pages — remove 'verified_badge' reference, (e) OrderDetailsPage.tsx — fix 'partially_paid' to 'partial', (f) AddProductsStep.tsx — change 'status' to 'is_active', (g) ShopLayout.tsx — cast operating_hours with `as Record<string, unknown>`. For columns that truly don't exist, remove the reference or use optional chaining. Run `npx tsc --noEmit` after to verify.

## Phase 2: HIGH — Disconnected Wiring (6 tasks)

- [ ] Task 5: Add OrderDetailsPage route to App.tsx. Add: `<Route path="orders/:orderId" element={<FeatureProtectedRoute featureId="basic-orders"><OrderDetailsPage /></FeatureProtectedRoute>} />` inside the admin routes. Verify OrderDetailsPage is already imported.

- [ ] Task 6: Fix DisposableMenuOrders 'converted_to_invoice_id' reference. In src/pages/admin/DisposableMenuOrders.tsx line 334, this column doesn't exist on menu_orders. Remove the column reference and instead do a lookup join through customer_invoices to check if an invoice exists for the order. Or simply remove the conversion status UI if the join is too complex.

- [ ] Task 7: Clean up orphaned SMS state in WholesaleClients.tsx. Remove smsDialogOpen, smsClient state variables (lines 99-100) and any button that sets smsDialogOpen to true. The SendSMS component was removed per plan (line 35 comment).

- [ ] Task 8: Clean up orphaned import dialog state in WholesaleClients.tsx. Check if an import dialog component is actually rendered. If not, remove importDialogOpen, importFile, and importing state (lines 103-105) and any associated button.

- [ ] Task 9: Fix CustomerManagement cache invalidation. After migrating to useQuery (Task 3), ensure delete handler uses queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }) instead of calling loadCustomers(). Also invalidate any dashboard/badge count queries that show customer counts.

- [ ] Task 10: Fix InventoryDashboard realtime subscription tenant filtering. In src/pages/admin/InventoryDashboard.tsx lines 94-117, add tenant_id filter to the realtime channel: `.on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: \`tenant_id=eq.\${tenantId}\` })`. This prevents unnecessary re-renders from other tenants' changes.

## Phase 3: HIGH — Data, Validation & Performance (5 tasks)

- [ ] Task 11: Fix InventoryDashboard inline query keys. Replace inline strings at lines 121, 170, 213 (['inventory-stats', tenantId], ['category-stock', tenantId], ['low-stock-products', tenantId]) with queryKeys factory: queryKeys.inventory.summary(tenantId) etc. Add these keys to queryKeys factory if they don't exist.

- [ ] Task 12: Remove FinanceHubPage dead import. Delete the unused `_FrontedInventory` lazy import at line 40 of src/pages/admin/hubs/FinanceHubPage.tsx.

- [ ] Task 13: Fix marketing page 35-second LCP. In src/pages/MarketingHome.tsx: (a) Remove BusinessAdminDemo import and usage from ModernHero, (b) Remove VideoShowcase import (line 24) and usage, (c) Remove EnhancedDashboardPreview import (line 39) and usage (lines 139-145). Replace with a single static hero section. This alone should cut LCP by 90%+.

- [ ] Task 14: Fix marketing hero copy. In src/components/marketing/ModernHero.tsx, replace 'The only menu system built for operators who need to disappear' with 'Your operation. One platform.' and replace subtitle with 'Manage wholesale orders, inventory, menus, and compliance — all in one place.'

- [ ] Task 15: Fix marketing color inconsistency. In src/components/marketing/ModernHero.tsx, replace hardcoded 'bg-emerald-600' CTAs with CSS variable usage or standardize on emerald across MarketingNav and all marketing components. Update src/index.css --marketing-primary to emerald values (160 84% 39%).

## Phase 4: MEDIUM — Consistency & Type Safety (7 tasks)

- [ ] Task 16: Fix CashRegister.tsx toast import. Replace `import { useToast } from '@/hooks/use-toast'` (line 10) with `import { toast } from 'sonner'`. Update all toast() calls in the file to use sonner pattern: `toast.success('message')` / `toast.error('message')`.

- [ ] Task 17: Fix WholesaleClients 'overdue' filter. Line 124 uses `.gt('outstanding_balance', 10000)` as overdue detection. Replace with actual payment term check: query for clients where latest invoice due_date < now AND outstanding_balance > 0. If no due_date column exists, rename the filter from 'overdue' to 'high_balance' to be honest about what it does.

- [ ] Task 18: Fix InvoiceDetailPage void status. Line 174 compares to 'void' but the DB enum doesn't include it. Replace 'void' check with 'cancelled' only since that's what exists in the enum. Remove any UI that references 'void' status.

- [ ] Task 19: Fix SettingsPage nested tabs conflict. In src/pages/admin/SettingsPage.tsx, when rendered inside SettingsHubPage's 'general' tab, remove the internal Tabs wrapper and just render the general settings content directly. Use a prop like `embedded?: boolean` to toggle between standalone (with tabs) and embedded (content only) modes.

- [ ] Task 20: Fix SettingsPage useAccount import. In src/pages/admin/SettingsPage.tsx line 19, verify if useAccount from AccountContext properly maps to tenant context. If not, replace with useTenantAdminAuth() pattern.

- [ ] Task 21: Fix og:image for FloraIQ. In src/pages/MarketingHome.tsx SEOHead (line 64), add ogImage prop pointing to a branded image. Create a simple branded og:image as a static asset if one doesn't exist, or use a placeholder path like '/og-image.png'.

- [ ] Task 22: Fix marketing SEO title. In src/pages/MarketingHome.tsx line 65, change title from 'FloraIQ - Secure Disposable Menus for Cannabis Operators' to 'FloraIQ - Cannabis Wholesale Operations Platform'.

## Phase 5: MEDIUM — Marketing Polish (5 tasks)

- [ ] Task 23: Fix StickyMobileCTA conflicting messaging. Delete src/components/marketing/StickyMobileCTA.tsx entirely. Remove import and usage from MarketingHome.tsx.

- [ ] Task 24: Fix footer social icons. In src/components/marketing/MarketingFooter.tsx, replace plain text characters ('X', 'Li', 'Ig') with proper inline SVG icons for X/Twitter, LinkedIn, and Instagram.

- [ ] Task 25: Fix MarketingNav touch target. In src/components/marketing/MarketingNav.tsx, change hamburger button padding to meet 44px minimum: add `min-w-[44px] min-h-[44px]` classes.

- [ ] Task 26: Remove dark: classes from marketing components. Search MarketingHome.tsx and all marketing components for `dark:` Tailwind classes. Remove them since ForceLightMode wraps the marketing page.

- [ ] Task 27: Fix fabricated marketing social proof. In src/components/marketing/TrustedBy.tsx, replace fake company names with either real metrics (total orders processed, active menus) or an honest tagline like 'Built for licensed cannabis operators'. If no real data available, replace with industry positioning block.

## Phase 6: CLEANUP — Delete Dead Code (13 tasks)

- [ ] Task 28: Delete src/components/marketing/VideoShowcase.tsx (765 lines). Remove import from MarketingHome.tsx line 24 and any JSX usage.

- [ ] Task 29: Delete src/components/marketing/EnhancedDashboardPreview.tsx. Remove import from MarketingHome.tsx line 39 and usage lines 139-145.

- [ ] Task 30: Delete src/components/marketing/demos/BusinessAdminDemo.tsx. Remove import and usage from ModernHero.tsx.

- [ ] Task 31: Delete src/components/marketing/TrustedBy.tsx. Remove import from MarketingHome.tsx line 29 and usage line 87.

- [ ] Task 32: Delete src/components/marketing/TestimonialsCarousel.tsx (258 lines). Remove import from MarketingHome.tsx line 23 and usage lines 112-115.

- [ ] Task 33: Delete src/components/marketing/ComparisonSection.tsx (193 lines). Remove import from MarketingHome.tsx line 35 and usage lines 186-194.

- [ ] Task 34: Delete src/components/marketing/ROICalculator.tsx (241 lines). Remove import from MarketingHome.tsx line 37 and usage.

- [ ] Task 35: Delete these 4 files: ScrollProgressIndicator.tsx, KeyboardNavigationHelper.tsx, FloatingChatButton.tsx, LiveChatWidget.tsx. Remove all imports and usage from MarketingHome.tsx.

- [ ] Task 36: Delete src/components/marketing/CountUpNumber.tsx and src/components/marketing/StatsSection.tsx. Remove imports and usage from MarketingHome.tsx.

- [ ] Task 37: Delete src/components/marketing/IntegrationEcosystem.tsx. Remove import and usage from MarketingHome.tsx.

- [ ] Task 38: Extract inline pricing section from MarketingHome.tsx. Move lines 196-395 (pricing grid) into src/components/marketing/PricingSection.tsx. Import and use the new component in MarketingHome.tsx.

- [ ] Task 39: Replace ConfettiButton with standard Button in pricing CTAs. In the pricing section (now PricingSection.tsx after Task 38), replace ConfettiButton imports/usage with standard shadcn Button. Remove canvas-confetti dependency if no longer used elsewhere.

- [ ] Task 40: Audit marketing footer links. Check each link in MarketingFooter.tsx (/integrations, /docs, /status, /careers, /blog, /case-studies). For any that lead to empty/placeholder pages, either remove the link or add a "Coming Soon" state to the target page.

## Phase 7: FINAL VERIFICATION (2 tasks)

- [ ] Task 41: Run full TypeScript check. Execute `npx tsc --noEmit` and fix ANY remaining errors introduced by previous tasks.

- [ ] Task 42: Run `npx vite build` to verify production build succeeds with no errors.

## Checkpoint: Run `npx tsc --noEmit 2>&1 | head -50` — project must build and type-check without errors.
