# Button Monitoring - Integration Examples

## Quick Examples

### Example 1: Replace Button with MonitoredButton

```typescript
// Before
<Button onClick={handleDelete}>Delete</Button>

// After
import { MonitoredButton } from '@/components/ui/monitored-button';

<MonitoredButton
  component="ProductManagement"
  action="delete-product"
  onClick={handleDelete}
  buttonId={`delete-${productId}`}
>
  Delete
</MonitoredButton>
```

### Example 2: Wrap Existing Handler

```typescript
import { monitorButtonAction } from '@/lib/utils/buttonMonitorIntegration';

const handleSave = async (data: FormData) => {
  await saveProduct(data);
};

const monitoredSave = monitorButtonAction(
  handleSave,
  'ProductManagement',
  'save-product'
);

<Button onClick={() => monitoredSave(formData)}>Save</Button>
```

### Example 3: Use Hook for Complex Logic

```typescript
import { useMonitoredButton } from '@/hooks/useMonitoredButton';

const MyComponent = () => {
  const [isSaving, setIsSaving] = useState(false);
  
  const saveHandler = async () => {
    setIsSaving(true);
    try {
      await saveData();
      toast.success('Saved!');
    } finally {
      setIsSaving(false);
    }
  };

  const { handler, isLoading } = useMonitoredButton(saveHandler, {
    component: 'MyComponent',
    action: 'save-data',
  });

  return (
    <Button onClick={handler} disabled={isSaving || isLoading}>
      {isSaving || isLoading ? 'Saving...' : 'Save'}
    </Button>
  );
};
```

### Example 4: Add Data Attributes for Better Tracking

```typescript
<Button
  data-component="ProductManagement"
  data-action="update-price"
  data-button-id={`update-price-${productId}`}
  onClick={handleUpdatePrice}
>
  Update Price
</Button>
```

## Console Commands (Development)

```javascript
// Get health report
window.getButtonHealth()

// Get broken buttons
window.getBrokenButtons(0.3) // 30% error rate threshold

// Get all stats
window.buttonMonitor.getStats()

// Export data
window.buttonMonitor.exportData()

// Clear data
window.buttonMonitor.clear()
```
