/**
 * Test suite for encryption/decryption
 * Verifies encryption functionality, search, and performance
 * 
 * Usage:
 *   npm run test-encryption
 */

import { clientEncryption } from '../src/lib/encryption/clientEncryption';
import { getEncryptedFields, getSearchableFields } from '../src/lib/encryption/utils';

const TEST_USER_ID = 'test-user-123';
const TEST_PASSWORD = 'test-password-123';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

function test(name: string, fn: () => Promise<void> | void): void {
  const start = Date.now();
  try {
    const result = fn();
    if (result instanceof Promise) {
      result
        .then(() => {
          const duration = Date.now() - start;
          results.push({ name, passed: true, duration });
          console.log(`✅ ${name} (${duration}ms)`);
        })
        .catch((error: unknown) => {
          const duration = Date.now() - start;
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.push({ name, passed: false, error: errorMessage, duration });
          console.error(`❌ ${name}: ${errorMessage}`);
        });
    } else {
      const duration = Date.now() - start;
      results.push({ name, passed: true, duration });
      console.log(`✅ ${name} (${duration}ms)`);
    }
  } catch (error: unknown) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMessage, duration });
    console.error(`❌ ${name}: ${errorMessage}`);
  }
}

async function runTests() {
  console.log('🧪 Starting encryption tests...\n');

  // Test 1: Initialization
  test('Encryption initialization', async () => {
    await clientEncryption.initialize(TEST_PASSWORD, TEST_USER_ID);
    if (!clientEncryption.isReady()) {
      throw new Error('Encryption not ready after initialization');
    }
  });

  // Test 2: String encryption/decryption
  test('String encryption/decryption', () => {
    const original = 'test@example.com';
    const encrypted = clientEncryption.encrypt(original);
    const decrypted = clientEncryption.decrypt<string>(encrypted);
    
    if (decrypted !== original) {
      throw new Error(`Decryption mismatch: expected "${original}", got "${decrypted}"`);
    }
  });

  // Test 3: Number encryption/decryption
  test('Number encryption/decryption', () => {
    const original = 12345;
    const encrypted = clientEncryption.encrypt(original);
    const decrypted = clientEncryption.decrypt<number>(encrypted);
    
    if (decrypted !== original) {
      throw new Error(`Decryption mismatch: expected ${original}, got ${decrypted}`);
    }
  });

  // Test 4: Object encryption/decryption
  test('Object encryption/decryption', () => {
    const original = { name: 'John', age: 30, email: 'john@example.com' };
    const encrypted = clientEncryption.encrypt(original);
    const decrypted = clientEncryption.decrypt<typeof original>(encrypted);
    
    if (JSON.stringify(decrypted) !== JSON.stringify(original)) {
      throw new Error('Object decryption mismatch');
    }
  });

  // Test 5: Array encryption/decryption
  test('Array encryption/decryption', () => {
    const original = ['item1', 'item2', 'item3'];
    const encrypted = clientEncryption.encrypt(original);
    const decrypted = clientEncryption.decrypt<string[]>(encrypted);
    
    if (JSON.stringify(decrypted) !== JSON.stringify(original)) {
      throw new Error('Array decryption mismatch');
    }
  });

  // Test 6: Object encryption utility
  test('encryptObject utility', () => {
    const original = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '555-1234',
    };
    
    const encrypted = clientEncryption.encryptObject(original);
    
    if (!encrypted.name_encrypted || !encrypted.email_encrypted || !encrypted.phone_encrypted) {
      throw new Error('Missing encrypted fields');
    }
  });

  // Test 7: Object decryption utility
  test('decryptObject utility', () => {
    const original = {
      name: 'John Doe',
      email: 'john@example.com',
    };
    
    const encrypted = clientEncryption.encryptObject(original);
    const decrypted = clientEncryption.decryptObject(encrypted);
    
    if (decrypted.name !== original.name || decrypted.email !== original.email) {
      throw new Error('Decryption mismatch');
    }
  });

  // Test 8: Search hash generation
  test('Search hash generation', () => {
    const value = 'test@example.com';
    const hash1 = clientEncryption.createSearchHash(value);
    const hash2 = clientEncryption.createSearchHash(value);
    
    // Hash should be deterministic
    if (hash1 !== hash2) {
      throw new Error('Search hash is not deterministic');
    }
    
    // Hash should be different for different values
    const hash3 = clientEncryption.createSearchHash('different@example.com');
    if (hash1 === hash3) {
      throw new Error('Search hash collision');
    }
  });

  // Test 9: Session expiry
  test('Session expiry check', () => {
    if (clientEncryption.isSessionExpired()) {
      throw new Error('Session expired immediately after initialization');
    }
  });

  // Test 10: Session destruction
  test('Session destruction', () => {
    clientEncryption.destroy();
    if (clientEncryption.isReady()) {
      throw new Error('Encryption still ready after destruction');
    }
  });

  // Wait for async tests
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Print summary
  console.log('\n📊 Test Summary:');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏱️  Total duration: ${totalDuration}ms`);
  console.log(`   📈 Average: ${Math.round(totalDuration / results.length)}ms per test`);

  if (failed > 0) {
    console.log('\n❌ Some tests failed. Details:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };

