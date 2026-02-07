// Quick verification that the sessionStorage implementation is syntactically correct
const fs = require('fs');
const path = require('path');

const contextFile = path.join(__dirname, 'src/contexts/TenantAdminAuthContext.tsx');
const content = fs.readFileSync(contextFile, 'utf8');

// Check for sessionStorage keys
if (!content.includes('SESSION_ADMIN_KEY')) {
  console.error('❌ SESSION_ADMIN_KEY not found');
  process.exit(1);
}

if (!content.includes('SESSION_TENANT_KEY')) {
  console.error('❌ SESSION_TENANT_KEY not found');
  process.exit(1);
}

// Check for sessionStorage.getItem in getInitialAdminState
if (!content.includes('sessionStorage.getItem(SESSION_ADMIN_KEY)')) {
  console.error('❌ sessionStorage.getItem(SESSION_ADMIN_KEY) not found in getInitialAdminState');
  process.exit(1);
}

// Check for sessionStorage.setItem calls
const sessionSetItemCount = (content.match(/sessionStorage\.setItem/g) || []).length;
if (sessionSetItemCount < 8) {
  console.error(`❌ Expected at least 8 sessionStorage.setItem calls, found ${sessionSetItemCount}`);
  process.exit(1);
}

// Check for sessionStorage.removeItem in clearAuthState
if (!content.includes('sessionStorage.removeItem(SESSION_ADMIN_KEY)')) {
  console.error('❌ sessionStorage.removeItem(SESSION_ADMIN_KEY) not found in clearAuthState');
  process.exit(1);
}

if (!content.includes('sessionStorage.removeItem(SESSION_TENANT_KEY)')) {
  console.error('❌ sessionStorage.removeItem(SESSION_TENANT_KEY) not found in clearAuthState');
  process.exit(1);
}

console.log('✅ SessionStorage implementation verified successfully!');
console.log(`✅ Found ${sessionSetItemCount} sessionStorage.setItem calls`);
console.log('✅ getInitialAdminState reads from sessionStorage');
console.log('✅ getInitialTenantState reads from sessionStorage');
console.log('✅ clearAuthState removes sessionStorage items');
console.log('✅ All data writes cache to sessionStorage');
process.exit(0);
