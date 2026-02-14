# 🔍 Button Monitoring System

**Complete button health tracking and error logging system**

---

## 📋 Overview

The Button Monitoring System automatically tracks all button interactions across the application, logs errors, identifies broken buttons, and provides comprehensive health reports.

### Features

- ✅ **Automatic Monitoring**: Tracks all button clicks automatically
- ✅ **Error Detection**: Logs all button errors and failures
- ✅ **Performance Tracking**: Measures button action duration
- ✅ **Health Reports**: Identifies broken buttons (high error rate)
- ✅ **Real-time Dashboard**: View button health at `/debug/button-monitor`
- ✅ **Export Data**: Download monitoring data for analysis
- ✅ **Zero Configuration**: Works automatically, no setup needed

---

## 🚀 Quick Start

### Automatic Monitoring (Already Enabled)

The system is automatically initialized when the app loads. No configuration needed!

### Manual Monitoring

For specific buttons, use the `MonitoredButton` component:

```typescript
import { MonitoredButton } from '@/components/ui/monitored-button';

<MonitoredButton
  component="ProductManagement"
  action="delete-product"
  onClick={handleDelete}
  buttonId="delete-product-123"
>
  Delete Product
</MonitoredButton>
```

### Using the Hook

```typescript
import { useMonitoredButton } from '@/hooks/useMonitoredButton';

const { handler, isLoading } = useMonitoredButton(
  async () => {
    await deleteProduct(id);
  },
  {
    component: 'ProductManagement',
    action: 'delete-product',
    buttonId: `delete-${id}`,
  }
);

<Button onClick={handler} disabled={isLoading}>
  {isLoading ? 'Deleting...' : 'Delete'}
</Button>
```

---

## 📊 Dashboard

Access the button health dashboard at:

**URL**: `/debug/button-monitor`

### Dashboard Features

1. **Health Overview**
   - Total buttons tracked
   - Total clicks
   - Success rate
   - Error rate
   - Broken buttons count

2. **Broken Buttons Tab**
   - Lists buttons with error rate ≥ 30%
   - Shows error count, success count, average duration
   - Displays last error message and timestamp

3. **Recent Errors Tab**
   - Last 20 button errors
   - Error messages, timestamps, durations
   - Component and action names

4. **All Buttons Tab**
   - Complete statistics for all tracked buttons
   - Sorted by click count
   - Status badges (Healthy/Warning/Broken)

5. **Top Errors Tab**
   - Most frequent errors by button
   - Error count and last error message

---

## 🔧 API Reference

### `buttonMonitor` (Singleton)

```typescript
import { buttonMonitor } from '@/lib/utils/buttonMonitor';

// Get all statistics
const stats = buttonMonitor.getStats();

// Get statistics for specific button
const buttonStats = buttonMonitor.getButtonStats('ComponentName', 'action-name');

// Get broken buttons (error rate ≥ threshold)
const broken = buttonMonitor.getBrokenButtons(0.5); // 50% error rate

// Get recent errors
const errors = buttonMonitor.getRecentErrors(50); // Last 50 errors

// Get health report
const report = buttonMonitor.getHealthReport();

// Export all data
const data = buttonMonitor.exportData();

// Clear all data
buttonMonitor.clear();
```

### `useButtonMonitor` Hook

```typescript
import { useButtonMonitor } from '@/lib/utils/buttonMonitor';

const { trackClick, buttonId } = useButtonMonitor(
  'ComponentName',
  'action-name',
  'optional-button-id'
);

const handleClick = async () => {
  const complete = trackClick();
  try {
    await doSomething();
    complete('success');
  } catch (error) {
    complete('error', error);
  }
};
```

### `MonitoredButton` Component

```typescript
import { MonitoredButton } from '@/components/ui/monitored-button';

<MonitoredButton
  component="ComponentName"
  action="action-name"
  onClick={async () => {
    // Your async action
  }}
  buttonId="optional-id"
  timeout={30000} // 30 seconds
  onError={(error) => {
    // Custom error handler
  }}
  onSuccess={() => {
    // Custom success handler
  }}
>
  Click Me
</MonitoredButton>
```

### `useMonitoredButton` Hook

```typescript
import { useMonitoredButton } from '@/hooks/useMonitoredButton';

const { handler, isLoading } = useMonitoredButton(
  async (id: string) => {
    await deleteItem(id);
  },
  {
    component: 'ComponentName',
    action: 'delete-item',
    buttonId: 'delete-button',
    timeout: 30000,
    onError: (error) => console.error(error),
    onSuccess: () => console.log('Success!'),
  }
);
```

---

## 📈 Health Report Structure

```typescript
interface HealthReport {
  totalButtons: number;
  totalClicks: number;
  successRate: number; // 0-1
  errorRate: number; // 0-1
  brokenButtons: number;
  recentErrors: number;
  topErrors: Array<{
    button: string; // "Component.action"
    count: number;
    lastError: string;
  }>;
}
```

### Button Statistics

```typescript
interface ButtonStats {
  buttonId: string;
  component: string;
  action: string;
  totalClicks: number;
  successCount: number;
  errorCount: number;
  timeoutCount: number;
  lastError?: string;
  lastErrorTime?: string;
  averageDuration?: number; // milliseconds
  lastClickTime?: string;
}
```

---

## 🎯 Identifying Broken Buttons

A button is considered "broken" if its error rate exceeds a threshold (default: 30%).

### Example

```typescript
// Get broken buttons
const broken = buttonMonitor.getBrokenButtons(0.3); // 30% error rate

broken.forEach((stat) => {
  console.log(`${stat.component}.${stat.action}: ${stat.errorCount}/${stat.totalClicks} errors`);
  console.log(`Last error: ${stat.lastError}`);
});
```

---

## 📝 Logging

All button errors are automatically logged using the `logger` utility:

```typescript
// Errors are logged with:
logger.error('Button error: ComponentName.action-name', error, {
  component: 'ButtonMonitor',
  buttonId: 'button-id',
  duration: 1234, // milliseconds
  url: window.location.href,
});
```

---

## 🔍 Global Interceptor

The global button interceptor automatically monitors all buttons without any code changes:

- ✅ Tracks all `<button>` and `[role="button"]` clicks
- ✅ Monitors form submissions
- ✅ Detects async operations
- ✅ Tracks timeouts (30 second default)
- ✅ Logs all errors automatically

### How It Works

1. Listens to all click events on the document
2. Identifies button elements (button tags or role="button")
3. Extracts component/action from data attributes or DOM structure
4. Tracks click start time
5. Monitors for completion, errors, or timeouts
6. Records statistics automatically

---

## 🛠️ Integration Examples

### Example 1: Replace Existing Button

```typescript
// Before
<Button onClick={handleDelete}>Delete</Button>

// After
<MonitoredButton
  component="ProductManagement"
  action="delete-product"
  onClick={handleDelete}
>
  Delete
</MonitoredButton>
```

### Example 2: Wrap Existing Handler

```typescript
import { monitorButtonAction } from '@/lib/utils/buttonMonitorIntegration';

const handleDelete = async (id: string) => {
  await deleteProduct(id);
};

const monitoredDelete = monitorButtonAction(
  handleDelete,
  'ProductManagement',
  'delete-product'
);

<Button onClick={() => monitoredDelete(productId)}>Delete</Button>
```

### Example 3: Use Hook

```typescript
import { useMonitoredButton } from '@/hooks/useMonitoredButton';

const MyComponent = () => {
  const { handler, isLoading } = useMonitoredButton(
    async () => {
      await saveData();
    },
    {
      component: 'MyComponent',
      action: 'save-data',
    }
  );

  return (
    <Button onClick={handler} disabled={isLoading}>
      {isLoading ? 'Saving...' : 'Save'}
    </Button>
  );
};
```

---

## 📊 Console Access

In development, you can access button monitoring from the console:

```javascript
// Get health report
window.buttonMonitor?.getHealthReport();

// Get broken buttons
window.buttonMonitor?.getBrokenButtons(0.3);

// Export data
window.buttonMonitor?.exportData();
```

---

## 🎨 Customization

### Change Timeout

```typescript
<MonitoredButton
  timeout={60000} // 60 seconds
  // ...
/>
```

### Custom Error Handling

```typescript
<MonitoredButton
  onError={(error) => {
    // Custom error handling
    toast.error(`Custom error: ${error.message}`);
    // Still logged automatically
  }}
  // ...
/>
```

### Custom Success Handling

```typescript
<MonitoredButton
  onSuccess={() => {
    // Custom success handling
    console.log('Button action succeeded!');
  }}
  // ...
/>
```

---

## 🔒 Privacy & Performance

- **Memory Limits**: Keeps last 1000 interactions, stats for 500 buttons
- **No PII**: Only tracks button IDs, component names, and error messages
- **Client-Side Only**: All data stays in browser (can be exported)
- **Low Overhead**: Minimal performance impact (< 1ms per click)

---

## 🐛 Troubleshooting

### Buttons Not Being Tracked

1. Check if button has `data-monitored` attribute (should be added automatically)
2. Verify global interceptor is initialized (check console for "Global button monitoring initialized")
3. Check browser console for errors

### Missing Component/Action Names

Add data attributes to buttons:

```typescript
<Button
  data-component="ComponentName"
  data-action="action-name"
  data-button-id="unique-id"
>
  Click Me
</Button>
```

### High Memory Usage

The system automatically limits data:
- Last 1000 interactions
- Stats for 500 buttons

Clear data if needed:

```typescript
buttonMonitor.clear();
```

---

## 📚 Related Files

- `src/lib/utils/buttonMonitor.ts` - Core monitoring system
- `src/lib/utils/globalButtonInterceptor.ts` - Global automatic monitoring
- `src/components/debug/ButtonHealthPanel.tsx` - Dashboard UI
- `src/components/ui/monitored-button.tsx` - Monitored button component
- `src/hooks/useMonitoredButton.ts` - Monitoring hook
- `src/lib/utils/buttonMonitorIntegration.ts` - Integration utilities

---

## ✅ Best Practices

1. **Use Descriptive Names**: Use clear component and action names
2. **Add Button IDs**: Use unique IDs for better tracking
3. **Check Dashboard Regularly**: Review `/debug/button-monitor` periodically
4. **Fix Broken Buttons**: Address buttons with high error rates
5. **Export Data**: Export monitoring data for analysis
6. **Monitor in Production**: System works in all environments

---

## 🎉 Summary

The Button Monitoring System provides:

- ✅ Automatic tracking of all buttons
- ✅ Error detection and logging
- ✅ Performance monitoring
- ✅ Health reports and broken button identification
- ✅ Real-time dashboard
- ✅ Zero configuration required

**Access the dashboard**: Navigate to `/debug/button-monitor` in your browser!

