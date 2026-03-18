# 🔍 Button Monitoring - Quick Start

## ✅ What's Included

A complete button monitoring system that automatically tracks all button interactions, logs errors, and identifies broken buttons.

---

## 🚀 Zero Configuration

**The system is already active!** All buttons are automatically monitored when the app loads.

---

## 📊 View Button Health

### Option 1: Dashboard (Recommended)

Navigate to: **`/debug/button-monitor`**

Features:
- Health overview (total buttons, success rate, error rate)
- Broken buttons list (error rate ≥ 30%)
- Recent errors (last 20)
- All button statistics
- Top errors by frequency

### Option 2: Browser Console (Development)

```javascript
// Get health report
window.getButtonHealth()

// Get broken buttons
window.getBrokenButtons(0.3) // 30% error rate

// Get all stats
window.buttonMonitor.getStats()

// Export data
window.buttonMonitor.exportData()
```

---

## 🎯 What Gets Tracked

- ✅ Button clicks
- ✅ Success/failure status
- ✅ Error messages
- ✅ Action duration (performance)
- ✅ Component and action names
- ✅ Timestamps and URLs
- ✅ Timeouts (30 second default)

---

## 🔧 Manual Integration (Optional)

### Use MonitoredButton Component

```typescript
import { MonitoredButton } from '@/components/ui/monitored-button';

<MonitoredButton
  component="ProductManagement"
  action="delete-product"
  onClick={handleDelete}
>
  Delete
</MonitoredButton>
```

### Use Hook

```typescript
import { useMonitoredButton } from '@/hooks/useMonitoredButton';

const { handler, isLoading } = useMonitoredButton(
  async () => await saveData(),
  { component: 'MyComponent', action: 'save' }
);

<Button onClick={handler} disabled={isLoading}>Save</Button>
```

### Add Data Attributes

For better tracking, add these attributes to buttons:

```typescript
<Button
  data-component="ComponentName"
  data-action="action-name"
  data-button-id="unique-id"
  onClick={handleClick}
>
  Click Me
</Button>
```

---

## 📈 Identifying Broken Buttons

A button is "broken" if its error rate exceeds 30% (configurable).

**View broken buttons:**
- Dashboard: "Broken Buttons" tab
- Console: `window.getBrokenButtons(0.3)`

---

## 📝 Logging

All button errors are automatically logged:

```typescript
logger.error('Button error: ComponentName.action-name', error, {
  component: 'ButtonMonitor',
  buttonId: 'button-id',
  duration: 1234,
  url: window.location.href,
});
```

---

## 🎨 Features

- ✅ **Automatic**: Works for all buttons, no code changes needed
- ✅ **Zero Config**: Initialized automatically on app load
- ✅ **Error Detection**: Catches unhandled promise rejections
- ✅ **Performance**: Tracks action duration
- ✅ **Health Reports**: Identifies broken buttons automatically
- ✅ **Real-time**: Dashboard updates every 5 seconds
- ✅ **Export**: Download monitoring data as JSON
- ✅ **Console Access**: Dev tools integration

---

## 🔍 Example Output

### Health Report

```javascript
{
  totalButtons: 45,
  totalClicks: 1234,
  successRate: 0.95,  // 95%
  errorRate: 0.05,    // 5%
  brokenButtons: 2,
  recentErrors: 5,
  topErrors: [
    { button: "ProductManagement.delete-product", count: 3, lastError: "Unauthorized" },
    { button: "OrderManagement.cancel-order", count: 2, lastError: "Order not found" }
  ]
}
```

### Broken Button

```javascript
{
  buttonId: "delete-product-123",
  component: "ProductManagement",
  action: "delete-product",
  totalClicks: 10,
  successCount: 3,
  errorCount: 7,  // 70% error rate
  errorRate: 0.7,
  lastError: "Unauthorized access",
  lastErrorTime: "2025-01-28T10:30:00Z",
  averageDuration: 1234
}
```

---

## 🛠️ Troubleshooting

### Buttons Not Tracked

1. Check console for "Global button monitoring initialized"
2. Verify button is not disabled
3. Add `data-component` and `data-action` attributes

### Missing Errors

Errors are logged automatically. Check:
- Browser console
- Logger output
- Dashboard "Recent Errors" tab

### High Memory Usage

System automatically limits:
- Last 1000 interactions
- Stats for 500 buttons

Clear data: `window.buttonMonitor.clear()`

---

## 📚 Full Documentation

See `docs/BUTTON_MONITORING_SYSTEM.md` for complete API reference and advanced usage.

---

## ✅ Summary

**Everything is already working!**

- ✅ All buttons automatically monitored
- ✅ Errors automatically logged
- ✅ Broken buttons automatically identified
- ✅ Dashboard available at `/debug/button-monitor`
- ✅ Console access in development mode

**Just use your app normally - the system tracks everything!**

