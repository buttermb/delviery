# Clarifying Questions - Complete System Review

## Date: 2025-01-15
## Purpose: Ensure all panels and features are properly implemented

---

## 🏢 BUSINESS ADMIN PANEL (Tenant Admin)

### Authentication & Access
1. **Multi-tenant isolation**: When a tenant admin logs in, do they ONLY see data for their tenant, or can they see other tenants' data?
   - ✅ **Current**: RLS policies should enforce this, but want to confirm

2. **Admin roles within tenant**: Can a tenant have multiple admins with different permission levels (owner, admin, manager)?
   - ✅ **Current**: `usePermissions` hook exists, but want to confirm roles

3. **Session management**: If a tenant admin is logged in on multiple devices, should sessions be shared or independent?
   - ⚠️ **Question**: How should concurrent sessions be handled?

### Product Management
4. **Product visibility**: When a product is created, should it automatically appear in customer-facing menus, or require manual approval?
   - ✅ **Current**: `menu_visibility` trigger handles this, but want to confirm workflow

5. **Product categories**: Are product categories fixed (flower, vape, etc.) or can tenants create custom categories?
   - ⚠️ **Question**: Should categories be tenant-specific or global?

6. **Bulk operations**: Can tenant admins bulk update products (e.g., change prices, update stock)?
   - ✅ **Current**: `BulkOperations.tsx` exists, but want to confirm all operations

### Order Management
7. **Order status workflow**: What is the complete order status flow? (pending → confirmed → preparing → in_transit → delivered?)
   - ⚠️ **Question**: Are all statuses required, or can orders skip steps?

8. **Order cancellation**: Can tenant admins cancel orders? What happens to inventory when an order is cancelled?
   - ⚠️ **Question**: Should inventory be automatically restored?

9. **Order modifications**: Can tenant admins modify orders after they're placed (add items, change quantities)?
   - ⚠️ **Question**: What are the restrictions?

### Inventory Management
10. **Multi-warehouse**: Do tenants have multiple warehouses/locations? How is inventory tracked per location?
    - ⚠️ **Question**: Is inventory location-specific or global per tenant?

11. **Inventory alerts**: When stock is low, who gets notified? (tenant admin, warehouse manager, both?)
    - ✅ **Current**: `inventory_alerts` table exists, but want to confirm notification recipients

12. **Inventory transfers**: Can inventory be transferred between warehouses/locations?
    - ⚠️ **Question**: Is this feature needed?

### Wholesale Management
13. **Wholesale clients**: Can tenant admins create unlimited wholesale clients, or is there a limit based on subscription tier?
    - ⚠️ **Question**: Should this be tier-gated?

14. **Credit limits**: How are wholesale client credit limits enforced? Can they be overridden?
    - ⚠️ **Question**: What happens when a client exceeds their credit limit?

15. **Wholesale pricing**: Can tenant admins set different prices for different wholesale clients?
    - ⚠️ **Question**: Is client-specific pricing needed?

### Disposable Menus (Big Plug CRM)
16. **Menu expiration**: Do disposable menus expire automatically, or do they remain active until manually deactivated?
    - ⚠️ **Question**: What's the expiration policy?

17. **Menu access**: How do wholesale clients access their disposable menus? (unique URL, email link, login?)
    - ⚠️ **Question**: What's the access mechanism?

18. **Menu encryption**: Are disposable menus encrypted? If so, how is decryption handled?
    - ⚠️ **Question**: Security implementation details

### Financial Management
19. **Payment processing**: How are payments processed? (Stripe, manual entry, both?)
    - ⚠️ **Question**: Payment gateway integration

20. **Revenue reporting**: What financial reports do tenant admins need? (daily, weekly, monthly, custom date ranges?)
    - ⚠️ **Question**: Reporting requirements

21. **Tax calculation**: Is tax calculated automatically, or manually entered?
    - ⚠️ **Question**: Tax handling

### Fleet Management
22. **Courier assignment**: How are couriers assigned to orders? (manual, automatic, both?)
    - ⚠️ **Question**: Assignment logic

23. **Route optimization**: Is route optimization needed, or is manual routing sufficient?
    - ⚠️ **Question**: Feature requirement

24. **Courier earnings**: How are courier earnings calculated? (per delivery, hourly, commission-based?)
    - ⚠️ **Question**: Payment structure

---

## 🚚 COURIER PANEL

### Authentication & Access
25. **Courier login**: How do couriers log in? (email/password, phone number, app-based?)
    - ⚠️ **Question**: Authentication method

26. **Courier verification**: Do couriers need to be verified/approved by tenant admin before they can log in?
    - ⚠️ **Question**: Onboarding process

27. **Multi-tenant couriers**: Can a courier work for multiple tenants, or are they exclusive to one tenant?
    - ⚠️ **Question**: Courier-tenant relationship

### Order Management
28. **Order acceptance**: Can couriers accept/reject delivery assignments, or are they automatically assigned?
    - ⚠️ **Question**: Assignment model

29. **Order status updates**: Can couriers update order status, or only tenant admins?
    - ⚠️ **Question**: Permission levels

30. **Delivery confirmation**: How do couriers confirm delivery? (signature, photo, GPS check-in?)
    - ⚠️ **Question**: Verification method

### GPS & Tracking
31. **Real-time tracking**: Should courier location be tracked in real-time, or only updated at checkpoints?
    - ⚠️ **Question**: Tracking granularity

32. **Geofencing**: Are geofences used for delivery verification? (must be within X feet of delivery address?)
    - ⚠️ **Question**: Geofence implementation

33. **Offline mode**: Can couriers work offline and sync when connection is restored?
    - ⚠️ **Question**: Offline capability

### Earnings & Payments
34. **Earnings visibility**: Can couriers see their earnings in real-time, or only after payment?
    - ⚠️ **Question**: Earnings display

35. **Payment schedule**: How often are couriers paid? (daily, weekly, monthly?)
    - ⚠️ **Question**: Payment frequency

36. **Payment method**: How are couriers paid? (direct deposit, cash, app-based?)
    - ⚠️ **Question**: Payment method

---

## 🛒 CUSTOMER PANEL

### Authentication & Access
37. **Customer registration**: Can customers self-register, or must they be invited by tenant admin?
    - ⚠️ **Question**: Registration flow

38. **Age verification**: Is age verification required? How is it verified? (ID upload, third-party service?)
    - ✅ **Current**: `age_verifications` table exists, but want to confirm process

39. **Multi-tenant customers**: Can a customer have accounts with multiple tenants, or are they exclusive?
    - ⚠️ **Question**: Customer-tenant relationship

### Ordering
40. **Order minimums**: Are there minimum order amounts or quantities?
    - ⚠️ **Question**: Order restrictions

41. **Delivery zones**: Are there delivery zones? Can customers outside zones still order?
    - ⚠️ **Question**: Geographic restrictions

42. **Order scheduling**: Can customers schedule orders for future delivery, or only immediate delivery?
    - ⚠️ **Question**: Scheduling feature

### Payment
43. **Payment methods**: What payment methods are accepted? (credit card, cash on delivery, crypto?)
    - ⚠️ **Question**: Payment options

44. **Payment at delivery**: Is cash on delivery supported? How is it handled?
    - ⚠️ **Question**: COD implementation

45. **Refunds**: Can customers request refunds? What's the process?
    - ⚠️ **Question**: Refund workflow

### Account Management
46. **Order history**: How long is order history retained? (indefinitely, 1 year, 6 months?)
    - ⚠️ **Question**: Data retention

47. **Saved addresses**: Can customers save multiple delivery addresses?
    - ✅ **Current**: `addresses` table exists, but want to confirm UI

48. **Loyalty points**: Is there a loyalty/rewards program? How does it work?
    - ⚠️ **Question**: Loyalty system

---

## 🎛️ SUPER ADMIN PANEL

### Tenant Management
49. **Tenant onboarding**: How are new tenants onboarded? (self-signup, manual creation, both?)
    - ⚠️ **Question**: Onboarding process

50. **Tenant suspension**: When a tenant is suspended, what happens to their data and active orders?
    - ⚠️ **Question**: Suspension handling

51. **Tenant deletion**: Can tenants be deleted? What happens to their data?
    - ⚠️ **Question**: Data retention policy

### Platform Management
52. **Feature flags**: Are there feature flags to enable/disable features for specific tenants?
    - ⚠️ **Question**: Feature control

53. **Platform-wide settings**: Are there platform-wide settings that affect all tenants? (tax rates, delivery fees, etc.)
    - ⚠️ **Question**: Global settings

54. **Analytics**: What analytics does super admin need? (revenue, user growth, feature usage?)
    - ⚠️ **Question**: Analytics requirements

### Billing & Subscriptions
55. **Subscription management**: Can super admin manually change subscription tiers, or only through Stripe?
    - ✅ **Current**: `TenantDetailPage.tsx` has plan change, but want to confirm process

56. **Billing disputes**: How are billing disputes handled?
    - ⚠️ **Question**: Dispute resolution

57. **Trial periods**: Do tenants get trial periods? How long? Auto-convert or manual?
    - ⚠️ **Question**: Trial management

---

## 🔄 CROSS-PANEL INTEGRATIONS

### Real-time Updates
58. **Order status sync**: When an order status changes in one panel, how quickly should it update in other panels?
    - ✅ **Current**: Real-time subscriptions exist, but want to confirm expectations

59. **Inventory sync**: When inventory changes, should it update immediately across all panels?
    - ✅ **Current**: Real-time hooks exist, but want to confirm

60. **Notification delivery**: How are notifications delivered? (in-app, email, SMS, push notifications?)
    - ⚠️ **Question**: Notification channels

### Data Consistency
61. **Conflict resolution**: If two admins edit the same product simultaneously, how are conflicts resolved?
    - ⚠️ **Question**: Concurrent edit handling

62. **Data validation**: Where is data validated? (client-side only, server-side only, both?)
    - ✅ **Current**: Edge functions use Zod, but want to confirm all endpoints

63. **Caching strategy**: What data is cached? How long? When is cache invalidated?
    - ⚠️ **Question**: Caching approach

---

## 🔒 SECURITY & COMPLIANCE

### Authentication
64. **Password requirements**: What are password requirements? (length, complexity, expiration?)
    - ⚠️ **Question**: Password policy

65. **Two-factor authentication**: Is 2FA required or optional? For which user types?
    - ⚠️ **Question**: 2FA implementation

66. **Session timeout**: What are session timeout policies? (different for different user types?)
    - ✅ **Current**: `SessionTimeoutWarning` exists, but want to confirm timeouts

### Data Privacy
67. **GDPR compliance**: Is GDPR compliance required? What data can be deleted on request?
    - ⚠️ **Question**: Privacy compliance

68. **Data encryption**: What data is encrypted at rest? (PII, payment info, all data?)
    - ⚠️ **Question**: Encryption requirements

69. **Audit logging**: What actions must be logged for compliance? (all actions, only sensitive actions?)
    - ✅ **Current**: Audit triggers exist, but want to confirm requirements

### Access Control
70. **IP restrictions**: Can tenant admins restrict access by IP address?
    - ⚠️ **Question**: IP whitelisting

71. **Device management**: Can admins see/manage active devices/sessions?
    - ⚠️ **Question**: Device tracking

72. **API access**: Do tenants have API access? How is it authenticated?
    - ⚠️ **Question**: API implementation

---

## 📱 MOBILE & PWA

### Mobile Apps
73. **Native apps**: Are native iOS/Android apps needed, or is PWA sufficient?
    - ⚠️ **Question**: Mobile strategy

74. **Push notifications**: Are push notifications needed? For which user types?
    - ⚠️ **Question**: Push notification requirements

75. **Offline capability**: Which features need to work offline? (order viewing, delivery updates?)
    - ⚠️ **Question**: Offline features

### PWA Features
76. **Install prompts**: Should users be prompted to install the PWA?
    - ⚠️ **Question**: PWA promotion

77. **Background sync**: Should data sync in the background when connection is restored?
    - ⚠️ **Question**: Background sync

---

## 🚨 ERROR HANDLING & EDGE CASES

### Error Scenarios
78. **Payment failures**: What happens when payment fails? (retry, cancel order, notify admin?)
    - ⚠️ **Question**: Payment failure handling

79. **Delivery failures**: What happens when delivery fails? (reschedule, refund, reassign courier?)
    - ⚠️ **Question**: Delivery failure handling

80. **Inventory discrepancies**: What happens when inventory doesn't match between systems?
    - ⚠️ **Question**: Inventory reconciliation

### Edge Cases
81. **Concurrent orders**: What happens if two customers order the last item simultaneously?
    - ⚠️ **Question**: Race condition handling

82. **Price changes**: If a product price changes while in a customer's cart, what happens?
    - ⚠️ **Question**: Price lock mechanism

83. **Courier unavailability**: What happens if no couriers are available for a delivery?
    - ⚠️ **Question**: Fallback handling

---

## 📊 REPORTING & ANALYTICS

### Business Intelligence
84. **Custom reports**: Can tenant admins create custom reports, or are they predefined?
    - ⚠️ **Question**: Report customization

85. **Data export**: Can data be exported? (CSV, Excel, PDF?) What data can be exported?
    - ⚠️ **Question**: Export capabilities

86. **Dashboard customization**: Can tenant admins customize their dashboard?
    - ⚠️ **Question**: Dashboard flexibility

---

## 🔧 TECHNICAL QUESTIONS

### Performance
87. **Load expectations**: What's the expected load? (concurrent users, orders per day, data volume?)
    - ⚠️ **Question**: Scalability requirements

88. **Database size**: What's the expected database size? Any data archiving needed?
    - ⚠️ **Question**: Data management

89. **CDN usage**: Is a CDN used for static assets? (images, product photos?)
    - ⚠️ **Question**: Asset delivery

### Integrations
90. **Third-party integrations**: What third-party services are integrated? (Stripe, Twilio, SendGrid, etc.)
    - ⚠️ **Question**: External dependencies

91. **Webhook support**: Do tenants need webhook support for order/inventory updates?
    - ⚠️ **Question**: Webhook requirements

92. **API rate limiting**: Are there API rate limits? Per tenant or global?
    - ⚠️ **Question**: Rate limiting

---

## 🎯 PRIORITY QUESTIONS (Most Critical)

### Must Answer Before Production:
1. **Multi-tenant isolation** (Q1) - Security critical
2. **Order status workflow** (Q7) - Core business logic
3. **Payment processing** (Q19) - Revenue critical
4. **Courier authentication** (Q25) - Access critical
5. **Age verification process** (Q38) - Compliance critical
6. **Data retention policies** (Q46, Q51) - Legal compliance
7. **GDPR compliance** (Q67) - Legal requirement
8. **Payment failure handling** (Q78) - User experience
9. **Concurrent order handling** (Q81) - Data integrity
10. **Load expectations** (Q87) - Performance planning

---

## 📝 Next Steps

1. **Review questions** - Identify which are most important
2. **Answer priority questions** - Focus on critical items first
3. **Document answers** - Create implementation guide based on answers
4. **Update implementation** - Make changes based on clarifications
5. **Test scenarios** - Test edge cases based on answers

---

**Status:** Questions compiled, awaiting answers

**Priority:** Answer critical questions (marked with ⚠️) before production deployment

