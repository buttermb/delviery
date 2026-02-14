# FloraIQ Ultimate UI/UX Implementation Checklist

> **Priority Legend:**
> - 🔴 P0 - Critical (Launch blocker)
> - 🟠 P1 - High (Week 1-2)
> - 🟡 P2 - Medium (Week 3-4)
> - 🟢 P3 - Nice to have (Post-launch)

---

## 1. FOUNDATION & DESIGN SYSTEM

### 1.1 Design Tokens
- [x] 🔴 Define color palette (primary, secondary, success, warning, error, neutral)
- [x] 🔴 Define typography scale (headings h1-h6, body, caption, overline)
- [x] 🔴 Define spacing scale (4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px)
- [x] 🔴 Define border radius scale (none, sm, md, lg, full)
- [x] 🔴 Define shadow scale (none, sm, md, lg, xl)
- [x] 🟠 Define transition/animation tokens (duration, easing)
- [x] 🟠 Define z-index scale (dropdown, sticky, modal, toast, tooltip)
- [x] 🟡 Create dark mode color variants
- [ ] 🟡 Document all tokens in Storybook or style guide

### 1.2 Component Library
- [x] 🔴 Button (primary, secondary, outline, ghost, destructive, sizes, loading state)
- [x] 🔴 Input (text, number, password, textarea, with label, with error, with helper)
- [x] 🔴 Select (single, multi, searchable, creatable)
- [x] 🔴 Checkbox & Radio (single, group, with label)
- [x] 🔴 Modal/Dialog (sizes, close button, header, footer, scrollable body)
- [x] 🔴 Toast/Notification (success, error, warning, info, with action, auto-dismiss)
- [x] 🔴 Table (sortable, selectable, expandable rows, loading skeleton)
- [x] 🔴 Card (clickable, with header, with footer, with actions)
- [x] 🟠 Dropdown Menu (with icons, with dividers, nested)
- [x] 🟠 Tabs (horizontal, with badges, with icons)
- [x] 🟠 Badge/Tag (colors, sizes, dismissible)
- [x] 🟠 Avatar (sizes, with status indicator, fallback)
- [x] 🟠 Tooltip (positions, with arrow)
- [x] 🟠 Popover (positions, trigger modes)
- [x] 🟠 Progress Bar (determinate, indeterminate, with label)
- [x] 🟠 Skeleton Loader (text, avatar, card, table row)
- [x] 🟡 Date Picker (single, range, with presets)
- [x] 🟡 Time Picker
- [x] 🟡 File Upload (drag & drop, preview, progress)
- [x] 🟡 Slider (single, range, with marks)
- [x] 🟡 Toggle/Switch
- [x] 🟡 Accordion/Collapsible
- [x] 🟡 Breadcrumb
- [x] 🟢 Command Palette
- [x] 🟢 Data Grid (virtualized)

### 1.3 Layout Components
- [x] 🔴 Page Container (max-width, padding, responsive)
- [x] 🔴 Sidebar (collapsible, with sections, active state)
- [x] 🔴 Header (with breadcrumb, with actions, sticky)
- [x] 🔴 Page Header (title, description, actions)
- [x] 🟠 Grid Layout (responsive columns)
- [x] 🟠 Stack (horizontal, vertical, spacing)
- [x] 🟠 Divider (horizontal, vertical, with text)
- [x] 🟡 Split Pane (resizable)
- [x] 🟡 Drawer/Slide-out Panel

### 1.4 Feedback Components
- [x] 🔴 Loading Spinner (sizes)
- [x] 🔴 Empty State (illustration, title, description, action)
- [x] 🔴 Error State (illustration, title, description, retry)
- [x] 🟠 Confirmation Dialog (title, message, cancel, confirm)
- [x] 🟠 Alert Banner (info, warning, error, dismissible)
- [x] 🟡 Stepper/Wizard (horizontal, vertical, with validation)

---

## 2. GLOBAL UX PATTERNS

### 2.1 Navigation
- [x] 🔴 Sidebar navigation with clear hierarchy
- [x] 🔴 Active state clearly visible on current page
- [x] 🔴 Hover states on all interactive elements
- [x] 🔴 Mobile bottom navigation bar
- [x] 🟠 Breadcrumb navigation on nested pages
- [x] 🟠 Back button behavior consistent
- [x] 🟠 Browser history works correctly (back/forward)
- [x] 🟡 Keyboard navigation (Tab, Shift+Tab, Enter, Escape)
- [x] 🟡 Skip to main content link for accessibility
- [x] 🟢 Command palette (Cmd+K) for power users

### 2.2 Forms
- [x] 🔴 All required fields marked with asterisk
- [x] 🔴 Inline validation on blur
- [x] 🔴 Error messages below fields (not just red border)
- [x] 🔴 Submit button disabled until form valid
- [x] 🔴 Loading state on submit button during submission
- [x] 🔴 Success feedback after submission
- [x] 🟠 Auto-save drafts for long forms
- [x] 🟠 Warn before leaving with unsaved changes
- [x] 🟠 Form data preserved on validation error
- [x] 🟠 Tab order logical (not jumping around)
- [x] 🟡 Auto-focus first field on form open
- [x] 🟡 Enter key submits form (when appropriate)
- [ ] 🟢 Smart defaults based on context

### 2.3 Tables & Lists
- [x] 🔴 Responsive - scroll horizontally OR stack on mobile
- [x] 🔴 Loading skeleton (not spinner) while fetching
- [x] 🔴 Empty state with helpful message and CTA
- [x] 🔴 Pagination for large datasets (or infinite scroll)
- [x] 🟠 Sortable columns with clear indicator
- [x] 🟠 Bulk selection with select all
- [x] 🟠 Bulk actions bar when items selected
- [x] 🟠 Row hover state
- [x] 🟠 Row click to view detail (not requiring link click)
- [x] 🟡 Column visibility toggle
- [x] 🟡 Remember sort/filter preferences
- [x] 🟡 Export functionality
- [x] 🟢 Virtualized rendering for 1000+ rows

### 2.4 Search & Filtering
- [x] 🔴 Search input with clear button
- [x] 🔴 Debounced search (300ms delay)
- [x] 🟠 Filter dropdowns with multi-select
- [x] 🟠 Active filters shown as removable chips
- [x] 🟠 "Clear all filters" button
- [x] 🟠 Filter presets (saved searches)
- [x] 🟡 Search across multiple fields
- [x] 🟡 Fuzzy matching for typos
- [x] 🟡 Highlight matches in results
- [x] 🟢 Recent searches

### 2.5 Modals & Dialogs
- [x] 🔴 Close on escape key
- [x] 🔴 Close on backdrop click (unless destructive)
- [x] 🔴 Focus trapped inside modal
- [x] 🔴 Scrollable content if overflow
- [x] 🔴 Primary action button on right
- [x] 🟠 Stacked modals work correctly (rare but needed)
- [x] 🟠 Modal doesn't jump on scroll
- [x] 🟡 Animate in/out smoothly

### 2.6 Toasts & Notifications
- [x] 🔴 Success toasts auto-dismiss (3s)
- [x] 🔴 Error toasts require dismiss
- [x] 🔴 Toasts stack without overlapping
- [x] 🔴 Toasts visible above all content (z-index)
- [x] 🟠 Action button in toast where appropriate
- [x] 🟠 Undo option for destructive actions
- [x] 🟡 Position configurable (top-right, bottom-right)
- [x] 🟡 Limit to max 3 visible toasts

### 2.7 Loading States
- [x] 🔴 Initial page load shows skeleton, not blank
- [x] 🔴 Button shows spinner during action
- [x] 🔴 Disable button during submission (prevent double-click)
- [x] 🟠 Progress bar for multi-step or long operations
- [x] 🟠 Optimistic updates where safe
- [ ] 🟡 Persist last known data while refreshing

### 2.8 Error Handling
- [x] 🔴 Network error shows user-friendly message
- [x] 🔴 Retry button for transient errors
- [x] 🔴 Form errors don't clear user input
- [x] 🔴 404 page with navigation options
- [x] 🟠 Error boundary catches React crashes
- [x] 🟠 Log errors to monitoring service
- [x] 🟡 Offline indicator when connection lost
- [x] 🟡 Queue actions while offline, sync on reconnect

### 2.9 Responsive Design
- [x] 🔴 No horizontal scroll on any screen size
- [x] 🔴 Touch targets minimum 44x44px on mobile
- [x] 🔴 Text readable without zooming (min 16px body)
- [x] 🔴 Forms usable on mobile keyboard
- [x] 🟠 Tables scroll horizontally OR cards stack
- [x] 🟠 Modals full-screen or bottom sheet on mobile
- [x] 🟠 Sidebar collapses to hamburger on mobile
- [x] 🟡 Pull to refresh on mobile lists
- [x] 🟡 Swipe actions on mobile list items

### 2.10 Accessibility
- [x] 🔴 All images have alt text
- [x] 🔴 All form inputs have labels
- [x] 🔴 Color contrast meets WCAG AA (4.5:1)
- [x] 🔴 Focus indicators visible
- [x] 🟠 ARIA labels on icon-only buttons
- [x] 🟠 Screen reader announces dynamic content
- [x] 🟡 Skip navigation link
- [x] 🟡 Reduced motion preference respected
- [x] 🟢 Full keyboard navigability

---

## 3. CREDIT SYSTEM UI

### 3.1 Credit Balance Display
- [x] 🔴 Balance visible in header (free tier only)
- [x] 🔴 Balance hidden for paid tier users
- [x] 🔴 Balance formatted with commas (10,000 not 10000)
- [x] 🔴 Color transitions: green >5000, yellow 1000-5000, orange 500-1000, red <500
- [x] 🟠 Pulse animation on balance decrease
- [x] 🟠 Hover tooltip shows credits used today
- [x] 🟠 Click opens purchase modal or dropdown
- [ ] 🟡 Projected depletion date in tooltip

### 3.2 Credit Deduction Toast
- [x] 🔴 Shows on every credit-consuming action
- [x] 🔴 Shows action name and credits deducted
- [x] 🔴 Shows remaining balance
- [x] 🔴 Auto-dismiss after 2 seconds
- [x] 🟠 Click opens purchase modal
- [x] 🟠 Multiple toasts stack or consolidate
- [x] 🟡 Only shown for free tier users

### 3.3 Credit Cost Badges
- [x] 🔴 Badge next to high-cost action buttons
- [x] 🔴 Shows credit cost (e.g., "75 credits")
- [x] 🔴 Yellow if action leaves balance <1000
- [x] 🔴 Red if insufficient credits
- [x] 🔴 Hidden for paid tier users
- [x] 🟠 Consistent placement across all panels

### 3.4 Insufficient Credits Handling
- [x] 🔴 Block action when balance insufficient
- [x] 🔴 Show clear error with current balance and required credits
- [x] 🔴 Offer to buy credits or upgrade
- [x] 🟠 Don't lose user's work (preserve form data)

### 3.5 Low Credit Warning Modal
- [x] 🔴 Triggers at 1000 credits
- [x] 🔴 Shows once per session (sessionStorage)
- [x] 🔴 Shows current balance and estimated days remaining
- [x] 🔴 Two options: Buy credits, Upgrade (emphasized)
- [x] 🟠 "Remind me later" dismisses for 24 hours
- [ ] 🟠 Shows usage velocity (credits/day)

### 3.6 Out of Credits Modal
- [x] 🔴 Full blocking modal when balance = 0
- [x] 🔴 Explains viewing works but actions paused
- [x] 🔴 Buy credits and Upgrade options
- [x] 🔴 Cannot dismiss without action
- [x] 🟠 Allows navigation (just blocks the action)

### 3.7 Credit Purchase Modal
- [x] 🔴 Display credit packages from database
- [x] 🔴 Show name, credits, price for each package
- [x] 🔴 Highlight "Best Value" option
- [x] 🔴 Stripe checkout integration
- [x] 🟠 Promo code input with Apply button
- [x] 🟠 Show current balance + purchased = new balance
- [x] 🟠 Auto-close on success with confirmation toast
- [x] 🟡 Loading state during Stripe redirect

### 3.8 Credit Usage Stats (Settings > Billing)
- [x] 🔴 Current balance prominently displayed
- [x] 🔴 Credits used today/week/month
- [x] 🟠 Usage breakdown by category (bar chart)
- [x] 🟠 Top 5 credit-consuming actions
- [x] 🟠 Transaction history table (paginated)
- [ ] 🟡 Projected depletion date
- [ ] 🟡 Trends vs previous period

### 3.9 Progressive Upgrade Triggers
- [x] 🔴 Track triggers shown in JSONB field
- [x] 🔴 Each trigger fires max once per defined period
- [x] 🟠 2000 credits: Yellow badge on balance
- [x] 🟠 1000 credits: Warning modal
- [x] 🟠 500 credits: Persistent banner (dismissible)
- [x] 🟠 0 credits: Blocker modal
- [ ] 🟡 3rd menu created: Tooltip suggestion
- [ ] 🟡 10th order: Toast congratulation
- [ ] 🟡 High velocity: Upgrade suggestion

---

## 4. COMMAND CENTER PANELS

### 4.1 Dashboard
- [x] 🔴 Personalized greeting (Good morning/afternoon/evening, [Name])
- [x] 🔴 Today's focus: Orders to process, Revenue today, Alerts
- [x] 🔴 Quick stats cards (4 key metrics)
- [x] 🔴 Loads fast (<2s initial render)
- [x] 🟠 Smart suggestions bar ("You have 5 unpaid tabs...")
- [x] 🟠 Recent activity feed
- [ ] 🟡 Drag-and-drop widget customization
- [ ] 🟡 Widget layout saved per user
- [ ] 🟡 Preset layouts (Sales Focus, Inventory Focus)
- [ ] 🟢 Quick action floating button (N key shortcut)

### 4.2 Hotbox Command Center
- [x] 🔴 Three-column kanban: Urgent, Today, Upcoming
- [x] 🔴 Cards show key info without clicking
- [x] 🔴 Primary action button on each card
- [x] 🔴 Real-time updates (new items appear without refresh)
- [x] 🔴 Badge count in sidebar nav
- [x] 🟠 Swipe right to complete/dismiss (mobile)
- [x] 🟠 Swipe left to snooze (mobile)
- [x] 🟠 Single tap opens detail modal (not new page)
- [x] 🟡 Sound alert for urgent items (optional)
- [x] 🟡 Batch process buttons ("Process all orders")
- [x] 🟡 Drag cards between columns to reprioritize
- [x] 🟢 Keyboard shortcuts for common actions

### 4.3 Live Orders Board
- [x] 🔴 Four-column kanban: New, Preparing, Ready, Delivered
- [x] 🔴 Drag-and-drop to change status
- [x] 🔴 Real-time updates
- [x] 🔴 Order timer showing elapsed time
- [x] 🔴 Timer color: Green <10min, Yellow 10-20min, Red >20min
- [x] 🟠 Click card for quick preview (not full page)
- [x] 🟠 One-click customer contact (call/text)
- [x] 🟠 Sound alert for new orders (optional)
- [x] 🟡 Filter by delivery type, payment status
- [x] 🟡 Undo status change (5 second window)

### 4.4 Live Map
- [x] 🔴 Map shows courier locations
- [x] 🔴 Map shows pending deliveries
- [x] 🔴 Legend explaining marker types
- [x] 🔴 Click marker shows action panel
- [x] 🟠 Clustered markers for dense areas
- [x] 🟠 Different colors: On route, Available, Late
- [x] 🟠 Route overlay for planned delivery path
- [ ] 🟠 Traffic overlay toggle
- [x] 🟡 Side panel list syncs with map (hover highlights)
- [ ] 🟡 Auto-center on activity
- [ ] 🟢 Fullscreen mode

---

## 5-21: [SECTIONS CONTINUE - SAVED TO FILE]

See full checklist in /UIUX_CHECKLIST.md
