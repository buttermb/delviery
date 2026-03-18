# Encryption API Documentation

## Overview

This document describes the encryption APIs available for handling customer PHI/PII data. The system uses AES-256-GCM encryption with PBKDF2 key derivation.

## Client-Side Encryption

### EncryptionContext

React context providing encryption operations throughout the application.

#### Initialization

```typescript
import { useEncryptionContext } from '@/contexts/EncryptionContext';

function MyComponent() {
  const { isReady, initialize, encrypt, decrypt } = useEncryptionContext();
  
  // Initialize on mount or after login
  useEffect(() => {
    if (!isReady) {
      initialize(userPassword);
    }
  }, []);
}
```

#### Methods

**`initialize(password: string): Promise<void>`**
- Initializes encryption with user's password
- Derives encryption key using PBKDF2
- Must be called before encrypt/decrypt operations
- Throws error if user not authenticated

```typescript
await initialize('user-password-123');
```

**`encrypt(value: any): string`**
- Encrypts any value (string, number, object)
- Returns base64-encoded ciphertext
- Requires `isReady = true`

```typescript
const encrypted = encrypt({ 
  firstName: 'John',
  medicalCardNumber: '12345'
});
```

**`decrypt<T>(value: string): T`**
- Decrypts ciphertext back to original type
- Type parameter for type safety
- Throws error if decryption fails

```typescript
const decrypted = decrypt<CustomerPHI>(encryptedData);
```

**`encryptObject<T>(obj: T): Record<string, string>`**
- Encrypts all values in an object
- Returns object with encrypted string values
- Useful for form data encryption

```typescript
const formData = {
  firstName: 'John',
  email: 'john@example.com'
};
const encrypted = encryptObject(formData);
```

**`decryptObject<T>(obj: Record<string, string>): T`**
- Decrypts all values in an object
- Returns typed object with original values

```typescript
const decrypted = decryptObject<Customer>(encryptedRecord);
```

**`createSearchHash(value: string): string`**
- Creates SHA-256 hash for searchable fields
- Used for email, phone, medical card number
- Returns hex-encoded hash

```typescript
const emailHash = createSearchHash('user@example.com');
```

**`destroy(): void`**
- Clears encryption key from memory
- Called on logout
- Requires re-initialization for new session

```typescript
destroy(); // Clear encryption on logout
```

## Server-Side Encryption (Edge Functions)

### Shared Encryption Utilities

Location: `supabase/functions/_shared/encryption.ts`

#### Functions

**`encryptData(data: string, password: string): Promise<string>`**

Encrypts string data using AES-256-GCM.

```typescript
import { encryptData } from '../_shared/encryption.ts';

const encrypted = await encryptData('sensitive-data', userPassword);
```

**Parameters:**
- `data`: String to encrypt
- `password`: Encryption password (user-specific)

**Returns:** Base64-encoded encrypted data (salt + IV + ciphertext)

---

**`decryptData(encryptedData: string, password: string): Promise<string>`**

Decrypts AES-256-GCM encrypted data.

```typescript
const decrypted = await decryptData(encrypted, userPassword);
```

**Parameters:**
- `encryptedData`: Base64-encoded encrypted string
- `password`: Decryption password

**Returns:** Decrypted plaintext string

**Throws:** Error if password is incorrect or data is corrupted

---

**`encryptCustomerFields(customer: any, password: string): Promise<any>`**

Encrypts all PHI fields in a customer record.

```typescript
const encryptedCustomer = await encryptCustomerFields(
  customerData, 
  userPassword
);
```

**Encrypted Fields:**
- Personal: first_name, last_name, email, phone, address, city, state, zip_code
- PHI: date_of_birth, medical_card_number, medical_card_state, medical_card_expiration
- Medical: physician_name, qualifying_conditions, allergies
- Additional: caregiver_name, caregiver_phone, medical_card_photo_url
- Preferences: preferred_products, preferred_strains

**Returns:** Object with `_encrypted` fields and search indexes

---

**`decryptCustomerFields(encryptedCustomer: any, password: string): Promise<any>`**

Decrypts all encrypted fields in a customer record.

```typescript
const customer = await decryptCustomerFields(
  encryptedRecord,
  userPassword
);
```

**Returns:** Object with decrypted values, removes `_encrypted` suffixes

---

**`createSearchHash(value: string): Promise<string>`**

Creates searchable hash using SHA-256.

```typescript
const emailHash = await createSearchHash('user@example.com');
```

**Usage:** Store in `email_search_index`, `phone_search_index`, `medical_card_number_search_index`

---

**`logPHIAccess(supabaseClient, customerId, action, fieldsAccessed, userId?, purpose?): Promise<void>`**

Logs PHI access for HIPAA compliance.

```typescript
await logPHIAccess(
  supabase,
  'customer-id-123',
  'view',
  ['first_name', 'email', 'medical_card_number'],
  'user-id-456',
  'Customer service inquiry'
);
```

**Parameters:**
- `supabaseClient`: Supabase client instance
- `customerId`: Customer record ID
- `action`: 'view' | 'create' | 'update' | 'decrypt' | 'search' | 'export' | 'delete'
- `fieldsAccessed`: Array of field names accessed
- `userId`: (Optional) User performing the action
- `purpose`: (Optional) Reason for access

**Logs to:** `phi_access_audit` table

## Database Functions

### `log_phi_access()`

RPC function for logging PHI access from frontend.

```typescript
const { error } = await supabase.rpc('log_phi_access', {
  p_customer_id: 'customer-id',
  p_action: 'view',
  p_fields_accessed: ['email', 'phone'],
  p_purpose: 'Customer verification'
});
```

## Edge Function APIs

### Export Customer Data

**Endpoint:** `POST /functions/v1/export-customer-data`

**Purpose:** GDPR-compliant data export with PHI decryption

**Request:**
```json
{
  "customer_user_id": "uuid",
  "tenant_id": "uuid",
  "format": "json" | "csv",
  "encryption_password": "user-password" // Optional
}
```

**Response (Success):**
```json
{
  "success": true,
  "export_request_id": "uuid",
  "data": {
    "export_date": "2025-01-18T04:00:00Z",
    "customer_id": "uuid",
    "personal_information": { ... },
    "customer_record": { ... },
    "orders": [ ... ],
    "loyalty_points": [ ... ]
  },
  "expires_at": "2025-01-25T04:00:00Z",
  "note": "PHI data is encrypted. Provide encryption_password to decrypt."
}
```

**Notes:**
- Without `encryption_password`: Returns placeholder for encrypted fields
- With password: Returns fully decrypted data
- Logs PHI access with action='export'
- Export expires after 7 days

---

### Delete Customer Account

**Endpoint:** `POST /functions/v1/delete-customer-account`

**Purpose:** GDPR-compliant account deletion with PHI anonymization

**Request:**
```json
{
  "customer_user_id": "uuid",
  "tenant_id": "uuid",
  "reason": "User request" // Optional
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Account deleted successfully. Your data has been anonymized in accordance with GDPR requirements."
}
```

**Behavior:**
- Anonymizes customer data (removes PHI)
- Preserves order history (anonymized)
- Logs deletion in audit trail
- Marks account as inactive
- Revokes all active sessions

## Utility Hooks

### `usePHIAccessLogger`

React hook for logging PHI access from frontend.

```typescript
import { usePHIAccessLogger } from '@/lib/utils/phiAccessLogger';

function CustomerDetails({ customerId }) {
  const { logAccess } = usePHIAccessLogger();
  
  useEffect(() => {
    logAccess(
      customerId,
      'view',
      ['first_name', 'email', 'medical_card_number'],
      'Customer profile view'
    );
  }, [customerId]);
}
```

### `encryptCustomerData` / `decryptCustomerData`

Utility functions for customer encryption operations.

```typescript
import { 
  encryptCustomerData, 
  decryptCustomerData 
} from '@/lib/utils/customerEncryption';

// Encrypt before save
const encrypted = await encryptCustomerData(formData, password);

// Decrypt after load
const decrypted = await decryptCustomerData(dbRecord, password);
```

## Security Best Practices

### Password Management

**Never store encryption passwords:**
```typescript
// ❌ BAD - Never store passwords in state
const [password, setPassword] = useState('');

// ✅ GOOD - Use session-based encryption
const { initialize } = useEncryptionContext();
await initialize(tempPassword); // Password not persisted
```

### Key Derivation

**Always use PBKDF2 with 100,000 iterations:**
```typescript
const key = await deriveKey(password, salt, 100000);
```

### Random Values

**Use crypto.getRandomValues() for salts and IVs:**
```typescript
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
```

### Access Logging

**Log all PHI access without exception:**
```typescript
// Before accessing PHI
await logPHIAccess(supabase, customerId, 'view', fields);

// Then access data
const customer = await fetchCustomer(customerId);
```

## Error Handling

### Encryption Errors

```typescript
try {
  const encrypted = encrypt(data);
} catch (error) {
  if (error.message.includes('not ready')) {
    // Reinitialize encryption
    await initialize(password);
  } else {
    // Handle other errors
    console.error('Encryption failed:', error);
  }
}
```

### Decryption Errors

```typescript
try {
  const decrypted = decrypt(data);
} catch (error) {
  if (error.message.includes('invalid password')) {
    // Prompt user for correct password
  } else {
    // Data may be corrupted
    console.error('Decryption failed:', error);
  }
}
```

## Performance Considerations

### Batch Operations

Encrypt/decrypt in batches for better performance:

```typescript
// Encrypt multiple customers
const encrypted = await Promise.all(
  customers.map(c => encryptCustomerFields(c, password))
);
```

### Caching

Cache decrypted data to avoid repeated operations:

```typescript
const cache = new Map();

function getDecryptedCustomer(id: string) {
  if (cache.has(id)) return cache.get(id);
  
  const decrypted = decryptCustomerData(encrypted, password);
  cache.set(id, decrypted);
  return decrypted;
}
```

### Lazy Loading

Only decrypt fields when needed:

```typescript
// Only decrypt visible fields
const partialDecrypt = (customer) => ({
  ...customer,
  firstName: decrypt(customer.first_name_encrypted),
  // Decrypt other fields on demand
});
```

## Migration Guide

### Migrating Existing Data

Use the migration script to encrypt existing plaintext data:

```bash
# Dry run first
deno run --allow-net --allow-env scripts/migrate-customer-encryption.ts --dry-run

# Execute migration
deno run --allow-net --allow-env scripts/migrate-customer-encryption.ts
```

### Hybrid Mode Support

During migration, support both encrypted and plaintext data:

```typescript
function getCustomerData(customer: any) {
  if (customer.is_encrypted) {
    return decryptCustomerData(customer, password);
  }
  return customer; // Return plaintext as-is
}
```

## Compliance

### HIPAA

- ✅ Encryption at rest (AES-256-GCM)
- ✅ Access control (RLS policies)
- ✅ Audit trail (phi_access_audit)
- ✅ Secure key management (PBKDF2)
- ✅ Data anonymization on deletion

### GDPR

- ✅ Right to access (export API)
- ✅ Right to deletion (delete API)
- ✅ Right to rectification (update with logging)
- ✅ Data portability (JSON/CSV export)
- ✅ Breach notification (audit trail)

## Support

For issues or questions:
- Review `docs/HIPAA_COMPLIANCE.md`
- Check `docs/README_ENCRYPTION.md`
- See `docs/ENCRYPTION_TESTING.md` for testing guidelines
