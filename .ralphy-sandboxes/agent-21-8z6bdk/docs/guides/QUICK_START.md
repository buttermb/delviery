# Encryption Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Install Dependencies (Already Done)
```bash
npm install crypto-js @types/crypto-js
```

### Step 2: Run Database Migrations
```bash
supabase migration up
```

### Step 3: Deploy Application
```bash
npm run build
# Deploy to your platform
```

### Step 4: Test
1. Log in to your application
2. Check browser console for "Encryption initialized successfully"
3. Create a new customer - it will be encrypted automatically
4. View customers - they will decrypt automatically

**That's it!** Encryption is now active.

## 📝 Using Encryption in Your Components

### Reading Encrypted Data

```typescript
import { useEncryption } from '@/lib/hooks/useEncryption';

function MyComponent() {
  const { decryptObject, isReady } = useEncryption();
  
  useEffect(() => {
    if (isReady) {
      // Fetch encrypted data
      const { data } = await supabase.from('customers').select('*');
      
      // Decrypt
      const decrypted = data?.map(record => decryptObject(record));
    }
  }, [isReady]);
}
```

### Creating Encrypted Data

```typescript
import { useEncryptedMutation } from '@/lib/hooks/useEncryptedMutation';

function MyForm() {
  const { insert } = useEncryptedMutation({ table: 'customers' });
  
  const handleSubmit = async (data) => {
    // Automatically encrypted before sending
    await insert({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '555-1234',
    });
  };
}
```

### Checking Encryption Status

```typescript
import { EncryptionIndicator } from '@/components/admin/EncryptionIndicator';

function MyPage() {
  return (
    <div>
      <EncryptionIndicator showLabel />
      {/* Your content */}
    </div>
  );
}
```

## 🔍 Common Patterns

### Pattern 1: Hybrid Migration (Read Both)
```typescript
const { decryptObject, isReady } = useEncryption();

// Try encrypted first, fall back to plaintext
let data = record;
if (isReady && record.name_encrypted) {
  try {
    data = decryptObject(record);
  } catch {
    // Fall back to plaintext
    data = record;
  }
}
```

### Pattern 2: Conditional Encryption
```typescript
const { insert, isReady } = useEncryptedMutation({ table: 'customers' });

if (isReady) {
  await insert(data); // Encrypted
} else {
  await supabase.from('customers').insert(data); // Plaintext fallback
}
```

### Pattern 3: Search Encrypted Fields
```typescript
const { createSearchHash } = useEncryption();

// Create search hash
const emailHash = createSearchHash('john@example.com');

// Search using index
const { data } = await supabase
  .from('customers')
  .select('*')
  .eq('email_search_index', emailHash);
```

## ⚡ Performance Tips

1. **Batch Operations**: Encrypt multiple records at once
2. **Pagination**: Use pagination for large datasets
3. **Caching**: Cache decrypted data when appropriate
4. **Lazy Loading**: Only decrypt when needed

## 🐛 Troubleshooting

### Encryption Not Ready
```typescript
const { isReady } = useEncryption();

if (!isReady) {
  return <div>Please log in to access encrypted data</div>;
}
```

### Decryption Fails
```typescript
try {
  const decrypted = decryptObject(encryptedData);
} catch (error) {
  // Fall back to plaintext during hybrid migration
  const plaintext = encryptedData;
}
```

### Session Expired
- User needs to log in again
- Encryption will re-initialize automatically

## 📚 More Information

- **Architecture**: See `docs/ENCRYPTION_GUIDE.md`
- **Deployment**: See `docs/DEPLOYMENT.md`
- **Recovery**: See `docs/RECOVERY.md`
- **Status**: See `ENCRYPTION_IMPLEMENTATION_STATUS.md`

## ✅ Checklist

- [ ] Dependencies installed
- [ ] Migrations run
- [ ] Application deployed
- [ ] Login tested (encryption initializes)
- [ ] Create operation tested (data encrypted)
- [ ] Read operation tested (data decrypted)
- [ ] Migration status checked

---

**Need Help?** Check the full documentation or review the implementation status.

