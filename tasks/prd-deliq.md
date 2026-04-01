[PRD]
# PRD: DeliIQ — Complete Deli & Convenience Store Management Platform

## Overview

DeliIQ is a multi-tenant SaaS platform purpose-built for independent deli, bodega, and convenience store owners. It combines inventory receiving with barcode/invoice scanning, network-wide pricing intelligence, POS, customer-facing kiosk ordering with full sandwich customization, kitchen display system, Apple Wallet/Google Wallet loyalty with geo-fenced lock screen notifications, and Stripe Connect payment processing.

The platform is forked from FloraIQ's proven multi-tenant infrastructure (auth, billing, delivery, wholesale, 200+ edge functions) and redesigned for a non-technical audience: primarily 40+ year old Arabic and Spanish-speaking store owners who need a tool that works like a phone call — simple, visual, and voice-friendly.

**Business Model:** Freemium — 1 store free with core features (POS, inventory, basic kiosk). Paid tiers unlock pricing intelligence, loyalty campaigns, multi-store, kiosk payments, and advanced analytics. Platform fee of $0.20 per kiosk transaction on top of monthly subscription.

**Payment Processing:** Stripe Connect (Express) — money flows directly to store owner's bank account. DeliIQ collects platform fee automatically. No money transmitter license required.

## Goals

- Launch MVP in 10 weeks with POS, kiosk ordering, kitchen display, and Apple Wallet loyalty
- Onboard 50 beta stores in NYC/NJ bodega corridor within 3 months
- Achieve 70%+ weekly active usage (the tool must be indispensable, not optional)
- Full Arabic (RTL) and Spanish language support from day one
- Every core action completable in under 3 taps or 1 voice command
- Build network effect: more stores → better pricing data → more stores
- Process $1M+ in kiosk transactions within 6 months

## Quality Gates

These commands must pass for every user story:
- `npx tsc --noEmit` — Type checking
- `npx eslint .` — Linting

For UI stories, also include:
- Verify in browser using dev-browser skill
- Test RTL layout in Arabic mode
- Verify touch targets are minimum 48x48px (WCAG)
- Verify color contrast meets WCAG 2 AA

## User Stories

---

## PILLAR 1: SCAN & RECEIVE

### US-001: Barcode scan to receive inventory
**Description:** As a store owner, I want to scan a product barcode with my phone camera so that I can instantly add it to my inventory without typing anything.

**Acceptance Criteria:**
- [ ] Camera-based barcode scanner opens in under 1 second
- [ ] Supports UPC-A, UPC-E, EAN-13, EAN-8, Code 128
- [ ] On scan: if product exists in catalog, show product card with name, image, last cost, current stock
- [ ] On scan: if product is new, auto-lookup via UPC database API and pre-fill name, category, image
- [ ] Large "+1" / "+6" / "+12" / "+24" / "case" quick-add buttons (no keyboard needed)
- [ ] Running total of items received shown at top
- [ ] Haptic feedback + sound on successful scan
- [ ] Works offline — queues scans and syncs when connected

### US-002: Invoice photo scanning (OCR)
**Description:** As a store owner, I want to photograph a paper invoice from my distributor so that the system automatically reads the items, quantities, and costs.

**Acceptance Criteria:**
- [ ] Camera capture with auto-crop and perspective correction
- [ ] OCR extracts: item descriptions, quantities, unit costs, totals, invoice number, date, distributor name
- [ ] Side-by-side review screen: photo on left, extracted data on right
- [ ] Auto-match extracted items to existing catalog products (fuzzy matching on name + UPC)
- [ ] Unmatched items highlighted in yellow for manual matching or "Add as new product"
- [ ] One-tap confirm imports all items to inventory with costs updated
- [ ] Supports McLane, UNFI, CoreMark, S&P, C&S, Associated Wholesale Grocers invoice formats
- [ ] Also accepts PDF upload from email
- [ ] Invoice stored and searchable by date, distributor, amount
- [ ] Cost history tracked per product: "You paid $1.20 last time, now $1.35 — 12.5% increase"

### US-003: Pricing intelligence dashboard
**Description:** As a store owner, I want to see what other stores in the network are paying and charging for the same products so that I can set competitive prices and spot overcharges.

**Acceptance Criteria:**
- [ ] For each product: show my cost, network average cost, network low/high cost
- [ ] For each product: show my retail price, network average retail, suggested retail (based on target margin)
- [ ] Suggested margin engine: category-based defaults (Beverages 40%, Snacks 35%, Deli 55%, Tobacco 15%)
- [ ] "You're overpaying" alerts: flag items where my cost is 15%+ above network average
- [ ] "Better deal available" suggestions: show cheaper distributors for the same item
- [ ] "Price too low" alerts: flag items where my retail is below network average (leaving money on table)
- [ ] Data is anonymized — no store names shown, only aggregated stats by zip code
- [ ] Minimum 5 stores reporting before showing network data (privacy threshold)
- [ ] External data enrichment from grocery price APIs and USDA commodity prices
- [ ] Sortable by: biggest margin opportunity, most overpaying, most popular items, recently changed

### US-004: Wholesale distributor directory
**Description:** As a store owner, I want a directory of all wholesale distributors with contact info, rep names, and latest catalogs so that I can easily find and order from suppliers.

**Acceptance Criteria:**
- [ ] Searchable directory of distributors (McLane, UNFI, CoreMark, S&P, C&S, local distributors)
- [ ] Each listing shows: company name, logo, phone, email, rep name, delivery days, minimum order, payment terms
- [ ] Latest catalog/price list (PDF) viewable in-app
- [ ] "Call Rep" button dials directly from the app
- [ ] "Text Rep" button opens SMS with pre-filled order template
- [ ] Store owner can add their own distributors and reps
- [ ] Mark favorites for quick access
- [ ] Community ratings: "Reliable delivery?" "Good prices?" "Easy to work with?" (1-5 stars)
- [ ] Delivery schedule calendar: shows which distributor delivers on which days
- [ ] Order history per distributor: total spent, last order, average order size

### US-005: Smart reorder suggestions
**Description:** As a store owner, I want the system to tell me what to reorder based on how fast items sell so that I never run out of popular products.

**Acceptance Criteria:**
- [ ] Calculate sales velocity (units/day) for each product over 7/14/30 day windows
- [ ] Predict stockout date based on current stock ÷ velocity
- [ ] Daily "Reorder Now" push notification: items that will run out within 3 days
- [ ] Weekly "Suggested Order" by distributor: grouped items ready to call in
- [ ] Factor in lead time per distributor (e.g., McLane = next day, UNFI = 3 days)
- [ ] Factor in minimum order requirements per distributor
- [ ] One-tap "Send to distributor" generates order via email with line items
- [ ] Seasonal adjustment: learns that ice cream sells 3x in summer, hot chocolate in winter
- [ ] Weather adjustment: rain forecast → increase coffee/soup stock suggestion

---

## PILLAR 2: MANAGE & SELL (POS)

### US-006: Visual POS with large touch targets
**Description:** As a store owner or cashier, I want a point-of-sale screen with big buttons and product images so that I can ring up customers fast without reading small text.

**Acceptance Criteria:**
- [ ] Product grid with images, large text names, prices — minimum 80x80px touch targets
- [ ] Category tabs across top (Drinks, Snacks, Deli, Tobacco, Lottery, Grocery, Other)
- [ ] "Favorites" tab with most-sold items auto-populated
- [ ] Barcode scan to add item to cart (phone camera or USB/Bluetooth scanner)
- [ ] Quick quantity adjustment: tap +/- or swipe
- [ ] Cart summary always visible on right side (tablet) or bottom (phone)
- [ ] Cash, card (via Stripe Terminal), EBT, mobile payment support
- [ ] Cash register mode: enter amount tendered, show change in large green text
- [ ] Split payment: part cash, part card
- [ ] Receipt via SMS, email, or print (Bluetooth thermal printer)
- [ ] Quick sale mode: just enter dollar amount without scanning (for misc items)
- [ ] Tax calculation: configurable per category (some items tax-exempt)
- [ ] Discount buttons: $1 off, 10% off, custom amount (manager PIN required)

### US-007: Inventory with expiry date tracking
**Description:** As a store owner, I want to track expiry dates on perishable items so that I can rotate stock and reduce waste.

**Acceptance Criteria:**
- [ ] Expiry date field on each product (optional, for perishables)
- [ ] Batch tracking: same product can have multiple batches with different expiry dates
- [ ] Color-coded alerts: green (>7 days), yellow (3-7 days), red (<3 days), black (expired)
- [ ] Daily "Expiring Soon" push notification with list of items
- [ ] FIFO enforcement: POS shows "Sell THIS batch first" prompts
- [ ] Markdown suggestions: "Mark down $1 to clear before expiry"
- [ ] Waste log: track expired items discarded — quantity, cost, reason
- [ ] Monthly waste report: total waste cost, worst categories, trend vs last month
- [ ] Tax write-off export: CSV of all waste for accountant

### US-008: Deli counter / prepared foods management
**Description:** As a deli owner, I want to manage my prepared food menu with ingredients, prep time, and made-to-order workflow.

**Acceptance Criteria:**
- [ ] Separate "Deli Menu" section with categories (Sandwiches, Heroes, Wraps, Hot Food, Salads, Breakfast, Platters)
- [ ] Each item: name, description, photo, base price, prep time estimate, ingredients list
- [ ] Ingredient-level inventory deduction (sandwich uses 4oz turkey, 2 slices bread, etc.)
- [ ] Automatic "low ingredient" alerts (running low on turkey → affects 12 menu items)
- [ ] "86'd" (out of stock) toggle per item — removes from kiosk and online menu instantly
- [ ] Dayparting: breakfast items auto-show 6-11am, lunch items after 11am
- [ ] Catering/platter orders with advance scheduling and deposit

### US-009: Online ordering and delivery
**Description:** As a store owner, I want customers to order from their phone for pickup or delivery so that I can serve more customers without more counter space.

**Acceptance Criteria:**
- [ ] Customer-facing web store (mobile-optimized) with full product catalog and deli menu
- [ ] Full sandwich customizer (same as kiosk — bread, protein, toppings, extras, condiments)
- [ ] Cart, checkout, payment (Stripe Connect — card, Apple Pay, Google Pay)
- [ ] Pickup: estimated ready time, "Your order is ready" SMS notification
- [ ] Delivery: integrated courier/delivery system (from FloraIQ)
- [ ] Delivery zone configuration with distance-based fees
- [ ] Order notification to store (sound alert + push notification + auto-print ticket)
- [ ] Real-time order tracking for delivery customers
- [ ] Order history for repeat customers: "Reorder last order" one-tap

### US-010: Daily cash reconciliation
**Description:** As a store owner, I want a simple end-of-day cash count screen so that I know if my drawer is correct without doing math.

**Acceptance Criteria:**
- [ ] "Close Day" button shows expected cash based on cash sales minus cash payouts
- [ ] Bill counter entry: "How many $100s? $50s? $20s? $10s? $5s? $1s? Coins?" with large buttons
- [ ] Show over/short amount in large green/red text
- [ ] Log discrepancy with optional note
- [ ] Per-shift breakdown if multiple employees worked
- [ ] Daily report: total sales by payment method, cash over/short, transaction count
- [ ] Weekly summary: total over/short trend (catch patterns)
- [ ] Export to accountant: daily/weekly/monthly CSV

---

## PILLAR 3: CUSTOMER KIOSK ORDERING

### US-011: Customer-facing menu display (kiosk)
**Description:** As a customer walking up to a deli, I want to see the full menu on a tablet with pictures of every item so that I know exactly what I'm ordering.

**Acceptance Criteria:**
- [ ] Full-screen tablet mode (PWA kiosk mode — no browser chrome)
- [ ] Store branding: logo, colors, name at top
- [ ] Menu categories as large visual tabs: Sandwiches, Heroes, Wraps, Salads, Hot Food, Breakfast, Sides, Drinks
- [ ] Each item shows: photo, name, base price, short description, prep time estimate
- [ ] "Popular" / "Chef's Pick" badges on top sellers (auto-calculated from sales data)
- [ ] Sold-out items grayed out with "Sold Out" overlay (synced from POS in real-time)
- [ ] Dietary filter bar: Halal, Vegetarian, Vegan, Gluten-Free
- [ ] Allergen icons on applicable items (nuts, dairy, gluten, eggs, fish, shellfish)
- [ ] Works in English, Spanish, and Arabic (customer picks language at top)
- [ ] Auto-resets to home screen after 2 minutes of inactivity
- [ ] Minimum 64px font for item names, 48px for prices
- [ ] Seasonal/time-based menu: breakfast until 11am, then lunch auto-switches

### US-012: Build-your-own sandwich/order customizer
**Description:** As a customer, I want to customize my sandwich step-by-step so that I get exactly what I want without miscommunication.

**Acceptance Criteria:**
- [ ] Step-by-step builder flow after tapping a sandwich/hero/wrap:
  - Step 1: **Size** — Half / Whole (with price difference shown)
  - Step 2: **Bread** — White, Wheat, Rye, Hero Roll, Wrap, Gluten-Free (+$1.00) — with photos of each
  - Step 3: **Protein** — Turkey, Ham, Roast Beef, Italian Mix, Chicken Cutlet, Tuna, etc. — with photos and prices for premium options
  - Step 4: **Cheese** — American, Swiss, Provolone, Pepper Jack, Mozzarella, No Cheese — with photos
  - Step 5: **Toppings** — Lettuce, Tomato, Onion, Pickles, Peppers, Olives, Jalapeños, Banana Peppers, etc. (multi-select, free)
  - Step 6: **Extras with upcharge** — Extra Meat (+$2.50), Extra Cheese (+$1.00), Avocado (+$1.50), Bacon (+$2.00), Egg (+$1.00)
  - Step 7: **Condiments** — Mayo, Mustard, Oil & Vinegar, Hot Sauce, Ranch, Chipotle Mayo, Honey Mustard, etc. (multi-select, free)
  - Step 8: **Special Instructions** — free text OR voice input ("light mayo, toasted please")
- [ ] Running total updates live with each selection
- [ ] "Back" button on each step to revise
- [ ] Visual progress bar showing current step
- [ ] "Make it a combo" prompt at end: add drink + side for $X (savings shown)
- [ ] Every modifier option has a photo (not just text)
- [ ] Owner configures all steps, options, prices, and photos in admin panel

### US-013: Hot food and prepared food ordering
**Description:** As a customer, I want to order hot food with portion sizes, sides, and protein options.

**Acceptance Criteria:**
- [ ] Hot food items show: photo, name, price, prep time
- [ ] Portion sizes where applicable: Small / Regular / Large with price tiers
- [ ] Side selection: "Pick 2 sides" from list (rice, beans, salad, fries, plantains, coleslaw, mac & cheese)
- [ ] Protein upgrades: "Swap chicken for steak +$3.00"
- [ ] Heat level selector: Mild / Medium / Hot / Extra Hot (with pepper icons 🌶️)
- [ ] Special dietary notes: "No pork", "Extra sauce on side"
- [ ] Estimated prep time shown: "Ready in ~8 min"

### US-014: Cart review and checkout
**Description:** As a customer, I want to review my full order with all customizations before confirming.

**Acceptance Criteria:**
- [ ] Cart shows every item with full customization underneath:
  ```
  Turkey Hero (Whole)                $9.99
    Wheat bread, Provolone
    Lettuce, Tomato, Onion
    + Extra Cheese                   $1.00
    + Avocado                        $1.50
    "Light mayo, toasted please"

  Chicken Over Rice (Regular)        $8.99
    Yellow rice, side salad
    Hot sauce on the side
  ```
- [ ] Edit button on each item reopens the customizer at last state
- [ ] Remove item with swipe-left or tap X
- [ ] "Add Another Item" returns to menu
- [ ] Subtotal, tax, total displayed clearly in large font
- [ ] Tip option: No Tip / $1 / $2 / $3 / Custom
- [ ] Customer name (required — for order calling): keyboard or voice input
- [ ] Phone number (optional — for SMS "ready" notification)
- [ ] Payment mode depends on store setting:
  - **Pay at Counter**: "Place Order" → ticket prints → customer pays cash/card at register
  - **Pay on Kiosk**: tap to pay (NFC), insert card (Stripe Terminal), Apple Pay, Google Pay
  - **Both**: customer chooses at checkout
- [ ] Loyalty: if customer taps their wallet pass QR, auto-apply stamp/points and any active deal
- [ ] "Place Order" button: giant, green, unmissable

### US-015: Order confirmation and tracking
**Description:** As a customer, I want to know my order number and wait time after ordering.

**Acceptance Criteria:**
- [ ] Full-screen confirmation: order number "#47" in massive font
- [ ] "Your order will be ready in ~12 minutes"
- [ ] QR code: "Scan to track on your phone" (opens web tracker)
- [ ] If phone number provided: SMS with order number + wait time
- [ ] Web tracker shows status: Received → Preparing → Almost Ready → Ready for Pickup
- [ ] When ready: SMS "Your order #47 is READY! Pick up at the counter."
- [ ] Kiosk auto-resets to menu 10 seconds after order placed
- [ ] If loyalty pass detected: "You earned 1 stamp! 7/10 toward a free coffee ☕"

### US-016: Order status display (TV/monitor)
**Description:** As a store owner, I want a TV showing order numbers and status so customers know when their food is ready.

**Acceptance Criteria:**
- [ ] Full-screen display mode for TV/monitor (HDMI from tablet, Chromecast, or Fire Stick)
- [ ] Two columns: "Preparing" (yellow) and "Ready for Pickup" (green)
- [ ] Order numbers in massive font (readable from 20+ feet)
- [ ] Customer name under order number
- [ ] When order moves to "Ready": number flashes + chime sound
- [ ] After 5 minutes in "Ready": number dims
- [ ] After 15 minutes: number removed
- [ ] Bottom ticker: store WiFi password, daily special, "Download our loyalty card!" with QR
- [ ] Auto-rotating promotional banner between orders (owner uploads images)

---

## PILLAR 4: KITCHEN DISPLAY SYSTEM

### US-017: Kitchen display (cook's tablet)
**Description:** As a cook, I want to see incoming orders on a tablet with all customizations clearly listed so I make each order correctly.

**Acceptance Criteria:**
- [ ] Tablet-optimized: orders as cards in queue (left to right, oldest first)
- [ ] Each order card shows:
  - Order number (#47) — large bold
  - Customer name
  - Time since placed (ticking counter: "3:24")
  - Source badge: "KIOSK" / "ONLINE" / "PHONE" / "COUNTER"
  - Each item with FULL customization:
    ```
    🥪 TURKEY HERO (WHOLE)
    → Wheat, Provolone
    → LTO, + Extra Cheese, + Avo
    → ⚠️ LIGHT MAYO, TOASTED
    ```
  - Special instructions highlighted in yellow with ⚠️ icon
  - Modifier additions in green (+), removals in red (-)
- [ ] Color coding by age: white (0-5 min), yellow (5-10 min), red (10+ min — rush!)
- [ ] Tap item → mark as "Done" (strikethrough)
- [ ] When all items done → "ORDER READY" big green button
- [ ] "Order Ready" triggers: SMS to customer, TV display update, buzzer sound
- [ ] Swipe card right to bump after pickup
- [ ] New order sound: configurable chime, bell, or voice announcement
- [ ] Multi-station filtering: "Grill" sees only hot items, "Cold" sees only sandwiches

### US-018: Ticket printing
**Description:** As a cook, I want orders to auto-print on a thermal printer so I have physical tickets during rush.

**Acceptance Criteria:**
- [ ] Auto-print on new order (configurable: always / rush-only / never)
- [ ] Kitchen ticket format (compact, no prices):
  ```
  ================================
  #47  MIKE         12:34 PM
  ================================
  TURKEY HERO (WHOLE)
    Wheat / Provolone
    Lettuce, Tomato, Onion
    + EXTRA CHEESE
    + AVOCADO
    ** LIGHT MAYO, TOASTED **
  --------------------------------
  CHICKEN OVER RICE (REG)
    Yellow rice, Side salad
    ** HOT SAUCE ON THE SIDE **
  ================================
  ITEMS: 2    SOURCE: KIOSK
  ================================
  ```
- [ ] Special instructions in **BOLD CAPS** with ** markers
- [ ] Customer receipt format (full with prices, subtotal, tax, total, payment method)
- [ ] Supports 80mm and 58mm thermal printers via Bluetooth, USB, and WiFi (ESC/POS)
- [ ] Reprint button on KDS
- [ ] Auto-detect connected printers

### US-019: Order modification
**Description:** As a cook or cashier, I want to modify an order if the customer changes their mind or we're out of an ingredient.

**Acceptance Criteria:**
- [ ] Tap order on KDS → "Modify" button (manager PIN if configured)
- [ ] Can: swap ingredient, remove item, add item, update special instructions
- [ ] Price recalculates automatically
- [ ] Modified items flagged "MODIFIED" on KDS and reprint ticket
- [ ] Customer SMS: "Your order has been updated — [change summary]"
- [ ] "Cancel Order" with refund trigger (auto-refund if card, void if cash)
- [ ] Modification logged: who, when, what changed

### US-020: Rush hour management
**Description:** As a store owner, I want the system to handle peak rush without breaking.

**Acceptance Criteria:**
- [ ] Auto-detect rush: 5+ active orders in queue → "Rush Mode"
- [ ] Kiosk shows: "Current wait: ~15 min" warning before customer orders
- [ ] Rush Mode option: temporarily hide slow-prep items
- [ ] KDS: orders auto-prioritize oldest first, overdue orders flash red
- [ ] Ticket printer auto-enables during rush
- [ ] Kiosk can show "Taking a break — back in 15 min" (owner toggle)
- [ ] Post-rush analytics: peak time, max queue depth, average prep time, longest wait

---

## PILLAR 5: APPLE WALLET LOYALTY & CRM

### US-021: Apple Wallet / Google Wallet pass generation
**Description:** As a store owner, I want a branded loyalty card that customers add to their phone wallet so my store is always on their phone.

**Acceptance Criteria:**
- [ ] Setup wizard: upload logo, pick brand color, set stamp goal, preview card
- [ ] System generates signed Apple PassKit `.pkpass` bundle
- [ ] System generates Google Wallet pass via API
- [ ] Pass displays: store name, logo, stamp count or points, current deal message
- [ ] Pass includes geo-fence: store GPS coordinates + configurable radius (50m-500m)
- [ ] Customer adds via: QR code at register, NFC tap, SMS link, receipt link, kiosk prompt after order
- [ ] Pass auto-updates when stamps/points change
- [ ] Fallback PWA for Android without Google Wallet (add to home screen)
- [ ] Pass back field: store hours, address, phone number

### US-022: Geo-fenced lock screen notifications
**Description:** As a store owner, I want the loyalty card to pop up on customers' phones when they walk near my store.

**Acceptance Criteria:**
- [ ] Pass registered with store GPS + configurable radius (default 100m)
- [ ] When customer enters geo-fence: card appears on lock screen with current message
- [ ] Lock screen shows: store name, current deal/message, stamp progress
- [ ] Owner changes lock screen message anytime: "Fresh coffee! Double stamps today"
- [ ] Message update pushes to ALL installed passes within minutes
- [ ] Dashboard: "walk-by" analytics — how many pass holders entered geo-fence today/this week
- [ ] Supports multiple relevant locations per pass (store + nearby subway station, parking lot)
- [ ] Time-based messages: different message for morning commuters vs lunch crowd

### US-023: Digital stamp card
**Description:** As a store owner, I want a digital stamp card so customers earn stamps and get free items.

**Acceptance Criteria:**
- [ ] Configurable programs: "Buy 10 coffees, get 1 free", "Buy 5 subs, get 1 free"
- [ ] Multiple simultaneous programs (coffee card + sandwich card)
- [ ] Stamp earned by: NFC tap, QR scan at register, automatic with POS purchase, or kiosk order
- [ ] Wallet pass updates showing progress: "7/10 ☕"
- [ ] On completion: "FREE COFFEE! Show at register" banner
- [ ] Cashier scans pass QR → confirm freebie → stamps reset → new cycle starts
- [ ] Anti-fraud: one stamp per transaction, minimum purchase amount configurable, cooldown period
- [ ] Partial stamps: spend $20+ = 2 stamps (configurable multiplier)

### US-024: Push deal notifications
**Description:** As a store owner, I want to send deals to every customer with my loyalty card.

**Acceptance Criteria:**
- [ ] Simple compose: pick deal type (% off, $ off, BOGO, free item, double stamps), write message
- [ ] AI suggestions based on context:
  - Time: "It's Tuesday, your slowest day. Send 'Double stamps today'?"
  - Inventory: "47 muffins expiring tomorrow. Send 'Muffins 50% off today'?"
  - Weather: "Rain forecast. Send 'Free hot coffee with any sandwich'?"
  - Lapsed: "84 customers haven't visited in 2 weeks. Send 'We miss you — free cookie'?"
- [ ] One-tap approve sends push update to all pass holders
- [ ] Pass lock screen message updates with the deal
- [ ] Schedule sends: "Send Friday at 7am"
- [ ] Frequency cap: max 1 push per customer per day (prevent spam)
- [ ] Analytics per campaign: reach, walk-bys after send, redemptions, revenue lift

### US-025: Loyalty analytics dashboard
**Description:** As a store owner, I want to see how my loyalty program is performing in simple numbers.

**Acceptance Criteria:**
- [ ] Total cards installed (Apple + Google + PWA) — big number with trend arrow
- [ ] New cards this week/month
- [ ] Walk-by rate: % of card holders who enter geo-fence weekly
- [ ] Visit conversion: % of walk-bys who make a purchase
- [ ] Campaign scorecard: each deal sent with reach → visits → redemptions → revenue
- [ ] Top 10 customers: most visits, highest spend, longest streak
- [ ] Lapsed customers: haven't visited in 14+ days (count + "Win back" button)
- [ ] ALL displayed as big simple numbers with up/down arrows — no complex charts
- [ ] Available in Arabic and Spanish
- [ ] Weekly email summary to owner: "This week: 23 new cards, 156 visits, $847 from loyalty customers"

### US-026: Customer segmentation and auto-campaigns
**Description:** As a store owner, I want the system to automatically send the right deal to the right customers.

**Acceptance Criteria:**
- [ ] Auto-segments: Regulars (3+/week), Weekenders, Morning Crowd, Lunch Crowd, Lapsed (14+ days), New (first visit), Big Spenders ($50+/visit)
- [ ] Auto-campaign: "Welcome" — free cookie/drink coupon sent 1 day after first visit
- [ ] Auto-campaign: "We miss you" — deal sent after 14 days inactive
- [ ] Auto-campaign: "Happy birthday" — if birthdate captured at signup
- [ ] Auto-campaign: "Rain day special" — triggered by weather API + store inventory
- [ ] Auto-campaign: "Streak reward" — bonus stamps after 5 consecutive weeks of visits
- [ ] Store owner enables/disables each with one toggle
- [ ] Monthly loyalty report: retention rate, repeat visit %, revenue from loyalty vs walk-in

---

## PILLAR 6: PAYMENT PROCESSING

### US-027: Stripe Connect onboarding for store owners
**Description:** As a store owner, I want to connect my bank account so I get paid directly for all card transactions.

**Acceptance Criteria:**
- [ ] "Set Up Payments" in onboarding wizard
- [ ] Stripe Connect Express flow: owner enters bank info, Stripe handles KYC/identity
- [ ] Onboarding completable in under 5 minutes
- [ ] Once connected: payments from kiosk, online orders, and POS card transactions flow directly to owner's bank
- [ ] Daily automatic payouts (Stripe default) with option for weekly
- [ ] Owner dashboard shows: pending balance, next payout date, payout history
- [ ] DeliIQ platform fee ($0.20/transaction) deducted automatically before payout
- [ ] If not yet connected: kiosk shows "Pay at Counter" only, card payments disabled
- [ ] Owner can disconnect/reconnect Stripe at any time in settings

### US-028: Kiosk payment integration
**Description:** As a store owner who wants kiosk payments, I want customers to pay directly on the kiosk tablet.

**Acceptance Criteria:**
- [ ] Kiosk payment setting in admin: "Pay at Counter" / "Pay on Kiosk" / "Customer Chooses"
- [ ] Pay on Kiosk supports:
  - Stripe Terminal (M2 reader) connected via Bluetooth — tap, insert, swipe
  - Apple Pay and Google Pay via browser NFC (Web Payments API)
  - Manual card entry as fallback
- [ ] Payment flow: customer taps "Pay Now" → reader activates → card presented → confirmation
- [ ] Tip screen before payment: suggested amounts ($1, $2, $3) + custom + no tip
- [ ] Digital receipt: SMS or email (customer chooses on confirmation screen)
- [ ] Declined card handling: friendly message "Card declined — please try another card or pay at counter"
- [ ] Offline handling: if internet drops mid-payment, queue transaction and retry on reconnect
- [ ] Refunds: processed from admin dashboard or KDS (cancel order → auto-refund)
- [ ] Device pairing: connect Stripe Terminal reader to kiosk tablet in settings (scan/Bluetooth)

### US-029: POS card payment
**Description:** As a cashier, I want to accept card payments at the register through the same system.

**Acceptance Criteria:**
- [ ] POS checkout: "Card" button activates connected Stripe Terminal reader
- [ ] Same reader can be shared between POS and kiosk (or separate readers per device)
- [ ] Contactless (tap), chip insert, and magnetic swipe supported
- [ ] Tip prompt configurable: before or after payment, or disabled
- [ ] Split payment: part cash, part card
- [ ] Void last transaction (within 5 minutes, manager PIN required)
- [ ] End-of-day card settlement report
- [ ] All card transactions appear in same dashboard as kiosk transactions

### US-030: Transaction reporting and payouts
**Description:** As a store owner, I want to see all my transactions in one place and know when I'm getting paid.

**Acceptance Criteria:**
- [ ] Unified transaction list: all sales from POS, kiosk, and online orders
- [ ] Filter by: date range, payment method, source (POS/kiosk/online), amount
- [ ] Each transaction shows: time, amount, payment method, items, customer name (if kiosk/online)
- [ ] Daily summary: total revenue, by source, by payment method, tips total, platform fees
- [ ] Payout schedule: next payout date, amount, destination bank
- [ ] Payout history: date, amount, bank, Stripe transfer ID
- [ ] Monthly statement: revenue, fees (Stripe + DeliIQ platform), net payout, tax summary
- [ ] Export: CSV, PDF for accountant
- [ ] Real-time balance: "You've earned $1,247.50 today"

---

## PILLAR 7: UX & ACCESSIBILITY

### US-031: Arabic (RTL) and Spanish language support
**Description:** As an Arabic or Spanish-speaking store owner, I want to use the app in my language.

**Acceptance Criteria:**
- [ ] Language selector on first launch and in settings: English, العربية, Español
- [ ] Full RTL layout for Arabic: mirrored navigation, text alignment, swipe directions, icon positions
- [ ] All UI labels, buttons, notifications, error messages, onboarding text translated
- [ ] Numbers and currency always in local format ($X.XX, left-to-right even in Arabic mode)
- [ ] Product names stay in original language (that's how they appear on packaging)
- [ ] Kiosk customer UI: independent language from admin (admin in Arabic, kiosk in English)
- [ ] Voice input works in Arabic, Spanish, and English
- [ ] Onboarding video tutorials in all 3 languages
- [ ] Push notifications and SMS to customers: in the language they selected

### US-032: Voice-first interaction
**Description:** As a store owner with limited English literacy, I want to speak to the app instead of typing.

**Acceptance Criteria:**
- [ ] Microphone button on every search bar and text input field
- [ ] Product search by voice: say "Pepsi" → shows all Pepsi products
- [ ] Receiving by voice: "Add 12 Pepsi 2-liter" → adds to inventory
- [ ] Deal compose by voice: "Send double stamps today" → pre-fills campaign
- [ ] Daily summary by voice: "What did I sell today?" → speaks back total sales
- [ ] Supports Arabic, Spanish, and English speech recognition
- [ ] Noise-filtered: works in busy deli environment with background noise
- [ ] Voice confirmation: "I heard 'add 12 Pepsi 2-liter' — is that right?" with Yes/No buttons

### US-033: Simplified onboarding wizard
**Description:** As a new store owner, I want a step-by-step setup that gets me running in 15 minutes.

**Acceptance Criteria:**
- [ ] Step 1: Store name + address + phone (pre-fill from Google Places if possible)
- [ ] Step 2: Upload store logo or take photo of storefront (AI auto-crops to square)
- [ ] Step 3: Pick language + POS layout preference (grid/list)
- [ ] Step 4: Connect bank account (Stripe Connect Express — or skip for now)
- [ ] Step 5: Scan your first 5 products (guided barcode scan with celebration animation on each)
- [ ] Step 6: Create your loyalty card (pick color + stamp goal + preview wallet pass)
- [ ] Step 7: Set up kiosk (pair tablet via QR code — or skip)
- [ ] Step 8: Print loyalty QR poster for counter (generates printable PDF)
- [ ] Each step has 30-second video tutorial in selected language
- [ ] "Skip for now" on every non-critical step
- [ ] "Call for help" button connects to bilingual live support
- [ ] Progress bar: 8/8 steps, celebration confetti on completion
- [ ] Estimated total time shown: "~15 minutes to get started"

### US-034: Family & employee accounts
**Description:** As a store owner, I want to give family and employees access without exposing financial data.

**Acceptance Criteria:**
- [ ] Roles: Owner (full access), Manager (POS + inventory + basic reports), Cashier (POS only)
- [ ] PIN-based fast login at POS: 4-digit PIN per person (no email/password needed)
- [ ] Employee time tracking: clock in/out at POS
- [ ] Per-employee sales tracking (who sold what, when)
- [ ] Owner sees all data, Manager sees shift data, Cashier sees their own sales only
- [ ] Add employee: name + phone + role + PIN — no email required
- [ ] Remove employee: one tap, immediate access revocation
- [ ] Activity log: who did what and when (for theft prevention)

### US-035: Accessibility and simplicity
**Description:** As a 40+ year old store owner who isn't tech-savvy, I want the interface to be as simple as possible.

**Acceptance Criteria:**
- [ ] Maximum 3 taps to reach any core function from home screen
- [ ] No settings/features hidden behind hamburger menus — main actions always visible
- [ ] Large font throughout: minimum 16px body text, 24px headers, 32px numbers
- [ ] High contrast mode: toggle for extra-dark text and extra-large buttons
- [ ] Undo for destructive actions: "Item deleted — Undo (5 seconds)"
- [ ] No jargon: "Inventory" not "Stock Management", "Reorder" not "Purchase Order"
- [ ] Contextual help: tap any icon or label → tooltip explaining what it does
- [ ] "Demo mode" with sample data so owners can explore without fear of breaking things
- [ ] Night mode: dark theme for late-night shifts
- [ ] Persistent bottom navigation: Home, POS, Orders, Loyalty, More

### US-036: Weather-aware intelligence
**Description:** As a store owner, I want the system to factor in weather automatically.

**Acceptance Criteria:**
- [ ] Weather widget on dashboard showing current + 3-day forecast for store location
- [ ] Hot day (>85°F): boost cold drink/ice cream reorder suggestions + push "Cool down" deal
- [ ] Cold/rainy: boost hot coffee/soup + trigger "Warm up" auto-campaign to loyalty cardholders
- [ ] Snow forecast: alert to stock bread, milk, eggs (storm buying pattern)
- [ ] Weather shown as context on dashboard ("92°F Sunny — expect high cold drink sales today")
- [ ] Historical correlation: show which products sell more/less on hot/cold/rainy days

---

## PILLAR 8: PLATFORM & INFRASTRUCTURE

### US-037: Fork FloraIQ and rebrand as DeliIQ
**Description:** As a developer, I want to fork FloraIQ and strip cannabis-specific features for a clean DeliIQ foundation.

**Acceptance Criteria:**
- [ ] New repository created from FloraIQ fork
- [ ] All FloraIQ/cannabis references removed: THC, CBD, strain, terpene, COA, METRC, leafly, dispensary
- [ ] Branding replaced: DeliIQ name, warm orange/cream color palette, new logo
- [ ] Cannabis DB columns removed or repurposed (strain_type → subcategory, thc_percent → removed)
- [ ] Cannabis edge functions removed (leafly-suggestions, verify-age-jumio, menu-burn, etc.)
- [ ] Multi-tenant infrastructure preserved and tested
- [ ] Auth, billing (Stripe Connect), delivery, wholesale modules preserved
- [ ] New deli-specific tables: modifier_groups, modifiers, kiosk_devices, wallet_passes, wallet_pass_registrations, order_customizations, kitchen_stations
- [ ] Deployment pipeline working (Vercel + Supabase)
- [ ] All quality gates passing

### US-038: Apple PassKit integration
**Description:** As a developer, I want Apple Wallet pass generation and push updates.

**Acceptance Criteria:**
- [ ] Apple Developer account with Pass Type ID certificate
- [ ] Edge function `generate-wallet-pass`: creates signed `.pkpass` bundle with store branding, QR barcode, geo-fence
- [ ] Edge function `update-wallet-pass`: pushes content updates to installed passes via APNs
- [ ] Web service endpoints per Apple spec: register device, unregister, get latest pass, get changed passes
- [ ] Pass fields: store logo (icon, logo, strip), brand color, stamp count, current deal, barcode (QR)
- [ ] Geo-fence: store lat/lng + radius encoded in pass `locations` array
- [ ] Back fields: store hours, address, phone, "Powered by DeliIQ"
- [ ] Pass update triggers: stamp earned, deal changed, points updated
- [ ] Device registration table: track all installed passes per store

### US-039: Google Wallet API integration
**Description:** As a developer, I want Google Wallet loyalty passes for Android users.

**Acceptance Criteria:**
- [ ] Google Cloud project with Wallet API enabled + service account
- [ ] Edge function creates loyalty class and loyalty objects
- [ ] Pass displays: store logo, stamp/points, current deal, barcode
- [ ] Geo-fence via `relevantLocations` on loyalty class
- [ ] Pass updates via PATCH to loyalty object
- [ ] "Add to Google Wallet" generates JWT save link
- [ ] Fallback: installable PWA loyalty card for devices without Google Wallet

### US-040: UPC product database integration
**Description:** As a developer, I want barcode lookup to auto-identify products.

**Acceptance Criteria:**
- [ ] Integration with Open Food Facts (free, primary) and Barcode Lookup API (paid fallback)
- [ ] On scan: returns product name, brand, category, image, size/weight, ingredients
- [ ] Results cached in product_catalog table (reduce API calls)
- [ ] Lookup chain: local cache → DeliIQ network → external API → manual entry
- [ ] Network contribution: when a store adds a new product, it enriches the shared catalog
- [ ] Rate limiting on external API calls

### US-041: Invoice OCR pipeline
**Description:** As a developer, I want reliable invoice text extraction from photos and PDFs.

**Acceptance Criteria:**
- [ ] Google Cloud Vision API for OCR (or Tesseract as cost-effective fallback)
- [ ] Pre-processing: auto-crop, deskew, contrast enhancement for phone photos
- [ ] Template matching for known distributors (McLane, UNFI, CoreMark) — structured extraction
- [ ] Generic fallback: table detection + row parsing for unknown invoice formats
- [ ] Output: structured JSON with line items (product name, UPC if present, qty, unit cost, extended cost)
- [ ] Confidence scores per field — low confidence fields highlighted for manual review
- [ ] Training pipeline: store owner corrections improve model over time
- [ ] Target: 90%+ accuracy on supported distributor formats, 75%+ on unknown formats

### US-042: Stripe Connect platform setup
**Description:** As a developer, I want Stripe Connect Express integration for marketplace payments.

**Acceptance Criteria:**
- [ ] Stripe Connect Express accounts for each store tenant
- [ ] Onboarding flow: owner clicks "Set Up Payments" → Stripe hosted onboarding → redirect back
- [ ] Platform fee: configurable per-transaction ($0.20 default) collected as application_fee_amount
- [ ] Payment intents created with transfer_data pointing to store's connected account
- [ ] Webhook handlers: account.updated (onboarding complete), payment_intent.succeeded, charge.refunded
- [ ] Payout schedule: daily automatic (Stripe default), configurable to weekly
- [ ] Dashboard: pending balance, payout history, fee breakdown
- [ ] Stripe Terminal integration for in-person card payments
- [ ] Refund processing: full and partial refunds from admin dashboard

### US-043: Offline-first POS and kiosk
**Description:** As a developer, I want POS and kiosk to work during internet outages.

**Acceptance Criteria:**
- [ ] Service Worker caches product catalog, menu, and POS interface
- [ ] IndexedDB stores transaction queue during offline periods
- [ ] Offline POS: process cash sales, store transactions locally
- [ ] Offline kiosk: take "Pay at Counter" orders, queue for sync
- [ ] Visual indicator: "Offline — transactions will sync when connected" banner
- [ ] On reconnect: auto-sync queued transactions to server
- [ ] Conflict resolution: if product price changed while offline, use price at time of sale
- [ ] Stress test: verify 100+ queued transactions sync correctly

### US-044: Combo and meal deal engine
**Description:** As a developer, I want a flexible combo/deal system for the menu.

**Acceptance Criteria:**
- [ ] Combo definition: select items from categories + set combo price
- [ ] Savings calculation and display: "Save $2.50!"
- [ ] Combo modifiers: customer can still customize items within combo
- [ ] Upgrade options: "Large drink +$0.75", "Add side +$1.50"
- [ ] Time-limited combos with auto-enable/disable (breakfast combo until 11am)
- [ ] Featured combos on kiosk home screen banner
- [ ] Combo analytics: which combos sell, conversion rate, average savings given

### US-045: Catering and advance orders
**Description:** As a developer, I want scheduled orders and catering support.

**Acceptance Criteria:**
- [ ] "Order for Later" on kiosk and online: pick date + time (min 2 hours ahead)
- [ ] Catering menu: platters, party subs, trays with per-person pricing
- [ ] Large quantity handling: "feeds 10-12 people"
- [ ] Deposit requirement: configurable (e.g., 50% prepayment for catering)
- [ ] Advance notification to owner: "Catering order for Thursday 11:30am"
- [ ] KDS: catering appears at scheduled prep start time
- [ ] Customer reminder SMS: morning of pickup
- [ ] Cancellation policy: configurable cutoff (24hrs before, full refund; within 24hrs, keep deposit)

---

## Functional Requirements

- FR-1: Multi-tenant architecture — each store is an isolated tenant with separate data
- FR-2: All product data searchable by barcode, name, brand, category, and voice
- FR-3: Invoice OCR achieves 90%+ accuracy on McLane/UNFI/CoreMark formats
- FR-4: Pricing intelligence anonymizes all store data — no individual store identifiable
- FR-5: Apple Wallet passes comply with Apple PassKit Programming Guide v2023+
- FR-6: Google Wallet passes comply with Google Wallet API specifications
- FR-7: Geo-fence radius configurable 50m-500m per store
- FR-8: Push updates to wallet passes propagate within 5 minutes
- FR-9: POS and kiosk function offline with sync-on-reconnect
- FR-10: Voice input supports Arabic, Spanish, English with >90% recognition accuracy
- FR-11: All touch targets minimum 48x48px per WCAG 2.1 AA
- FR-12: Full RTL Arabic layout with mirrored navigation
- FR-13: Bluetooth thermal printer support (ESC/POS protocol, 80mm and 58mm)
- FR-14: Kitchen display updates in real-time (<1 second latency from order placement)
- FR-15: Stripe Connect Express for direct-to-owner payouts
- FR-16: Platform fee collection as Stripe application_fee_amount
- FR-17: Kiosk auto-locks to PWA mode with no browser escape
- FR-18: Order modifications propagate to KDS, ticket reprint, and customer SMS within 5 seconds
- FR-19: Loyalty pass install/uninstall events tracked for analytics
- FR-20: Auto-campaigns limited to 1 push per customer per day
- FR-21: All financial reports exportable as CSV and PDF
- FR-22: Employee PIN lockout after 5 failed attempts
- FR-23: Cash reconciliation logs all discrepancies with timestamps
- FR-24: Menu modifier system supports required/optional, single/multi-select, min/max, upcharges
- FR-25: Sandwich customizer completes full build in under 60 seconds average

## Non-Goals (Out of Scope for MVP)

- Lottery/scratch-off tracking (complex regulatory)
- ATM integration
- Alcohol/tobacco age verification (future phase)
- Multi-store management dashboard (paid tier, post-launch)
- Native iOS/Android app (PWA only for MVP)
- Accounting integration (QuickBooks, Xero — future phase)
- Fax ordering to distributors
- EBT payment processing (requires FNS certification — future phase)
- In-house delivery fleet management (use third-party or FloraIQ courier system)
- Custom branded customer app (Wallet passes are the customer layer)
- Scan-and-go (customer scans items themselves — future phase)

## Technical Considerations

- **Fork from FloraIQ:** Multi-tenant Supabase infra, 200+ edge functions, auth, billing, delivery all carry over
- **Apple PassKit:** Requires Apple Developer account ($99/yr), Pass Type ID cert, APNs cert for push
- **Google Wallet:** Requires Google Cloud project, Wallet API enabled, service account for JWT
- **OCR:** Google Cloud Vision API primary, with distributor-specific template parsers for structured extraction
- **UPC Database:** Open Food Facts (free) primary, Barcode Lookup API ($10/mo) as fallback
- **Voice:** Web Speech API (browser-native) for MVP, Whisper API if accuracy insufficient in noisy environments
- **Offline:** Service Worker + IndexedDB for POS/kiosk transaction queue
- **RTL:** Tailwind CSS `dir="rtl"` with `rtl:` variant, logical properties (start/end not left/right)
- **Thermal Printers:** WebBluetooth API for ESC/POS, WebUSB as fallback, WiFi printers via HTTP
- **Stripe Terminal:** Stripe Terminal JS SDK, M2 reader ($59), connects via Bluetooth
- **Weather:** OpenWeather API free tier (1,000 calls/day — sufficient for hourly per-store checks)
- **Kiosk Lock:** Android: "Screen Pinning" API. iOS: Guided Access. PWA: `display: fullscreen` manifest
- **Real-time KDS:** Supabase Realtime subscriptions for instant order updates
- **i18n:** react-i18next with lazy-loaded language bundles (en, ar, es)

## Success Metrics

- 50 stores onboarded in first 3 months
- 70%+ weekly active usage rate among onboarded stores
- Average 500+ loyalty cards installed per store within 6 months
- 15%+ repeat visit increase for stores using geo-fence notifications
- Invoice scan → receive under 2 minutes (vs 15+ manual)
- 90%+ OCR accuracy on supported distributor invoices
- Kiosk order completion rate >85% (started → placed order)
- Average sandwich customization time under 60 seconds
- Kitchen order accuracy >98% (correct customizations)
- NPS 50+ from store owners (quarterly survey)
- Monthly churn under 5% after first 3 months
- $1M+ in platform-processed transactions within 6 months

## Open Questions

1. White-label loyalty cards (store brand only) or co-brand with DeliIQ (network growth)?
2. SMS loyalty fallback for customers without Apple/Google Wallet?
3. Pricing intelligence: opt-in or default-on with opt-out?
4. Pursue distributor API partnerships (McLane, UNFI) or stay independent?
5. Minimum store density for useful pricing intelligence in a zip code?
6. Should we offer managed onboarding service ($X one-time setup fee)?
7. Hardware bundle: sell pre-configured tablets + printer + card reader as a kit?
8. Franchise/chain support: same owner, multiple stores with shared menu and separate financials?
9. Integration with DoorDash/UberEats/Grubhub for delivery orders?
10. Compliance: food handler permits, health inspection tracking — include or separate product?

[/PRD]
