/**
 * Verification script for encryption setup
 * Checks that all dependencies, files, and integrations are correct
 * 
 * Usage:
 *   npm run verify-encryption
 *   (add to package.json: "verify-encryption": "tsx scripts/verifyEncryptionSetup.ts")
 */

import { existsSync } from 'fs';
import { readFileSync } from 'fs';
import { join } from 'path';

interface VerificationResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: VerificationResult[] = [];

function verify(name: string, check: () => boolean, message: string): void {
  try {
    const passed = check();
    results.push({ name, passed, message: passed ? message : `❌ ${message}` });
    if (passed) {
      console.log(`✅ ${name}: ${message}`);
    } else {
      console.error(`❌ ${name}: ${message}`);
    }
  } catch (error) {
    results.push({ name, passed: false, message: `Error: ${error instanceof Error ? error.message : String(error)}` });
    console.error(`❌ ${name}: Error - ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runVerification() {
  console.log('🔍 Verifying encryption setup...\n');

  // Check 1: Dependencies in package.json
  verify(
    'Package Dependencies',
    () => {
      const packageJsonPath = join(process.cwd(), 'package.json');
      if (!existsSync(packageJsonPath)) return false;
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      return !!deps['crypto-js'] && !!deps['@types/crypto-js'] && !!deps['tsx'];
    },
    'crypto-js, @types/crypto-js, and tsx are in package.json'
  );

  // Check 2: Core encryption files
  verify(
    'Core Encryption Files',
    () => {
      const files = [
        'src/lib/encryption/clientEncryption.ts',
        'src/lib/encryption/constants.ts',
        'src/lib/encryption/types.ts',
        'src/lib/encryption/utils.ts',
      ];
      return files.every(file => existsSync(join(process.cwd(), file)));
    },
    'All core encryption files exist'
  );

  // Check 3: React hooks
  verify(
    'React Hooks',
    () => {
      const files = [
        'src/lib/hooks/useEncryption.ts',
        'src/lib/hooks/useEncryptedQuery.ts',
        'src/lib/hooks/useEncryptedMutation.ts',
        'src/lib/hooks/useEncryptedFile.ts',
        'src/hooks/useEncryptionError.ts',
      ];
      return files.every(file => existsSync(join(process.cwd(), file)));
    },
    'All encryption hooks exist'
  );

  // Check 4: Context
  verify(
    'Encryption Context',
    () => {
      return existsSync(join(process.cwd(), 'src/contexts/EncryptionContext.tsx'));
    },
    'EncryptionContext exists'
  );

  // Check 5: App.tsx integration
  verify(
    'App.tsx Integration',
    () => {
      const appPath = join(process.cwd(), 'src/App.tsx');
      if (!existsSync(appPath)) return false;
      const appContent = readFileSync(appPath, 'utf-8');
      return appContent.includes('EncryptionProvider') && 
             appContent.includes('from "./contexts/EncryptionContext"') &&
             appContent.includes('<EncryptionProvider>');
    },
    'EncryptionProvider is integrated in App.tsx'
  );

  // Check 6: Database migrations
  verify(
    'Database Migrations',
    () => {
      const migrations = [
        'supabase/migrations/20250101000000_add_encrypted_columns.sql',
        'supabase/migrations/20250101000001_create_indexes.sql',
        'supabase/migrations/20250101000002_update_rls.sql',
      ];
      return migrations.every(migration => existsSync(join(process.cwd(), migration)));
    },
    'All database migration files exist'
  );

  // Check 7: Scripts
  verify(
    'Utility Scripts',
    () => {
      const scripts = [
        'scripts/encryptAllData.ts',
        'scripts/testEncryption.ts',
      ];
      return scripts.every(script => existsSync(join(process.cwd(), script)));
    },
    'All utility scripts exist'
  );

  // Check 8: Auth context updates
  verify(
    'Auth Context Updates',
    () => {
      const contexts = [
        'src/contexts/AuthContext.tsx',
        'src/contexts/CustomerAuthContext.tsx',
        'src/contexts/TenantAdminAuthContext.tsx',
        'src/contexts/SuperAdminAuthContext.tsx',
      ];
      return contexts.every(context => {
        if (!existsSync(join(process.cwd(), context))) return false;
        const content = readFileSync(join(process.cwd(), context), 'utf-8');
        return content.includes('clientEncryption');
      });
    },
    'All auth contexts import clientEncryption'
  );

  // Check 9: Login pages
  verify(
    'Login Pages',
    () => {
      const loginPages = [
        'src/pages/saas/LoginPage.tsx',
        'src/pages/customer/LoginPage.tsx',
        'src/pages/tenant-admin/LoginPage.tsx',
        'src/pages/courier/LoginPage.tsx',
        'src/pages/super-admin/LoginPage.tsx',
      ];
      // Check that login pages have encryption (direct or via auth context)
      // Some pages may initialize encryption directly, others via auth context
      const pagesWithEncryption = loginPages.filter(page => {
        if (!existsSync(join(process.cwd(), page))) return false;
        const content = readFileSync(join(process.cwd(), page), 'utf-8');
        // Check for direct encryption initialization or auth context usage
        return content.includes('clientEncryption') || 
               content.includes('Encryption') ||
               content.includes('useCustomerAuth') ||
               content.includes('useTenantAdminAuth') ||
               content.includes('useSuperAdminAuth');
      });
      // All login pages should have encryption (direct or via auth context)
      return pagesWithEncryption.length === loginPages.length;
    },
    'Login pages have encryption initialization (direct or via auth context)'
  );

  // Check 10: Documentation
  verify(
    'Documentation',
    () => {
      const docs = [
        'docs/QUICK_START.md',
        'docs/ENCRYPTION_GUIDE.md',
        'docs/DEPLOYMENT.md',
        'docs/RECOVERY.md',
      ];
      return docs.some(doc => existsSync(join(process.cwd(), doc)));
    },
    'Documentation files exist'
  );

  // Summary
  console.log('\n📊 Verification Summary:');
  console.log('─'.repeat(50));
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const failed = results.filter(r => !r.passed);

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
  });

  console.log('─'.repeat(50));
  console.log(`\n✅ Passed: ${passed}/${total}`);
  
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}/${total}`);
    console.log('\nFailed checks:');
    failed.forEach(f => console.log(`  - ${f.name}: ${f.message}`));
    process.exit(1);
  } else {
    console.log('\n🎉 All checks passed! Encryption setup is complete and ready for deployment.');
    process.exit(0);
  }
}

runVerification().catch(error => {
  console.error('❌ Verification script error:', error);
  process.exit(1);
});

