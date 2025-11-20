export interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  tags: string[];
  related?: string[];
  videoUrl?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  popular?: boolean;
  new?: boolean;
}

export const faqCategories = [
  { id: 'general', name: 'General', icon: 'HelpCircle' },
  { id: 'inventory', name: 'Inventory', icon: 'Package' },
  { id: 'orders', name: 'Orders & Customers', icon: 'ShoppingCart' },
  { id: 'reports', name: 'Reports & Analytics', icon: 'BarChart' },
  { id: 'billing', name: 'Billing & Subscription', icon: 'CreditCard' },
  { id: 'security', name: 'Security & Privacy', icon: 'Shield' },
  { id: 'integration', name: 'Integration & API', icon: 'Plug' },
  { id: 'mobile', name: 'Mobile App', icon: 'Smartphone' },
  { id: 'training', name: 'Training & Onboarding', icon: 'GraduationCap' },
  { id: 'troubleshooting', name: 'Troubleshooting', icon: 'AlertCircle' },
  { id: 'account', name: 'Account Management', icon: 'User' },
  { id: 'compliance', name: 'Compliance & Legal', icon: 'FileText' }
];

export const faqs: FAQ[] = [
  // General (10 questions)
  {
    id: 'gen-001',
    category: 'general',
    question: 'How do I create my first order?',
    answer: 'Go to Orders → New Order, select a customer, add products, and confirm. The order will be processed and you can track it in real-time using our live map feature.',
    tags: ['orders', 'getting-started'],
    related: ['gen-002', 'ord-001'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'gen-002',
    category: 'general',
    question: 'What payment methods do you accept?',
    answer: 'We accept credit cards (Visa, Mastercard, Amex), ACH transfers, and Bitcoin (coming soon). Payment terms can be customized per customer in their profile settings.',
    tags: ['payments', 'billing'],
    related: ['bill-001', 'gen-001'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'gen-003',
    category: 'general',
    question: 'How do I add team members?',
    answer: 'Go to Team → User Management, click "Add User", enter their email and assign their role (Admin, Manager, Staff, Driver). You can set granular permissions for each team member including access to specific features and data.',
    tags: ['team', 'users', 'permissions'],
    related: ['acc-002'],
    difficulty: 'beginner'
  },
  {
    id: 'gen-004',
    category: 'general',
    question: 'Can I export my data?',
    answer: 'Yes! Go to Reports → Data Export to download your data in CSV or PDF format. You can export orders, customers, inventory, financial reports, and more. Scheduled exports can be set up for automatic daily, weekly, or monthly deliveries to your email.',
    tags: ['export', 'reports', 'data'],
    related: ['rep-001'],
    difficulty: 'beginner'
  },
  {
    id: 'gen-005',
    category: 'general',
    question: 'How do I customize my dashboard?',
    answer: 'Click the "Customize" button in the top right of your dashboard. You can drag and drop widgets, resize them, add new ones, or remove unwanted ones. Your layout is saved automatically and syncs across all your devices.',
    tags: ['dashboard', 'customization'],
    difficulty: 'beginner'
  },
  {
    id: 'gen-006',
    category: 'general',
    question: 'What are the system requirements?',
    answer: 'BigMike Wholesale is a web-based application that works on any modern browser (Chrome, Firefox, Safari, Edge). Minimum requirements: 4GB RAM, stable internet connection (5+ Mbps recommended). Mobile apps require iOS 14+ or Android 8+.',
    tags: ['requirements', 'technical'],
    difficulty: 'beginner'
  },
  {
    id: 'gen-007',
    category: 'general',
    question: 'How do I get support?',
    answer: 'We offer multiple support channels: Live chat (24/7), email support (support@bigmike.com), phone support (business hours), and our comprehensive knowledge base. Premium plans include priority support with dedicated account managers.',
    tags: ['support', 'help'],
    related: ['gen-008'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'gen-008',
    category: 'general',
    question: 'What is your typical response time?',
    answer: 'Live chat: < 2 minutes, Email: < 4 hours (business days), Phone: immediate. Premium and Enterprise plans receive priority support with guaranteed response times (< 1 hour for critical issues).',
    tags: ['support', 'response-time'],
    related: ['gen-007'],
    difficulty: 'beginner'
  },
  {
    id: 'gen-009',
    category: 'general',
    question: 'Can I try before I buy?',
    answer: 'Absolutely! We offer a 14-day free trial with full access to all features (no credit card required). You can also schedule a personalized demo with our team to see how FloraIQ can transform your cannabis distribution.',
    tags: ['trial', 'demo'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'gen-010',
    category: 'general',
    question: 'Do you offer training for new users?',
    answer: 'Yes! All plans include access to our video tutorial library, interactive guides, and written documentation. Premium plans include live onboarding sessions, and Enterprise plans get custom training programs tailored to your business needs.',
    tags: ['training', 'onboarding'],
    related: ['train-001'],
    difficulty: 'beginner'
  },

  // Inventory (8 questions)
  {
    id: 'inv-001',
    category: 'inventory',
    question: 'How do I track fronted inventory?',
    answer: 'Navigate to Fronted Inventory to see all outstanding products and payments. You can filter by customer, date range, or status. The system automatically tracks payment schedules and sends reminders to customers.',
    tags: ['inventory', 'fronted', 'payments'],
    popular: true,
    difficulty: 'intermediate'
  },
  {
    id: 'inv-002',
    category: 'inventory',
    question: 'How do I manage inventory batches?',
    answer: 'Go to Inventory → Batches to create, track, and manage inventory batches. Each batch can have its own expiration date, location, supplier info, and cost. Use batch tracking for FIFO/LIFO inventory management and traceability.',
    tags: ['inventory', 'batches', 'tracking'],
    difficulty: 'intermediate'
  },
  {
    id: 'inv-003',
    category: 'inventory',
    question: 'Can I set up low stock alerts?',
    answer: 'Yes! Go to Settings → Notifications to enable low stock alerts. You can set custom thresholds for each product (e.g., alert when < 50 units). Alerts can be sent via email, SMS, or in-app notifications.',
    tags: ['inventory', 'alerts', 'notifications'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'inv-004',
    category: 'inventory',
    question: 'How do I perform a physical inventory count?',
    answer: 'Use the Inventory Count feature (Inventory → Physical Count). Create a new count, scan items with your mobile device, and the system automatically reconciles differences. You can count by location, category, or specific items.',
    tags: ['inventory', 'counting', 'mobile'],
    difficulty: 'intermediate'
  },
  {
    id: 'inv-005',
    category: 'inventory',
    question: 'Can I import inventory from a spreadsheet?',
    answer: 'Yes! Go to Inventory → Import to upload a CSV or Excel file. Download our template to ensure proper formatting. The system validates data and shows a preview before importing. Bulk updates are also supported.',
    tags: ['inventory', 'import', 'bulk'],
    difficulty: 'intermediate'
  },
  {
    id: 'inv-006',
    category: 'inventory',
    question: 'How does barcode scanning work?',
    answer: 'Use any camera-enabled device to scan product barcodes. The system supports UPC, EAN, Code 128, and QR codes. You can generate custom barcodes for products that don\'t have them. Barcode scanning works for receiving, picking, and counting.',
    tags: ['inventory', 'barcode', 'scanning'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'inv-007',
    category: 'inventory',
    question: 'Can I track inventory across multiple warehouses?',
    answer: 'Yes! The multi-location feature allows you to track inventory across unlimited warehouses, stores, or distribution centers. Transfer inventory between locations, set reorder points per location, and view consolidated or location-specific reports.',
    tags: ['inventory', 'multi-location', 'warehouses'],
    difficulty: 'advanced'
  },
  {
    id: 'inv-008',
    category: 'inventory',
    question: 'How do I handle inventory adjustments?',
    answer: 'Go to Inventory → Adjustments to record stock corrections, damaged goods, theft, or found items. Each adjustment requires a reason code and is logged in the audit trail. You can also attach photos and notes for documentation.',
    tags: ['inventory', 'adjustments', 'audit'],
    difficulty: 'intermediate'
  },

  // Orders & Customers (9 questions)
  {
    id: 'ord-001',
    category: 'orders',
    question: 'How do I process a return?',
    answer: 'Go to the order details, click "Return" and select the items to return. Choose the return reason and restocking method. The system automatically updates inventory, creates a credit memo, and can trigger a refund if payment was processed.',
    tags: ['orders', 'returns', 'refunds'],
    popular: true,
    difficulty: 'intermediate'
  },
  {
    id: 'ord-002',
    category: 'orders',
    question: 'Can I create custom pricing for customers?',
    answer: 'Yes! In customer settings, you can set custom pricing tiers, volume discounts, category-specific pricing, and payment terms. You can also create price lists for customer groups or apply automatic discounts based on order volume.',
    tags: ['customers', 'pricing', 'discounts'],
    popular: true,
    difficulty: 'intermediate'
  },
  {
    id: 'ord-003',
    category: 'orders',
    question: 'How do I track delivery status?',
    answer: 'Use the Live Map feature to see real-time delivery tracking with GPS. You can view delivery status in order details, and customers can track their orders via a shared link. The system automatically updates customers via SMS/email at each delivery milestone.',
    tags: ['orders', 'delivery', 'tracking'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'ord-004',
    category: 'orders',
    question: 'Can customers place orders themselves?',
    answer: 'Yes! Enable the customer portal to allow customers to place orders online 24/7. They can view their price lists, past orders, account balance, and track deliveries. You control what customers can see and do in the portal.',
    tags: ['customers', 'portal', 'self-service'],
    difficulty: 'intermediate'
  },
  {
    id: 'ord-005',
    category: 'orders',
    question: 'How do I handle partial shipments?',
    answer: 'When creating a shipment, select which items to ship. The system creates a partial shipment and marks remaining items as backordered. You can ship backorders later, and customers are notified of each shipment separately.',
    tags: ['orders', 'shipping', 'backorders'],
    difficulty: 'intermediate'
  },
  {
    id: 'ord-006',
    category: 'orders',
    question: 'Can I set credit limits for customers?',
    answer: 'Yes! Set credit limits in customer profiles. The system automatically blocks new orders when the limit is reached. You can also set payment terms (Net 30, Net 60, etc.) and track aging balances. Automated reminders are sent for overdue invoices.',
    tags: ['customers', 'credit', 'payments'],
    difficulty: 'intermediate'
  },
  {
    id: 'ord-007',
    category: 'orders',
    question: 'How does route optimization work?',
    answer: 'Our AI-powered route optimization considers traffic, delivery windows, vehicle capacity, and driver schedules to create the most efficient routes. Routes update in real-time based on new orders or traffic conditions. Save up to 30% on fuel costs.',
    tags: ['delivery', 'routing', 'optimization'],
    popular: true,
    difficulty: 'advanced'
  },
  {
    id: 'ord-008',
    category: 'orders',
    question: 'Can I schedule recurring orders?',
    answer: 'Yes! Create subscription orders that repeat automatically (daily, weekly, monthly). Customize the schedule, auto-adjust quantities based on usage patterns, and pause/resume subscriptions. Customers receive notifications before each recurring order.',
    tags: ['orders', 'recurring', 'subscriptions'],
    difficulty: 'intermediate'
  },
  {
    id: 'ord-009',
    category: 'orders',
    question: 'How do I handle COD (Cash on Delivery)?',
    answer: 'Enable COD in payment settings. Drivers can collect cash/checks upon delivery using the mobile app. The system tracks COD collections, driver settlements, and can flag discrepancies. Automatic reconciliation with your accounting system.',
    tags: ['orders', 'payments', 'cod'],
    difficulty: 'intermediate'
  },

  // Reports & Analytics (7 questions)
  {
    id: 'rep-001',
    category: 'reports',
    question: 'What reports are available?',
    answer: 'We offer 50+ reports including: Sales by product/customer/period, Inventory valuation, Aging reports, Profit margins, Driver performance, Route efficiency, Customer analytics, and custom reports. All reports can be exported to CSV, PDF, or Excel.',
    tags: ['reports', 'analytics'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'rep-002',
    category: 'reports',
    question: 'Can I schedule automated reports?',
    answer: 'Yes! In Reports → Scheduled Reports, you can set up daily, weekly, or monthly automated reports sent to your email. Choose recipients, customize report parameters, and select file format. Reports run automatically at your specified time.',
    tags: ['reports', 'automation', 'scheduling'],
    popular: true,
    difficulty: 'intermediate'
  },
  {
    id: 'rep-003',
    category: 'reports',
    question: 'How do I create custom reports?',
    answer: 'Use the Report Builder (Reports → Custom) to create tailored reports. Drag and drop fields, apply filters, group data, and add calculations. Save templates for reuse. Advanced users can write custom SQL queries (Enterprise plan).',
    tags: ['reports', 'custom', 'builder'],
    difficulty: 'advanced'
  },
  {
    id: 'rep-004',
    category: 'reports',
    question: 'Can I see real-time analytics?',
    answer: 'Yes! The dashboard shows real-time metrics including active orders, inventory levels, revenue, and more. Use the Analytics tab for real-time graphs and charts. Data refreshes every 30 seconds. Set up custom KPI widgets on your dashboard.',
    tags: ['analytics', 'real-time', 'dashboard'],
    difficulty: 'beginner'
  },
  {
    id: 'rep-005',
    category: 'reports',
    question: 'How do I track profitability by product?',
    answer: 'The Profit Analysis report shows margins by product, category, customer, or order. It factors in cost of goods, shipping, discounts, and overhead. Use this to identify your most profitable items and optimize your pricing strategy.',
    tags: ['reports', 'profitability', 'margins'],
    difficulty: 'intermediate'
  },
  {
    id: 'rep-006',
    category: 'reports',
    question: 'Can I compare periods (YoY, MoM)?',
    answer: 'Yes! Most reports include comparison features. Compare current period to previous period, same period last year, or custom date ranges. View absolute differences and percentage changes. Great for identifying trends and seasonal patterns.',
    tags: ['reports', 'comparison', 'trends'],
    difficulty: 'intermediate'
  },
  {
    id: 'rep-007',
    category: 'reports',
    question: 'Do you offer business intelligence (BI) integration?',
    answer: 'Yes! Connect to Tableau, Power BI, Looker, or other BI tools via our API or data warehouse sync. Export your data to your own database for advanced analytics. Enterprise plans include pre-built BI dashboards.',
    tags: ['reports', 'bi', 'integration'],
    difficulty: 'advanced'
  },

  // Billing & Subscription (8 questions)
  {
    id: 'bill-001',
    category: 'billing',
    question: 'How does billing work?',
    answer: 'Billing is monthly or annual based on your plan. You can upgrade, downgrade, or cancel anytime. Changes take effect at the next billing cycle. We prorate charges when you upgrade mid-cycle. All major credit cards and ACH payments accepted.',
    tags: ['billing', 'subscription'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'bill-002',
    category: 'billing',
    question: 'What happens if I cancel?',
    answer: 'Your account remains active until the end of your billing period. After cancellation, your data is retained for 90 days in read-only mode, then permanently deleted. You can reactivate anytime during the 90-day window without data loss.',
    tags: ['billing', 'cancellation'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'bill-003',
    category: 'billing',
    question: 'Can I get a refund?',
    answer: 'We offer a 30-day money-back guarantee for new subscriptions. Annual plans can be refunded within 60 days. Monthly subscriptions are not refundable after the first month. Contact support to process a refund.',
    tags: ['billing', 'refunds'],
    difficulty: 'beginner'
  },
  {
    id: 'bill-004',
    category: 'billing',
    question: 'What are the plan limits?',
    answer: 'Starter: 100 orders/month, 1 user, 500 products. Professional: 1,000 orders/month, 5 users, unlimited products. Premium: 10,000 orders/month, 25 users, all features. Enterprise: Unlimited everything with custom pricing. See pricing page for details.',
    tags: ['billing', 'plans', 'limits'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'bill-005',
    category: 'billing',
    question: 'Do you offer discounts for annual plans?',
    answer: 'Yes! Save 20% with annual billing. Nonprofits get an additional 10% discount. We also offer volume discounts for multi-location businesses. Contact sales for enterprise pricing and custom packages.',
    tags: ['billing', 'discounts', 'annual'],
    difficulty: 'beginner'
  },
  {
    id: 'bill-006',
    category: 'billing',
    question: 'What happens if I exceed my plan limits?',
    answer: 'You\'ll receive a notification when you reach 80% of your limit. Overage charges apply at $0.10 per order over your limit. Or, upgrade to a higher plan anytime to avoid overages. The system never stops working - no service interruption.',
    tags: ['billing', 'limits', 'overages'],
    difficulty: 'intermediate'
  },
  {
    id: 'bill-007',
    category: 'billing',
    question: 'Can I change my billing information?',
    answer: 'Yes! Go to Settings → Billing to update your credit card, billing address, or payment method. You can also download past invoices and view payment history. Changes take effect immediately.',
    tags: ['billing', 'payment-method'],
    difficulty: 'beginner'
  },
  {
    id: 'bill-008',
    category: 'billing',
    question: 'Do you offer purchase orders (PO)?',
    answer: 'Yes, for annual Enterprise plans. We accept POs with Net 30 terms after credit approval. Contact our sales team to set up PO billing. Monthly invoices will reference your PO number.',
    tags: ['billing', 'purchase-orders', 'enterprise'],
    difficulty: 'intermediate'
  },

  // Security & Privacy (8 questions)
  {
    id: 'sec-001',
    category: 'security',
    question: 'How is my data secured?',
    answer: 'We use bank-level AES-256 encryption for data at rest and TLS 1.3 for data in transit. All data is stored in SOC 2 Type II certified data centers with 24/7 monitoring, redundant backups, and disaster recovery. Regular security audits and penetration testing.',
    tags: ['security', 'encryption'],
    popular: true,
    difficulty: 'intermediate'
  },
  {
    id: 'sec-002',
    category: 'security',
    question: 'What encryption standards do you use?',
    answer: 'AES-256 encryption for data at rest, TLS 1.3 for data in transit, RSA-2048 for key exchange. Passwords are hashed with bcrypt (12 rounds). Payment information is tokenized and never stored on our servers. PCI DSS Level 1 compliant.',
    tags: ['security', 'encryption', 'standards'],
    difficulty: 'advanced'
  },
  {
    id: 'sec-003',
    category: 'security',
    question: 'Do you comply with GDPR/CCPA?',
    answer: 'Yes! We are fully compliant with GDPR, CCPA, and other privacy regulations. We provide data processing agreements (DPA), data export tools, right-to-deletion, and consent management. Our privacy policy details how we handle personal data.',
    tags: ['security', 'privacy', 'compliance'],
    popular: true,
    difficulty: 'intermediate'
  },
  {
    id: 'sec-004',
    category: 'security',
    question: 'Can I enable two-factor authentication?',
    answer: 'Yes! Enable 2FA in Settings → Security. We support authenticator apps (Google Authenticator, Authy), SMS codes, and hardware keys (YubiKey). We recommend 2FA for all admin users. Can be enforced organization-wide in Enterprise plans.',
    tags: ['security', '2fa', 'authentication'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'sec-005',
    category: 'security',
    question: 'What happens to my data if I cancel?',
    answer: 'Your data is retained in read-only mode for 90 days after cancellation. During this period, you can reactivate your account or export your data. After 90 days, all data is permanently deleted from our servers and backups per our data retention policy.',
    tags: ['security', 'data-retention', 'cancellation'],
    difficulty: 'intermediate'
  },
  {
    id: 'sec-006',
    category: 'security',
    question: 'How do you handle data breaches?',
    answer: 'We have an incident response plan that includes immediate containment, investigation, and notification within 72 hours per GDPR requirements. We carry cyber liability insurance and conduct regular security training. No breaches have occurred to date.',
    tags: ['security', 'breach', 'incident-response'],
    difficulty: 'advanced'
  },
  {
    id: 'sec-007',
    category: 'security',
    question: 'Can I restrict access by IP address?',
    answer: 'Yes! Enterprise plans include IP whitelisting. Configure allowed IP ranges in Settings → Security. Access from unauthorized IPs is automatically blocked. You can also set different restrictions for different user roles.',
    tags: ['security', 'ip-restriction', 'enterprise'],
    difficulty: 'advanced'
  },
  {
    id: 'sec-008',
    category: 'security',
    question: 'What audit logging is available?',
    answer: 'All user actions are logged including logins, data changes, exports, and deletions. Logs include timestamp, user, IP address, and action details. Logs are retained for 1 year (3 years for Enterprise). Export logs for compliance or investigation purposes.',
    tags: ['security', 'audit', 'logging'],
    difficulty: 'advanced'
  },

  // Integration & API (6 questions)
  {
    id: 'int-001',
    category: 'integration',
    question: 'How do I access the API?',
    answer: 'Go to Settings → API to generate your API key. View our comprehensive API documentation at /docs/api-reference. We offer RESTful APIs with JSON responses, webhooks for real-time events, and GraphQL (Enterprise). Rate limits apply based on your plan.',
    tags: ['api', 'integration'],
    popular: true,
    difficulty: 'intermediate'
  },
  {
    id: 'int-002',
    category: 'integration',
    question: 'What are the API rate limits?',
    answer: 'Starter: 100 requests/minute, Professional: 500 requests/minute, Premium: 2,000 requests/minute, Enterprise: Custom limits. Rate limit headers are included in all responses. Contact support to request limit increases.',
    tags: ['api', 'rate-limits'],
    popular: true,
    difficulty: 'intermediate'
  },
  {
    id: 'int-003',
    category: 'integration',
    question: 'Do you have webhooks?',
    answer: 'Yes! Set up webhooks for order events, inventory changes, customer updates, and payment events. Configure webhook URLs in Settings → Integrations. Webhooks include retry logic, signature verification, and event logs for debugging.',
    tags: ['api', 'webhooks', 'integration'],
    difficulty: 'advanced'
  },
  {
    id: 'int-004',
    category: 'integration',
    question: 'Can I integrate with my accounting software?',
    answer: 'Yes! We have native integrations with QuickBooks, Xero, Sage, and NetSuite. Sync customers, products, orders, and invoices automatically. We also support custom integrations via API. Most accounting syncs run every 15 minutes.',
    tags: ['integration', 'accounting', 'quickbooks'],
    popular: true,
    difficulty: 'intermediate'
  },
  {
    id: 'int-005',
    category: 'integration',
    question: 'Do you support SSO/SAML?',
    answer: 'Yes! Enterprise plans include Single Sign-On (SSO) via SAML 2.0. We support Okta, Azure AD, Google Workspace, OneLogin, and other identity providers. SSO can be required for all users or optional. JIT (Just-in-Time) provisioning available.',
    tags: ['integration', 'sso', 'saml', 'enterprise'],
    difficulty: 'advanced'
  },
  {
    id: 'int-006',
    category: 'integration',
    question: 'How do I connect to third-party services?',
    answer: 'Use Zapier or Make (formerly Integromat) to connect with 5,000+ apps without coding. We also have native integrations with Shopify, WooCommerce, Mailchimp, Twilio, and more. Custom integrations can be built using our API and webhooks.',
    tags: ['integration', 'zapier', 'third-party'],
    difficulty: 'intermediate'
  },

  // Mobile App (5 questions)
  {
    id: 'mob-001',
    category: 'mobile',
    question: 'Is there a mobile app?',
    answer: 'Yes! Download the BigMike Wholesale app for iOS (App Store) and Android (Google Play). The mobile app includes order management, inventory scanning, delivery tracking, customer management, and offline mode. Free with all plans.',
    tags: ['mobile', 'app'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'mob-002',
    category: 'mobile',
    question: 'What features are available on mobile?',
    answer: 'Full order management, barcode scanning, signature capture, GPS delivery tracking, customer lookup, inventory checks, photo uploads, offline mode, and push notifications. Drivers have a specialized delivery interface optimized for route completion.',
    tags: ['mobile', 'features'],
    difficulty: 'beginner'
  },
  {
    id: 'mob-003',
    category: 'mobile',
    question: 'Can I use the app offline?',
    answer: 'Yes! The mobile app works offline for viewing orders, scanning inventory, and capturing signatures. Data syncs automatically when you reconnect. Perfect for warehouses with poor connectivity or drivers in rural areas.',
    tags: ['mobile', 'offline'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'mob-004',
    category: 'mobile',
    question: 'How do I enable push notifications?',
    answer: 'Go to mobile app Settings → Notifications to configure push alerts for new orders, low inventory, delivery updates, and customer messages. You can customize notification sounds and quiet hours. Notifications sync with web app settings.',
    tags: ['mobile', 'notifications', 'push'],
    difficulty: 'beginner'
  },
  {
    id: 'mob-005',
    category: 'mobile',
    question: 'Can drivers use their own devices?',
    answer: 'Yes! Drivers can download the app on their personal iOS or Android devices. You control access via user accounts. The app uses minimal battery and data (<100MB/day). You can also provide company devices with the app pre-installed.',
    tags: ['mobile', 'drivers', 'byod'],
    difficulty: 'beginner'
  },

  // Training & Onboarding (6 questions)
  {
    id: 'train-001',
    category: 'training',
    question: 'What training resources are available?',
    answer: 'We provide video tutorials (50+ videos), interactive walkthroughs, written documentation, webinars (weekly), and a searchable knowledge base. Premium plans include live onboarding sessions. Enterprise plans get custom training programs.',
    tags: ['training', 'resources'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'train-002',
    category: 'training',
    question: 'How long does onboarding take?',
    answer: 'Basic setup: 1-2 hours. Full implementation: 1-2 weeks depending on data migration and customization needs. Our onboarding team guides you through setup, data import, team training, and go-live. Most customers are fully operational within a week.',
    tags: ['training', 'onboarding', 'timeline'],
    difficulty: 'beginner'
  },
  {
    id: 'train-003',
    category: 'training',
    question: 'Do you help with data migration?',
    answer: 'Yes! We provide data import templates, migration guides, and automated import tools. Premium and Enterprise plans include assisted migration where our team helps import your data from spreadsheets or legacy systems. Typical migration takes 2-5 days.',
    tags: ['training', 'migration', 'data-import'],
    popular: true,
    difficulty: 'intermediate'
  },
  {
    id: 'train-004',
    category: 'training',
    question: 'Can I get certified?',
    answer: 'Yes! We offer BigMike Certified User and BigMike Certified Administrator programs. Complete online courses and pass exams to earn certificates. Certification includes badges for your resume/LinkedIn and access to exclusive community forums.',
    tags: ['training', 'certification'],
    difficulty: 'intermediate'
  },
  {
    id: 'train-005',
    category: 'training',
    question: 'Do you offer on-site training?',
    answer: 'Yes! Enterprise plans include optional on-site training at your location. Our trainers conduct hands-on sessions customized to your business needs. Typical on-site training is 1-3 days covering all features and best practices.',
    tags: ['training', 'on-site', 'enterprise'],
    difficulty: 'advanced'
  },
  {
    id: 'train-006',
    category: 'training',
    question: 'How do I train new employees?',
    answer: 'Use our built-in training mode where new users can practice in a sandbox environment without affecting live data. Assign role-specific training modules, track completion, and test knowledge with quizzes. Training materials are always free and up-to-date.',
    tags: ['training', 'employees', 'sandbox'],
    difficulty: 'intermediate'
  },

  // Troubleshooting (8 questions)
  {
    id: 'trouble-001',
    category: 'troubleshooting',
    question: 'Why can\'t I log in?',
    answer: 'Check if Caps Lock is on, verify you\'re using the correct email, try resetting your password. If you have 2FA enabled, ensure your authenticator code is current. Clear browser cache or try a different browser. Still stuck? Contact support.',
    tags: ['troubleshooting', 'login', 'authentication'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'trouble-002',
    category: 'troubleshooting',
    question: 'My orders aren\'t syncing - what do I do?',
    answer: 'Check your internet connection, refresh the page, verify you have the latest app version. Check Settings → Integrations to ensure connected services are active. If using offline mode, force a sync. Contact support if orders are still not syncing after 15 minutes.',
    tags: ['troubleshooting', 'sync', 'orders'],
    popular: true,
    difficulty: 'intermediate'
  },
  {
    id: 'trouble-003',
    category: 'troubleshooting',
    question: 'How do I fix printing issues?',
    answer: 'Ensure your printer is connected and set as default. Check printer drivers are up-to-date. Try Print Preview to see if the issue is formatting-related. For label printers, verify label size settings match your actual labels. Clear print queue and restart printer.',
    tags: ['troubleshooting', 'printing'],
    difficulty: 'intermediate'
  },
  {
    id: 'trouble-004',
    category: 'troubleshooting',
    question: 'Why are my reports showing incorrect data?',
    answer: 'Check your date range and filters. Ensure you\'re looking at the correct location (if multi-location). Verify that data was entered correctly in source records. Some reports may be cached - click refresh. For persistent issues, contact support with a screenshot.',
    tags: ['troubleshooting', 'reports', 'data'],
    difficulty: 'intermediate'
  },
  {
    id: 'trouble-005',
    category: 'troubleshooting',
    question: 'What browsers are supported?',
    answer: 'We support the latest versions of Chrome, Firefox, Safari, and Edge. Internet Explorer is not supported. For best performance, use Chrome or Firefox. Enable JavaScript and cookies. Minimum screen resolution: 1366x768. Mobile browsers work for basic tasks.',
    tags: ['troubleshooting', 'browsers', 'compatibility'],
    difficulty: 'beginner'
  },
  {
    id: 'trouble-006',
    category: 'troubleshooting',
    question: 'How do I clear my cache?',
    answer: 'Chrome: Press Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac), select "Cached images and files", click Clear. Firefox: Options → Privacy & Security → Clear Data. Safari: Preferences → Privacy → Manage Website Data → Remove All. Try hard refresh: Ctrl+F5.',
    tags: ['troubleshooting', 'cache', 'browser'],
    difficulty: 'beginner'
  },
  {
    id: 'trouble-007',
    category: 'troubleshooting',
    question: 'Why am I getting a "quota exceeded" error?',
    answer: 'You\'ve reached your plan limits for orders, users, or storage. Go to Settings → Billing to view your current usage. You can upgrade your plan immediately or wait until next billing cycle. Overages may apply. Contact sales for custom limits.',
    tags: ['troubleshooting', 'limits', 'quota'],
    difficulty: 'intermediate'
  },
  {
    id: 'trouble-008',
    category: 'troubleshooting',
    question: 'How do I resolve payment processing failures?',
    answer: 'Verify credit card information is correct and card has sufficient funds. Check if card is expired or blocked. Try a different payment method. Ensure billing address matches card. For continued failures, contact your bank or try a different card. We never charge failed attempts.',
    tags: ['troubleshooting', 'payments', 'billing'],
    difficulty: 'intermediate'
  },

  // Account Management (5 questions)
  {
    id: 'acc-001',
    category: 'account',
    question: 'How do I change my password?',
    answer: 'Go to Settings → Security → Change Password. Enter your current password and new password (minimum 8 characters, must include uppercase, lowercase, and number). You\'ll be logged out of all devices and need to log in again with your new password.',
    tags: ['account', 'password', 'security'],
    popular: true,
    difficulty: 'beginner'
  },
  {
    id: 'acc-002',
    category: 'account',
    question: 'Can I merge multiple accounts?',
    answer: 'Yes! Contact support to merge accounts. We\'ll consolidate your data, users, and subscriptions. Note: Only one subscription will remain active - choose which plan to keep. Billing will be adjusted. Merge typically takes 24-48 hours.',
    tags: ['account', 'merge'],
    difficulty: 'advanced'
  },
  {
    id: 'acc-003',
    category: 'account',
    question: 'How do I delete my account?',
    answer: 'Go to Settings → Account → Delete Account. This is permanent and cannot be undone. All data will be deleted after 90 days. Export your data first if needed. Unused portion of your subscription is refunded prorated (annual plans only).',
    tags: ['account', 'delete', 'cancellation'],
    difficulty: 'beginner'
  },
  {
    id: 'acc-004',
    category: 'account',
    question: 'Can I transfer ownership?',
    answer: 'Yes! The current owner can transfer ownership to another user. Go to Settings → Account → Transfer Ownership, select the new owner (must be an existing admin user), and confirm. The new owner must accept the transfer. Billing responsibility transfers immediately.',
    tags: ['account', 'ownership', 'transfer'],
    difficulty: 'intermediate'
  },
  {
    id: 'acc-005',
    category: 'account',
    question: 'How do I update billing information?',
    answer: 'Go to Settings → Billing → Payment Method to update credit card, billing address, or company information. Changes apply to future charges immediately. You can also add backup payment methods to prevent service interruption.',
    tags: ['account', 'billing', 'payment'],
    difficulty: 'beginner'
  },

  // Compliance & Legal (6 questions)
  {
    id: 'comp-001',
    category: 'compliance',
    question: 'Are you SOC 2 compliant?',
    answer: 'Yes! We maintain SOC 2 Type II certification, audited annually by independent third parties. Our SOC 2 report covers security, availability, processing integrity, confidentiality, and privacy. Request a copy of our SOC 2 report from your sales representative.',
    tags: ['compliance', 'soc2', 'audit'],
    popular: true,
    difficulty: 'advanced'
  },
  {
    id: 'comp-002',
    category: 'compliance',
    question: 'What is your data retention policy?',
    answer: 'Active accounts: Data retained indefinitely. Cancelled accounts: 90 days read-only, then permanent deletion. Backups: 30-day rolling backups. Audit logs: 1 year (3 years for Enterprise). You can request early deletion. Custom retention available for Enterprise.',
    tags: ['compliance', 'data-retention', 'policy'],
    difficulty: 'intermediate'
  },
  {
    id: 'comp-003',
    category: 'compliance',
    question: 'Do you offer BAAs for HIPAA?',
    answer: 'Yes! Enterprise plans include Business Associate Agreements (BAA) for HIPAA compliance. We implement required safeguards including encryption, access controls, and audit logging. Contact our compliance team to execute a BAA.',
    tags: ['compliance', 'hipaa', 'baa', 'enterprise'],
    difficulty: 'advanced'
  },
  {
    id: 'comp-004',
    category: 'compliance',
    question: 'What are your terms of service?',
    answer: 'Our Terms of Service outline the legal agreement between BigMike and users. Key points: We own the software, you own your data, we\'re not liable for business losses, disputes resolved by arbitration. Read full terms at bigmike.com/terms. Updated quarterly.',
    tags: ['compliance', 'legal', 'terms'],
    difficulty: 'beginner'
  },
  {
    id: 'comp-005',
    category: 'compliance',
    question: 'How do chargebacks work?',
    answer: 'If a customer disputes a charge, we\'re notified by the payment processor. We investigate and may request evidence from you. If the chargeback is valid, we process a refund. Invalid chargebacks are contested. Excessive chargebacks may result in account review.',
    tags: ['compliance', 'chargebacks', 'payments'],
    difficulty: 'intermediate'
  },
  {
    id: 'comp-006',
    category: 'compliance',
    question: 'What is your SLA guarantee?',
    answer: '99.9% uptime SLA for Premium and Enterprise plans. If we fall below 99.9% in a month, you receive service credits: 99.0-99.9% = 10% credit, 95.0-99.0% = 25% credit, <95% = 50% credit. Excludes scheduled maintenance. Monitor status at status.bigmike.com.',
    tags: ['compliance', 'sla', 'uptime'],
    popular: true,
    difficulty: 'intermediate'
  }
];

export function searchFAQs(query: string, category?: string): FAQ[] {
  const lowerQuery = query.toLowerCase().trim();
  
  return faqs.filter(faq => {
    const matchesCategory = !category || faq.category === category;
    const matchesQuery = !query || 
      faq.question.toLowerCase().includes(lowerQuery) ||
      faq.answer.toLowerCase().includes(lowerQuery) ||
      faq.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
    
    return matchesCategory && matchesQuery;
  });
}

export function getFAQsByCategory(categoryId: string): FAQ[] {
  return faqs.filter(faq => faq.category === categoryId);
}

export function getPopularFAQs(limit: number = 10): FAQ[] {
  return faqs.filter(faq => faq.popular).slice(0, limit);
}

export function getRelatedFAQs(faqId: string): FAQ[] {
  const faq = faqs.find(f => f.id === faqId);
  if (!faq || !faq.related) return [];
  
  return faqs.filter(f => faq.related?.includes(f.id));
}
