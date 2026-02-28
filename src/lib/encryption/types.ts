// src/lib/encryption/types.ts

export interface EncryptionMetadata {
  version: number;
  algorithm: string;
  timestamp: string;
  keyId?: string;
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  tag?: string;
  metadata: EncryptionMetadata;
}

export interface UserKeyDerivation {
  salt: string;
  iterations: number;
  algorithm: string;
}

export interface EncryptionSession {
  key: string;
  initialized: Date;
  lastActivity: Date;
  userId: string;
}

export type EncryptableValue = 
  | string 
  | number 
  | boolean 
  | object 
  | null 
  | undefined;

export interface EncryptedRecord {
  [key: string]: string | number | boolean | null | undefined;
}

export interface DecryptedRecord {
  [key: string]: unknown;
}

export interface SearchIndex {
  field: string;
  hash: string;
  tableName: string;
}

export interface EncryptionHookResult {
  isReady: boolean;
  encrypt: (value: EncryptableValue) => string;
  decrypt: <T = string>(value: string) => T;
  encryptObject: <T extends Record<string, unknown>>(obj: T) => EncryptedRecord;
  decryptObject: <T extends Record<string, unknown>>(obj: EncryptedRecord) => T;
  createSearchHash: (value: string) => string;
  destroy: () => void;
  initialize: (password: string) => Promise<void>;
}

export interface FileEncryptionResult {
  encryptedBlob: Blob;
  metadata: {
    originalName: string;
    originalType: string;
    originalSize: number;
    encryptedSize: number;
  };
}

// Table-specific types
export interface EncryptedCustomer {
  id: string;
  first_name_encrypted: string;
  last_name_encrypted: string;
  email_encrypted: string;
  phone_encrypted: string;
  address_encrypted: string;
  city_encrypted: string;
  state_encrypted: string;
  zip_code_encrypted: string;
  date_of_birth_encrypted: string; // PHI
  medical_card_number_encrypted: string; // PHI
  medical_card_state_encrypted?: string; // PHI
  medical_card_expiration_encrypted?: string; // PHI
  physician_name_encrypted?: string; // PHI
  qualifying_conditions_encrypted?: string; // PHI
  caregiver_name_encrypted?: string;
  caregiver_phone_encrypted?: string;
  medical_card_photo_url_encrypted?: string; // PHI
  allergies_encrypted?: string; // PHI
  preferred_products_encrypted?: string;
  preferred_strains_encrypted?: string;
  email_search_index: string;
  phone_search_index: string;
  medical_card_number_search_index: string;
  encryption_metadata: EncryptionMetadata;
  is_encrypted: boolean;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  account_id: string;
}

export interface DecryptedCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  date_of_birth?: string; // PHI
  medical_card_number?: string; // PHI
  medical_card_state?: string; // PHI
  medical_card_expiration?: string; // PHI
  physician_name?: string; // PHI
  qualifying_conditions?: string[]; // PHI
  caregiver_name?: string;
  caregiver_phone?: string;
  medical_card_photo_url?: string; // PHI
  allergies?: string[]; // PHI
  preferred_products?: string[];
  preferred_strains?: string[];
  customer_type?: string;
  status?: string;
  total_spent?: number;
  loyalty_points?: number;
  loyalty_tier?: string;
  last_purchase_at?: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  account_id: string;
}

export interface EncryptedBusiness {
  id: string;
  business_name_encrypted: string;
  license_number_encrypted: string;
  address_encrypted: string;
  contact_info_encrypted: string;
  bank_details_encrypted?: string;
  business_name_search_index: string;
  license_number_search_index: string;
  encryption_metadata: EncryptionMetadata;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface DecryptedBusiness {
  id: string;
  business_name: string;
  license_number: string;
  address: string;
  contact_info: string;
  bank_details?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface EncryptedProduct {
  id: string;
  name_encrypted: string;
  description_encrypted: string;
  price_encrypted: string;
  sku_encrypted: string;
  name_search_index: string;
  sku_search_index: string;
  encryption_metadata: EncryptionMetadata;
  created_at: string;
  updated_at: string;
  business_id: string;
}

export interface DecryptedProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  sku: string;
  created_at: string;
  updated_at: string;
  business_id: string;
}

export interface EncryptedOrder {
  id: string;
  items_encrypted: string;
  total_encrypted: string;
  customer_notes_encrypted?: string;
  delivery_address_encrypted: string;
  encryption_metadata: EncryptionMetadata;
  created_at: string;
  updated_at: string;
  customer_id: string;
  business_id: string;
  status: string;
}

export interface DecryptedOrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  [key: string]: unknown;
}

export interface DecryptedOrder {
  id: string;
  items: DecryptedOrderItem[];
  total: string;
  customer_notes?: string;
  delivery_address: string;
  created_at: string;
  updated_at: string;
  customer_id: string;
  business_id: string;
  status: string;
}

