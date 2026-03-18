# 🚀 THREE-TIER AUTH SYSTEM - QUICK START GUIDE

## Overview

This guide will help you quickly understand and use the three-tier authentication system.

## 🎯 The Three Tiers

### 1. Super Admin (Platform Owner)
**Purpose:** Manage all tenant accounts and platform settings

**Login:** `/super-admin/login`
- Email: Your platform admin email
- Password: Your platform admin password

**Dashboard:** `/super-admin/dashboard`
- View all tenants
- Manage subscriptions
- Grant features
- Suspend/activate tenants

### 2. Tenant Admin (Wholesale Business Owners)
**Purpose:** Manage your wholesale business operations

**Login:** `/{your-tenant-slug}/admin/login`
- Example: `/bigmike-wholesale/admin/login`
- Email: Your business admin email
- Password: Your business admin password

**Dashboard:** `/{your-tenant-slug}/admin/dashboard`
- Today's sales and orders
- Low stock alerts
- Trial warnings
- Access to full admin panel

### 3. Customer Portal (B2B Buyers)
**Purpose:** Browse menus and place orders

**Login:** `/{tenant-slug}/shop/login`
- Example: `/bigmike-wholesale/shop/login`
- Email: Your customer account email
- Password: Your customer account password

**Dashboard:** `/{tenant-slug}/shop/dashboard`
- Available menus
- Recent orders
- Product browsing

## 📝 Getting Started

### For Super Admins

1. **First Time Setup:**
   ```sql
   -- Create your super admin account
   INSERT INTO super_admin_users (email, password_hash, role, status)
   VALUES (
     'admin@platform.com',
     -- Use bcrypt to hash your password (SHA-256 used in Edge Functions)
     'your-hashed-password',
     'super_admin',
     'active'
   );
   ```

2. **Login:**
   - Navigate to `/super-admin/login`
   - Enter your email and password
   - You'll be redirected to `/super-admin/dashboard`

3. **Create a Tenant:**
   - Click "Create New Tenant" in dashboard
   - Or use the existing tenant creation flow

### For Tenant Admins

1. **Get Your Tenant Slug:**
   - Ask your platform administrator
   - Or check the URL from your invitation email

2. **Login:**
   - Navigate to `/{your-tenant-slug}/admin/login`
   - Enter your email and password
   - You'll be redirected to your dashboard

3. **First Time:**
   - Complete onboarding if prompted
   - Set up payment method for billing
   - Configure your business settings

### For Customers

1. **Get Invitation:**
   - Receive invitation from your supplier (tenant)
   - Contains tenant slug and login instructions

2. **Login:**
   - Navigate to `/{tenant-slug}/shop/login`
   - Enter your email and password
   - Browse available menus

## 🔑 Common Tasks

### Reset Password

**All Three Tiers:**
1. Click "Forgot password?" on login page
2. Enter your email
3. Check email for reset link
4. Follow link to reset page
5. Enter new password

**Reset Links:**
- Super Admin: `/super-admin/reset/{token}`
- Tenant Admin: `/{tenant-slug}/admin/reset/{token}`
- Customer: `/{tenant-slug}/shop/reset/{token}`

### Change Settings

**Super Admin:**
- `/super-admin/settings`
- Update account info
- Change password
- Configure notifications

**Tenant Admin:**
- `/{tenant-slug}/admin/settings`
- Update profile
- Change password
- Configure business info

**Customer:**
- `/{tenant-slug}/shop/settings`
- Update profile
- Change password
- Notification preferences

### View Billing (Tenant Admin)

1. Navigate to `/{tenant-slug}/admin/billing`
2. View current plan
3. Check usage meters
4. View invoice history
5. Manage payment method

## 🔒 Security Features

### Session Management
- Tokens expire after 7-30 days (depending on tier)
- Sessions tracked in database
- Automatic logout on token expiration

### Access Control
- Tenant slug validation on all routes
- Subscription status checks
- Account status verification
- Role-based permissions

### Password Security
- Minimum 8 characters (recommended: 12+)
- Password strength validation
- Secure hashing (SHA-256, use bcrypt in production)

## 🐛 Troubleshooting

### "Token Expired" Error
**Solution:** Log out and log back in

### "Tenant Not Found" Error
**Solution:** Verify the tenant slug in the URL is correct

### "Unauthorized" Error
**Solution:** 
- Check your account status
- Verify subscription is active
- Contact support if needed

### Can't Access Dashboard
**Solution:**
- Clear browser cache
- Clear localStorage (or use incognito)
- Try logging in again

### Password Reset Not Working
**Solution:**
- Check spam folder
- Verify email address is correct
- Request new reset link
- Contact administrator

## 📞 Support

### For Super Admins
- Manage everything via `/super-admin/dashboard`
- Can login as any tenant for support

### For Tenant Admins
- Contact platform support
- Check billing status
- Review usage limits

### For Customers
- Contact your supplier (tenant)
- They can manage your account

## 🔗 Quick Links

### Super Admin
- Dashboard: `/super-admin/dashboard`
- Login: `/super-admin/login`
- Settings: `/super-admin/settings`

### Tenant Admin
- Dashboard: `/{slug}/admin/dashboard`
- Login: `/{slug}/admin/login`
- Billing: `/{slug}/admin/billing`
- Settings: `/{slug}/admin/settings`

### Customer
- Dashboard: `/{slug}/shop/dashboard`
- Login: `/{slug}/shop/login`
- Settings: `/{slug}/shop/settings`

---

**Need Help?** Check the full documentation in `THREE_TIER_AUTH_COMPLETE.md` and `THREE_TIER_AUTH_FINAL.md`

