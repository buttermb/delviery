# HIPAA Compliance Documentation

## Overview

This system implements comprehensive HIPAA-compliant encryption for Protected Health Information (PHI) in compliance with the Health Insurance Portability and Accountability Act.

## Encryption Architecture

### Algorithm: AES-256-GCM
- **Key Size**: 256 bits
- **Mode**: Galactic/Counter Mode (GCM) with authenticated encryption
- **IV Length**: 16 bytes (randomly generated per encryption)
- **Tag Length**: 16 bytes (authentication tag)

### Key Derivation: PBKDF2
- **Algorithm**: PBKDF2 with SHA-256
- **Iterations**: 100,000 (OWASP recommended minimum)
- **Salt**: 32 bytes (randomly generated per user, stored securely)

## Protected Health Information (PHI)

### Encrypted Fields

The following customer data fields are encrypted at rest:

#### **Critical PHI** (Medical Information)
- `date_of_birth` - Patient date of birth
- `medical_card_number` - State-issued medical cannabis card number
- `medical_card_state` - Issuing state
- `medical_card_expiration` - Card expiration date
- `physician_name` - Prescribing physician
- `qualifying_conditions` - Medical conditions qualifying for cannabis use
- `medical_card_photo_url` - Medical card image reference
- `allergies` - Medical allergies

#### **Personally Identifiable Information (PII)**
- `first_name`, `last_name` - Full name
- `email` - Email address
- `phone` - Phone number
- `address`, `city`, `state`, `zip_code` - Full address
- `caregiver_name`, `caregiver_phone` - Caregiver information

#### **Preferences** (Encrypted for privacy)
- `preferred_products` - Product preferences
- `preferred_strains` - Strain preferences

### Search Capability

To enable searching on encrypted fields without decryption:
- SHA-256 hashes are stored in `*_search_index` columns
- Search indexes: `email_search_index`, `phone_search_index`, `medical_card_number_search_index`
- Searches are performed by hashing the search term and matching against indexes

## Access Controls

### Authentication Requirements
- All PHI access requires authentication via Supabase Auth
- Session-based encryption keys (30-minute timeout)
- Password-based key derivation (never stored server-side)

### Row Level Security (RLS)
- Tenant isolation enforced at database level
- Users can only access customers within their tenant
- Super admins have override capability for support

### Audit Trail
All PHI access is logged in `phi_access_audit` table:
- **Who**: User ID performing the action
- **What**: Specific fields accessed
- **When**: Timestamp of access
- **Why**: Purpose of access
- **Where**: IP address and user agent
- **Action**: Type (view, create, update, decrypt, search)

Audit logs are **immutable** (no updates or deletes allowed).

## Key Management

### User Password
- User's password is used to derive encryption keys
- **Never stored on server**
- PBKDF2 with 100,000 iterations
- Unique salt per user stored in `localStorage`

### Session Keys
- Derived keys stored in memory only
- Automatically expire after 30 minutes of inactivity
- Cleared on logout or session expiry

### Key Recovery
⚠️ **CRITICAL**: Loss of password = permanent loss of encrypted data
- No password recovery mechanism (by design)
- Users must maintain secure password records
- Consider implementing password hints (non-sensitive)

## Data at Rest

### Database Storage
- Encrypted fields stored as `BYTEA` (binary data)
- Original plaintext can be kept temporarily during migration (hybrid approach)
- Encryption metadata stored in `encryption_metadata` JSONB column

### Encryption Metadata
```json
{
  "version": 1,
  "algorithm": "AES-256-GCM",
  "timestamp": "2025-01-18T12:00:00Z",
  "keyId": "user-derived"
}
```

## Data in Transit

### HTTPS/TLS
- All data transmitted over HTTPS (TLS 1.3)
- Supabase handles TLS termination
- Additional encryption at application layer

### Edge Function Communication
- Encrypted data sent to edge functions
- Decryption only when necessary
- Audit logging for all PHI operations

## Compliance Requirements

### HIPAA Technical Safeguards

✅ **Access Control (§164.312(a)(1))**
- Unique user identification (Supabase Auth)
- Emergency access procedures (Super Admin)
- Automatic logoff (30-minute session timeout)
- Encryption and decryption (AES-256)

✅ **Audit Controls (§164.312(b))**
- Comprehensive audit trail (`phi_access_audit`)
- Immutable logs
- All PHI access logged

✅ **Integrity (§164.312(c)(1))**
- Authenticated encryption (GCM mode)
- Tamper detection via authentication tags
- Immutable audit logs

✅ **Transmission Security (§164.312(e)(1))**
- Encryption in transit (HTTPS/TLS)
- End-to-end encryption option

### HIPAA Physical Safeguards

✅ **Facility Access Controls (§164.310(a)(1))**
- Supabase infrastructure compliance
- AWS data center security

✅ **Workstation Security (§164.310(b))**
- Browser-based encryption
- No unencrypted PHI in browser storage

✅ **Device and Media Controls (§164.310(d)(1))**
- Encrypted backups
- Secure deletion procedures

## Breach Notification Procedures

### Detection
- Monitor `phi_access_audit` for anomalies
- Alert on unusual access patterns
- Failed decryption attempts logged

### Notification Timeline
1. **Discovery**: Log and document breach
2. **Assessment**: Determine scope and affected individuals
3. **Notification**: 60 days to notify affected individuals
4. **Reporting**: Report to HHS if >500 individuals affected

### Breach Response Team
- Security Officer
- Privacy Officer
- Legal Counsel
- IT Administrator

## Regular Compliance Activities

### Quarterly Reviews
- [ ] Audit log analysis
- [ ] Access control review
- [ ] Encryption key rotation assessment
- [ ] Failed access attempt review

### Annual Reviews
- [ ] Full HIPAA risk assessment
- [ ] Business Associate Agreement (BAA) review
- [ ] Encryption algorithm assessment
- [ ] Disaster recovery testing
- [ ] Employee training updates

### Continuous Monitoring
- Failed decryption attempts
- Unusual access patterns
- Session timeout violations
- Multiple failed login attempts

## Business Associate Agreements (BAA)

### Required Vendors
- ✅ **Supabase**: BAA required and obtained
- ✅ **Cloud Infrastructure (AWS)**: Covered under Supabase BAA
- ⚠️ **Any third-party integrations**: Must sign BAA before PHI access

## Employee Training

### Required Training Topics
1. HIPAA Overview and Requirements
2. PHI Definition and Handling
3. Encryption System Usage
4. Incident Reporting Procedures
5. Access Control Policies
6. Audit Trail Importance

### Training Schedule
- New employees: Within 30 days of hire
- All employees: Annual refresher training
- Ad-hoc: When policies change

## Technical Procedures

### Accessing Encrypted Customer Data

```typescript
// 1. Initialize encryption with user password
await encryption.initialize(userPassword);

// 2. Decrypt customer data
const decryptedCustomer = await decryptCustomerData(encryptedCustomer);

// 3. Log PHI access
await logPHIAccess(customerId, 'view', ['medical_card_number', 'date_of_birth']);
```

### Creating Encrypted Customer

```typescript
// 1. Encrypt sensitive fields
const encryptedData = await encryptCustomerData(customerData);

// 2. Save to database
const customer = await supabase
  .from('customers')
  .insert(encryptedData);

// 3. Log PHI creation
await logPHIAccess(customer.id, 'create', Object.keys(sensitiveFields));
```

## Disaster Recovery

### Backup Strategy
- Daily encrypted database backups
- 30-day retention period
- Offsite backup storage

### Recovery Procedures
1. Restore database from backup
2. Verify encryption integrity
3. Test key derivation
4. Validate audit trail
5. Notify affected parties if data loss occurred

### Recovery Time Objective (RTO)
- **Critical systems**: 4 hours
- **Full restoration**: 24 hours

### Recovery Point Objective (RPO)
- **Maximum data loss**: 1 hour (hourly backups)

## Security Incident Response

### Incident Classification

**Level 1 (Critical)**: Unauthorized PHI access or breach
- Response time: Immediate (< 1 hour)
- Escalation: CEO, Legal, Privacy Officer

**Level 2 (High)**: Failed security controls
- Response time: < 4 hours
- Escalation: Security Officer, IT Lead

**Level 3 (Medium)**: Potential vulnerability
- Response time: < 24 hours
- Escalation: IT Administrator

**Level 4 (Low)**: Minor security event
- Response time: < 72 hours
- Escalation: IT Support

## Contact Information

### Privacy Officer
- **Name**: [To be designated]
- **Email**: privacy@[domain].com
- **Phone**: [To be added]

### Security Officer
- **Name**: [To be designated]
- **Email**: security@[domain].com
- **Phone**: [To be added]

### HHS Office for Civil Rights
- **Website**: https://www.hhs.gov/ocr
- **Phone**: 1-800-368-1019
- **Email**: OCRComplaint@hhs.gov

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-01-18 | 1.0 | Initial HIPAA compliance documentation | System |

---

**Last Updated**: January 18, 2025  
**Next Review Date**: April 18, 2025  
**Document Owner**: Privacy Officer
