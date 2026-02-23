# Encryption Deployment Guide

## Pre-Deployment Checklist

### 1. Database Migrations
- [ ] Review migration files in `supabase/migrations/`
- [ ] Test migrations in staging environment
- [ ] Backup production database
- [ ] Run migrations: `supabase migration up`

### 2. Environment Variables
- [ ] Verify `VITE_SUPABASE_URL` is set
- [ ] Verify `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY` is set
- [ ] No additional encryption-specific env vars needed (keys derived from passwords)

### 3. Dependencies
- [ ] Verify `crypto-js` and `@types/crypto-js` are installed
- [ ] Run `npm install` to ensure all dependencies are up to date

### 4. Testing
- [ ] Run encryption tests: `npm run test-encryption`
- [ ] Test login flow (encryption should initialize automatically)
- [ ] Test customer create/read operations
- [ ] Test product create/read operations
- [ ] Verify decryption works for existing plaintext data (hybrid mode)

## Deployment Steps

### Step 1: Deploy Database Migrations

```bash
# Apply migrations to add encrypted columns
supabase migration up

# Verify migrations applied successfully
supabase migration list
```

### Step 2: Deploy Application Code

```bash
# Build application
npm run build

# Deploy to your hosting platform (Vercel, Netlify, etc.)
# The build includes all encryption code
```

### Step 3: Verify Deployment

1. **Test Login Flow**
   - Log in with existing user
   - Check browser console for "Encryption initialized successfully"
   - Verify no errors

2. **Test Data Operations**
   - Create a new customer (should be encrypted)
   - View existing customers (should decrypt automatically)
   - Verify both encrypted and plaintext data work (hybrid mode)

3. **Test Session Management**
   - Wait 30 minutes (or modify timeout in constants)
   - Verify session expires and requires re-login

## Hybrid Migration Strategy

### Phase 1: New Data Only (Week 1-2)
- New records are encrypted automatically
- Old records remain in plaintext
- System reads from both encrypted and plaintext fields

### Phase 2: Gradual Migration (Week 3-6)
```bash
# Encrypt 10% of existing data
npm run encrypt-data -- --table=customers --percentage=10 --userId=USER_ID --password=USER_PASSWORD

# Monitor for issues, then continue
npm run encrypt-data -- --table=customers --percentage=50 --userId=USER_ID --password=USER_PASSWORD

# Complete migration
npm run encrypt-data -- --table=customers --percentage=100 --userId=USER_ID --password=USER_PASSWORD
```

### Phase 3: Remove Plaintext Columns (Week 7+)
- After 100% migration verified
- Create migration to drop plaintext columns
- Update components to remove plaintext fallback

## Rollback Plan

If issues occur:

1. **Stop Encryption for New Data**
   - Components already have fallback to plaintext
   - Encryption only works if `isReady` is true
   - If encryption fails, system falls back automatically

2. **Revert Components**
   - Components check `encryptionIsReady` before using encryption
   - If false, they use plaintext fields
   - No code changes needed for rollback

3. **Database Rollback**
   - Encrypted columns can remain (they're nullable)
   - System will use plaintext columns if encrypted are null
   - Can drop encrypted columns later if needed

## Monitoring

### Key Metrics to Watch

1. **Encryption Initialization Rate**
   - Should be ~100% on successful logins
   - Check logs for "Encryption initialized successfully"

2. **Decryption Failure Rate**
   - Should be minimal (< 1%)
   - Check logs for "Failed to decrypt" warnings

3. **Performance Impact**
   - Encryption adds ~10-50ms per operation
   - Monitor API response times

4. **Session Expiry**
   - Users should re-login after 30 minutes
   - Monitor for excessive session expiry complaints

## Troubleshooting

### Encryption Not Initializing

**Symptoms:** Data not encrypted, `isReady` is false

**Solutions:**
1. Check user logged in successfully
2. Check browser console for errors
3. Verify password was provided during login
4. Check sessionStorage for `floraiq_session_key`

### Decryption Fails

**Symptoms:** Data shows as encrypted strings, not readable

**Solutions:**
1. Verify user is logged in with same account
2. Check encryption session hasn't expired
3. Verify data was encrypted with same user's key
4. Check for "Failed to decrypt" warnings in logs

### Performance Issues

**Symptoms:** Slow page loads, slow data operations

**Solutions:**
1. Encryption adds ~10-50ms per record
2. Batch operations recommended for large datasets
3. Consider pagination for large lists
4. Monitor network requests for bottlenecks

## Support

For deployment issues:
1. Check `ENCRYPTION_IMPLEMENTATION_STATUS.md` for current status
2. Review `docs/ENCRYPTION_GUIDE.md` for architecture details
3. Check browser console for errors
4. Review Supabase logs for database errors

