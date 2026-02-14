# Encryption Implementation Testing Guide

## Prerequisites

Before testing, ensure:
- Database migrations are applied successfully
- Frontend code is deployed
- Edge functions are deployed
- Encryption context is initialized in the app

## Phase 1: Database Migration Testing

### 1.1 Run Migration Script (Dry Run)

```bash
# Test without making changes
deno run --allow-net --allow-env scripts/migrate-customer-encryption.ts --dry-run
```

**Expected Output:**
- List of customers to be encrypted
- Estimated time for migration
- No actual data changes

### 1.2 Run Migration Script (Production)

```bash
# Encrypt existing customer data
deno run --allow-net --allow-env scripts/migrate-customer-encryption.ts
```

**Expected Output:**
- Progress bar showing encryption status
- Success count for each customer
- Error log if any failures occur
- Final summary report

### 1.3 Verify Database State

**Check encrypted columns exist:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customers' 
AND column_name LIKE '%_encrypted';
```

**Expected:** 20+ columns with `_encrypted` suffix, type `bytea`

**Check search indexes:**
```sql
SELECT * FROM customers 
WHERE email_search_index IS NOT NULL 
LIMIT 5;
```

**Expected:** Hash values for searchable fields

**Verify encryption metadata:**
```sql
SELECT 
  id,
  is_encrypted,
  encryption_metadata->>'version' as version,
  encryption_metadata->>'algorithm' as algorithm
FROM customers 
WHERE is_encrypted = true 
LIMIT 5;
```

**Expected:** `is_encrypted = true`, version = 1, algorithm = 'AES-256-GCM'

## Phase 2: Frontend Testing

### 2.1 Customer Creation Flow

**Test Steps:**
1. Navigate to Customer CRM page
2. Click "Add Customer"
3. Fill in all fields including PHI data:
   - First Name, Last Name
   - Email, Phone
   - Medical Card Number
   - Date of Birth
   - Qualifying Conditions
4. Submit form

**Expected Results:**
- Customer created successfully
- Toast notification confirms save
- PHI access logged in `phi_access_audit` table
- Database shows encrypted fields populated

**Verify in Database:**
```sql
SELECT 
  first_name_encrypted IS NOT NULL as has_encrypted_name,
  email_search_index IS NOT NULL as has_email_index,
  is_encrypted
FROM customers 
ORDER BY created_at DESC 
LIMIT 1;
```

### 2.2 Customer Details View

**Test Steps:**
1. Navigate to customer details page
2. View PHI information
3. Check console for any decryption errors

**Expected Results:**
- All fields display correctly (decrypted)
- No console errors
- PHI access logged with action='view'

**Verify PHI Logging:**
```sql
SELECT 
  action,
  fields_accessed,
  purpose,
  created_at
FROM phi_access_audit 
WHERE customer_id = '<customer_id>' 
AND action = 'view'
ORDER BY created_at DESC 
LIMIT 5;
```

### 2.3 Customer Search

**Test Steps:**
1. Go to Customer CRM
2. Search by email
3. Search by phone
4. Search by medical card number

**Expected Results:**
- Search returns correct results
- Search uses hash indexes (check browser network tab)
- Results decrypt properly

**Verify Search Hashes:**
```sql
-- Check search hash is being used
SELECT 
  email_search_index,
  phone_search_index,
  medical_card_number_search_index
FROM customers 
WHERE email_search_index = encode(digest('test@example.com', 'sha256'), 'hex');
```

### 2.4 Customer Update

**Test Steps:**
1. Edit existing customer
2. Change PHI fields (email, phone, medical info)
3. Save changes

**Expected Results:**
- Updates saved successfully
- Encrypted fields updated
- Search indexes regenerated
- PHI access logged with action='update'

## Phase 3: Edge Function Testing

### 3.1 Customer Data Export (GDPR)

**Test Request:**
```bash
curl -X POST 'https://<project-id>.supabase.co/functions/v1/export-customer-data' \
  -H 'Authorization: Bearer <service-role-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "customer_user_id": "<customer-user-id>",
    "tenant_id": "<tenant-id>",
    "format": "json",
    "encryption_password": "<password>"
  }'
```

**Expected Response:**
- Success: 200 with decrypted customer data
- PHI decrypted correctly
- All linked data included (orders, addresses, loyalty)
- Export logged in `phi_access_audit`

**Without Password:**
```bash
# Omit encryption_password to test placeholder
curl -X POST 'https://<project-id>.supabase.co/functions/v1/export-customer-data' \
  -H 'Authorization: Bearer <service-role-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "customer_user_id": "<customer-user-id>",
    "tenant_id": "<tenant-id>",
    "format": "json"
  }'
```

**Expected Response:**
- Note indicating PHI is encrypted
- Non-PHI data still visible
- Placeholder message for encrypted fields

### 3.2 Customer Account Deletion (GDPR)

**Test Request:**
```bash
curl -X POST 'https://<project-id>.supabase.co/functions/v1/delete-customer-account' \
  -H 'Authorization: Bearer <service-role-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "customer_user_id": "<customer-user-id>",
    "tenant_id": "<tenant-id>",
    "reason": "User request"
  }'
```

**Expected Results:**
- Account anonymized
- PHI deletion logged
- Customer user status = 'inactive'
- Order history preserved (anonymized)

**Verify Anonymization:**
```sql
SELECT 
  first_name_encrypted,
  email_encrypted,
  status
FROM customers 
WHERE id = '<customer-id>';
```

Expected: All encrypted fields should be NULL or anonymized

## Phase 4: Security Testing

### 4.1 Encryption Strength

**Verify Algorithm:**
- AES-256-GCM is used
- Key derivation: PBKDF2 with 100,000 iterations
- Random IV per encryption operation
- Salts are unique per field

**Test Encryption Uniqueness:**
```sql
-- Same plaintext should produce different ciphertext
SELECT 
  COUNT(DISTINCT first_name_encrypted) as unique_encryptions
FROM customers 
WHERE first_name_encrypted IS NOT NULL;
```

Expected: Each encrypted field should be unique

### 4.2 RLS Policy Testing

**Test unauthorized access:**
```sql
-- Try to access customers from wrong tenant
SET LOCAL jwt.claims.tenant_id = '<different-tenant-id>';
SELECT * FROM customers WHERE tenant_id = '<original-tenant-id>';
```

**Expected:** No rows returned (RLS blocks cross-tenant access)

### 4.3 PHI Access Audit Trail

**Verify all access is logged:**
```sql
SELECT 
  action,
  COUNT(*) as access_count,
  COUNT(DISTINCT user_id) as unique_users
FROM phi_access_audit 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY action;
```

**Expected:** Entries for 'view', 'create', 'update', 'search', 'export', 'delete'

**Check immutability:**
```sql
-- Attempt to delete audit log (should fail)
DELETE FROM phi_access_audit WHERE id = '<some-id>';
```

**Expected:** Error - RLS policy prevents deletion

## Phase 5: Performance Testing

### 5.1 Encryption Performance

**Test bulk encryption:**
```bash
# Time encryption of 100 customers
time deno run --allow-net --allow-env scripts/migrate-customer-encryption.ts --limit 100
```

**Expected:** ~1-2 seconds per customer

### 5.2 Decryption Performance

**Test query performance:**
```sql
EXPLAIN ANALYZE
SELECT * FROM customers 
WHERE email_search_index = encode(digest('user@example.com', 'sha256'), 'hex');
```

**Expected:** Index scan used, query time < 50ms

### 5.3 Search Performance

**Test search response time:**
- Open browser DevTools Network tab
- Search for customer by email
- Check response time

**Expected:** < 200ms for search results

## Phase 6: Edge Case Testing

### 6.1 Invalid Password Handling

**Test Steps:**
1. Try to decrypt with wrong password
2. Check error handling

**Expected:**
- Graceful error message
- No application crash
- Error logged but not exposed to user

### 6.2 Corrupted Data Handling

**Test Steps:**
1. Manually corrupt an encrypted field
2. Attempt to view customer

**Expected:**
- Error caught and handled
- User sees "Unable to decrypt" message
- System logs corruption for admin review

### 6.3 Hybrid Data (Mixed Encrypted/Plaintext)

**Test Steps:**
1. Create customer before migration (plaintext)
2. Migrate some fields
3. View customer details

**Expected:**
- Both encrypted and plaintext fields display
- No errors or data loss
- Smooth hybrid mode operation

## Phase 7: Compliance Verification

### 7.1 HIPAA Compliance Checklist

- ✅ PHI encrypted at rest (AES-256-GCM)
- ✅ Complete audit trail of PHI access
- ✅ Access controls (RLS policies)
- ✅ Secure key management
- ✅ Data anonymization on deletion
- ✅ Export capabilities (GDPR)

### 7.2 GDPR Compliance Checklist

- ✅ Right to access (export function)
- ✅ Right to deletion (anonymization)
- ✅ Right to rectification (update with logging)
- ✅ Data portability (JSON/CSV export)
- ✅ Consent tracking (can be added)
- ✅ Breach notification (audit trail)

## Troubleshooting

### Issue: Decryption fails

**Solution:**
1. Check encryption password is correct
2. Verify `encryption_metadata` is present
3. Check for data corruption
4. Review migration logs for errors

### Issue: Search not finding results

**Solution:**
1. Verify search indexes are populated
2. Check hash function matches
3. Ensure RLS policies allow access
4. Test with direct hash query

### Issue: Performance degradation

**Solution:**
1. Add indexes on search hash columns
2. Optimize decryption calls (batch operations)
3. Cache decrypted data appropriately
4. Consider partial decryption (only needed fields)

## Success Criteria

All tests pass when:
- ✅ All customer PHI is encrypted in database
- ✅ Frontend displays decrypted data correctly
- ✅ Search functionality works via hash indexes
- ✅ PHI access is logged for all operations
- ✅ GDPR export/deletion functions work
- ✅ No performance degradation
- ✅ No security vulnerabilities
- ✅ Complete audit trail maintained
