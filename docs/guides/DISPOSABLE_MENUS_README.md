# Disposable Encrypted Menus System

A secure, encrypted wholesale catalog system with self-destructing capabilities, geofencing, and comprehensive access control.

## 🔐 Key Features

### Security Features
- **Encrypted URL Tokens**: Cryptographically secure tokens for each menu
- **Access Codes**: 6-digit codes required for menu access
- **Device Fingerprinting**: Tracks unique devices accessing menus
- **Geofencing**: Optional location-based access restrictions
- **Time Restrictions**: Limit access to specific hours
- **IP Tracking**: Monitor and log IP addresses
- **Self-Destruction**: Soft and hard burn capabilities

### Access Control
- **Whitelist Management**: Invite-only access with unique tokens per customer
- **Single-Use Links**: Optional one-time access URLs
- **Link Regeneration**: Revoke and regenerate access for customers
- **View Limits**: Restrict number of times menu can be viewed
- **Access Logs**: Comprehensive logging of all access attempts

### Business Features
- **Custom Pricing**: Set special prices per customer
- **Order Limits**: Min/max order quantities per menu
- **Product Selection**: Choose specific products for each menu
- **Order Tracking**: Monitor orders placed through menus
- **Analytics Dashboard**: Detailed metrics and insights
- **Security Events**: Real-time alerts for suspicious activity

## 📁 File Structure

```
src/
├── pages/
│   ├── admin/
│   │   ├── DisposableMenus.tsx          # Main admin page
│   │   └── MenuAnalytics.tsx            # Analytics dashboard
│   └── customer/
│       ├── SecureMenuAccess.tsx         # Customer access page
│       └── SecureMenuView.tsx           # Menu viewing page
│
├── components/admin/disposable-menus/
│   ├── MenuCard.tsx                     # Menu display card
│   ├── CreateMenuDialog.tsx             # Create menu dialog
│   ├── BurnMenuDialog.tsx               # Burn menu dialog
│   ├── ManageAccessDialog.tsx           # Whitelist management
│   ├── MenuStatsCard.tsx                # Stats card component
│   └── SecurityEventsList.tsx           # Security events list
│
├── hooks/
│   └── useDisposableMenus.ts            # React hooks for API calls
│
└── utils/
    └── menuHelpers.ts                   # Utility functions

supabase/functions/
├── menu-generate/                       # Create new menus
├── menu-access-validate/                # Validate access attempts
├── menu-burn/                           # Burn/destroy menus
├── menu-order-place/                    # Process orders
└── menu-whitelist-manage/               # Manage whitelist
```

## 🚀 Usage

### Creating a Menu

1. Navigate to **Admin → Wholesale Operations → Disposable Menus**
2. Click **"Create New Menu"**
3. Fill in details:
   - Name and description
   - Select products
   - Set custom prices (optional)
   - Configure security settings
   - Set order limits (optional)

### Security Settings

#### Geofencing
```typescript
{
  require_geofence: true,
  geofence_lat: 40.7128,
  geofence_lng: -74.0060,
  geofence_radius: 5  // km
}
```

#### Time Restrictions
```typescript
{
  time_restrictions: true,
  allowed_hours: {
    start: 9,   // 9 AM
    end: 17     // 5 PM
  }
}
```

#### Access Limits
```typescript
{
  max_views: 10,           // Total views allowed
  single_use: false,       // One-time access per customer
  require_whitelist: true  // Only whitelisted customers
}
```

### Managing Whitelist

1. Click **"Manage"** on a menu card
2. Use the **Whitelist** tab
3. Add customers with:
   - Name
   - Phone number
   - Email
   - Custom notes

Each customer gets a unique access token automatically.

### Burning a Menu

**Soft Burn**: Makes menu inactive but preserves data
```typescript
{
  burn_type: 'soft',
  burn_reason: 'Compromised link',
  auto_regenerate: true,      // Create new menu
  migrate_customers: true     // Copy whitelist to new menu
}
```

**Hard Burn**: Permanent deletion of menu and all data
```typescript
{
  burn_type: 'hard',
  burn_reason: 'Security breach'
}
```

## 🔗 Customer Access Flow

1. **Access URL**: Customer receives `/m/{token}?u={uniqueToken}`
2. **Location Check**: System requests device location
3. **Access Code**: Customer enters 6-digit code
4. **Validation**: Backend validates all security requirements
5. **Menu View**: If approved, customer can browse and order
6. **Order Placement**: Orders tied to whitelist entry

## 📊 Analytics

Access detailed analytics for each menu:

- **Views**: Total and unique views
- **Conversion**: View-to-order conversion rate
- **Revenue**: Total and average order value
- **Security Events**: Access violations and attempts
- **Customer Activity**: Access logs and patterns
- **Geographic Data**: Location-based insights

## 🛡️ Security Events

The system monitors and logs:

- **failed_access_code**: Wrong access codes entered
- **geofence_violation**: Access outside allowed area
- **time_restriction_violation**: Access outside hours
- **excessive_views**: Too many views from one source
- **device_fingerprint_mismatch**: Different device detected
- **ip_change**: IP address changed during session
- **suspicious_ip**: Access from flagged IP

## 🔄 Edge Functions

### menu-generate
Creates new encrypted menu with products and settings.

**Input**:
```typescript
{
  name: string;
  description?: string;
  product_ids: string[];
  security_settings?: object;
  custom_prices?: Record<string, number>;
  min_order_quantity?: number;
  max_order_quantity?: number;
}
```

### menu-access-validate
Validates customer access attempt.

**Input**:
```typescript
{
  encrypted_url_token: string;
  access_code: string;
  unique_access_token?: string;
  device_fingerprint: string;
  location: { lat: number; lng: number };
  ip_address: string;
  user_agent: string;
}
```

### menu-burn
Burns/destroys a menu.

**Input**:
```typescript
{
  menu_id: string;
  burn_type: 'soft' | 'hard';
  burn_reason: string;
  auto_regenerate?: boolean;
  migrate_customers?: boolean;
}
```

### menu-order-place
Processes customer order.

**Input**:
```typescript
{
  menu_id: string;
  whitelist_id: string;
  order_items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
  }>;
  total_amount: number;
  customer_notes?: string;
}
```

### menu-whitelist-manage
Manages whitelist entries.

**Input**:
```typescript
{
  menu_id: string;
  action: 'add' | 'revoke' | 'regenerate_token';
  customer_data?: {
    name: string;
    phone: string;
    email?: string;
  };
  whitelist_id?: string;  // For revoke/regenerate
}
```

## 📱 Customer Experience

### Mobile Support
- Responsive design for all screen sizes
- Touch-optimized controls
- Native location services
- PWA capabilities

### Security Indicators
- Encrypted badge on header
- Active security checks display
- Confidential watermark
- Warning notices

## 🎯 Best Practices

### Security
1. Always enable geofencing for sensitive catalogs
2. Use time restrictions for limited-time offers
3. Set view limits to prevent sharing
4. Monitor security events regularly
5. Burn compromised menus immediately

### Operations
1. Use descriptive menu names
2. Set appropriate order limits
3. Keep whitelist updated
4. Review analytics weekly
5. Archive burned menus for records

### Customer Service
1. Send access codes via WhatsApp
2. Provide clear instructions
3. Test links before sending
4. Have backup contact method
5. Monitor failed access attempts

## 🔧 Configuration

### Database Tables
- `disposable_menus`: Main menu records
- `disposable_menu_products`: Menu-product relationships
- `menu_access_whitelist`: Invited customers
- `menu_access_logs`: Access attempt logs
- `menu_orders`: Orders placed
- `menu_security_events`: Security violations
- `menu_burn_history`: Burned menu records

### Indexes
- Fast lookup by encrypted_url_token
- Efficient whitelist queries by menu_id
- Quick security event retrieval

### RLS Policies
All tables protected with Row Level Security for admin access only.

## 📞 Support

For issues or questions:
1. Check security events log
2. Review access logs
3. Verify menu configuration
4. Contact system administrator

## 🚨 Emergency Procedures

### Compromised Menu
1. Navigate to menu
2. Click "Burn" button
3. Select "Hard Burn"
4. Document reason
5. Create new menu if needed

### Security Breach
1. Identify affected menus
2. Burn all compromised menus
3. Review security events
4. Update whitelist
5. Regenerate new access codes

## 📈 Future Enhancements

Planned features:
- [ ] SMS notifications for access attempts
- [ ] QR code generation for access
- [ ] Advanced analytics dashboard
- [ ] Bulk whitelist import
- [ ] API webhook integrations
- [ ] Multi-language support
- [ ] Custom branding per menu

---

**Version**: 1.0.0  
**Last Updated**: 2025-10-31  
**Status**: Production Ready ✅
