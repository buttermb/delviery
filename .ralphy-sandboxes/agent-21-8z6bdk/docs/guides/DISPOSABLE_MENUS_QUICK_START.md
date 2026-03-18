# Disposable Menus - Quick Start Guide

## For Administrators

### Creating a New Menu

**Option 1: Quick Create (Legacy)**
1. Go to **Disposable Menus** page
2. Click **"Quick Create"** button
3. Use the existing 5-step dialog

**Option 2: Wizard (Recommended)**
1. Go to **Disposable Menus** page
2. Click **"Create Menu (Wizard)"** button
3. **Step 1:** Select a template:
   - **Weekly Special** - For weekly promotions
   - **Flash Sale** - 24-hour urgent sales
   - **VIP Menu** - Exclusive customer menus
   - **Custom** - Full control
4. **Step 2:** Enter menu name and description
5. **Step 3:** Search and select products
6. **Step 4:** Configure settings (auto-filled from template)
7. Click **"Create Menu"**

### Sharing a Menu

1. Click on a menu card
2. Click **"Share"** button
3. Choose sharing method:

   **Link & QR Tab:**
   - Copy the menu URL
   - Download QR code as PNG
   - Share via WhatsApp or Email

   **SMS Blast Tab:**
   - Select customers (multi-select)
   - Customize message
   - Click "Send SMS" (requires SMS provider setup)

   **Customers Tab:**
   - View who has access
   - See invitation dates and status

### Exporting Analytics

1. Go to menu analytics page
2. Click **"Export"** dropdown
3. Choose format:
   - **Excel** (.xlsx) - Recommended for spreadsheets
   - **CSV** (.csv) - For simple data
   - **JSON** (.json) - For developers

## For Customers

### Viewing a Menu

1. Open the menu link (via email, SMS, or QR code)
2. Enter access code if required
3. Browse products
4. Add items to cart
5. Adjust quantities
6. Click **"Place Order"**
7. Enter phone number when prompted

### Shopping Cart Features

- **Persistent:** Cart saves across page refreshes
- **Real-time Total:** Updates automatically
- **Quantity Controls:** Plus/minus buttons or direct input
- **Weight Selection:** Choose different weight options per product

## Technical Details

### Menu Templates

| Template | Expiration | Access | Max Views | Use Case |
|----------|-----------|--------|-----------|----------|
| Weekly Special | 7 days | Invite-only | Unlimited | Weekly promotions |
| Flash Sale | 24 hours | Shared | 100 | Urgent sales |
| VIP Menu | 30 days | Invite-only | Unlimited | Premium customers |
| Custom | Custom | Custom | Custom | Full control |

### QR Code Usage

QR codes are automatically generated when sharing a menu. They can be:
- **Downloaded** as PNG for printing
- **Scanned** by customers to access menu
- **Customized** with size and colors (future enhancement)

### Cart Persistence

The shopping cart uses browser localStorage and:
- Persists across page refreshes
- Clears when switching menus
- Stores product ID, quantity, weight, and price

## Troubleshooting

### Menu Creation Issues

**Problem:** "Menu limit reached"
- **Solution:** Upgrade your plan or contact support

**Problem:** Can't select products
- **Solution:** Ensure products exist in inventory first

### QR Code Issues

**Problem:** QR code not generating
- **Solution:** Check browser console for errors, ensure menu URL is valid

### Cart Issues

**Problem:** Cart not persisting
- **Solution:** Check browser localStorage is enabled, clear cache if needed

## API Integration (For Developers)

### SMS Provider Setup

To enable SMS functionality:

1. **Choose a provider:**
   - Twilio (recommended)
   - Plivo
   - Novu
   - Custom service

2. **Create Edge Function:**
   ```
   supabase/functions/send-sms/index.ts
   ```

3. **Update MenuShareDialogEnhanced:**
   Replace placeholder in `handleSendSMS()` with actual API call

4. **Environment Variables:**
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

### Password Protection

Password hashing is ready but requires:
1. Backend validation in Edge Function
2. Password verification in `SecureMenuAccess` component
3. Password strength indicator in wizard (optional)

## Best Practices

1. **Use Templates:** Start with templates for common use cases
2. **Name Menus Clearly:** Use descriptive names for easy identification
3. **Set Expiration:** Always set expiration dates for security
4. **Limit Views:** Use max views for highly sensitive menus
5. **Access Codes:** Enable access codes for additional security
6. **Test QR Codes:** Always test QR codes before printing
7. **Monitor Analytics:** Check analytics regularly for insights

## Support

For issues or questions:
- Check the help documentation in the admin panel
- Review the implementation guide: `DISPOSABLE_MENUS_IMPLEMENTATION.md`
- Contact support through the admin panel

