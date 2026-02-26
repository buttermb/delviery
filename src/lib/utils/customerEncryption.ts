/**
 * Customer Encryption Utilities
 * 
 * Helper functions for encrypting/decrypting customer PHI data
 * Includes HIPAA-compliant audit logging
 */

import { logger } from '@/lib/logger';
import { clientEncryption } from '../encryption/clientEncryption';
import { getEncryptedFields, getSearchableFields } from '../encryption/utils';
import { supabase } from '@/integrations/supabase/client';
import type { DecryptedCustomer } from '../encryption/types';

/**
 * Encrypt customer data for database storage
 */
export async function encryptCustomerData(customer: Partial<DecryptedCustomer>): Promise<Record<string, unknown>> {
  const fieldsToEncrypt = getEncryptedFields('customers');
  const searchableFields = getSearchableFields('customers');
  
  const encrypted: Record<string, unknown> = {
    // Preserve non-encrypted fields
    tenant_id: customer.tenant_id,
    account_id: customer.account_id,
    customer_type: customer.customer_type,
    status: customer.status,
    total_spent: customer.total_spent ?? 0,
    loyalty_points: customer.loyalty_points ?? 0,
    loyalty_tier: customer.loyalty_tier || 'bronze',
    
    // Encryption metadata
    is_encrypted: true,
    encryption_metadata: {
      version: 1,
      algorithm: 'AES-256-GCM',
      timestamp: new Date().toISOString(),
      fields: fieldsToEncrypt.filter((f: string) => customer[f as keyof DecryptedCustomer] != null)
    }
  };

  // Encrypt each sensitive field
  for (const field of fieldsToEncrypt) {
    const value = customer[field as keyof DecryptedCustomer];
    if (value != null) {
      const stringValue = Array.isArray(value) 
        ? JSON.stringify(value)
        : String(value);
      
      encrypted[`${field}_encrypted`] = clientEncryption.encrypt(stringValue);
    }
  }

  // Create search indexes
  for (const field of searchableFields) {
    const value = customer[field as keyof DecryptedCustomer];
    if (value != null) {
      encrypted[`${field}_search_index`] = clientEncryption.createSearchHash(String(value));
    }
  }

  return encrypted;
}

/**
 * Decrypt customer data from database
 */
export async function decryptCustomerData(encryptedCustomer: Record<string, unknown>): Promise<DecryptedCustomer> {
  if (!encryptedCustomer.is_encrypted) {
    // Return plaintext customer (hybrid migration support)
    return encryptedCustomer as unknown as DecryptedCustomer;
  }

  const fieldsToDecrypt = getEncryptedFields('customers');
  const decrypted: Record<string, unknown> = {
    id: encryptedCustomer.id,
    tenant_id: encryptedCustomer.tenant_id,
    account_id: encryptedCustomer.account_id,
    created_at: encryptedCustomer.created_at,
    updated_at: encryptedCustomer.updated_at,
  };

  // Decrypt each encrypted field
  for (const field of fieldsToDecrypt) {
    const encryptedField = `${field}_encrypted`;
    if (encryptedCustomer[encryptedField]) {
      try {
        const decryptedValue = clientEncryption.decrypt<string>(encryptedCustomer[encryptedField] as string);
        
        // Parse JSON arrays back to arrays
        if (field === 'qualifying_conditions' || field === 'allergies' || 
            field === 'preferred_products' || field === 'preferred_strains') {
          try {
            decrypted[field] = JSON.parse(decryptedValue);
          } catch {
            decrypted[field] = decryptedValue;
          }
        } else {
          decrypted[field] = decryptedValue;
        }
      } catch (error) {
        logger.error('Failed to decrypt customer field', error as Error, { 
          component: 'customerEncryption',
          field,
          customerId: encryptedCustomer.id 
        });
        decrypted[field] = null;
      }
    }
  }

  return decrypted as unknown as DecryptedCustomer;
}

/**
 * Log PHI access for HIPAA compliance
 */
export async function logPHIAccess(
  customerId: string,
  action: 'view' | 'create' | 'update' | 'decrypt' | 'search',
  fieldsAccessed: string[],
  purpose?: string
): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_phi_access', {
      p_customer_id: customerId,
      p_action: action,
      p_fields_accessed: fieldsAccessed,
      p_purpose: purpose
    });

    if (error) throw error;
  } catch (error) {
    logger.error('Failed to log PHI access', error as Error, { 
      component: 'customerEncryption',
      customerId,
      action 
    });
    // Don't block the operation if logging fails
  }
}

/**
 * Search encrypted customers by email
 */
export async function searchCustomerByEmail(email: string, tenantId: string): Promise<DecryptedCustomer[]> {
  const emailHash = clientEncryption.createSearchHash(email);
  
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('email_search_index', emailHash);

  if (error) throw error;

  // Decrypt results
  const decrypted = await Promise.all(
    (data ?? []).map(c => decryptCustomerData(c))
  );

  // Log search
  for (const customer of decrypted) {
    await logPHIAccess(customer.id, 'search', ['email']);
  }

  return decrypted;
}

/**
 * Search encrypted customers by phone
 */
export async function searchCustomerByPhone(phone: string, tenantId: string): Promise<DecryptedCustomer[]> {
  const phoneHash = clientEncryption.createSearchHash(phone);
  
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('phone_search_index', phoneHash);

  if (error) throw error;

  // Decrypt results
  const decrypted = await Promise.all(
    (data ?? []).map(c => decryptCustomerData(c))
  );

  // Log search
  for (const customer of decrypted) {
    await logPHIAccess(customer.id, 'search', ['phone']);
  }

  return decrypted;
}

/**
 * Search encrypted customers by medical card number
 */
export async function searchCustomerByMedicalCard(cardNumber: string, tenantId: string): Promise<DecryptedCustomer[]> {
  const cardHash = clientEncryption.createSearchHash(cardNumber);
  
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('medical_card_number_search_index', cardHash);

  if (error) throw error;

  // Decrypt results
  const decrypted = await Promise.all(
    (data ?? []).map(c => decryptCustomerData(c))
  );

  // Log search
  for (const customer of decrypted) {
    await logPHIAccess(customer.id, 'search', ['medical_card_number']);
  }

  return decrypted;
}

/**
 * Get PHI fields that were accessed
 */
export function getPHIFields(): string[] {
  return [
    'date_of_birth',
    'medical_card_number',
    'medical_card_state',
    'medical_card_expiration',
    'physician_name',
    'qualifying_conditions',
    'medical_card_photo_url',
    'allergies'
  ];
}

/**
 * Check if a field is PHI
 */
export function isPHIField(fieldName: string): boolean {
  return getPHIFields().includes(fieldName);
}
