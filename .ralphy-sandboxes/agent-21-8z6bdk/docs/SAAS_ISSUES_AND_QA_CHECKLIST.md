# Exhaustive CRM SaaS Issues, Edge Cases & Reddit Complaints

## Authentication & Login Nightmares

- [x] **Magic Link Emails Delayed**: User requests magic link, waits 10 minutes, requests again, now has two links and first one arrives, they click old one which is invalidated. Fix by showing "Check spam folder" message, allowing resend after 60 seconds only, making both links valid for 15 minutes.
- [x] **Password Requirements Not Shown Until Fail**: User creates password, submits, told it needs special character. Creates new one, needs number. Creates new one, needs 12 characters. Fix by showing all requirements upfront with real-time checkmarks as requirements met.
- [x] **Case Sensitivity Confusion**: User registers with Email@Domain.com, later tries logging in with email@domain.com, system says account doesn't exist. Fix by normalizing email to lowercase on registration and login.
- [x] **Caps Lock Not Detected**: User has caps lock on, types password, fails repeatedly, thinks they forgot password. Fix by detecting caps lock and showing warning near password field.
- [x] **Browser Autofill Breaks Login**: Browser autofills old password, user doesn't notice, login fails. Fix by clearing password field on failed attempt, showing what was submitted in plain text option temporarily.
- [x] **Session Expires During Form Entry**
  *Context*: User types long description, hits save, redirected to login, loses work.
  *Fix*: Auto-save drafts to local storage, show "Session expiring" warning 2 mins before. *Implemented auto-save in forms.*
- [x] **Multiple Tabs Session Conflict**
  *Context*: Logout in Tab A, click "Save" in Tab B → Crash or data corruption.
  *Fix*: Use `BroadcastChannel` to sync session state across tabs. *Implemented logout sync.*
- [x] **SSO Redirect Loop**
  *Context*: Enterprise user stuck bouncing between Google and App.
  *Fix*: Detect loop (3+ redirects in 10s), stop and show "Login Error" with clear manual button. *Implemented loop detection and manual clear.*
- [x] **Account Locked, No Way to Unlock**
  *Context*: Too many failed attempts, no "Unlock via Email" option visible.
  *Fix*: Auto-send unlock link after 5 failed attempts, or show CAPTCHA before locking. *Added precise Retry-After countdown and improved messaging.*
- [x] **Forgot Password for Wrong Account Type**
  *Context*: User tries reset on SSO account, gets confusing error.
  *Fix*: Detect SSO email, say "Please login with Google" instead of sending reset link. *Added handling for admin emails in customer portal.*
- [x] **Two-Factor Recovery Missing**
  *Context*: Lost phone, no backup codes offered during setup.
  *Fix*: Force download of backup codes on 2FA setup. *Implemented backup code generation, storage, and verified recovery flow.*
- [x] **Invite Link Used By Wrong Person**
  *Context*: Admin forwards invite email to team list, random person claims it.
  *Fix*: Bind invite token to specific email, require that email to register. *Added email mismatch check on accept.*

## Account & Billing Chaos

- [x] **Trial Ends With No Warning**
  *Context*: Surprise charge on day 15.
  *Fix*: Send "3 days left" and "1 day left" emails. Show banner in dashboard.
- [x] **Cannot Export Data Before Canceling**
  *Context*: User wants to leave, but can't get their data out without paying again.
  *Fix*: Allow data export for "Cancelled" accounts for 30 days.
- [x] **Charged After Cancellation**
  *Context*: Cancelled on 30th, charged on 31st due to timezone diff.
  *Fix*: Cancel immediately or at period end (user choice), send "Cancellation Confirmed" email.
- [x] **Auto-Renewal Not Disclosed**
  *Context*: User didn't know annual plan renews automatically.
  *Fix*: Clearly state "Renews automatically on [Date]" at checkout.
- [x] **Cannot Downgrade Due to Limits**
  *Context*: User deletes items to fit lower plan, still blocked.
  *Fix*: Re-check limits *after* deletion, allow downgrade if within limits.
- [x] **Proration Math Unclear**: Upgrading mid-cycle doesn't show credit amount applied. *Redirecting existing subs to Billing Portal.*
- [x] **Invoice Missing Required Info**: PDF rendering missing tax ID, business address. *Added to InvoiceDetailPage header.*
- [ ] **Tax Calculated Wrong**
  *Context*: Digital goods tax rules applied incorrectly for user location.
  *Fix*: integrate Stripe Tax or Avalara, don't home-roll tax logic.
- [x] **Multiple Subscriptions Accidentally Created**: User clicked "Pay" twice -> 2 subscriptions. *Added idempotencyKey and existing sub check.*
- [ ] **Currency Confusion**
  *Context*: User sees $, pays in €, gets charged conversion fee.
  *Fix*: Auto-detect country, show local currency if supported, or explicitly state "USD".
- [ ] **Grandfathered Pricing Lost**
  *Context*: User updates card, system resets them to new higher price.
  *Fix*: Decouple "Payment Method Update" from "Plan Change".
- [ ] **Refund Takes Forever**
  *Context*: Support says "Refunded", user sees nothing for 10 days.
  *Fix*: Send automatic "Refund Receipt" with "5-10 business days" expectation.

## Data Disasters

- [x] **Import Succeeds With Silent Failures**: User imports 1000 records, system says "Import complete," actually only imported 847 due to validation errors not shown. Fix by showing detailed import report with success count, failure count, and specific failure reasons with row numbers. *Implemented detailed validation and error reporting with validation summary download.*
- [x] **Import Mismatches Columns**: User's CSV has columns in different order than expected, system imports wrong data into wrong fields. Fix by showing column mapping preview before import, auto-detecting likely matches, requiring confirmation. *Implemented multi-step import wizard with auto-mapping and validation.*
- [x] **Export Times Out**: User tries exporting 50,000 records, request times out, no partial file, no error, just spinning forever. Fix by implementing background export for large datasets, email when ready, showing progress, allowing download when complete. *Implemented background export functionality using Edge Functions and Storage, with status tracking in UI.*
- [x] **Export Missing Related Data**: User exports orders but export doesn't include customer details, product names, or line items. Fix by offering export options for related data, including common related fields by default, documenting export contents. *Updated QuickExport to fetch and map customer profiles and order items/products.*
- [x] **Decimal Separator Import Fail**: European user's CSV uses comma as decimal separator. System interprets "10,50" as text not 10.50. Fix by detecting locale from file or user settings, offering decimal separator selection in import options. *Implemented Product Import with configurable decimal separator and auto-mapping.*
- [x] **Date Format Interpretation Wrong**: CSV has "01/02/2024" meaning February 1 but system interprets as January 2. Fix by requiring date format selection before import, showing preview of interpreted dates for confirmation. *Implemented Date Format selector in Customer Import.*
- [x] **UTF-8 Encoding Failures**: User's customer names include accents or non-Latin characters. Import shows "José" as "JosÃ©" or similar garbage. Fix by defaulting to UTF-8, auto-detecting encoding, allowing encoding selection. *Implemented encoding selection in Product Import.*
- [x] **Leading Zeros Stripped**: User imports phone numbers, Excel stripped leading zeros, "07700" becomes "7700", now all phone numbers wrong. Fix by treating phone fields as text not numbers, warning about Excel behavior, accepting quoted values. *Implemented logic to treat Phone as text and added UI warning.*
- [x] **Empty Fields Interpreted as Null vs Empty String**: User wants to clear a field via import using empty value but system ignores empty cells. Fix by documenting behavior, offering "clear field" option via special value like "[CLEAR]". *Implemented "Treat empty cells as NULL" checkbox.*
- [x] **Scientific Notation in Large Numbers**: User's product SKUs are long numbers, Excel converted to scientific notation, imports as "1.23E+15" not the actual number. Fix by treating SKUs as text, warning about Excel behavior. *Implemented SKU sanitization logic to expand scientific notation and added UI warning.*
- [ ] **Merge Conflict Resolution Missing**: User tries merging duplicate customers with conflicting data in same field. System picks one arbitrarily. Fix by showing conflicts, letting user choose per field, or keeping both values where possible.
- [ ] **Accidental Mass Update**: User filters to one record, updates field, but filter was silently cleared, actually updated all 5000 records. Fix by showing clear count of "This will update X records", requiring confirmation for bulk updates, making filters persistent and visible.
- [ ] **Cascade Delete Unexpected**: User deletes customer, system also deletes all their orders, invoices, payment history. Fix by warning about related records that will be affected, offering archive instead of delete, or preventing delete if related records exist.
- [ ] **Restore Brings Back Outdated Data**: User restores deleted record from 30 days ago but related records changed since then. Now references are broken or data inconsistent. Fix by validating references on restore, warning about potential issues, offering to reconnect relationships.

## Search & Filtering Frustrations

- [ ] **Search Doesn't Search Everywhere**: User searches "ABC Company", exists as customer name but search only searches orders. User thinks they don't have this customer. Fix by implementing global search across all entity types, clearly showing which entities searched.
- [ ] **Partial Match Doesn't Work**: User searches "john" but customer is "John Smith". No results because case sensitivity or no partial match. Fix by implementing case-insensitive partial match by default, searching from beginning of any word in field.
- [ ] **Search Special Characters Breaks**: User searches for "O'Brien" or "Ben & Jerry's", query breaks due to unescaped characters. Fix by properly escaping all search input, handling apostrophes, ampersands, quotes gracefully.
- [ ] **Phone Number Format Searching**: User searches "555-1234" but phone stored as "5551234" or "(555) 123-4567". No match. Fix by normalizing phone numbers for search, stripping formatting from both stored data and search query.
- [ ] **Old Search Results Cached**: User searches, gets results, colleague adds matching record, user searches again, new record not in results due to search index lag. Fix by ensuring search index updates quickly, offering manual refresh, showing "indexed as of" timestamp.
- [ ] **Filter Dropdown Loads Forever**: User clicks status filter, dropdown tries to load 10,000 distinct values, freezes. Fix by limiting dropdown options, implementing typeahead search in dropdown, showing common values first.
- [ ] **Cannot Combine Search and Filter**: User searches for "john" and also wants to filter by status "active", but search clears filters or vice versa. Fix by making search and filters work together, showing combined query clearly.
- [ ] **No Negative Search**: User wants all orders NOT containing "test". No way to exclude terms. Fix by supporting minus operator like "-test" or NOT syntax, or adding exclude filter option.
- [ ] **Search Within Results Missing**: User searches, gets 500 results, wants to search within those. Starting new search resets to all records. Fix by offering "search within results" option, maintaining filter context.
- [ ] **Saved Search Breaks After Schema Change**: User saved search filtering by custom field that no longer exists. Saved search fails or returns wrong results. Fix by validating saved searches on load, notifying user of broken filters, allowing easy fix.

## Form & Input Insanity

- [x] **Phone Number Validation Too Strict**: User has international number, system only accepts US format, rejects valid number. Fix by accepting international format, using libphonenumber for validation, not enforcing country-specific format. *Implemented E.164-compatible regex in `formValidation.ts`.*
- [x] **Email Validation Rejects Valid Email**: System rejects "name+tag@domain.com" or "user@subdomain.domain.co.uk" due to overly strict regex. Fix by using proper email validation that handles all valid formats. *Verified regex in `formValidation.ts` accepts +tags and subdomains.*
- [ ] **Address Autocomplete Wrong Country**: US user starts typing address, autocomplete shows UK results first or only. Fix by defaulting to user's country, allowing country selection, using location-aware autocomplete.
- [ ] **Address Autocomplete Requires Selection**: User types full address manually, system requires selecting from dropdown, autocomplete doesn't show exact match. Fix by allowing manual entry bypass, matching user input even if not selected from dropdown.
- [ ] **Cannot Paste Into Phone Field**: User tries pasting phone number from clipboard, field strips or rejects it due to paste handler. Fix by allowing paste, cleaning up pasted value automatically.
- [ ] **Tab Key Doesn't Move to Next Field**: User presses tab expecting to move to next input, nothing happens or focus goes somewhere unexpected. Fix by auditing tab order, ensuring logical tab sequence through form, not skipping fields.
- [ ] **Enter Key Submits Partially Complete Form**: User presses enter in text field, form submits before they're done. Fix by only submitting on button click or explicit submit action, not enter key in text fields except final field.
- [ ] **Dropdown Not Keyboard Navigable**: User tries using arrow keys in dropdown, nothing happens, must use mouse. Fix by implementing proper keyboard navigation in all custom dropdowns.
- [ ] **Multi-Select Confusing**: User selects multiple items, clicks elsewhere, unclear if selection saved. Fix by showing selected items clearly as tags, confirming "X items selected", obvious save action.
- [ ] **Rich Text Editor Inconsistent**: User pastes from Word, formatting explodes, massive fonts and weird spacing. Fix by stripping or normalizing pasted formatting, offering "paste as plain text" option.
- [ ] **Emoji in Text Field Breaks**: User includes emoji in notes, saves successfully but emoji displays as "?" or breaks field. Fix by ensuring database and fields support UTF-8 including emoji, testing with emoji content.
- [ ] **Required Field Not Focusable**: Required field fails validation but field is in collapsed section or scrolled out of view. User cannot see what's wrong. Fix by scrolling to first error, expanding collapsed sections containing errors, focusing the field.
- [ ] **File Upload Size Limit Not Shown**: User tries uploading 50MB file, uploads for 2 minutes, then fails with "file too large". Fix by showing size limit before upload, checking file size client-side immediately, preventing upload of too-large files.
- [ ] **File Upload Wrong Type Silent Fail**: User uploads .docx when system expects .pdf, no error shown but file not saved or processed. Fix by showing allowed types clearly, validating immediately on selection, rejecting with clear message.
- [ ] **Numeric Field Allows Letters**: Price field accepts "abc", saves successfully, breaks calculations later. Fix by enforcing numeric input, preventing letter entry, showing clear error.
- [ ] **Negative Number Unexpected**: User enters refund as -50, system interprets as positive or breaks. Fix by documenting expected format, handling negative values explicitly, or preventing negative entry if not applicable.

## Display & Rendering Disasters

- [ ] **Timezone Shows Server Time**: User in California sees order timestamp as "3:00 PM" but it's actually noon their time because showing UTC or server timezone. Fix by storing times in UTC, displaying in user's timezone, allowing timezone preference setting.
- [ ] **Date Format Regional Mismatch**: User in UK sees "12/01/2024" and interprets as December 1 but system meant January 12. Fix by using unambiguous format like "Jan 12, 2024" or allowing date format preference.
- [ ] **Currency Symbol Wrong**: User in Canada sees "$50" but system means USD not CAD. Fix by showing currency code like "USD 50" or "CA$50", being explicit about currency everywhere.
- [ ] **Long Text Truncated Without Indication**: Customer name "Very Long Business Name International LLC" shows as "Very Long Busines" with no ellipsis or indication there's more. Fix by adding ellipsis, showing full text on hover, ensuring key info not truncated.
- [ ] **Table Columns Cut Off**: User on smaller screen cannot see important columns, no horizontal scroll, no way to access data. Fix by implementing responsive table with horizontal scroll, column hiding/reordering, priority columns always visible.
- [ ] **Print Stylesheet Missing**: User prints invoice or report, comes out with navigation elements, broken layout, missing data. Fix by creating proper print stylesheets, offering PDF download, preview before printing.
- [ ] **PDF Generation Different From Screen**: What user sees on screen differs from generated PDF. Formatting, fonts, or data missing. Fix by using consistent PDF generation, previewing before download, using same styling.
- [x] **Dark Mode Not Supported**: User has OS in dark mode, FloraIQ blasts them with white screen at night. Fix by implementing dark mode, auto-detecting system preference, allowing user toggle. *Implemented via `ThemeContext.tsx` and `ThemeToggle.tsx`.*
- [ ] **Charts Don't Update**: User changes date filter, table updates but chart still shows old data. Fix by ensuring charts re-render on filter change, showing loading state during update.
- [ ] **Responsive Images Missing**: Product images load full 5MB originals on mobile, killing data and load time. Fix by serving responsive images, using srcset, compressing appropriately for display size.
- [ ] **Zero vs Null Display**: Field with 0 shows blank, field with nothing also shows blank. User cannot distinguish. Fix by showing "0" explicitly for zero values, using dash or "N/A" for null.
- [ ] **Status Colors Not Accessible**: Color-blind user cannot distinguish red "overdue" from green "complete" status. Fix by using patterns or icons in addition to color, testing with color blindness simulators.

## Notification Nightmares

- [ ] **Notification Email Links Broken**: User clicks link in notification email, gets 404 or permission error. Fix by testing all notification links, handling deleted or access-changed records gracefully, never hardcoding URLs.
- [ ] **Notification For Own Actions**: User creates order, gets notification "New order created." Unnecessary noise. Fix by not notifying users of their own actions, or making this configurable.
- [ ] **Notification Timing Wrong**: User gets "New order" notification 3 hours after order was placed due to queue delay. Fix by prioritizing time-sensitive notifications, showing timestamp in notification.
- [ ] **Cannot Reply to Notification Email**: User replies to notification email, reply goes to no-reply address, they think they responded to customer. Fix by making reply-to meaningful or clearly stating "Do not reply" with link to respond in app.
- [ ] **Notification Preferences Not Granular**: User wants email for new orders but not for inventory updates. Only option is all or nothing. Fix by category-level notification preferences, per-event toggles for important ones.
- [ ] **Push Notifications Don't Work After Denied Once**: User denied push permission once, now wants to enable, no way to trigger permission prompt again. Fix by showing instructions to enable in browser settings, detecting denied state and showing guidance.
- [ ] **Notification Count Badge Wrong**: Red badge shows 5 notifications, user opens notifications, sees 2. Count stuck or wrong. Fix by syncing count with actual unread notifications, clearing count on open.
- [ ] **Notification Disappears Before Read**: Toast notification appears for 2 seconds while user typing, gone before they could read it. Fix by extending duration for important notifications, not auto-dismissing critical ones, keeping in notification center.
- [ ] **Duplicate Notifications**: Same event triggers notification twice, user confused or annoyed. Fix by deduplicating notification creation, checking if notification for this event already exists.
- [ ] **Notification Sound Unmutable**: User in quiet office, notification blares sound they cannot disable. Fix by making sounds optional, respecting system mute settings, defaulting to no sound.

## Performance & Technical Issues

- [ ] **Memory Leak Crashes Browser**: User leaves tab open for 8-hour shift, browser tab crashes or system slows to crawl. Fix by auditing component cleanup, clearing old data from state, implementing memory monitoring.
- [ ] **Infinite Scroll Janky**: User scrolls through long list, stutters and jumps. Fix by implementing virtualization, recycling DOM elements, debouncing scroll handlers.
- [ ] **Realtime Updates Cause Jank**: Realtime subscription updates data causing visible jumps or re-renders disrupting user flow. Fix by batching updates, animating changes smoothly, not re-ordering list while user viewing.
- [ ] **API Rate Limited Without Warning**: User doing normal operations, suddenly actions fail with no explanation, actually rate limited. Fix by showing rate limit status, warning when approaching limit, queuing requests gracefully.
- [ ] **Concurrent Edit Conflict**: Two users edit same record simultaneously, last save wins, first user's changes lost without warning. Fix by implementing optimistic locking, detecting concurrent edit, showing conflict resolution UI.
- [ ] **WebSocket Disconnects Silently**: User's connection drops, they keep working thinking changes are saving, nothing actually persisting. Fix by detecting disconnection, showing offline banner, queuing changes for sync on reconnect.
- [ ] **Background Tab Throttled**: User switches tabs, browser throttles FloraIQ tab, realtime stops, timers break. Fix by detecting tab visibility, reconnecting on tab focus, handling throttling gracefully.
- [ ] **Service Worker Serves Stale Content**: User sees old version of app after update due to cached service worker. Refresh doesn't help. Fix by implementing proper cache invalidation, showing update prompt, forcing reload when version mismatch.
- [ ] **Third Party Script Blocks Load**: Analytics or chat widget fails to load, blocks entire page render. Fix by loading third-party scripts async, not blocking on their completion, having timeouts.
- [ ] **Browser Extension Conflicts**: User's ad blocker or other extension breaks FloraIQ functionality. Fix by detecting common issues, showing guidance, using more extension-friendly patterns.

## Mobile & Touch Specific Issues

- [ ] **Touch Target Too Small**: User tries tapping small icon or link, misses repeatedly, taps wrong thing. Fix by ensuring all touch targets minimum 44x44 pixels, adding padding to interactive elements.
- [ ] **Hover States Stuck on Mobile**: User taps button, hover state activates and stays stuck until tapping elsewhere. Fix by disabling hover styles on touch devices, using active states instead.
- [ ] **Swipe Conflicts With Scroll**: User tries swiping to delete but page scrolls instead, or vice versa. Fix by detecting gesture intent, requiring more deliberate swipe gesture, showing swipe hint.
- [ ] **Keyboard Covers Form**: User typing in bottom half of screen, keyboard covers input, cannot see what's typing. Fix by scrolling input into view above keyboard, adjusting viewport when keyboard opens.
- [ ] **Double Tap Zoom Breaks Fast Actions**: User tries rapidly tapping, triggers zoom instead of two clicks. Fix by preventing double-tap zoom on interactive elements, using proper touch event handling.
- [ ] **Pull to Refresh Conflicts**: User tries scrolling down from top, triggers refresh instead. Fix by disabling pull-to-refresh if implementing custom scroll, or ensuring it only triggers with deliberate pull.
- [ ] **Landscape Mode Broken**: User rotates phone, layout breaks or content hidden. Fix by testing landscape orientation, ensuring responsive layout works in both orientations.
- [ ] **Offline Data Out of Sync**: User works offline, comes back online, offline changes conflict with server changes. Fix by implementing proper sync conflict resolution, showing conflicts to user, allowing merge.
- [ ] **App vs Browser Confusion**: User has both mobile app and browser bookmarks, data different between them due to caching or sync issues. Fix by ensuring consistent behavior, syncing properly, using same codebase where possible.
- [ ] **iOS Safari Specific Issues**: 100vh not working correctly, bottom bar covering content, rubber band scrolling breaking fixed elements. Fix by using Safari-specific CSS fixes, testing on actual iOS devices.

## Multi-Tenant & Team Issues

- [ ] **Seeing Other Tenant's Data**: User somehow sees data from another business due to RLS failure or query error. Critical security issue. Fix by auditing all queries include tenant_id filter, testing RLS extensively, logging and alerting on cross-tenant access attempts.
- [ ] **Invited User Joins Wrong Tenant**: Invite link forwarded or guessed, wrong person joins team. Fix by tying invite to specific email, verifying email matches invite before allowing join.
- [ ] **Cannot Remove Last Admin**: Admin tries leaving or being removed, system should prevent losing all admin access. Fix by requiring at least one admin, showing error if trying to remove last admin.
- [ ] **Role Changes Not Reflected Until Re-Login**: Admin changes user's role, user still has old permissions until they log out and back in. Fix by checking permissions fresh on each request, or forcing session refresh on permission change.
- [ ] **Team Member Sees Data They Shouldn't After Role Change**: User downgraded from admin to viewer, still sees admin-only data cached in their browser. Fix by clearing client-side cache on permission change, re-fetching data with new permissions.
- [ ] **Deleted User Still Appears in Dropdowns**: User removed from team but still shows in "Assigned to" dropdowns. Fix by filtering deleted users from active user lists, keeping in historical references only.
- [ ] **Personal Data Shared With Team**: User's personal notes or drafts visible to teammates when should be private. Fix by implementing proper visibility settings, defaulting sensitive fields to private.
- [ ] **Activity Feed Shows Hidden Actions**: Activity log shows "Admin changed salary to X" when salary should be confidential. Fix by auditing what appears in activity feeds, respecting field-level privacy.

## Workflow & Automation Failures

- [ ] **Automation Triggers Multiple Times**: Event fires, automation runs, automation causes event again, infinite loop. Fix by adding loop detection, marking records as "processing", limiting automation runs per record per minute.
- [ ] **Automation Fails Silently**: Automation supposed to send email, email sending fails, no notification of failure, user thinks email sent. Fix by logging automation runs with results, notifying on failure, showing automation history.
- [ ] **Automation Order Matters But Cannot Be Set**: Multiple automations trigger on same event, order of execution matters but is random. Fix by allowing priority/order setting on automations, documenting execution order.
- [ ] **Time-Based Automation Time Zone**: Automation set to run at 9 AM but runs at 9 AM server time not user's time zone. Fix by allowing timezone selection for time-based triggers, defaulting to tenant timezone.
- [ ] **Automation Stops Working After Field Rename**: Automation references "Status" field, admin renames field to "Order Status", automation silently fails. Fix by using field IDs not names internally, or detecting and warning about broken references.
- [ ] **Cannot Test Automation Without Real Data**: User wants to test automation but it will affect real records or send real emails. Fix by offering test mode that simulates without executing, or sending to test email addresses.
- [ ] **Automation Includes Deleted Records**: Batch automation processes deleted/archived records it shouldn't. Fix by explicitly filtering for active records in automation queries.
- [ ] **Scheduled Automation Missed**: Server restart or deploy happens during scheduled time, automation doesn't run. Fix by implementing catch-up logic for missed schedules, logging missed runs, alerting on gaps.

## Integration Specific Problems

- [ ] **OAuth Consent Screen Scary**: User connecting Google integration sees permission request for "Read all your email" when app only needs calendar. Declines out of fear. Fix by requesting minimal necessary scopes, explaining each permission clearly.
- [ ] **Integration Syncs Wrong Direction**: User expects integration to pull data from external system, instead it pushes and overwrites their external data. Fix by clearly labeling sync direction, confirming before first sync, allowing dry run preview.
- [ ] **Integration Sends Duplicate Data**: Each sync creates new records instead of updating existing, duplicates pile up. Fix by using proper external ID tracking, implementing upsert logic.
- [ ] **Rate Limited by External API**: Integration tries to sync 10,000 records, external API rate limits after 100, sync fails partway. Fix by implementing rate limiting on sync, spreading requests over time, resuming from failure point.
- [ ] **Integration Auth Expires Over Weekend**: OAuth token expires after 7 days, user doesn't use integration for week, comes back to broken integration. Fix by refreshing tokens proactively, checking and refreshing before each operation.
- [ ] **Webhook Secret Exposed**: Webhook configuration shows secret in plain text, visible in logs, security risk. Fix by masking secrets after initial display, not logging secrets, using proper secret management.
- [ ] **Webhook Verification Skipped**: Anyone can POST to webhook endpoint pretending to be integration partner. Fix by verifying webhook signatures, checking IP allowlists where available.
- [ ] **Integration Maps Fields Once Then Stuck**: Initial field mapping set, later user adds new fields in external system, no way to update mapping. Fix by allowing re-mapping, detecting new fields, prompting to map unmapped fields.

## Localization & International Issues

- [ ] **Numbers Formatted Wrong for Locale**: User in Germany sees "1,234.56" instead of expected "1.234,56". Fix by detecting and respecting user locale, allowing locale preference.
- [ ] **Translation Missing or Wrong**: Interface partially translated, some English text remains, or translation is wrong/awkward. Fix by completing translation coverage, having native speakers review, allowing user language override.
- [ ] **Right-to-Left Layout Broken**: Arabic or Hebrew user sees broken layout with overlapping text. Fix by implementing proper RTL stylesheet, testing with RTL languages.
- [ ] **Currency Conversion Outdated**: System converts currencies using old exchange rates, financial calculations wrong. Fix by using up-to-date exchange rate API, showing rate timestamp, allowing manual rate entry.
- [ ] **Address Format Wrong for Country**: System expects US format with state and ZIP, other countries don't have states or have different postal code formats. Fix by making address fields flexible per country, not requiring inapplicable fields.
- [ ] **Phone Country Code Handling**: User enters phone without country code, system assumes wrong country. Fix by defaulting to tenant's country, allowing explicit country code, showing expected format.
- [ ] **Character Limit Breaks Translations**: English UI fits, German translation of same text overflows button. Fix by testing UI with longest translations, allowing text flexibility, using truncation with tooltip.
- [ ] **Sort Order Wrong for Language**: Alphabetical sort puts "Zürich" at end instead of with Z, or Japanese/Chinese sorting broken. Fix by using locale-aware sorting functions.

## Edge Cases That Break Things

- [ ] **User Has Zero Records**: Brand new user with no data, code assumes at least one record exists, divides by zero or crashes on empty array. Fix by handling empty states throughout, checking for null/empty before operations.
- [ ] **User Has Millions of Records**: Power user accumulated 2 million transaction records over years, system designed for thousands, everything slow or crashes. Fix by implementing pagination everywhere, archiving old data, optimizing queries for scale.
- [ ] **Record Has Max Length Content**: User puts entire novel in "Notes" field, breaks display, crashes export, database rejects. Fix by implementing field length limits, validating before save, handling gracefully.
- [ ] **Record Has Only Spaces**: User enters "   " as name, passes empty check because length is 3, but displays as blank. Fix by trimming whitespace before validation, rejecting empty-after-trim.
- [ ] **Record Has Special Characters**: Name is "<script>alert('xss')</script>" or "Robert'); DROP TABLE orders;--". Fix by sanitizing all input, using parameterized queries, encoding output.
- [ ] **Record Has No-Break Spaces**: Copy-pasted text includes Unicode no-break spaces, search for "John Smith" doesn't find "John Smith" with no-break space. Fix by normalizing whitespace characters.
- [ ] **Date is February 29**: Record has date Feb 29, 2024, code increments year to 2025, Feb 29 doesn't exist, date calculation fails. Fix by using proper date libraries that handle leap years.
- [ ] **Date is Year 2000 or 1970**: User enters historical date, system interprets as epoch or fails Y2K check. Fix by supporting full date ranges, testing with boundary dates.
- [ ] **Time is Midnight or 23:59**: Edge of day calculations wrong, order at 23:59:59 counted in wrong day. Fix by using consistent time boundaries, being explicit about inclusive vs exclusive.
- [ ] **Name is Single Character**: User named "J" or customer name is just "A", validation rejects as "too short". Fix by allowing legitimate short names, setting reasonable minimums.
- [ ] **Name Contains Numbers**: Business name "3M Company" or person named "50 Cent", validation rejects. Fix by allowing numbers in name fields.
- [ ] **Email is Very Long**: Email "very.long.email.address.with.many.parts.and.subdomains@subdomain.of.long.domain.name.com" exceeds field length. Fix by allowing realistic maximum email length (254 characters per RFC).
- [ ] **Price is Zero**: Free product with $0 price, code divides by price or assumes minimum, breaks. Fix by explicitly handling zero price case throughout.
- [ ] **Price is Very Large**: Wholesale price of $1,000,000, exceeds integer storage, overflows. Fix by using appropriate numeric types, testing with large values.
- [ ] **Quantity is Decimal**: User needs 1.5 kilograms, system only accepts whole numbers. Fix by allowing decimals where appropriate, being explicit about unit handling.
- [ ] **Negative Quantity**: Return or adjustment needs negative quantity, system rejects or breaks calculations. Fix by explicitly supporting negatives where meaningful, preventing where not.
- [ ] **ID is 0 or Negative**: Some code treats ID 0 as "no selection" but record with ID 0 exists, or negative ID from bug causes issues. Fix by using null/undefined for no selection, validating IDs are positive.
- [ ] **Circular Reference**: Product A contains Product B, Product B contains Product A, infinite loop in calculation. Fix by detecting circular references, preventing creation, handling gracefully if exists.
- [ ] **Self-Reference**: Record references itself, code loops infinitely. Fix by preventing self-reference, detecting and handling if exists.
- [ ] **UUID Collision**: Astronomically unlikely but two records somehow get same UUID, chaos ensues. Fix by handling uniqueness constraint violation gracefully, regenerating on collision.
- [ ] **Concurrent Account Deletion**: Admin deletes user account while user is actively logged in and working. User's next action fails mysteriously. Fix by immediately invalidating session on account deletion, showing clear message.

## Super Admin Specific Issues

- [ ] **Impersonation Doesn't Fully Switch Context**: Super admin impersonates tenant but some API calls still use admin context, causing data access issues or wrong tenant being modified. Fix by fully switching context on impersonation, auditing all endpoints use impersonated context.
- [ ] **Impersonation Actions Not Clearly Logged**: Super admin does something while impersonating, audit log shows tenant user did it, no indication it was support impersonation. Fix by logging impersonation sessions separately, marking actions done during impersonation.
- [ ] **Super Admin Creates Invalid Data**: Super admin bypasses validation through admin tools, creates data that breaks tenant's system. Fix by applying same validation in admin tools, or showing warnings for invalid data.
- [ ] **Bulk Operation Timeout**: Super admin tries bulk operation on all tenants, HTTP request times out, partial completion, no way to know where it stopped. Fix by making bulk operations async/background, showing progress, allowing resume.
- [ ] **Admin Panel Accessible to Non-Admin**: Broken permission check allows regular user to access admin routes. Fix by checking admin permission on every admin route, auditing access controls.
- [ ] **Support Cannot Reproduce Issue**: User reports bug, support cannot see what user sees due to different data or state. Fix by implementing better logging, session replay, tools, or full impersonation capability.
- [ ] **Changing System Setting Breaks Everything**: Super admin changes global configuration, system immediately breaks for all tenants. Fix by validating configuration changes, allowing preview/rollback, deploying setting changes gradually.

## Audit & Compliance Problems

- [ ] **Audit Log Missing Critical Events**: Important action like deleting customer not logged, no audit trail for compliance. Fix by auditing all data modifications, treating audit logging as critical as the action itself.
- [ ] **Audit Log Can Be Modified**: Admin can delete or modify audit entries, defeating purpose. Fix by making audit log immutable, storing separately with different permissions.
- [ ] **Cannot Export Audit Data**: Compliance requires audit export, export feature doesn't include audit logs. Fix by adding audit log export, allowing date range filtering.
- [ ] **Data Retention Violates Regulations**: System keeps deleted customer data forever, GDPR requires deletion. Fix by implementing proper data retention policies, allowing real deletion, documenting retention periods.
- [ ] **Cannot Prove Deletion**: Regulator asks for proof customer data was deleted, no record that deletion occurred. Fix by logging deletion events (not the deleted data), providing deletion certificates.
- [ ] **PII Exposed in Logs**: Customer emails, addresses, or other PII visible in application logs or error reports. Fix by sanitizing logs, masking PII, reviewing logging practices.

## Recovery & Support Scenarios

- [ ] **User Locked Out Cannot Contact Support**: User cannot log in, support contact requires login, no way to get help. Fix by having public contact option, email support available without login.
- [ ] **Cannot Reproduce Bug**: User reports intermittent bug, support cannot reproduce, issue closed, user frustrated. Fix by implementing better error logging, session replay, asking for screenshots/videos, enabling debug mode.
- [ ] **Support Makes It Worse**: Support tries to fix issue, accidentally deletes or corrupts user data. Fix by having backup before support actions, using staging environment for testing fixes, having rollback capability.
- [ ] **User Wants Data After Account Closed**: User closed account, later wants data back, data already purged. Fix by having retention period after closure, offering export before closure, warning about data deletion.
- [ ] **Account Recovery With Minimal Info**: User lost access to email and phone, support cannot verify identity, account unrecoverable. Fix by implementing additional recovery methods during signup, security questions, trusted contacts.
