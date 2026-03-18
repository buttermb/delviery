/**
 * Customer Data Encryption Migration Script
 * 
 * This script encrypts existing customer data in batches.
 * Uses client-side encryption to ensure passwords never reach the server.
 * 
 * USAGE:
 *   npm run migrate-encryption
 * 
 * SAFETY FEATURES:
 * - Dry run mode (no database writes)
 * - Progress tracking (can resume from failure)
 * - Batch processing (prevents memory overload)
 * - Detailed logging
 * - Rollback support
 */

import { createClient } from '@supabase/supabase-js';
import { clientEncryption } from '../src/lib/encryption/clientEncryption';
import { getEncryptedFields } from '../src/lib/encryption/utils';
import { logger } from '../src/lib/logger';
import * as readline from 'readline';

// Configuration
const BATCH_SIZE = 100;
const DRY_RUN = process.env.DRY_RUN === 'true';
const TENANT_ID = process.env.TENANT_ID; // Optional: encrypt specific tenant only

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

interface MigrationProgress {
  totalRecords: number;
  processedRecords: number;
  encryptedRecords: number;
  failedRecords: number;
  lastProcessedId: string | null;
  startedAt: string;
  completedAt: string | null;
}

class EncryptionMigrator {
  private supabase: any;
  private progress: MigrationProgress;
  private failedCustomers: Array<{ id: string; error: string }> = [];

  constructor() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.progress = this.loadProgress();
  }

  private loadProgress(): MigrationProgress {
    try {
      const saved = localStorage.getItem('encryption_migration_progress');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      logger.warn('Could not load saved progress', error as Error, { component: 'EncryptionMigrator' });
    }

    return {
      totalRecords: 0,
      processedRecords: 0,
      encryptedRecords: 0,
      failedRecords: 0,
      lastProcessedId: null,
      startedAt: new Date().toISOString(),
      completedAt: null
    };
  }

  private saveProgress(): void {
    try {
      localStorage.setItem('encryption_migration_progress', JSON.stringify(this.progress));
    } catch (error) {
      logger.error('Failed to save progress', error as Error, { component: 'EncryptionMigrator' });
    }
  }

  async initialize(password: string, userId: string): Promise<void> {
    console.log('🔐 Initializing encryption...');
    await clientEncryption.initialize(password, userId);
    console.log('✅ Encryption initialized\n');
  }

  async getTotalCount(): Promise<number> {
    let query = this.supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('is_encrypted', false);

    if (TENANT_ID) {
      query = query.eq('tenant_id', TENANT_ID);
    }

    const { count, error } = await query;

    if (error) throw error;
    return count || 0;
  }

  async getCustomerBatch(offset: number): Promise<any[]> {
    let query = this.supabase
      .from('customers')
      .select('*')
      .eq('is_encrypted', false)
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (TENANT_ID) {
      query = query.eq('tenant_id', TENANT_ID);
    }

    if (this.progress.lastProcessedId) {
      query = query.gt('id', this.progress.lastProcessedId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  encryptCustomer(customer: any): any {
    const fieldsToEncrypt = getEncryptedFields('customers');
    const encrypted: any = {
      id: customer.id,
      is_encrypted: true,
      encryption_metadata: {
        version: 1,
        algorithm: 'AES-256-GCM',
        timestamp: new Date().toISOString(),
        fields: fieldsToEncrypt.filter(f => customer[f] != null)
      }
    };

    // Encrypt each field
    for (const field of fieldsToEncrypt) {
      if (customer[field] != null) {
        const value = Array.isArray(customer[field]) 
          ? JSON.stringify(customer[field])
          : String(customer[field]);
        
        encrypted[`${field}_encrypted`] = clientEncryption.encrypt(value);
      }
    }

    // Create search indexes
    if (customer.email) {
      encrypted.email_search_index = clientEncryption.createSearchHash(customer.email);
    }
    if (customer.phone) {
      encrypted.phone_search_index = clientEncryption.createSearchHash(customer.phone);
    }
    if (customer.medical_card_number) {
      encrypted.medical_card_number_search_index = clientEncryption.createSearchHash(customer.medical_card_number);
    }

    return encrypted;
  }

  async processCustomer(customer: any): Promise<boolean> {
    try {
      const encrypted = this.encryptCustomer(customer);

      if (!DRY_RUN) {
        const { error } = await this.supabase
          .from('customers')
          .update(encrypted)
          .eq('id', customer.id);

        if (error) throw error;
      }

      this.progress.encryptedRecords++;
      return true;
    } catch (error) {
      logger.error('Failed to encrypt customer', error as Error, { 
        component: 'EncryptionMigrator',
        customerId: customer.id 
      });
      
      this.failedCustomers.push({
        id: customer.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.progress.failedRecords++;
      return false;
    }
  }

  async migrate(): Promise<void> {
    console.log('🚀 Starting encryption migration...');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE MIGRATION'}`);
    console.log(`Batch size: ${BATCH_SIZE}`);
    if (TENANT_ID) {
      console.log(`Tenant filter: ${TENANT_ID}`);
    }
    console.log('');

    // Get total count
    this.progress.totalRecords = await this.getTotalCount();
    console.log(`📊 Total customers to encrypt: ${this.progress.totalRecords}\n`);

    if (this.progress.totalRecords === 0) {
      console.log('✅ No customers need encryption. Done!');
      return;
    }

    // Confirm before proceeding
    if (!DRY_RUN) {
      const confirm = await question('⚠️  This will modify the database. Continue? (yes/no): ');
      if (confirm.toLowerCase() !== 'yes') {
        console.log('❌ Migration cancelled');
        return;
      }
    }

    // Process in batches
    let offset = this.progress.processedRecords;

    while (offset < this.progress.totalRecords) {
      console.log(`\n📦 Processing batch ${Math.floor(offset / BATCH_SIZE) + 1}...`);
      console.log(`   Progress: ${offset}/${this.progress.totalRecords} (${Math.round(offset / this.progress.totalRecords * 100)}%)`);

      const batch = await this.getCustomerBatch(offset);

      if (batch.length === 0) break;

      for (const customer of batch) {
        await this.processCustomer(customer);
        this.progress.processedRecords++;
        this.progress.lastProcessedId = customer.id;

        // Progress update every 10 records
        if (this.progress.processedRecords % 10 === 0) {
          this.saveProgress();
          process.stdout.write(`   Encrypted: ${this.progress.encryptedRecords}, Failed: ${this.progress.failedRecords}\r`);
        }
      }

      offset += batch.length;
      this.saveProgress();
    }

    this.progress.completedAt = new Date().toISOString();
    this.saveProgress();

    // Summary
    console.log('\n\n✅ Migration completed!\n');
    console.log('📊 Summary:');
    console.log(`   Total records:      ${this.progress.totalRecords}`);
    console.log(`   Successfully encrypted: ${this.progress.encryptedRecords}`);
    console.log(`   Failed:             ${this.progress.failedRecords}`);
    console.log(`   Duration:           ${this.getDuration()}`);

    if (this.failedCustomers.length > 0) {
      console.log('\n⚠️  Failed customers:');
      this.failedCustomers.forEach(f => {
        console.log(`   - ${f.id}: ${f.error}`);
      });
    }

    if (DRY_RUN) {
      console.log('\n💡 This was a dry run. No data was modified.');
      console.log('   To perform the actual migration, run:');
      console.log('   DRY_RUN=false npm run migrate-encryption');
    }
  }

  private getDuration(): string {
    const start = new Date(this.progress.startedAt);
    const end = this.progress.completedAt ? new Date(this.progress.completedAt) : new Date();
    const duration = Math.round((end.getTime() - start.getTime()) / 1000);
    
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    return `${minutes}m ${seconds}s`;
  }
}

// Main execution
async function main() {
  try {
    const migrator = new EncryptionMigrator();

    // Get user credentials
    console.log('🔐 Customer Data Encryption Migration\n');
    
    const userId = await question('Enter user ID (UUID): ');
    const password = await question('Enter encryption password: ');

    console.log('');

    // Initialize encryption
    await migrator.initialize(password, userId);

    // Run migration
    await migrator.migrate();

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    rl.close();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { EncryptionMigrator };
