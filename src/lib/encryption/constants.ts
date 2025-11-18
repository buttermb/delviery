// src/lib/encryption/constants.ts

export const ENCRYPTION_CONFIG = {
  // Algorithm settings
  algorithm: 'AES-256-GCM' as const,
  keySize: 256,
  
  // PBKDF2 settings for key derivation
  pbkdf2: {
    iterations: 100000, // OWASP recommendation
    hashAlgorithm: 'SHA-256' as const,
    saltLength: 32, // bytes
  },
  
  // AES-GCM settings
  aesGcm: {
    ivLength: 16, // bytes
    tagLength: 16, // bytes
  },
  
  // Session settings
  sessionTimeout: 30 * 60 * 1000, // 30 minutes in ms
  
  // Version for future migrations
  version: 1,
} as const;

export const STORAGE_KEYS = {
  userSalt: 'floraiq_user_salt',
  sessionKey: 'floraiq_session_key',
  encryptionVersion: 'floraiq_encryption_version',
  lastActivity: 'floraiq_last_activity',
} as const;

export const ENCRYPTED_SUFFIX = '_encrypted' as const;
export const SEARCH_INDEX_SUFFIX = '_search_index' as const;

// Tables that require encryption
export const ENCRYPTED_TABLES = [
  'customers',
  'businesses',
  'products',
  'orders',
  'transactions',
  'messages',
  'documents',
  'profiles',
] as const;

// Fields to encrypt per table
export const ENCRYPTED_FIELDS = {
  customers: [
    'first_name', 
    'last_name', 
    'email', 
    'phone', 
    'address',
    'city',
    'state',
    'zip_code',
    'date_of_birth', // PHI - HIPAA
    'medical_card_number', // PHI - HIPAA
    'medical_card_state', // PHI - HIPAA
    'medical_card_expiration', // PHI - HIPAA
    'physician_name', // PHI - HIPAA
    'qualifying_conditions', // PHI - HIPAA
    'caregiver_name',
    'caregiver_phone',
    'medical_card_photo_url', // PHI - HIPAA
    'allergies',
    'preferred_products',
    'preferred_strains'
  ],
  businesses: ['business_name', 'license_number', 'address', 'contact_info', 'bank_details'],
  products: ['name', 'description', 'price', 'sku', 'supplier_info'],
  orders: ['items', 'total', 'customer_notes', 'delivery_address', 'payment_info'],
  transactions: ['amount', 'payment_method', 'payment_details'],
  messages: ['content', 'subject', 'attachments'],
  documents: ['file_name', 'file_type', 'file_size', 'metadata'],
  profiles: ['full_name', 'phone', 'address', 'preferences'],
} as const;

// Searchable fields (create search indexes)
export const SEARCHABLE_FIELDS = {
  customers: ['email', 'phone', 'medical_card_number'],
  businesses: ['business_name', 'license_number'],
  products: ['name', 'sku'],
} as const;

export const ERROR_MESSAGES = {
  NOT_INITIALIZED: 'Encryption not initialized. Please log in again.',
  INVALID_PASSWORD: 'Invalid password for decryption.',
  SESSION_EXPIRED: 'Encryption session expired. Please log in again.',
  ENCRYPTION_FAILED: 'Failed to encrypt data.',
  DECRYPTION_FAILED: 'Failed to decrypt data.',
} as const;

