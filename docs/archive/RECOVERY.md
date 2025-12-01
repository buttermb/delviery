# Encryption Recovery Guide

## Overview

This guide covers recovery procedures for the zero-knowledge encryption system. Since encryption keys are derived from user passwords and never stored on the server, recovery requires the user's password.

## Key Recovery

### Normal Recovery (User Knows Password)

If a user knows their password, recovery is automatic:

1. **User logs in** with their password
2. **Encryption initializes** automatically
3. **Data decrypts** automatically on access

**No action needed** - the system handles this automatically.

### Lost Password Recovery

⚠️ **CRITICAL**: If a user loses their password, **encrypted data cannot be recovered**. This is by design for zero-knowledge security.

**Options:**

1. **Password Reset** (if email access available)
   - User resets password via email
   - New password creates new encryption key
   - **Old encrypted data remains encrypted** (cannot decrypt with new key)
   - User can only access new data encrypted with new key

2. **Account Recovery** (if configured)
   - Some systems allow recovery keys
   - Recovery keys must be generated and stored by user
   - Not currently implemented in this system

3. **Data Loss** (worst case)
   - If password is lost and no recovery method exists
   - Encrypted data is permanently inaccessible
   - This is the trade-off for zero-knowledge security

## Session Recovery

### Session Expired

**Symptoms:**
- Encryption not ready (`isReady` is false)
- Data shows as encrypted strings
- User needs to log in again

**Solution:**
1. User logs in again with password
2. Encryption session restores automatically
3. Data becomes accessible again

**Prevention:**
- Sessions expire after 30 minutes of inactivity
- Users should stay logged in during active use
- Consider extending timeout if needed (modify `ENCRYPTION_CONFIG.sessionTimeout`)

### Browser Crash / Tab Close

**Symptoms:**
- SessionStorage cleared
- Encryption session lost
- Data inaccessible

**Solution:**
1. User logs in again
2. Encryption re-initializes
3. Data accessible again

**Note:** Salt stored in localStorage persists, so re-initialization is fast.

## Data Recovery

### Corrupted Encrypted Data

**Symptoms:**
- Decryption fails with specific records
- Error: "Decryption produced empty result"
- Some records work, others don't

**Diagnosis:**
```typescript
try {
  const decrypted = decryptObject(encryptedRecord);
} catch (error) {
  // Check if it's a specific record or all records
  logger.error('Decryption failed', error, { recordId: record.id });
}
```

**Solutions:**

1. **Single Record Corruption**
   - Check if record has valid encrypted fields
   - Verify encryption_metadata exists
   - Try manual decryption with known good key
   - If corrupted, restore from backup (if available)

2. **System-Wide Corruption**
   - Check encryption initialization
   - Verify user is logged in with correct account
   - Check for encryption version mismatch
   - Review migration logs

### Migration Issues

**Symptoms:**
- Some data encrypted, some not
- Inconsistent encryption state
- Partial migration

**Solutions:**

1. **Resume Migration**
   ```bash
   # Check current state
   # Then resume from last successful point
   npm run encrypt-data -- --table=customers --percentage=100 --userId=USER_ID --password=USER_PASSWORD
   ```

2. **Verify Migration**
   ```sql
   -- Check encrypted vs plaintext
   SELECT 
     COUNT(*) FILTER (WHERE name_encrypted IS NOT NULL) as encrypted_count,
     COUNT(*) FILTER (WHERE name IS NOT NULL AND name_encrypted IS NULL) as plaintext_count
   FROM customers;
   ```

3. **Rollback Migration** (if needed)
   - Stop encrypting new data (components fall back to plaintext)
   - Encrypted columns remain but unused
   - System continues with plaintext

## Backup and Restore

### Backup Strategy

**Important:** Backups contain encrypted data. Without the user's password, backups are useless.

1. **Database Backups**
   - Standard Supabase backups include encrypted columns
   - Encrypted data is stored as ciphertext
   - Cannot decrypt without user password

2. **Export Encrypted Data**
   ```sql
   -- Export encrypted customer data
   COPY (
     SELECT id, name_encrypted, email_encrypted, phone_encrypted
     FROM customers
   ) TO '/path/to/backup.csv';
   ```

3. **Export Plaintext Data** (during hybrid migration)
   ```sql
   -- Export plaintext data before full encryption
   COPY (
     SELECT id, name, email, phone
     FROM customers
     WHERE name_encrypted IS NULL
   ) TO '/path/to/plaintext_backup.csv';
   ```

### Restore Procedure

1. **Restore Database Backup**
   - Standard Supabase restore procedure
   - Encrypted data restored as-is
   - Users must log in to decrypt

2. **Restore from Export**
   ```sql
   -- Import encrypted data
   COPY customers (id, name_encrypted, email_encrypted, phone_encrypted)
   FROM '/path/to/backup.csv';
   ```

3. **Verify Restore**
   - Users log in
   - Data decrypts automatically
   - Verify data integrity

## Troubleshooting Common Issues

### Issue: "Encryption not initialized"

**Cause:** User not logged in or session expired

**Solution:**
1. User logs in
2. Check browser console for initialization errors
3. Verify password was provided during login

### Issue: "Decryption failed"

**Cause:** Wrong password, corrupted data, or session expired

**Solutions:**
1. Verify user logged in with correct account
2. Check if session expired (30 minutes)
3. Verify encrypted data format is correct
4. Check encryption_metadata exists

### Issue: "Search not working"

**Cause:** Search indexes not created or incorrect hash

**Solution:**
1. Verify search indexes exist in database
2. Check search hash generation uses same key
3. Ensure user is logged in (key needed for hash)

### Issue: "Performance degradation"

**Cause:** Encryption overhead or inefficient queries

**Solutions:**
1. Encryption adds ~10-50ms per operation (normal)
2. Batch operations for better performance
3. Use pagination for large datasets
4. Consider caching decrypted data (with caution)

## Emergency Procedures

### Complete System Failure

If encryption system completely fails:

1. **Disable Encryption** (temporary)
   - Components already have plaintext fallback
   - System continues working with plaintext
   - No code changes needed

2. **Investigate Root Cause**
   - Check browser console errors
   - Review server logs
   - Check database connectivity

3. **Restore Service**
   - Fix underlying issue
   - Re-enable encryption
   - Users log in to restore sessions

### Data Loss Prevention

**Best Practices:**

1. **Regular Backups**
   - Daily database backups
   - Export plaintext data before full encryption
   - Store backups securely

2. **Password Management**
   - Encourage strong passwords
   - Consider password managers
   - Document recovery procedures

3. **Testing**
   - Test encryption/decryption regularly
   - Verify backups are restorable
   - Test recovery procedures

4. **Monitoring**
   - Monitor encryption initialization rate
   - Track decryption failure rate
   - Alert on unusual patterns

## Support Contacts

For encryption-related issues:

1. Check `docs/ENCRYPTION_GUIDE.md` for architecture
2. Review `docs/DEPLOYMENT.md` for deployment issues
3. Check browser console for errors
4. Review Supabase logs for database errors
5. Contact development team with:
   - Error messages
   - Browser console logs
   - Steps to reproduce
   - Affected user accounts (if applicable)

## Recovery Checklist

When recovering from an encryption issue:

- [ ] Verify user is logged in
- [ ] Check encryption session is active
- [ ] Verify password is correct
- [ ] Check browser console for errors
- [ ] Verify database connectivity
- [ ] Check encryption_metadata exists
- [ ] Test decryption with known good data
- [ ] Verify backups are available
- [ ] Document issue and resolution
- [ ] Update monitoring/alerts if needed

