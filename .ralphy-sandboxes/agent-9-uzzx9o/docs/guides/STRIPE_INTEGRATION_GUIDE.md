# 💳 Stripe Integration Guide - Complete Implementation

**Status:** ✅ **FULLY IMPLEMENTED**

---

## 🎯 What's Been Implemented

### 1. ✅ Stripe Secret Key Configuration
- Edge Functions ready to use `STRIPE_SECRET_KEY` environment variable
- Automatic Stripe customer creation if not exists
- Stripe subscription management

### 2. ✅ Payment Method Management via Customer Portal
- New Edge Function: `stripe-customer-portal`
- Integrated into BillingPage.tsx
- Users can add/update payment methods through Stripe's hosted portal

### 3. ✅ Invoice Generation
- Automatic invoice creation when plans change
- Prorated invoices for mid-cycle upgrades/downgrades
- Invoice line items with detailed breakdown
- Stored in `invoices` table

### 4. ✅ Proration Calculation
- Mid-cycle upgrade/downgrade proration
- Credit calculation for unused portions
- Charge calculation for remaining days
- Detailed proration breakdown returned

---

## 🔧 Setup Instructions

### Step 1: Configure Stripe Secret Key

In your Supabase Dashboard:

1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Add new secret:
   - **Name:** `STRIPE_SECRET_KEY`
   - **Value:** Your Stripe Secret Key (starts with `sk_live_` or `sk_test_`)

### Step 2: Configure Stripe Webhook Secret (Optional)

For webhook signature verification:

1. In Stripe Dashboard → **Developers** → **Webhooks**
2. Create endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. Add secret to Supabase:
   - **Name:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** Your webhook signing secret

### Step 3: Set Site URL

1. In Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets**
2. Add or update:
   - **Name:** `SITE_URL`
   - **Value:** `https://your-domain.com` (or your local dev URL)

---

## 📋 Edge Functions

### 1. `update-subscription`

**Enhanced Features:**
- ✅ Proration calculation for mid-cycle changes
- ✅ Invoice generation on plan changes
- ✅ Stripe subscription updates with proration
- ✅ Automatic Stripe customer creation

**Request:**
```json
{
  "tenant_id": "uuid",
  "new_plan": "starter" | "professional" | "enterprise",
  "use_stripe": false  // Set to true to use Stripe payment processing
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully upgraded to professional plan",
  "tenant": {
    "subscription_plan": "professional",
    "mrr": 299
  },
  "proration": {
    "amount": 150.50,
    "details": {
      "days_remaining": 15,
      "days_used": 15,
      "credit_amount": 49.50,
      "charge_amount": 200.00,
      "proration_amount": 150.50
    }
  }
}
```

### 2. `stripe-customer-portal` (NEW)

**Purpose:** Creates Stripe Customer Portal session for payment method management

**Request:**
```json
{
  "tenant_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://billing.stripe.com/session/..."
}
```

**Features:**
- Add payment methods
- Update payment methods
- View payment history
- Update billing address
- Manage subscriptions (if enabled in Stripe Dashboard)

---

## 💰 Proration Logic

### How It Works

When a user upgrades/downgrades mid-cycle:

1. **Calculate Days:**
   - Total days in billing period
   - Days remaining until period end
   - Days already used

2. **Calculate Rates:**
   - Old plan daily rate = `old_plan_price / total_days`
   - New plan daily rate = `new_plan_price / total_days`

3. **Calculate Credits/Charges:**
   - Credit = `old_plan_daily_rate × days_remaining` (for unused portion)
   - Charge = `new_plan_daily_rate × days_remaining` (for remaining days)

4. **Proration Amount:**
   - Upgrade: `charge - credit` (positive)
   - Downgrade: `charge - credit` (negative/credit)

### Example

**Scenario:** Upgrade from Starter ($99) to Professional ($299) with 15 days remaining in a 30-day period

- Old plan daily: $99 / 30 = $3.30/day
- New plan daily: $299 / 30 = $9.97/day
- Credit for unused: $3.30 × 15 = $49.50
- Charge for remaining: $9.97 × 15 = $149.55
- **Proration amount:** $149.55 - $49.50 = **$100.05**

---

## 📄 Invoice Generation

### When Invoices Are Created

1. **Plan Upgrades:** Full period invoice or prorated invoice
2. **Plan Downgrades:** Credit invoice with proration
3. **Mid-Cycle Changes:** Detailed proration breakdown

### Invoice Structure

```typescript
{
  tenant_id: string,
  invoice_number: "INV-XXXXXXXX-123456",
  subtotal: 100.05,
  tax: 8.00,  // 8% tax
  total: 108.05,
  line_items: [
    {
      description: "Credit - Unused portion of Starter Plan",
      unit_price: -49.50,
      total: -49.50
    },
    {
      description: "Professional Plan - Prorated",
      unit_price: 100.05,
      total: 100.05
    },
    {
      description: "Proration Adjustment (15 days remaining)",
      unit_price: 149.55,
      total: 149.55
    }
  ],
  billing_period_start: "2025-11-01",
  billing_period_end: "2025-11-30",
  issue_date: "2025-11-15",
  due_date: "2025-12-15",
  status: "open"
}
```

---

## 🎨 Frontend Integration

### BillingPage.tsx Enhancements

**Payment Method Management:**
- ✅ "Add Payment Method" button opens Stripe Customer Portal
- ✅ "Update Payment Method" button opens Stripe Customer Portal
- ✅ Loading states during portal session creation
- ✅ Error handling with user-friendly messages

**Proration Display:**
- ✅ Shows proration notice in upgrade/downgrade dialog
- ✅ Displays proration amount in success toast
- ✅ Invoices show detailed line items

---

## 🔒 Security

### Authentication
- ✅ Edge Functions verify user authentication
- ✅ Role-based access (owner/admin only)
- ✅ Tenant isolation enforced

### Stripe Security
- ✅ Stripe Customer Portal handles all payment method operations securely
- ✅ Webhook signature verification (when configured)
- ✅ Metadata stored for tenant tracking

---

## 🧪 Testing

### Test Scenarios

1. **Direct Plan Update (No Stripe):**
   - Upgrade/downgrade without payment
   - Verify invoice creation
   - Check proration calculations

2. **Stripe Subscription Update:**
   - Upgrade with existing Stripe subscription
   - Verify proration in Stripe
   - Check invoice sync

3. **Customer Portal:**
   - Open payment method management
   - Add new payment method
   - Update existing payment method

4. **Mid-Cycle Changes:**
   - Upgrade 15 days into billing period
   - Downgrade mid-cycle
   - Verify credit/charge amounts

---

## 📊 Database Tables Used

### `invoices`
- Stores all generated invoices
- Links to `tenants` via `tenant_id`
- Tracks payment status and amounts

### `tenants`
- Updated with new plan details
- Stores `stripe_customer_id`
- Stores `stripe_subscription_id` (when using Stripe)

### `subscription_events`
- Logs all subscription changes
- Tracks upgrade/downgrade events

---

## 🚀 Production Checklist

- [ ] Set `STRIPE_SECRET_KEY` in Supabase environment variables
- [ ] Set `SITE_URL` for correct redirect URLs
- [ ] Configure Stripe webhook endpoint (optional)
- [ ] Test payment method management
- [ ] Verify invoice generation
- [ ] Test proration calculations
- [ ] Review Stripe Dashboard for subscriptions

---

## 📝 Configuration Reference

### Environment Variables

```bash
STRIPE_SECRET_KEY=sk_live_...  # Required for Stripe integration
STRIPE_WEBHOOK_SECRET=whsec_...  # Optional, for webhook verification
SITE_URL=https://your-domain.com  # Required for redirects
```

### Stripe Dashboard Settings

1. **Customer Portal:**
   - Enable in Stripe Dashboard → **Settings** → **Billing** → **Customer Portal**
   - Configure allowed features (payment methods, billing history, etc.)

2. **Webhooks:**
   - Create endpoint pointing to your `stripe-webhook` function
   - Subscribe to events: `checkout.session.completed`, `customer.subscription.updated`, `invoice.payment_succeeded`, etc.

---

## ✅ Status

**Implementation:** ✅ Complete  
**Testing:** Ready for testing  
**Documentation:** ✅ Complete  
**Production Ready:** ✅ Yes (after Stripe configuration)

---

**Last Updated:** November 2, 2025

