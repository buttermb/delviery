# FloraIQ R4 - 500 Tasks

- [x] Task 1: Fix useUrlFilters type casting in Orders.tsx -- 
- [x] Task 2: Fix useUrlFilters type casting in ClientsPage.tsx --
- [x] Task 3: Fix useUrlFilters type casting in WholesaleOrdersPage.tsx -- 
- [x] Task 4: Cast supabase in DataExport.tsx -- Line 85: change to (supabase as any).from('data_exports') to fix
      untyped table error.
- [x] Task 5: Cast supabase in NewPurchaseOrder.tsx -- Lines 142/168/178: use (supabase as any) for untyped tables/RPCs.
      Add product_name to insert. Remove tenant_id from insert.
- [x] Task 6: Cast supabase in OfflineOrderCreate.tsx -- Line 91: change to (supabase as any).from('products') to fix
      untyped table error.
- [x] Task 7: Cast supabase in AllTenantsPage.tsx -- Line 44: change to (supabase as
      any).rpc('admin_grant_tenant_access') to fix untyped RPC error.
- [x] Task 8: Cast supabase in CommissionTrackingPage.tsx -- Line 16: change to (supabase as any).rpc('get_platform_metrics')
      to fix untyped RPC error.
- [x] Task 9: Fix cast in MarketplaceCategoryManager.tsx -- Line 47: change data as MarketplaceCategory[] to (data as unknown
      as MarketplaceCategory[]) for intermediate cast.
- [x] Task 10: Cast supabase in ProductVisibilityManager.tsx -- Line 46: change to (supabase as any).from('marketplace_listings')
      to fix untyped table error.
- [x] Task 11: Cast supabase in BusinessMenuPage.tsx --
- [x] Task 12: Cast supabase in PublicMarketplacePage.tsx --
- [x] Task 13: Cast supabase in AdminQuickExport.tsx -- Line 81: change to (supabase as
      any).from('profiles').select('user_id, full_name, email').
- [x] Task 14: Fix type mismatches in CustomerDetails.tsx -- Cast arithmetic: (Number((o as any).total_amount) || 0). Ensure
      computedTotalSpent typed as number for .toFixed(2).
- [x] Task 15: Fix type mismatch in CustomerInsights.tsx -- Line 42: change to (customer as unknown as Record) to fix
      intermediate cast error.
- [x] Task 16: Fix type mismatch in RevenueReports.tsx -- Line 98: cast (order as any).total in forEach to resolve missing
      property error.
- [x] Task 17: Fix type mismatch in WhiteLabelSettings.tsx -- Line 88: cast whiteLabelConfig as any before assigning to
      white_label theme field.
- [x] Task 18: Add missing customerDialogOpen state in CashRegister.tsx -- 
- [x] Task 19: Fix SearchInput props in CollectionMode.tsx -- Lines 952-956: change value/onChange to defaultValue/onSearch to
      match SearchInputProps interface.
- [x] Task 20: Fix Order type collision in Orders.tsx -- Line 1425: cast editOrder as any when passing to OrderEditModal to
      resolve local Order interface collision.
- [x] Task 21: Fix supabase casts in CreditAuditLogPage.tsx -- No direct supabase usage; delegates to superAdminCreditService.ts which already casts via `const sb = supabase as any`.
- [x] Task 22: Fix supabase casts in PromoCodeManagementPage.tsx -- Removed unnecessary `as any` casts: `code as any` (line 278) and `validUntil?.toISOString() as any` (line 394).
- [x] Task 23: Fix supabase casts in TeamSettings.tsx -- No casts needed; tenant_users and profiles tables are fully typed in generated types. No TS errors.
- [x] Task 24: Fix supabase casts in MarketplacePurchasesPage.tsx -- Replaced useToast with toast from sonner, replaced inline query keys with queryKeys factory, added marketplace section to queryKeys.
- [x] Task 25: Fix supabase casts in VendorPayoutsPage.tsx -- Fixed supabase cast pattern, replaced inline query keys with queryKeys factory (added marketplace.payouts and marketplace.balance), replaced `any` types with MarketplacePayout and MarketplaceOrder interfaces.
- [x] Task 26: Wire OrderEditModal to Orders.tsx -- Removed unnecessary `as any` cast on editOrder prop; types are structurally compatible.
- [x] Task 27: Wire OrderEditModal to OrderDetailsPage.tsx -- Already wired: import, state, button, and modal rendering all present with correct props.
- [x] Task 28: Wire OrderRefundModal to OrderDetailsPage.tsx -- Already wired: import, state, refund button, and modal rendering all present with correct props.
- [x] Task 29: Wire OrderTimeline to OrderDetailsPage.tsx -- Imported OrderTimeline component and added it to the sidebar with orderId prop and maxHeight="350px", hidden on print.
- [x] Task 30: Wire OrderNotesSection to OrderDetailsPage.tsx -- Imported OrderNotesSection and replaced static Notes card with tabbed internal/customer notes component, wired to unified_orders table with tenant_id filter.
- [x] Task 31: Wire OrderThreadedNotes to OrderDetailsPage.tsx -- Already wired: import, rendering in sidebar with orderId and orderNumber props, hidden on print.
- [x] Task 32: Wire OrderDuplicateButton to OrderDetailsPage.tsx -- Already wired: DuplicateOrderButton (enhanced version with stock validation) is imported and rendered in header action buttons with full order data props.
- [x] Task 33: Wire OrderPrintDialog to OrderDetailsPage.tsx -- Imported OrderPrintDialog, added showPrintDialog state, replaced window.print() with dialog open, rendered dialog with mapped OrderPrintData props including customer, items, business info.
- [x] Task 34: Wire OrderExportButton to OrderDetailsPage.tsx -- Imported OrderExportButton and added to header actions with order data mapped to OrderData interface, including customer info and line items.
- [x] Task 35: Wire OrderAssignCourier to OrderDetailsPage.tsx -- Imported OrderAssignCourier, added showAssignCourierDialog state, added "Assign Courier" button for confirmed/preparing/ready orders with delivery address and no courier, rendered dialog with orderId, orderAddress, orderNumber props and onSuccess invalidation.
- [x] Task 36: Wire OrderDeliveryWindow to OrderDetailsPage.tsx -- Imported OrderDeliveryWindow and added to sidebar with delivery status mapping, scheduledDeliveryAt and timeSlotLabel extracted from order data, shown only for orders with delivery address.
- [x] Task 37: Wire OrderAuditLog to OrderDetailsPage.tsx -- Imported OrderAuditLog and added to sidebar with orderId prop and maxHeight="400px", hidden on print.
- [x] Task 38: Wire OrderCustomerCard to OrderDetailsPage.tsx -- Replaced static Customer Info card in sidebar with OrderCustomerCard component, mapping order.customer/order.user data to OrderCustomerData interface, with showActions disabled when order is cancelled.
- [x] Task 39: Wire OrderHoverCard to Orders.tsx rows --
- [x] Task 40: Wire OrderActionsDropdown to Orders.tsx rows -- Replaced inline DropdownMenu with OrderActionsDropdown component, added handleOrderAction callback for edit/cancel/refund/duplicate, cleaned up unused imports.
- [x] Task 41: Sanitize search in ClientsPage.tsx -- Applied sanitizeSearchInput from @/lib/sanitizeSearch to filters.q to trim, limit length, and escape special characters.
- [x] Task 42: Sanitize search in Orders.tsx -- Applied sanitizeSearchInput from @/lib/sanitizeSearch to filters.q to trim, limit length, and escape special characters.
- [x] Task 43: Sanitize search in ProductManagement.tsx -- Applied sanitizeSearchInput from @/lib/sanitizeSearch to debouncedSearchTerm to trim, limit length, and escape special characters.
- [x] Task 44: Sanitize search in WholesaleOrdersPage.tsx -- Applied sanitizeSearchInput from @/lib/sanitizeSearch to filters.q to trim, limit length, and escape special characters.
- [x] Task 45: Sanitize search in WholesaleClients.tsx -- Applied sanitizeSearchInput from @/lib/sanitizeSearch to searchTerm to trim, limit length, and escape special characters.
- [x] Task 46: Sanitize search in InventoryManagement.tsx -- Applied sanitizeSearchInput from @/lib/sanitizeSearch to searchTerm in client-side filter to trim, limit length, and escape special characters.
- [x] Task 47: Sanitize search in InvoicesPage.tsx -- Applied sanitizeSearchInput from @/lib/sanitizeSearch to searchQuery in client-side filter to trim, limit length, and escape special characters.
- [x] Task 48: Sanitize search in CustomerSearch component -- Replaced escapePostgresLike with sanitizeSearchInput from @/lib/sanitizeSearch to trim, limit length, and escape special characters.
- [x] Task 49: Sanitize search in GlobalSearch.tsx -- Replaced escapePostgresLike with sanitizeSearchInput from @/lib/sanitizeSearch to trim, limit length, and escape special characters.
- [x] Task 50: Sanitize search in AdminCommandPalette.tsx -- Applied sanitizeSearchInput from @/lib/sanitizeSearch to search input before passing to searchData() to trim, limit length, and escape special characters.
- [x] Task 51: Sanitize search in POSCustomerSelector.tsx -- Applied sanitizeSearchInput from @/lib/sanitizeSearch to searchQuery in client-side filter to trim, limit length, and escape special characters.
- [x] Task 52: Add Zod validation to CustomerForm.tsx -- Already implemented: Zod schema with z.string().email() for email, z.string().max(100) for name, phone regex validation, zodResolver wired to form.
- [x] Task 53: Add Zod validation to CreateClientDialog.tsx -- Added clientFormSchema with Zod validation for all fields (business_name, contact_name, phone, email, address, client_type, credit_limit, notes), replaced manual validation with safeParse, added inline field error messages.
- [x] Task 54: Add Zod validation to EditClientDialog.tsx -- Added clientFormSchema with Zod validation for all fields (business_name, contact_name, phone, email, address, client_type, credit_limit, notes), replaced manual validation with safeParse, added inline field error messages, added maxLength attributes to inputs.
- [x] Task 55: Add maxLength to OrderNotesSection.tsx -- Added maxLength={2000} to both internal and customer notes Textarea elements, plus character count indicators.
- [x] Task 56: Add maxLength to CustomerNotes.tsx -- Added character count indicators (length/1000) to both the add-note and edit-note Textarea elements, matching the OrderNotesSection pattern.
- [x] Task 57: Validate UUID param in OrderDetailsPage.tsx -- Added isValidUUID check on orderId from useParams; invalid UUIDs resolve to undefined, preventing bad DB queries and showing "Order Not Found" page.
- [x] Task 58: Validate UUID param in ProductDetailsPage.tsx -- Added isValidUUID check on productId from useParams; invalid UUIDs resolve to undefined, preventing bad DB queries and showing "Product not found" page.
- [x] Task 59: Validate UUID param in CustomerDetails.tsx -- Added isValidUUID check on id from useParams; invalid UUIDs resolve to undefined, preventing bad DB queries and showing "Customer not found" page.
- [x] Task 60: Sanitize search in OrderSearchBar.tsx -- Replaced escapePostgresLike with sanitizeSearchInput from @/lib/sanitizeSearch to trim, limit length, and escape special characters.
- [x] Task 61: Add loading skeleton to DashboardPage.tsx -- Added DashboardPageSkeleton component with section-matched skeleton layout (revenue, orders, customers, inventory). Used for both !tenant and initial load (isLoading && !stats) states.
- [x] Task 62: Add loading skeleton to ProductManagement.tsx -- Replaced simple spinner with view-mode-aware skeleton: grid view shows 8 product card skeletons with image/text/price placeholders, list view shows 6 table row skeletons with checkbox/image/details/badge/price/stock/action placeholders.
- [x] Task 63: Add loading skeleton to Orders.tsx -- Already implemented: full-page skeleton with header, stats grid, controls, and 8-row table skeleton shown during isLoading state (lines 569-644).
- [x] Task 64: Add loading skeleton to ClientsPage.tsx -- Added ClientsPageSkeleton component with section-matched skeleton layout (header, search/filter controls, 6-row table with avatar/name/contact/balance/status/actions, mobile card skeletons). Shown during initial load (isLoading && !clients).
- [x] Task 65: Add loading skeleton to InventoryManagement.tsx -- Replaced EnhancedLoadingState with section-matched skeleton (header, 3 stat cards, warehouse table with 6 rows, mobile card skeletons). Shown during initial load (loading && !products).
- [x] Task 66: Add loading skeleton to InvoicesPage.tsx -- Added InvoicesPageSkeleton component with section-matched skeleton layout (header, 4 stats cards, search/filter controls, 6-row table with mobile card skeletons). Shown during initial load (isLoading && !invoices).
- [x] Task 67: Add loading skeleton to WholesaleOrdersPage.tsx -- Added WholesaleOrdersPageSkeleton component with section-matched skeleton layout (header, 5 stats cards, search/filter controls, 8-col table with 6 rows, mobile card skeletons). Shown during initial load (isLoading && orders.length === 0).
- [x] Task 68: Add loading skeleton to CashRegister.tsx -- Already implemented: full-page skeleton with header, quick-add product grid (8 items), and two-column layout (transaction card with input/items/buttons + recent transactions card with 4 entries). Shown during initial isLoading state.
- [x] Task 69: Add loading skeleton to CustomerDetails.tsx -- Replaced simple spinner with section-matched skeleton (header with avatar/name/contact, 4 stats cards, tabs with contact card and activity timeline placeholders). Shown during initial load.
- [x] Task 70: Add loading skeleton to OrderDetailsPage.tsx -- Replaced basic skeleton with section-matched skeleton (header with back button/title/badge/action buttons, 2-col grid with status timeline steps and order items table on left, sidebar with order info/customer info/activity timeline cards on right). Shown during initial isLoading state.
- [x] Task 71: Add empty state to ProductManagement.tsx -- Already implemented: EnhancedEmptyState with contextual messaging (filter active vs no products), Package icon, "Add Product" primary action, and designSystem="tenant-admin".
- [x] Task 72: Add empty state to Orders.tsx -- Already implemented: ResponsiveTable emptyState prop renders EnhancedEmptyState with contextual messaging (search/filter/no orders), ShoppingBag icon, "Create First Order" or "Clear Filters" primary action, "Create a Menu" secondary action, designSystem="tenant-admin".
- [x] Task 73: Add empty state to ClientsPage.tsx -- Already implemented: ResponsiveTable emptyState prop with contextual messaging (search vs no clients), Users icon, "Add Your First Client" primary action with Plus icon, "Clear Search" action for filtered results.
- [x] Task 74: Add empty state to InvoicesPage.tsx -- Already implemented: EnhancedEmptyState with contextual messaging (search/filter vs no invoices), FileText icon, "Create Invoice" or "Clear Filters" primary action, compact and designSystem="tenant-admin", in both mobile and desktop views.
- [x] Task 75: Add empty state to WholesaleOrdersPage.tsx -- Enhanced ResponsiveTable emptyState with contextual messaging (search/filter/no orders), Package icon, "Clear Filters" or "New Order"/"New PO" primary action based on filter state, designSystem="tenant-admin".
- [x] Task 76: Add empty state to PurchaseOrders.tsx -- Replaced basic inline empty state with EnhancedEmptyState component with contextual messaging (search/filter/no data), Package icon, "Clear Filters" or "New Purchase Order" primary action, compact and designSystem="tenant-admin".
- [x] Task 77: Add empty state to StockAlerts.tsx -- Added compact and designSystem="tenant-admin" props to existing EnhancedEmptyState, plus "Refresh Alerts" primary action with RefreshCw icon.
- [x] Task 78: Add empty state to SupportTicketsPage.tsx -- Added EnhancedEmptyState with contextual messaging (search/filter/no tickets), MessageSquare icon, "Clear Filters" or "New Ticket" primary action based on filter state, compact and designSystem="tenant-admin".
- [x] Task 79: Add empty state to VendorManagement.tsx -- Replaced inline empty state with EnhancedEmptyState component with Package icon, "Add Vendor" primary action with Plus icon, compact and designSystem="tenant-admin".
- [x] Task 80: Add empty state to DisposableMenus.tsx -- Enhanced ResponsiveGrid emptyState in SmartDashboard with contextual messaging (search/filter/no menus), Link icon, "Clear Filters" or "Create Menu" primary action based on filter state, compact and designSystem="tenant-admin".
- [x] Task 81: Add toast notifications to ProductManagement mutations -- Already implemented: all mutations (create, update, delete, publish, inline edit, batch delete, scan) use toast from sonner with success/error/warning notifications.
- [x] Task 82: Add toast notifications to CustomerManagement mutations -- Already implemented: all mutations (delete, export, import, create, update, notes CRUD) use toast from sonner with success/error notifications.
- [ ] Task 83: Add toast notifications to InvoicesPage mutations -- 
- [ ] Task 84: Add toast notifications to VendorManagement mutations -- 
- [ ] Task 85: Improve mobile responsiveness on DashboardPage.tsx -- 
- [ ] Task 86: Improve mobile responsiveness on Orders.tsx -- 
- [ ] Task 87: Improve mobile responsiveness on ClientsPage.tsx -- 
- [ ] Task 88: Improve mobile responsiveness on ProductManagement.tsx -- 
- [ ] Task 89: Improve mobile responsiveness on CashRegister.tsx -- 
- [ ] Task 90: Improve mobile responsiveness on CustomerDetails.tsx -- 
- [ ] Task 91: Add breadcrumb to OrderDetailsPage.tsx -- Add breadcrumb: Dashboard > Orders > Order #XYZ using Breadcrumbs
      component.
- [ ] Task 92: Add breadcrumb to ProductDetailsPage.tsx -- Add breadcrumb: Dashboard > Products > Product Name.
- [ ] Task 93: Add breadcrumb to CustomerDetails.tsx -- Add breadcrumb: Dashboard > Customers > Customer Name.
- [ ] Task 94: Add breadcrumb to VendorDetailPage.tsx -- Add breadcrumb: Dashboard > Vendors > Vendor Name.
- [ ] Task 95: Add breadcrumb to InvoiceDetailPage.tsx -- Add breadcrumb: Dashboard > Invoices > Invoice #XYZ.
- [ ] Task 96: Add confirmation dialog to product delete -- 
- [ ] Task 97: Add confirmation dialog to customer delete -- 
- [ ] Task 98: Add confirmation dialog to order cancel -- 
- [ ] Task 99: Add confirmation dialog to invoice void -- 
- [ ] Task 100: Add confirmation dialog to vendor delete -- 
- [ ] Task 101: Add aria-labels to OrderRow actions -- 
- [ ] Task 102: Add aria-labels to ProductCard actions -- 
- [ ] Task 103: Add aria-labels to CustomerRow actions -- 
- [ ] Task 104: Add hover transitions to ProductCard.tsx -- 
- [ ] Task 105: Add hover transitions to OrderRow.tsx -- 
- [ ] Task 106: Add hover transitions to CustomerRow.tsx -- 
- [ ] Task 107: Add text truncation with tooltips to OrderRow.tsx -- 
- [ ] Task 108: Add text truncation with tooltips to ProductCard.tsx -- 
- [ ] Task 109: Add consistent icons in DashboardPage.tsx -- 
- [ ] Task 110: Create PageTransition wrapper component -- 
- [ ] Task 111: Add optimistic update to product mutations -- 
- [ ] Task 112: Add optimistic update to order status mutations -- 
- [ ] Task 113: Add optimistic update to customer mutations -- 
- [ ] Task 114: Add retry logic to product queries -- In useProduct.ts add retry: 2 and retryDelay: 1000 to useQuery options.
- [ ] Task 115: Add retry logic to order queries -- In order list query hook add retry: 2 and retryDelay: 1000 to
      useQuery options.
- [ ] Task 116: Add staleTime to DashboardPage queries -- Add staleTime: 30_000 (30 seconds) to all dashboard stat queries.
- [ ] Task 117: Add staleTime to ProductManagement queries -- Add staleTime: 60_000 (1 minute) to product list queries.
- [ ] Task 118: Add staleTime to CustomerManagement queries -- Add staleTime: 60_000 to customer list queries.
- [ ] Task 119: Add staleTime to InvoicesPage queries -- Add staleTime: 60_000 to invoice list queries.
- [ ] Task 120: Add staleTime to WholesaleOrdersPage queries -- Add staleTime: 60_000 to wholesale order queries.
- [ ] Task 121: Ensure queryKeys factory in DashboardPage.tsx -- 
- [ ] Task 122: Ensure queryKeys factory in ProductManagement.tsx -- 
- [ ] Task 123: Ensure queryKeys factory in CustomerManagement.tsx -- 
- [ ] Task 124: Ensure queryKeys factory in InvoicesPage.tsx -- 
- [ ] Task 125: Ensure queryKeys factory in VendorManagement.tsx -- 
- [ ] Task 126: Add background refetch indicator to Orders.tsx -- 
- [ ] Task 127: Add background refetch indicator to ProductManagement.tsx -- 
- [ ] Task 128: Add background refetch indicator to ClientsPage.tsx -- 
- [ ] Task 129: Add CSV export to Orders.tsx -- 
- [ ] Task 130: Add CSV export to ProductManagement.tsx -- 
- [ ] Task 131: Add CSV export to ClientsPage.tsx -- 
- [ ] Task 132: Add CSV export to InvoicesPage.tsx -- 
- [ ] Task 133: Add CSV export to InventoryManagement.tsx -- 
- [ ] Task 134: Add bulk select to Orders.tsx -- 
- [ ] Task 135: Add bulk select to ProductManagement.tsx -- 
- [ ] Task 136: Add bulk select to ClientsPage.tsx -- 
- [ ] Task 137: Add filter presets to Orders.tsx -- 
- [ ] Task 138: Add filter presets to ProductManagement.tsx -- 
- [ ] Task 139: Add prefetch on hover for product rows -- 
- [ ] Task 140: Add prefetch on hover for order rows -- 
- [ ] Task 141: Add prefetch on hover for customer rows -- 
- [ ] Task 142: Add realtime subscription for order status -- 
- [ ] Task 143: Add realtime subscription for inventory changes -- 
- [ ] Task 144: Add audit logging to product mutations -- 
- [ ] Task 145: Add audit logging to order mutations -- 
- [ ] Task 146: Add audit logging to customer mutations -- 
- [ ] Task 147: Add column visibility to Orders table -- Add column visibility dropdown toggling optional columns: source,
      payment method, notes.
- [ ] Task 148: Add column visibility to Products table -- 
- [ ] Task 149: Add pagination page-size to Orders.tsx -- 
- [ ] Task 150: Add pagination page-size to ProductManagement.tsx -- 
- [ ] Task 151: Implement POS refund entry in CashRegister.tsx -- 
- [ ] Task 152: Create POSRefundSearch component -- 
- [ ] Task 153: Create POSRefundItemSelector component -- 
- [ ] Task 154: Create POSRefundConfirmDialog component -- 
- [ ] Task 155: Create useProcessRefund hook -- 
- [ ] Task 156: Add discount code input to POS cart -- 
- [ ] Task 157: Add percentage discount button to POS -- 
- [ ] Task 158: Add tax calculation display to POS -- 
- [ ] Task 159: Add cart item quantity edit to POS -- 
- [ ] Task 160: Add cart item remove button to POS -- 
- [ ] Task 161: Add low stock warning in POS cart -- 
- [ ] Task 162: Add POS product category tabs -- 
- [ ] Task 163: Add receipt print button to POS -- 
- [ ] Task 164: Add receipt email option to POS -- 
- [ ] Task 165: Wire POSCustomerSelector to sale flow -- 
- [ ] Task 166: Create POSTransactionHistory component -- 
- [ ] Task 167: Add transaction history tab to CashRegister -- 
- [ ] Task 168: Add split payment support to POS -- 
- [ ] Task 169: Add barcode scanner input to POS -- 
- [ ] Task 170: Add keyboard shortcut F2 for POS payment -- 
- [ ] Task 171: Add keyboard shortcut F4 for POS clear cart -- 
- [ ] Task 172: Add keyboard shortcut F3 for POS search focus -- 
- [ ] Task 173: Add POS offline mode indicator -- 
- [ ] Task 174: Add sound effect for POS scan success -- 
- [ ] Task 175: Add sound effect for POS payment complete -- 
- [ ] Task 176: Create POSHeldOrders component -- 
- [ ] Task 177: Wire POS session open/close flow -- 
- [ ] Task 178: Create POSDailySummary widget -- 
- [ ] Task 179: Wire cash drawer trigger -- 
- [ ] Task 180: Add POS quick-add favorites -- 
- [ ] Task 181: Add low-stock threshold input to ProductDetailsPage -- 
- [ ] Task 182: Wire LowStockAlert to DashboardPage -- 
- [ ] Task 183: Wire LowStockBanner to ProductManagement -- 
- [ ] Task 184: Wire InventoryHistoryTimeline to ProductDetailsPage -- 
- [ ] Task 185: Wire StockAdjustmentDialog to ProductDetailsPage -- 
- [ ] Task 186: Wire StockHistoryLog to StockHistoryPage -- 
- [ ] Task 187: Wire StockTransfer to InventoryTransfers -- 
- [ ] Task 188: Wire QuickReceiving to InventoryManagement -- 
- [ ] Task 189: Wire ProductBulkImportDialog to ProductManagement -- 
- [ ] Task 190: Wire ProductBulkExportDialog to ProductManagement -- 
- [ ] Task 191: Wire BulkPriceEditor to ProductManagement -- 
- [ ] Task 192: Wire BatchCategoryEditor to ProductManagement -- 
- [ ] Task 193: Add strain info fields to product form -- 
- [ ] Task 194: Wire DuplicateProductButton to ProductManagement -- 
- [ ] Task 195: Wire ProductArchiveButton to ProductManagement -- 
- [ ] Task 196: Wire ProductQRGenerator to ProductDetailsPage -- 
- [ ] Task 197: Wire ProductLabel to ProductDetailsPage -- 
- [ ] Task 198: Wire ProductTagsInput to product form -- 
- [ ] Task 199: Add cost and margin display to ProductDetailsPage -- 
- [ ] Task 200: Wire ProductHoverCard to ProductManagement rows -- 
- [ ] Task 201: Wire InlineStockEdit to ProductManagement -- 
- [ ] Task 202: Wire InlineProductEdit to ProductManagement -- 
- [ ] Task 203: Wire ProductFilters to ProductManagement -- 
- [ ] Task 204: Add unit conversion to ProductDetailsPage -- 
- [ ] Task 205: Wire ValuationReport to InventoryManagement -- 
- [ ] Task 206: Wire MovementReport to InventoryManagement -- 
- [ ] Task 207: Wire InventoryAlertsDashboard to InventoryDashboard -- 
- [ ] Task 208: Wire LowStockToPODialog to StockAlerts -- 
- [ ] Task 209: Wire FileUploadZone for product images -- 
- [ ] Task 210: Create product categories management page -- 
- [ ] Task 211: Add CSRF token to CreateClientDialog -- 
- [ ] Task 212: Add CSRF token to EditClientDialog -- 
- [ ] Task 213: Add CSRF token to CustomerForm -- 
- [ ] Task 214: Add CSRF token to CreateOrderPage -- 
- [ ] Task 215: Add CSRF token to CreateInvoicePage -- 
- [ ] Task 216: Add rate limiting indicator to login page -- 
- [ ] Task 217: Create SessionTimeoutWarning component -- 
- [ ] Task 218: Add password strength meter to signup -- 
- [ ] Task 219: Create TwoFactorSetup UI component -- 
- [ ] Task 220: Wire AuditTrail page with data -- 
- [ ] Task 221: Add role-based sidebar visibility -- 
- [ ] Task 222: Create handleRLSError utility -- 
- [ ] Task 223: Add compliance report generation -- 
- [ ] Task 224: Add data retention policy display -- 
- [ ] Task 225: Add GDPR customer data export -- 
- [ ] Task 226: Add IP access logging display -- 
- [ ] Task 227: Add PermissionGuard to RoleManagement -- 
- [ ] Task 228: Add PermissionGuard to TeamManagement -- 
- [ ] Task 229: Add PermissionGuard to SettingsPage -- 
- [ ] Task 230: Add PermissionGuard to DataExport -- 
- [ ] Task 231: Wire OrderEmailButton to OrderDetailsPage -- 
- [ ] Task 232: Wire OrderSMSButton to OrderDetailsPage -- 
- [ ] Task 233: Wire OrderTotalsCard to OrderDetailsPage -- 
- [ ] Task 234: Wire OrderItemsTable to OrderDetailsPage -- 
- [ ] Task 235: Wire OrderCancelModal to OrderDetailsPage -- 
- [ ] Task 236: Wire OrderDiscountModal to OrderDetailsPage -- 
- [ ] Task 237: Implement order status state machine -- 
- [ ] Task 238: Wire status state machine to StatusDropdown -- 
- [ ] Task 239: Add order priority flag to Orders list -- 
- [ ] Task 240: Add order payment status badge to Orders list -- 
- [ ] Task 241: Add React.lazy to DashboardPage route -- 
- [ ] Task 242: Add React.lazy to OrderDetailsPage route -- 
- [ ] Task 243: Add React.lazy to ProductDetailsPage route -- 
- [ ] Task 244: Add React.lazy to CashRegister route -- 
- [ ] Task 245: Add React.lazy to AnalyticsPage route -- 
- [ ] Task 246: Add React.memo to ProductCard -- 
- [ ] Task 247: Add React.memo to OrderRow -- 
- [ ] Task 248: Add React.memo to CustomerRow -- 
- [ ] Task 249: Add JSDoc to usePOSSale hook -- 
- [ ] Task 250: Create environment variable validation -- 
- [ ] Task 251: Wire WholesaleOrderDetailPage with full order data -- 
- [ ] Task 252: Add wholesale pricing tiers to product form -- Add pricing tier inputs: 1-10 units price, 11-50 units price, 50+
      units price. Save to products table.
- [ ] Task 253: Create wholesale price calculator component -- 
- [ ] Task 254: Add wholesale client credit limit to client form -- 
- [ ] Task 255: Create wholesale order approval workflow -- 
- [ ] Task 256: Wire WholesaleInvoiceGenerator -- 
- [ ] Task 257: Add wholesale minimum order enforcement -- 
- [ ] Task 258: Create wholesale client payment terms display -- 
- [ ] Task 259: Add wholesale order recurring schedule -- Option to create recurring orders: weekly/biweekly/monthly.
      Auto-generate next order.
- [ ] Task 260: Wire wholesale client address book -- 
- [ ] Task 261: Create wholesale catalog PDF export -- 
- [ ] Task 262: Add wholesale client sales rep assignment -- 
- [ ] Task 263: Create wholesale order quick reorder -- 
- [ ] Task 264: Add wholesale client communication log -- 
- [ ] Task 265: Wire wholesale order shipping labels -- 
- [ ] Task 266: Create wholesale client onboarding checklist -- Checklist: license verified, credit check done, terms agreed,
      first order placed. Track per client.
- [ ] Task 267: Add wholesale order line item notes -- 
- [ ] Task 268: Create wholesale pricing history chart -- 
- [ ] Task 269: Add wholesale order delivery scheduling -- 
- [ ] Task 270: Create wholesale client dashboard widget -- Dashboard card showing: active clients, orders this month,
      revenue, overdue invoices count.
- [ ] Task 271: Wire wholesale sample order flow -- 
- [ ] Task 272: Add wholesale client license verification -- 
- [ ] Task 273: Create wholesale order packing slip -- 
- [ ] Task 274: Add wholesale client discount rules -- 
- [ ] Task 275: Create wholesale order status notifications -- 
- [ ] Task 276: Add menu item reordering with drag and drop -- 
- [ ] Task 277: Create menu template system -- 
- [ ] Task 278: Add menu scheduling with start/end dates -- 
- [ ] Task 279: Add menu item price overrides -- 
- [ ] Task 280: Create menu preview component -- 
- [ ] Task 281: Add menu category sections -- 
- [ ] Task 282: Wire menu analytics dashboard -- 
- [ ] Task 283: Add menu item stock status badges -- 
- [ ] Task 284: Create menu bulk item add -- 
- [ ] Task 285: Add menu custom branding section -- 
- [ ] Task 286: Create disposable menu burn analytics -- Track: times shared, times viewed, times burned, average time to burn.
- [ ] Task 287: Add menu QR code generator -- 
- [ ] Task 288: Create menu item description editor -- 
- [ ] Task 289: Add menu access password protection -- 
- [ ] Task 290: Wire menu share via SMS/Email -- 
- [ ] Task 291: Create menu duplicate function -- 
- [ ] Task 292: Add menu item image gallery -- 
- [ ] Task 293: Create menu comparison view -- 
- [ ] Task 294: Add menu expiration warning notifications -- 
- [ ] Task 295: Wire menu client targeting -- 
- [ ] Task 296: Create recurring invoice system -- 
- [ ] Task 297: Add invoice payment reminder automation -- 
- [ ] Task 298: Wire invoice partial payment tracking -- 
- [ ] Task 299: Create invoice credit note system -- 
- [ ] Task 300: Add invoice late fee calculation -- 
- [ ] Task 301: Wire invoice email sending with PDF attachment -- 
- [ ] Task 302: Create invoice payment link generation -- 
- [ ] Task 303: Add invoice notes and terms editor -- 
- [ ] Task 304: Wire invoice batch generation from orders -- 
- [ ] Task 305: Create invoice aging report -- Report showing invoices by age: current, 1-30, 31-60, 61-90, 90+
      days. Totals per bucket.
- [ ] Task 306: Add invoice tax configuration per tenant -- 
- [ ] Task 307: Create invoice dispute workflow -- 
- [ ] Task 308: Wire invoice to wholesale order linking -- 
- [ ] Task 309: Add invoice sequence numbering per tenant -- 
- [ ] Task 310: Create invoice dashboard widget -- Widget showing: outstanding total, overdue total, paid this month,
      average days to pay.
- [ ] Task 311: Add invoice currency formatting -- 
- [ ] Task 312: Wire invoice print-optimized layout -- 
- [ ] Task 313: Create invoice template customization -- 
- [ ] Task 314: Add invoice payment method tracking -- 
- [ ] Task 315: Wire invoice CSV/Excel export -- 
- [ ] Task 316: Create customer segmentation system -- Segment customers by: total spend, order frequency, last order
      date, location. Auto-assign tags.
- [ ] Task 317: Add customer loyalty points system -- 
- [ ] Task 318: Wire customer purchase history chart -- 
- [ ] Task 319: Create customer notes with mentions -- 
- [ ] Task 320: Add customer preferred products list -- 
- [ ] Task 321: Create customer birthday/anniversary tracking -- 
- [ ] Task 322: Wire customer merge duplicate records -- 
- [ ] Task 323: Add customer credit balance system -- 
- [ ] Task 324: Create customer communication preferences -- Track: email opt-in, SMS opt-in, preferred contact method. Respect
      in notifications.
- [ ] Task 325: Wire customer lifetime value calculation -- 
- [ ] Task 326: Add customer risk score indicator -- Score based on: payment history, order cancellations, disputes.
      Visual indicator on list.
- [ ] Task 327: Create customer group pricing rules -- 
- [ ] Task 328: Wire customer order frequency alerts -- 
- [ ] Task 329: Add customer document storage -- Upload docs per customer: licenses, contracts, ID. View/download
      from detail page.
- [ ] Task 330: Create customer referral tracking -- 
- [ ] Task 331: Wire customer tag management -- 
- [ ] Task 332: Add customer address management -- 
- [ ] Task 333: Create customer engagement score -- 
- [ ] Task 334: Wire customer export with all data -- 
- [ ] Task 335: Add customer quick actions dropdown -- Dropdown per customer row: create order, send menu, add note, view
      details, export.
- [ ] Task 336: Create customer import from CSV -- 
- [ ] Task 337: Wire customer activity feed -- Timeline on detail page: orders, notes, status changes,
      communications. Most recent first.
- [ ] Task 338: Add customer payment terms per client -- 
- [ ] Task 339: Create customer satisfaction survey stub -- 
- [ ] Task 340: Wire customer dashboard overview widget -- Dashboard widget: total customers, new this month, churn rate, top
      spender.
- [ ] Task 341: Create delivery zone visual map editor -- 
- [ ] Task 342: Add delivery fee calculation by zone -- 
- [ ] Task 343: Wire delivery driver assignment panel -- 
- [ ] Task 344: Create delivery batch optimization -- 
- [ ] Task 345: Add delivery time estimation -- 
- [ ] Task 346: Wire delivery proof of delivery system -- 
- [ ] Task 347: Create delivery exception handling -- Report exceptions: wrong address, no answer, refused. Track
      resolution. Admin alerts.
- [ ] Task 348: Add delivery driver location tracking -- 
- [ ] Task 349: Wire delivery SLA monitoring -- 
- [ ] Task 350: Create delivery cost tracking -- Track cost per delivery: driver pay, fuel, time. Calculate margin
      per delivery.
- [ ] Task 351: Add delivery scheduling calendar -- 
- [ ] Task 352: Wire delivery customer notifications -- Auto-notify: driver assigned, en route, arriving soon, delivered.
      Via SMS stub.
- [ ] Task 353: Create delivery returns processing -- 
- [ ] Task 354: Add delivery vehicle management -- Track vehicles: type, capacity, registration. Assign vehicles to drivers.
- [ ] Task 355: Wire delivery daily summary report -- End-of-day summary: deliveries completed, revenue, avg time,
      exceptions. Auto-generate.
- [ ] Task 356: Create delivery tips tracking -- 
- [ ] Task 357: Add delivery priority levels -- 
- [ ] Task 358: Wire delivery geofence notifications -- 
- [ ] Task 359: Create delivery compliance checklist -- Pre-delivery checklist: ID verified, package sealed, receipt
      included. Mark per delivery.
- [ ] Task 360: Add delivery weather integration stub -- 
- [ ] Task 361: Wire delivery insurance tracking -- 
- [ ] Task 362: Create delivery manifest printout -- Print daily manifest: all deliveries with addresses, items,
      special instructions.
- [ ] Task 363: Add delivery customer rating system -- 
- [ ] Task 364: Wire delivery analytics dashboard -- Charts: deliveries per day, avg time trend, driver utilization,
      zone heatmap.
- [ ] Task 365: Create delivery window slot management -- 
- [ ] Task 366: Create revenue analytics dashboard -- 
- [ ] Task 367: Add order analytics with funnel -- 
- [ ] Task 368: Wire product performance report -- 
- [ ] Task 369: Create customer acquisition report -- 
- [ ] Task 370: Add financial summary dashboard -- P&L summary: revenue, COGS, gross margin, expenses. Monthly comparison.
- [ ] Task 371: Wire inventory valuation report -- 
- [ ] Task 372: Create driver performance scoreboard -- Leaderboard: deliveries, avg time, rating, on-time %. Weekly reset
      option.
- [ ] Task 373: Add peak hours heatmap -- 
- [ ] Task 374: Wire tax collection report -- 
- [ ] Task 375: Create KPI dashboard with targets -- 
- [ ] Task 376: Add profit margin analysis by product -- Calculate margin per product: price - cost. Sort by margin %.
      Highlight low margin.
- [ ] Task 377: Wire cash flow forecast chart -- 
- [ ] Task 378: Create menu performance analytics -- 
- [ ] Task 379: Add geographic sales heatmap -- 
- [ ] Task 380: Wire payment collection report -- 
- [ ] Task 381: Create customer retention cohort analysis -- 
- [ ] Task 382: Add daily operations summary email -- Auto-generate daily summary: orders, revenue, deliveries, issues.
      Email to admin stub.
- [ ] Task 383: Wire year-over-year comparison charts -- 
- [ ] Task 384: Create custom report builder -- 
- [ ] Task 385: Add analytics data export to Excel -- 
- [ ] Task 386: Wire real-time sales ticker -- 
- [ ] Task 387: Create inventory turnover report -- 
- [ ] Task 388: Add discount impact analysis -- Track discount usage: codes used, revenue impact, margin effect.
- [ ] Task 389: Wire refund and return analytics -- 
- [ ] Task 390: Create ABC inventory classification -- 
- [ ] Task 391: Create tenant general settings page -- 
- [ ] Task 392: Add notification preferences settings -- Toggle email/SMS for: new orders, low stock, deliveries, payments.
      Per-user settings.
- [ ] Task 393: Wire billing and subscription management -- 
- [ ] Task 394: Create tax settings configuration -- 
- [ ] Task 395: Add business hours configuration -- 
- [ ] Task 396: Wire integration settings page -- List available integrations: payment, SMS, email, accounting.
      Configure API keys.
- [ ] Task 397: Create receipt template customization -- Customize POS receipt: logo, header text, footer text. Preview
      before save.
- [ ] Task 398: Add order status workflow customization -- 
- [ ] Task 399: Wire data backup and export settings -- 
- [ ] Task 400: Create delivery settings page -- 
- [ ] Task 401: Add POS terminal settings -- Configure: receipt printer, cash drawer, barcode scanner, tax
      display. Per-terminal.
- [ ] Task 402: Wire email template customization -- 
- [ ] Task 403: Create product default settings -- 
- [ ] Task 404: Add user profile settings page -- 
- [ ] Task 405: Wire API key management settings -- 
- [ ] Task 406: Create webhook configuration page -- Configure webhook URLs for events: order created, payment
      received, stock low.
- [ ] Task 407: Add white-label branding settings -- 
- [ ] Task 408: Wire payment gateway configuration -- Configure payment processors: Stripe, Square stubs. Test/live mode
      toggle.
- [ ] Task 409: Create SEO settings for storefront -- 
- [ ] Task 410: Add feature flag management UI -- 
- [ ] Task 411: Build storefront product detail page -- 
- [ ] Task 412: Build storefront shopping cart drawer -- 
- [ ] Task 413: Build storefront checkout flow -- Steps: contact info, delivery address, time selection, review,
      place order. Guest checkout.
- [ ] Task 414: Build storefront order confirmation page -- 
- [ ] Task 415: Build storefront order tracking page -- 
- [ ] Task 416: Build storefront age verification gate -- 
- [ ] Task 417: Build storefront header component -- 
- [ ] Task 418: Build storefront footer component -- 
- [ ] Task 419: Wire storefront theme from tenant settings -- 
- [ ] Task 420: Build storefront closed/not-found states -- 
- [ ] Task 421: Add storefront product search with filters -- 
- [ ] Task 422: Build storefront promotions display -- 
- [ ] Task 423: Add storefront real-time stock status -- 
- [ ] Task 424: Build storefront customer order history -- 
- [ ] Task 425: Wire storefront SEO meta tags -- 
- [ ] Task 426: Build storefront mobile PWA config -- 
- [ ] Task 427: Add storefront product review display -- 
- [ ] Task 428: Wire storefront analytics tracking -- 
- [ ] Task 429: Build storefront product category pages -- 
- [ ] Task 430: Add storefront delivery zone checker -- 
- [ ] Task 431: Wire storefront cookie consent banner -- 
- [ ] Task 432: Build storefront product comparison -- Compare 2-3 products side by side: price, THC, strain, effects.
- [ ] Task 433: Add storefront wishlist/save for later -- 
- [ ] Task 434: Wire storefront social sharing buttons -- 
- [ ] Task 435: Build storefront loyalty rewards display -- 
- [ ] Task 436: Create in-app notification center -- 
- [ ] Task 437: Wire order status change notifications -- 
- [ ] Task 438: Add low stock alert notifications -- 
- [ ] Task 439: Create delivery alert notifications -- Notify on: late delivery, driver offline, delivery exception, completion.
- [ ] Task 440: Wire payment received notification -- 
- [ ] Task 441: Add driver status change notifications -- 
- [ ] Task 442: Create notification preferences per user -- 
- [ ] Task 443: Wire notification sound alerts -- 
- [ ] Task 444: Add notification digest email -- 
- [ ] Task 445: Create notification templates manager -- Admin edits notification text templates. Variables:
      {customer_name}, {order_id}, etc.
- [ ] Task 446: Wire expiring menu notifications -- 
- [ ] Task 447: Add new customer signup notification -- 
- [ ] Task 448: Create system maintenance notifications -- 
- [ ] Task 449: Wire invoice overdue notifications -- 
- [ ] Task 450: Add team member mention notifications -- 
- [ ] Task 451: Create notification history page -- 
- [ ] Task 452: Wire realtime notification via Supabase -- 
- [ ] Task 453: Add notification badge counts per section -- Sidebar badges: orders (pending count), deliveries (active),
      invoices (overdue).
- [ ] Task 454: Create notification action buttons -- In notifications: View Order, Assign Driver, Approve. Quick action
      without navigation.
- [ ] Task 455: Wire notification deduplication -- 
- [ ] Task 456: Build tenant onboarding wizard -- After first login: business setup, add products, set delivery
      zones, preview storefront.
- [ ] Task 457: Create contextual help tooltips -- 
- [ ] Task 458: Build admin quick-start checklist widget -- Dashboard checklist: profile done, product added, zone set, first
      order. Progress %.
- [ ] Task 459: Add feature tour for new users -- 
- [ ] Task 460: Create in-app changelog -- 
- [ ] Task 461: Build keyboard shortcuts help dialog -- 
- [ ] Task 462: Add empty dashboard welcome screen -- 
- [ ] Task 463: Create sample data generator for demo -- Button to populate demo data: products, orders, customers. For
      trial accounts.
- [ ] Task 464: Wire documentation links in settings -- 
- [ ] Task 465: Add interactive product tour -- Guided tour: create product, add to menu, share with customer.
      Highlight UI elements.
- [ ] Task 466: Create getting started video embeds -- 
- [ ] Task 467: Build status page indicator -- 
- [ ] Task 468: Add feedback widget -- Floating feedback button. Form: type (bug/feature/other),
      description. Submit to Supabase.
- [ ] Task 469: Create admin role descriptions page -- 
- [ ] Task 470: Wire contextual search in help -- 
- [ ] Task 471: Build global error boundary with recovery -- 
- [ ] Task 472: Create offline detection banner -- 
- [ ] Task 473: Add form autosave to prevent data loss -- 
- [ ] Task 474: Wire Supabase connection error handler -- 
- [ ] Task 475: Create request timeout handler -- 
- [ ] Task 476: Add concurrent edit detection -- 
- [ ] Task 477: Wire graceful degradation for features -- 
- [ ] Task 478: Create error report submission -- 
- [ ] Task 479: Add 404 page for invalid routes -- 
- [ ] Task 480: Wire session expiry handling -- 
- [ ] Task 481: Create mutation queue for offline mode -- 
- [ ] Task 482: Add file upload error handling -- Handle: too large, wrong type, network fail. Show specific error.
      Retry option.
- [ ] Task 483: Wire rate limit error display -- 
- [ ] Task 484: Create data validation error display -- 
- [ ] Task 485: Add app crash recovery -- 
- [ ] Task 486: Create admin activity feed -- Dashboard widget showing recent team activity: who did what and when.
- [ ] Task 487: Add admin quick actions toolbar -- Floating toolbar with: new order, new product, new customer, new
      menu shortcuts.
- [ ] Task 488: Wire admin dashboard widget customization -- 
- [ ] Task 489: Create admin multi-tab support -- 
- [ ] Task 490: Add admin recent items list -- Show recently viewed: orders, products, customers. Quick
      navigation. In sidebar.
- [ ] Task 491: Wire admin saved searches -- 
- [ ] Task 492: Create admin task list widget -- To-do list for admin: pending approvals, expiring items, overdue
      invoices.
- [ ] Task 493: Add admin dark mode toggle -- 
- [ ] Task 494: Wire admin print layout for all pages -- 
- [ ] Task 495: Create admin data import wizard -- Step-by-step import: upload file, map columns, validate, preview,
      import. For any entity.
- [ ] Task 496: Add admin bulk email to customers -- 
- [ ] Task 497: Wire admin calendar view for orders -- 
- [ ] Task 498: Create admin global search enhancement -- Search across all entities: orders, products, customers, invoices.
      Grouped results.
- [ ] Task 499: Add admin session management page -- 
- [ ] Task 500: Wire admin keyboard navigation -- 
