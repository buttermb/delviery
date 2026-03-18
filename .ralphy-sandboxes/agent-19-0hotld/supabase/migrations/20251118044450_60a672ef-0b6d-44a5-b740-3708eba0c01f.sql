-- Add encrypted columns for customer PHI and PII data (HIPAA compliance)
-- This migration adds AES-256 encrypted columns for all sensitive customer data

-- Add encrypted columns for basic PII
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS first_name_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS last_name_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS email_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS phone_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS address_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS city_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS state_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS zip_code_encrypted BYTEA;

-- Add encrypted columns for PHI (Protected Health Information)
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS date_of_birth_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS medical_card_number_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS medical_card_state_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS medical_card_expiration_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS physician_name_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS qualifying_conditions_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS medical_card_photo_url_encrypted BYTEA;

-- Add encrypted columns for caregiver information
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS caregiver_name_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS caregiver_phone_encrypted BYTEA;

-- Add encrypted columns for preferences
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS allergies_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS preferred_products_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS preferred_strains_encrypted BYTEA;

-- Add encryption metadata
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS encryption_metadata JSONB;

-- Add search indexes for encrypted fields (hashed for searchability)
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS email_search_index TEXT,
ADD COLUMN IF NOT EXISTS phone_search_index TEXT,
ADD COLUMN IF NOT EXISTS medical_card_number_search_index TEXT;

-- Add is_encrypted flag
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_email_search ON public.customers(email_search_index) WHERE email_search_index IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone_search ON public.customers(phone_search_index) WHERE phone_search_index IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_medical_card_search ON public.customers(medical_card_number_search_index) WHERE medical_card_number_search_index IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON public.customers(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_is_encrypted ON public.customers(is_encrypted);

-- Add HIPAA compliance comments
COMMENT ON COLUMN public.customers.date_of_birth_encrypted IS 'Encrypted date of birth (PHI - HIPAA compliance - AES-256)';
COMMENT ON COLUMN public.customers.medical_card_number_encrypted IS 'Encrypted medical card number (PHI - HIPAA compliance - AES-256)';
COMMENT ON COLUMN public.customers.medical_card_state_encrypted IS 'Encrypted medical card issuing state (PHI - HIPAA compliance - AES-256)';
COMMENT ON COLUMN public.customers.medical_card_expiration_encrypted IS 'Encrypted medical card expiration date (PHI - HIPAA compliance - AES-256)';
COMMENT ON COLUMN public.customers.physician_name_encrypted IS 'Encrypted prescribing physician name (PHI - HIPAA compliance - AES-256)';
COMMENT ON COLUMN public.customers.qualifying_conditions_encrypted IS 'Encrypted qualifying medical conditions (PHI - HIPAA compliance - AES-256)';
COMMENT ON COLUMN public.customers.medical_card_photo_url_encrypted IS 'Encrypted medical card photo URL (PHI - HIPAA compliance - AES-256)';
COMMENT ON COLUMN public.customers.caregiver_name_encrypted IS 'Encrypted caregiver name (PII - AES-256)';
COMMENT ON COLUMN public.customers.caregiver_phone_encrypted IS 'Encrypted caregiver phone (PII - AES-256)';
COMMENT ON COLUMN public.customers.first_name_encrypted IS 'Encrypted first name (PII - AES-256)';
COMMENT ON COLUMN public.customers.last_name_encrypted IS 'Encrypted last name (PII - AES-256)';
COMMENT ON COLUMN public.customers.email_encrypted IS 'Encrypted email address (PII - AES-256)';
COMMENT ON COLUMN public.customers.phone_encrypted IS 'Encrypted phone number (PII - AES-256)';
COMMENT ON COLUMN public.customers.address_encrypted IS 'Encrypted street address (PII - AES-256)';
COMMENT ON COLUMN public.customers.city_encrypted IS 'Encrypted city (PII - AES-256)';
COMMENT ON COLUMN public.customers.state_encrypted IS 'Encrypted state (PII - AES-256)';
COMMENT ON COLUMN public.customers.zip_code_encrypted IS 'Encrypted ZIP code (PII - AES-256)';
COMMENT ON COLUMN public.customers.allergies_encrypted IS 'Encrypted allergies list (PHI - HIPAA compliance - AES-256)';
COMMENT ON COLUMN public.customers.preferred_products_encrypted IS 'Encrypted preferred products list (AES-256)';
COMMENT ON COLUMN public.customers.preferred_strains_encrypted IS 'Encrypted preferred strains list (AES-256)';

COMMENT ON COLUMN public.customers.email_search_index IS 'SHA-256 hash of email for encrypted search';
COMMENT ON COLUMN public.customers.phone_search_index IS 'SHA-256 hash of phone for encrypted search';
COMMENT ON COLUMN public.customers.medical_card_number_search_index IS 'SHA-256 hash of medical card number for encrypted search';

COMMENT ON COLUMN public.customers.encryption_metadata IS 'Encryption metadata including algorithm version and timestamp';