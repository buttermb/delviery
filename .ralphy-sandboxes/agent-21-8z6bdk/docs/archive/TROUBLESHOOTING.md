
# Disposable Menus - Troubleshooting Guide

## Common Issues

### 1. Menu Not Loading
**Symptoms**: Infinite spinner, "Menu not found" error.
**Possible Causes**:
- Menu has expired or been burned.
- Network connectivity issues.
- Invalid URL token.
**Solutions**:
- Check if the menu status is `active` in the dashboard.
- Verify internet connection.
- Regenerate the link if needed.

### 2. "Access Denied" Error
**Symptoms**: User sees a 403 or 401 error.
**Possible Causes**:
- Incorrect access code.
- Velocity limit exceeded (too many attempts).
- IP address blocked.
**Solutions**:
- Verify the access code.
- Wait 5 minutes and try again (velocity reset).
- Check security logs for IP blocks.

### 3. Real-Time Updates Not Working
**Symptoms**: Price changes or stock status not reflecting on the menu.
**Possible Causes**:
- WebSocket connection failed.
- Inventory sync service is down.
**Solutions**:
- Refresh the page.
- Check Supabase status.
- Verify `inventory-changes` channel subscription in logs.

### 4. Screenshot Detection False Positives
**Symptoms**: Menu burns or warns user without a screenshot being taken.
**Possible Causes**:
- Switching tabs/apps (triggers visibility check).
- Browser extensions interfering with the page.
**Solutions**:
- Advise users not to switch apps while viewing.
- Disable browser extensions.
- Adjust sensitivity settings in the admin panel.

## Support
For critical issues, contact support@delviery.com with your Tenant ID and Menu ID.
