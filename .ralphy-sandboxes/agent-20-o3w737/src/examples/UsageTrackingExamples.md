# Usage Tracking Integration Examples

## How to Integrate Usage Tracking in Your Components

### **1. Using LimitGuard Component**

Wrap any create/action area with `LimitGuard` to show warnings:

```tsx
import { LimitGuard } from '@/components/whitelabel/LimitGuard';
import { Button } from '@/components/ui/button';

function AddCustomerButton() {
  const handleAdd = () => {
    // Your create logic
  };

  return (
    <LimitGuard resource="customers">
      <Button onClick={handleAdd}>
        Add Customer
      </Button>
    </LimitGuard>
  );
}
```

### **2. Using LimitEnforcedButton**

Button that automatically checks limits:

```tsx
import { LimitEnforcedButton } from '@/components/integrations/LimitEnforcedButton';

function CreateMenuButton() {
  const handleCreate = async () => {
    // Create menu logic
    await createMenu();
    
    // Track usage
    await updateResourceUsage(tenantId, 'menus', 1);
  };

  return (
    <LimitEnforcedButton
      resource="menus"
      action={handleCreate}
    >
      Create Menu
    </LimitEnforcedButton>
  );
}
```

### **3. Using useTenantLimits Hook**

Check limits before actions:

```tsx
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { useToast } from '@/hooks/use-toast';

function CreateProductForm() {
  const { canCreate, getRemaining } = useTenantLimits();
  const { toast } = useToast();

  const handleSubmit = async (data) => {
    if (!canCreate('products')) {
      toast({
        title: 'Limit Reached',
        description: `You can only create ${getRemaining('products')} more products.`,
        variant: 'destructive',
      });
      return;
    }

    // Create product
    await createProduct(data);
    
    // Update usage
    await updateResourceUsage(tenantId, 'products', 1);
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### **4. Tracking Add-On Usage**

Track SMS, emails, labels:

```tsx
import { trackSMSSent, trackEmailSent, trackLabelPrinted } from '@/utils/usageTracking';
import { useTenant } from '@/contexts/TenantContext';

function SendSMSButton() {
  const { tenant } = useTenant();

  const handleSend = async () => {
    await sendSMS(message);
    
    // Track usage
    if (tenant?.id) {
      await trackSMSSent(tenant.id, 1);
    }
  };

  return <Button onClick={handleSend}>Send SMS</Button>;
}
```

### **5. Automatic Usage Updates**

When creating resources, update usage:

```tsx
import { updateResourceUsage } from '@/utils/usageTracking';
import { useTenant } from '@/contexts/TenantContext';

async function createNewCustomer(data: CustomerData) {
  const { tenant } = useTenant();
  
  // Create customer
  const { data: customer } = await supabase
    .from('customers')
    .insert({ ...data, tenant_id: tenant.id })
    .select()
    .single();

  // Update usage count
  if (tenant?.id) {
    await updateResourceUsage(tenant.id, 'customers', 1);
  }

  return customer;
}
```

### **6. Usage Limit Warning**

Show warnings when approaching limits:

```tsx
import { UsageLimitWarning } from '@/components/shared/UsageLimitWarning';

function CustomersPage() {
  return (
    <div>
      <UsageLimitWarning resource="customers" warningThreshold={80} />
      
      <CustomerList />
    </div>
  );
}
```

---

## Integration Checklist

When adding new features that create resources:

- [ ] Wrap create action with `LimitGuard` or use `LimitEnforcedButton`
- [ ] Call `updateResourceUsage()` after successful creation
- [ ] Call `updateResourceUsage()` with negative delta on deletion
- [ ] Track add-on usage (SMS, emails, labels) if applicable
- [ ] Show usage warnings at 80% threshold
- [ ] Block actions when limit reached
- [ ] Link to billing page for upgrades

---

## Best Practices

1. **Check Limits Early**: Check before showing forms/dialogs
2. **Track After Success**: Only update usage after successful creation
3. **Handle Deletions**: Decrease usage count when resources are deleted
4. **Show Feedback**: Always inform users when limits are reached
5. **Provide Upgrade Path**: Link to billing page from limit warnings

---

**All utilities are ready to use!**

