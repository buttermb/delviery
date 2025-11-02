# 🚀 Quick Start Guide

## For Developers

### Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   Create a `.env` file:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Build for Production**
   ```bash
   npm run build
   ```

### Accessing the Application

#### Marketing Site
- **Homepage**: http://localhost:5173/
- **Features**: http://localhost:5173/features
- **Pricing**: http://localhost:5173/pricing
- **About**: http://localhost:5173/about
- **Contact**: http://localhost:5173/contact

#### Super Admin
- **Login**: http://localhost:5173/super-admin/login
- **Dashboard**: http://localhost:5173/super-admin/dashboard
- **Settings**: http://localhost:5173/super-admin/settings

#### Tenant Admin
- **Login**: http://localhost:5173/{tenantSlug}/admin/login
- **Dashboard**: http://localhost:5173/{tenantSlug}/admin/dashboard
- **Billing**: http://localhost:5173/{tenantSlug}/admin/billing

#### Customer Portal
- **Login**: http://localhost:5173/{tenantSlug}/shop/login
- **Dashboard**: http://localhost:5173/{tenantSlug}/shop/dashboard

---

## For Super Admins

### First Time Setup

1. **Create Super Admin Account**
   - Access the database and create a record in `super_admin_users` table
   - Or use the signup flow if implemented

2. **Login**
   - Navigate to `/super-admin/login`
   - Enter your email and password

3. **Create Your First Tenant**
   - Go to Dashboard
   - Click "Create Tenant"
   - Fill in tenant details
   - Assign a subscription plan

### Managing Tenants

1. **View Tenant Details**
   - Click on any tenant in the dashboard table
   - View overview, features, billing, users, and activity

2. **Manage Features**
   - Go to Tenant Detail → Features tab
   - Toggle features on/off for the tenant

3. **Monitor Usage**
   - Check Tenant Detail → Billing tab
   - View usage meters and limits

---

## For Tenant Admins

### First Time Setup

1. **Receive Invitation**
   - Get tenant slug from Super Admin
   - Navigate to `/{tenantSlug}/admin/login`

2. **Login**
   - Enter your email and password
   - You'll be redirected to your dashboard

3. **Complete Onboarding**
   - Set up payment method in Billing
   - Configure business settings
   - Upload logo/branding (if enabled)

### Daily Operations

1. **View Dashboard**
   - Check today's sales and orders
   - Monitor low stock alerts
   - Review recent orders

2. **Manage Billing**
   - Navigate to Billing page
   - View current plan and usage
   - Manage payment method
   - Download invoices

3. **Update Settings**
   - Go to Settings
   - Update business information
   - Change password
   - Configure notifications

---

## For Customers

### Getting Started

1. **Receive Invitation**
   - Get invitation link from your supplier (tenant)
   - Link contains tenant slug

2. **Login**
   - Navigate to `/{tenantSlug}/shop/login`
   - Enter your email and password

3. **Browse Menus**
   - View available menus on dashboard
   - Click on a menu to browse products

4. **Place Orders**
   - Add products to cart
   - Adjust quantities
   - Checkout (when implemented)

### Managing Account

1. **Update Profile**
   - Go to Settings
   - Update name, phone, etc.
   - Change password

2. **View Orders**
   - Check dashboard for recent orders
   - View order history

---

## Design Systems Reference

### Marketing Site
- **Primary Color**: Indigo (#6366F1)
- **Secondary Color**: Purple (#8B5CF6)
- **Use for**: Public-facing marketing pages

### Super Admin
- **Theme**: Dark
- **Background**: Slate 900 (#0F172A)
- **Primary**: Indigo 500 (#6366F1)
- **Use for**: Platform administration

### Tenant Admin
- **Theme**: Light
- **Background**: Slate 50 (#F8FAFC)
- **Primary**: Blue 500 (#3B82F6)
- **Use for**: Business management

### Customer Portal
- **Theme**: Ecommerce
- **Background**: Gray 50 (#F9FAFB)
- **Primary**: Amber 500 (#F59E0B)
- **Use for**: Shopping and ordering

---

## Troubleshooting

### Common Issues

#### "Tenant not found"
- Verify tenant slug in URL matches database
- Check if tenant is active in `tenants` table

#### "Access denied"
- Verify RLS policies are applied
- Check user permissions in database

#### "Password reset not working"
- Verify reset token hasn't expired
- Check email delivery settings

#### Build Errors
- Clear node_modules and reinstall
- Check TypeScript version compatibility
- Verify all environment variables are set

---

## Support

For issues or questions:
1. Check the documentation files
2. Review error messages in browser console
3. Check database logs for RLS policy issues
4. Contact development team

---

## Next Steps

After setup:
1. **Configure Branding**: Set up white label settings
2. **Set Up Billing**: Integrate payment processor
3. **Create First Tenant**: Add your first customer
4. **Test Flows**: Test all authentication flows
5. **Monitor**: Set up logging and monitoring

