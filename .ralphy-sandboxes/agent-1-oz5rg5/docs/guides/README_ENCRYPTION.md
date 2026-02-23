# Encryption System Documentation

## Overview

This system implements client-side, password-based AES-256-GCM encryption for sensitive customer data, including Protected Health Information (PHI) in compliance with HIPAA regulations.

## Architecture

### Encryption Stack
- **Algorithm**: AES-256-GCM (Galactic/Counter Mode)
- **Key Derivation**: PBKDF2 with SHA-256, 100,000 iterations
- **Key Storage**: Never stored on server; derived from user password in-memory only
- **Session Management**: 30-minute timeout with automatic key destruction

### Data Flow

```
User Password → PBKDF2 (100k iterations) → Session Key (in-memory)
                                              ↓
Plaintext Data → AES-256-GCM Encryption → Encrypted BYTEA (database)
                                              ↓
                                         SHA-256 Hash → Search Index
```

## Customer Data Encryption

### Encrypted Fields

#### Basic PII (Personally Identifiable Information)
- `first_name`, `last_name`
- `email`, `phone`
- `address`, `city`, `state`, `zip_code`

#### PHI (Protected Health Information) - HIPAA Regulated
- `date_of_birth` - Patient DOB
- `medical_card_number` - State medical cannabis card
- `medical_card_state` - Issuing state
- `medical_card_expiration` - Card expiration
- `physician_name` - Prescribing physician
- `qualifying_conditions` - Medical conditions
- `medical_card_photo_url` - Card image reference
- `allergies` - Medical allergies

#### Additional Sensitive Data
- `caregiver_name`, `caregiver_phone`
- `preferred_products`, `preferred_strains`

### Database Schema

Each encrypted field has:
- **Original column**: Plaintext (optional, for hybrid migration)
- **Encrypted column**: `{field_name}_encrypted` (BYTEA)
- **Search index**: `{field_name}_search_index` (TEXT, SHA-256 hash)
- **Metadata**: `encryption_metadata` (JSONB)

Example:
```sql
-- Plaintext (temporary during migration)
first_name TEXT

-- Encrypted storage
first_name_encrypted BYTEA

-- Search capability
email_search_index TEXT  -- SHA-256 hash for searching
```

## Usage

### Initialization

```typescript
import { useEncryption } from '@/lib/hooks/useEncryption';

const MyComponent = () => {
  const encryption = useEncryption();
  
  // Initialize with user's password (typically after login)
  await encryption.initialize(userPassword);
  
  // Check if ready
  if (encryption.isReady) {
    // Can now encrypt/decrypt data
  }
};
```

### Encrypting Customer Data

```typescript
import { useEncryptedMutation } from '@/lib/hooks/useEncryptedMutation';

const createCustomer = useEncryptedMutation<Customer>({
  table: 'customers',
  operation: 'insert'
});

// Encrypt and save customer
await createCustomer.mutateAsync({
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  date_of_birth: '1990-01-15',
  medical_card_number: 'MC123456',
  // ... other fields
});
```

### Decrypting Customer Data

```typescript
import { useEncryptedQuery } from '@/lib/hooks/useEncryptedQuery';

const { data: customers } = useEncryptedQuery<Customer[]>({
  table: 'customers',
  select: '*'
});

// customers array is automatically decrypted
customers.forEach(customer => {
  console.log(customer.first_name); // Decrypted plaintext
  console.log(customer.medical_card_number); // Decrypted PHI
});
```

### Searching Encrypted Data

```typescript
// Search by email (uses SHA-256 hash)
const { data } = await supabase
  .from('customers')
  .select('*')
  .eq('email_search_index', await createSearchHash(email));

// Decrypt results
const decryptedCustomers = await Promise.all(
  data.map(c => decryptCustomer(c))
);
```

## Security Features

### Key Derivation
- **PBKDF2**: 100,000 iterations (OWASP minimum)
- **Salt**: 32 bytes, randomly generated per user
- **Hash**: SHA-256

### Session Management
- Keys stored in memory only
- 30-minute inactivity timeout
- Automatic key destruction on logout
- Session restoration from localStorage (encrypted salt only)

### Access Controls
- User must authenticate before accessing encrypted data
- RLS policies enforce tenant isolation
- PHI access logged in `phi_access_audit` table

### Audit Trail (HIPAA Compliance)
All PHI access is logged:
```typescript
await logPHIAccess(customerId, 'view', [
  'medical_card_number',
  'date_of_birth',
  'physician_name'
]);
```

Audit log includes:
- Who (user_id)
- What (fields_accessed)
- When (timestamp)
- Why (purpose)
- Where (ip_address, user_agent)

## Hybrid Migration Strategy

To enable zero-downtime migration:

### Phase 1: Add Encrypted Columns
- Add `*_encrypted` columns (BYTEA)
- Keep original plaintext columns
- Add `is_encrypted` flag

### Phase 2: Gradual Encryption
- New records: encrypted only
- Existing records: both plaintext and encrypted
- Read: prefer encrypted, fallback to plaintext

### Phase 3: Complete Migration
```typescript
// Migrate existing data (batch processing)
const customers = await supabase
  .from('customers')
  .select('*')
  .eq('is_encrypted', false)
  .limit(100);

for (const customer of customers) {
  const encrypted = await encryptCustomer(customer);
  await supabase
    .from('customers')
    .update({
      ...encrypted,
      is_encrypted: true
    })
    .eq('id', customer.id);
}
```

### Phase 4: Remove Plaintext (Optional)
- Once all data is encrypted
- Drop plaintext columns
- Keep search indexes only

## Best Practices

### Password Requirements
For users with PHI access:
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- No dictionary words
- Consider passphrase approach (e.g., "correct-horse-battery-staple")

### Key Management
⚠️ **CRITICAL**: No password recovery mechanism by design
- Users must securely store passwords
- Loss of password = permanent loss of encrypted data
- Consider:
  - Password hints (non-sensitive)
  - Master admin recovery key (separate system)
  - Regular backups of plaintext during migration

### Performance Optimization
- Batch encrypt/decrypt operations
- Use search indexes for queries (avoid full-table decryption)
- Cache decrypted data in memory (with timeout)
- Lazy-load sensitive fields

### Error Handling
```typescript
try {
  const decrypted = await decrypt(encryptedData);
} catch (error) {
  if (error.message === 'Encryption not initialized') {
    // Prompt user to log in again
    await encryption.initialize(password);
  } else if (error.message === 'Session expired') {
    // Re-authenticate
    router.push('/login');
  } else {
    // Decryption failed (wrong password or corrupted data)
    logger.error('Decryption failed', error);
  }
}
```

## Testing

### Unit Tests
```typescript
describe('Customer Encryption', () => {
  it('encrypts all PHI fields', async () => {
    const customer = { /* ... */ };
    const encrypted = await encryptCustomer(customer);
    
    expect(encrypted.medical_card_number_encrypted).toBeDefined();
    expect(encrypted.medical_card_number_encrypted).toBeInstanceOf(Buffer);
  });
  
  it('decrypts correctly', async () => {
    const encrypted = { /* ... */ };
    const decrypted = await decryptCustomer(encrypted);
    
    expect(decrypted.medical_card_number).toBe('MC123456');
  });
});
```

### Integration Tests
- Create customer with PHI
- Search by encrypted field
- Verify audit trail
- Test session expiry
- Test wrong password

## Troubleshooting

### "Encryption not initialized"
**Cause**: User hasn't logged in or session expired  
**Fix**: Call `encryption.initialize(password)`

### "Invalid password for decryption"
**Cause**: Wrong password or corrupted encrypted data  
**Fix**: Verify password, check encryption_metadata

### "Session expired"
**Cause**: 30-minute inactivity timeout  
**Fix**: Re-authenticate user

### Search not returning results
**Cause**: Search index not created or hash mismatch  
**Fix**: Ensure `createSearchHash()` used for both insert and search

## Compliance

### HIPAA Requirements
✅ **Encryption at Rest**: AES-256-GCM  
✅ **Encryption in Transit**: HTTPS/TLS 1.3  
✅ **Access Controls**: Authentication + RLS  
✅ **Audit Trail**: `phi_access_audit` table  
✅ **Key Management**: User-derived, never stored  
✅ **Session Timeout**: 30 minutes  

See [HIPAA_COMPLIANCE.md](./HIPAA_COMPLIANCE.md) for full details.

### GDPR Compliance
- Right to be forgotten: Delete encrypted data
- Data portability: Export decrypted data (user authenticated)
- Access logs: `phi_access_audit` provides full trail

## Roadmap

### Future Enhancements
- [ ] Hardware security module (HSM) integration
- [ ] Key rotation mechanism
- [ ] Multi-factor authentication for PHI access
- [ ] Encrypted backups with separate keys
- [ ] Admin master key recovery system
- [ ] Real-time encryption monitoring dashboard
- [ ] Automated compliance reporting

## Resources

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [NIST Special Publication 800-132](https://csrc.nist.gov/publications/detail/sp/800-132/final)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

---

**Last Updated**: January 18, 2025  
**Version**: 1.0  
**Maintainer**: Security Team
