/**
 * Batch encryption script for existing data
 * Processes one table at a time with progress tracking
 * Can be run incrementally (10%, 50%, 100%)
 * 
 * Usage:
 *   npm run encrypt-data -- --table=customers --percentage=10
 *   npm run encrypt-data -- --table=customers --percentage=100
 */

import { createClient } from '@supabase/supabase-js';
import { clientEncryption } from '../src/lib/encryption/clientEncryption';
import { getEncryptedFields, getSearchableFields, getEncryptedFieldName, getSearchIndexFieldName } from '../src/lib/encryption/utils';
import { ENCRYPTED_TABLES } from '../src/lib/encryption/constants';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface EncryptionOptions {
  table: string;
  percentage?: number;
  batchSize?: number;
  userId: string;
  password: string;
}

/**
 * Encrypt a single record
 */
async function encryptRecord(
  table: string,
  record: Record<string, unknown>,
  userId: string
): Promise<Record<string, unknown>> {
  const encryptedRecord: Record<string, unknown> = { ...record };
  const fieldsToEncrypt = getEncryptedFields(table);
  const searchableFields = getSearchableFields(table);

  // Encrypt each field
  for (const field of fieldsToEncrypt) {
    if (record[field] !== undefined && record[field] !== null) {
      const value = record[field];
      
      // Encrypt the field
      const encryptedFieldName = getEncryptedFieldName(field);
      encryptedRecord[encryptedFieldName] = clientEncryption.encrypt(value);

      // Create search index if field is searchable
      if (searchableFields.includes(field) && typeof value === 'string') {
        const searchIndexName = getSearchIndexFieldName(field);
        encryptedRecord[searchIndexName] = clientEncryption.createSearchHash(value);
      }

      // Keep original field for now (hybrid migration)
    }
  }

  // Add encryption metadata
  encryptedRecord.encryption_metadata = clientEncryption.getMetadata();

  return encryptedRecord;
}

/**
 * Encrypt all data for a table
 */
async function encryptTableData(options: EncryptionOptions): Promise<void> {
  const { table, percentage = 100, batchSize = 100, userId, password } = options;

  // Initialize encryption
  await clientEncryption.initialize(password, userId);

  console.log(`\n🔐 Starting encryption for table: ${table}`);
  console.log(`   Percentage: ${percentage}%`);
  console.log(`   Batch size: ${batchSize}`);

  try {
    // Get total count
    const { count, error: countError } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    const totalRecords = count || 0;
    const recordsToProcess = Math.ceil((totalRecords * percentage) / 100);
    
    console.log(`   Total records: ${totalRecords}`);
    console.log(`   Records to process: ${recordsToProcess}`);

    let processed = 0;
    let offset = 0;

    while (processed < recordsToProcess) {
      const limit = Math.min(batchSize, recordsToProcess - processed);
      
      // Fetch batch
      const { data: records, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .range(offset, offset + limit - 1);

      if (fetchError) throw fetchError;

      if (!records || records.length === 0) break;

      // Encrypt each record
      for (const record of records) {
        try {
          const encrypted = await encryptRecord(table, record as Record<string, unknown>, userId);
          
          // Update record with encrypted fields
          const recordId = (record as { id: string }).id;
          const { error: updateError } = await supabase
            .from(table)
            .update(encrypted)
            .eq('id', recordId);

          if (updateError) {
            console.error(`   ❌ Failed to encrypt record ${record.id}:`, updateError.message);
          } else {
            processed++;
            if (processed % 10 === 0) {
              console.log(`   ✅ Processed ${processed}/${recordsToProcess} records...`);
            }
          }
        } catch (error) {
          console.error(`   ❌ Error encrypting record ${record.id}:`, error);
        }
      }

      offset += limit;
    }

    console.log(`\n✅ Encryption complete for ${table}`);
    console.log(`   Processed: ${processed}/${recordsToProcess} records`);
  } catch (error) {
    console.error(`\n❌ Encryption failed for ${table}:`, error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const tableArg = args.find(arg => arg.startsWith('--table='))?.split('=')[1];
  const percentageArg = args.find(arg => arg.startsWith('--percentage='))?.split('=')[1];
  const userIdArg = args.find(arg => arg.startsWith('--userId='))?.split('=')[1];
  const passwordArg = args.find(arg => arg.startsWith('--password='))?.split('=')[1];

  if (!tableArg || !ENCRYPTED_TABLES.includes(tableArg as any)) {
    console.error('❌ Invalid table. Valid tables:', ENCRYPTED_TABLES.join(', '));
    process.exit(1);
  }

  if (!userIdArg || !passwordArg) {
    console.error('❌ Missing userId or password. Required for encryption key derivation.');
    process.exit(1);
  }

  const percentage = percentageArg ? parseInt(percentageArg, 10) : 100;

  if (percentage < 1 || percentage > 100) {
    console.error('❌ Percentage must be between 1 and 100');
    process.exit(1);
  }

  await encryptTableData({
    table: tableArg,
    percentage,
    userId: userIdArg,
    password: passwordArg,
  });

  console.log('\n✅ Migration complete!');
}

if (require.main === module) {
  main().catch(console.error);
}

export { encryptTableData, encryptRecord };

