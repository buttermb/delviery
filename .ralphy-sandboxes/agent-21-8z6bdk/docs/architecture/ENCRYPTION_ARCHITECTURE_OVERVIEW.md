# Zero-Knowledge Encryption Architecture Overview

## System Architecture

### Two Encryption Systems

The platform uses **two separate encryption systems** for different purposes:

#### 1. Zero-Knowledge Encryption (This Implementation)
- **Purpose**: Encrypt customer, business, product, and order data
- **Library**: crypto-js
- **Key Derivation**: PBKDF2 from user password
- **Algorithm**: AES-256-GCM
- **Scope**: General sensitive data (PII, business info, etc.)

#### 2. Lab Results Encryption (Existing)
- **Purpose**: Encrypt lab test results (THC, CBD, terpenes)
- **Library**: Web Crypto API
- **Key Management**: Generated keys or password-derived
- **Algorithm**: AES-GCM
- **Scope**: Specific to lab results only

**Note**: These systems are independent and don't conflict.

## Zero-Knowledge Encryption Flow

### Initialization Flow
```
User Logs In
    ↓
Password Captured (memory only)
    ↓
PBKDF2 Key Derivation (100,000 iterations)
    ↓
Encryption Key Stored in sessionStorage
    ↓
Salt Stored in localStorage
    ↓
Encryption Ready
```

### Encryption Flow
```
User Creates Record
    ↓
Component Calls useEncryptedMutation
    ↓
Data Encrypted Client-Side
    ↓
Search Indexes Created (if searchable)
    ↓
Encrypted Data Sent to Supabase
    ↓
Stored in _encrypted Columns
```

### Decryption Flow
```
User Views Record
    ↓
Component Fetches from Supabase
    ↓
Encrypted Data Retrieved
    ↓
Component Calls decryptObject
    ↓
Data Decrypted Client-Side
    ↓
Displayed to User
```

## Data Flow Diagram

```
┌─────────────┐
│   Browser   │
│             │
│  ┌────────┐ │
│  │  User  │ │
│  │Password│ │
│  └───┬────┘ │
│      │      │
│  ┌───▼────┐ │
│  │ PBKDF2 │ │  Derives Key
│  └───┬────┘ │
│      │      │
│  ┌───▼────┐ │
│  │Encrypt │ │  Encrypts Data
│  └───┬────┘ │
│      │      │
└──────┼──────┘
       │
       │ Encrypted Data Only
       │
┌──────▼──────┐
│   Supabase  │
│             │
│  Stores:    │
│  - Encrypted│
│  - Search   │
│  - Metadata │
└─────────────┘
```

## Security Model

### What Server Can See
- ✅ Encrypted ciphertext (cannot decrypt)
- ✅ Search indexes (hashes, not original values)
- ✅ Encryption metadata (version, algorithm, timestamp)
- ✅ Non-encrypted fields (IDs, timestamps, status)

### What Server Cannot See
- ❌ User passwords
- ❌ Encryption keys
- ❌ Decrypted data
- ❌ Original plaintext values

### What User Can Access
- ✅ Their own encrypted data (with password)
- ✅ Decrypted data in browser
- ✅ Search their encrypted data

## Key Management

### Key Derivation
```typescript
// User password → Encryption key
PBKDF2(
  password: string,
  salt: string (from localStorage),
  iterations: 100000,
  hash: SHA-256
) → encryptionKey: string
```

### Key Storage
- **Encryption Key**: sessionStorage (cleared on browser close)
- **Salt**: localStorage (not sensitive, persists)
- **Session Activity**: sessionStorage (for timeout)

### Key Lifecycle
1. **Generation**: On login, derived from password
2. **Storage**: In sessionStorage (temporary)
3. **Usage**: For encrypt/decrypt operations
4. **Expiry**: After 30 minutes of inactivity
5. **Destruction**: On logout or expiry

## Encryption Schema

### Table Structure (Hybrid Migration)
```sql
customers (
  id UUID,
  -- Plaintext (during migration)
  name TEXT,
  email TEXT,
  phone TEXT,
  -- Encrypted
  name_encrypted TEXT,
  email_encrypted TEXT,
  phone_encrypted TEXT,
  -- Search indexes
  email_search_index TEXT,
  phone_search_index TEXT,
  -- Metadata
  encryption_metadata JSONB
)
```

### Field Naming Convention
- **Plaintext**: `field_name`
- **Encrypted**: `field_name_encrypted`
- **Search Index**: `field_name_search_index`
- **Metadata**: `encryption_metadata`

## Search Architecture

### Deterministic Hashing
```typescript
// Same input → Same hash
HMAC-SHA256(
  value.toLowerCase().trim(),
  userEncryptionKey
) → searchHash
```

### Search Flow
```
User Searches "john@example.com"
    ↓
Create Search Hash (client-side)
    ↓
Query: WHERE email_search_index = hash
    ↓
Returns Encrypted Records
    ↓
Decrypt Results (client-side)
    ↓
Display to User
```

## Migration Strategy

### Phase 1: Hybrid Mode
- New records: Encrypted
- Old records: Plaintext
- Reading: Try encrypted, fall back to plaintext
- Writing: Write to both (for compatibility)

### Phase 2: Gradual Migration
- Encrypt existing data in batches
- 10% → 50% → 100%
- Monitor for issues
- Verify data integrity

### Phase 3: Complete
- 100% encrypted
- Optional: Remove plaintext columns
- Full zero-knowledge security

## Performance Characteristics

### Encryption Overhead
- **Per Record**: ~10-50ms
- **Batch Operations**: More efficient
- **Large Datasets**: Use pagination

### Storage Overhead
- **Encrypted Data**: ~30-50% larger than plaintext
- **Search Indexes**: Fixed size (hash)
- **Metadata**: Minimal (~100 bytes)

### Network Overhead
- **Encrypted Payloads**: Slightly larger
- **No Additional Requests**: Same API calls
- **Search**: Same query pattern

## Error Handling

### Error Types
1. **NOT_INITIALIZED**: User not logged in
2. **SESSION_EXPIRED**: 30-minute timeout
3. **DECRYPTION_FAILED**: Wrong key or corrupted data
4. **ENCRYPTION_FAILED**: Encryption error

### Recovery Strategies
- **Recoverable**: Retry operation
- **Non-Recoverable**: Fall back to plaintext (hybrid mode)
- **User Action**: Re-login required

## Best Practices

### For Developers
1. Always use encryption hooks
2. Handle both encrypted/plaintext (hybrid mode)
3. Check `isReady` before operations
4. Use error handling utilities
5. Test with both encrypted and plaintext data

### For Users
1. Use strong passwords
2. Don't share passwords
3. Log out when done
4. Re-login if session expires

### For Operations
1. Monitor encryption initialization rate
2. Track decryption success rate
3. Monitor performance impact
4. Plan gradual migration
5. Have rollback plan ready

## Integration Points

### Authentication
- Login pages capture password
- Auth contexts initialize encryption
- Logout destroys encryption

### Components
- Forms use `useEncryptedMutation`
- Lists use `useEncryption` for decrypt
- Status components show encryption state

### Database
- Migrations add encrypted columns
- RLS policies work with encrypted data
- Search uses indexes

## Future Enhancements

### Potential Improvements
- Key rotation support
- Recovery key system
- Multi-device sync
- Performance optimizations
- Advanced search features

### Not Included (By Design)
- Server-side decryption (violates zero-knowledge)
- Password recovery for encrypted data (by design)
- Key escrow (violates zero-knowledge)

---

**This architecture ensures true zero-knowledge encryption where the server cannot access user data without their password.**

