# Zero-Knowledge Encryption Guide

## Overview

FloraIQ uses zero-knowledge client-side encryption to protect sensitive customer and business data. All encryption/decryption happens in the browser - keys never leave the client, and the server cannot decrypt data without the user's password.

## Architecture

### Key Components

1. **ClientEncryption** (`src/lib/encryption/clientEncryption.ts`)
   - Core encryption engine using crypto-js
   - PBKDF2 key derivation from user password
   - AES-256-GCM encryption/decryption
   - Session management (30-minute timeout)

2. **React Hooks**
   - `useEncryption` - Main encryption hook
   - `useEncryptedQuery` - Auto-decrypt Supabase queries
   - `useEncryptedMutation` - Auto-encrypt Supabase mutations
   - `useEncryptedFile` - File encryption/decryption

3. **Database Schema**
   - Encrypted columns: `*_encrypted` suffix
   - Search indexes: `*_search_index` suffix
   - Metadata: `encryption_metadata` JSONB column

## How It Works

### 1. Initialization

Encryption is automatically initialized when users log in:

```typescript
// Happens automatically in login flow
await clientEncryption.initialize(password, userId);
```

- Password is used to derive encryption key via PBKDF2
- Salt is stored in localStorage (not sensitive)
- Session key is stored in sessionStorage (cleared on browser close)

### 2. Encrypting Data

```typescript
import { useEncryptedMutation } from '@/lib/hooks/useEncryptedMutation';

const { insert, update } = useEncryptedMutation({ table: 'customers' });

// Data is automatically encrypted before sending to Supabase
await insert({
  name: 'John Doe',
  email: 'john@example.com',
  phone: '555-1234',
});
```

### 3. Decrypting Data

```typescript
import { useEncryptedQuery } from '@/lib/hooks/useEncryptedQuery';

const { data, loading } = useEncryptedQuery({
  table: 'customers',
  filters: { tenant_id: tenant.id },
});

// Data is automatically decrypted
console.log(data); // [{ name: 'John Doe', email: 'john@example.com', ... }]
```

### 4. Searching Encrypted Data

Search uses deterministic hashing:

```typescript
import { useEncryption } from '@/lib/hooks/useEncryption';

const { createSearchHash } = useEncryption();
const emailHash = createSearchHash('john@example.com');

// Query using search index
const { data } = await supabase
  .from('customers')
  .select('*')
  .eq('email_search_index', emailHash);
```

## Hybrid Migration

During migration, both encrypted and plaintext columns exist:

1. **New data**: Encrypted automatically
2. **Old data**: Remains in plaintext until migrated
3. **Reading**: Try encrypted first, fall back to plaintext
4. **Writing**: Write to both (for backward compatibility)

### Migration Process

```bash
# Encrypt 10% of existing data
npm run encrypt-data -- --table=customers --percentage=10 --userId=USER_ID --password=USER_PASSWORD

# Encrypt 50% of existing data
npm run encrypt-data -- --table=customers --percentage=50 --userId=USER_ID --password=USER_PASSWORD

# Encrypt 100% of existing data
npm run encrypt-data -- --table=customers --percentage=100 --userId=USER_ID --password=USER_PASSWORD
```

## Security Features

- ✅ **Zero-Knowledge**: Server cannot decrypt data
- ✅ **Client-Side Only**: All encryption in browser
- ✅ **Password-Derived Keys**: PBKDF2 with 100,000 iterations
- ✅ **Session Management**: 30-minute timeout, auto-destroy on logout
- ✅ **Searchable Encryption**: Deterministic hashing for search
- ✅ **File Encryption**: Encrypt files before upload

## Best Practices

1. **Always use encryption hooks** - Don't bypass encryption
2. **Handle both encrypted/plaintext** - During hybrid migration
3. **Never log sensitive data** - Use logger utility
4. **Clear passwords from memory** - After initialization
5. **Test encryption** - Run `npm run test-encryption`

## Troubleshooting

### Encryption Not Ready

```typescript
const { isReady } = useEncryption();

if (!isReady) {
  // Encryption not initialized - user needs to log in
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

Encryption session expires after 30 minutes of inactivity. User needs to log in again.

## Performance

- Encryption adds ~10-50ms per operation
- Acceptable for B2B use cases
- Batch operations recommended for large datasets

## Tables with Encryption

- `customers` - Name, email, phone, address, notes
- `wholesale_clients` - Business name, license, address, contact info, bank details
- `products` - Name, description, price, SKU, supplier info
- `orders` - Items, total, customer notes, delivery address, payment info
- `wholesale_orders` - Same as orders
- `transactions` - Amount, payment method, payment details
- `marketplace_messages` - Content, subject, attachments
- `documents` - File name, type, size, metadata
- `profiles` - Full name, phone, address, preferences

## Support

For issues or questions, contact the development team or check the implementation status in `ENCRYPTION_IMPLEMENTATION_STATUS.md`.

