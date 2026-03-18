/**
 * Route Checker Script
 * Scans navigation files and compares with defined routes in App.tsx
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface RouteCheck {
  path: string;
  exists: boolean;
  component?: string;
  error?: string;
  source?: string;
}

// Extract routes from navigation files
function extractNavigationRoutes(): string[] {
  const routes: string[] = [];
  
  // Check sidebar-navigation.ts
  const navFile = path.join(process.cwd(), 'src/components/admin/sidebar-navigation.ts');
  if (fs.existsSync(navFile)) {
    const content = fs.readFileSync(navFile, 'utf-8');
    const hrefRegex = /href:\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = hrefRegex.exec(content)) !== null) {
      routes.push(match[1]);
    }
  }
  
  // Check TenantAdminSidebar.tsx
  const tenantNavFile = path.join(process.cwd(), 'src/components/tenant-admin/TenantAdminSidebar.tsx');
  if (fs.existsSync(tenantNavFile)) {
    const content = fs.readFileSync(tenantNavFile, 'utf-8');
    const urlRegex = /url:\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = urlRegex.exec(content)) !== null) {
      routes.push(match[1]);
    }
  }
  
  // Check SaasAdminSidebar.tsx
  const saasNavFile = path.join(process.cwd(), 'src/components/saas/SaasAdminSidebar.tsx');
  if (fs.existsSync(saasNavFile)) {
    const content = fs.readFileSync(saasNavFile, 'utf-8');
    const urlRegex = /url:\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = urlRegex.exec(content)) !== null) {
      routes.push(match[1]);
    }
  }
  
  // Check all Link components
  const linkPattern = /<Link[^>]*to=["']([^"']+)["']/g;
  const files = glob.sync('src/**/*.{tsx,ts}', { cwd: process.cwd() });
  
  files.forEach(file => {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), file), 'utf-8');
      let match;
      while ((match = linkPattern.exec(content)) !== null) {
        const route = match[1];
        // Only include internal routes
        if (route.startsWith('/') && !route.startsWith('http')) {
          routes.push(route);
        }
      }
    } catch (e) {
      // Skip files that can't be read
    }
  });
  
  return [...new Set(routes)]; // Remove duplicates
}

// Extract defined routes from App.tsx
function extractDefinedRoutes(): Set<string> {
  const appFile = path.join(process.cwd(), 'src/App.tsx');
  if (!fs.existsSync(appFile)) {
    return new Set();
  }
  
  const content = fs.readFileSync(appFile, 'utf-8');
  const routes = new Set<string>();
  
  // Match Route path="..." or path: "..."
  const routeRegex = /path=["']([^"']+)["']/g;
  let match;
  
  while ((match = routeRegex.exec(content)) !== null) {
    routes.add(match[1]);
  }
  
  return routes;
}

// Check if page component exists
function checkPageExists(route: string): { exists: boolean; file?: string } {
  // Convert route to potential file paths
  const routeParts = route.split('/').filter(Boolean);
  
  const possiblePaths = [
    // Exact match
    path.join('src', 'pages', ...routeParts) + '.tsx',
    path.join('src', 'pages', ...routeParts, 'index.tsx'),
    // Admin routes
    path.join('src', 'pages', 'admin', ...routeParts.slice(1)) + '.tsx',
    path.join('src', 'pages', 'admin', ...routeParts.slice(1), 'index.tsx'),
    // Super admin routes
    path.join('src', 'pages', 'super-admin', ...routeParts.slice(1)) + '.tsx',
    path.join('src', 'pages', 'super-admin', ...routeParts.slice(1), 'index.tsx'),
  ];
  
  for (const filePath of possiblePaths) {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      return { exists: true, file: filePath };
    }
  }
  
  return { exists: false };
}

// Main check function
function checkAllRoutes() {
  console.log('🔍 Scanning codebase for routes...\n');
  
  const navRoutes = extractNavigationRoutes();
  const definedRoutes = extractDefinedRoutes();
  
  console.log(`Found ${navRoutes.length} navigation routes`);
  console.log(`Found ${definedRoutes.size} defined routes\n`);
  
  const results: RouteCheck[] = [];
  
  navRoutes.forEach(route => {
    const isDefined = definedRoutes.has(route);
    const pageCheck = checkPageExists(route);
    
    let error: string | undefined;
    if (!isDefined) {
      error = 'Route not defined in App.tsx';
    } else if (!pageCheck.exists) {
      error = 'Page component file missing';
    }
    
    results.push({
      path: route,
      exists: isDefined && pageCheck.exists,
      component: pageCheck.file,
      error,
    });
  });
  
  // Print results
  const broken = results.filter(r => !r.exists);
  const working = results.filter(r => r.exists);
  
  console.log(`✅ Working routes: ${working.length}`);
  console.log(`❌ Broken routes: ${broken.length}\n`);
  
  if (broken.length > 0) {
    console.log('❌ Broken routes:\n');
    broken.forEach(r => {
      console.log(`  ${r.path}`);
      console.log(`    Error: ${r.error}\n`);
    });
  }
  
  // Generate report
  const report = generateReport(results);
  const reportPath = path.join(process.cwd(), 'BROKEN_ROUTES_REPORT.md');
  fs.writeFileSync(reportPath, report, 'utf-8');
  
  console.log(`📄 Report saved to ${reportPath}`);
  
  return { broken, working, results };
}

function generateReport(results: RouteCheck[]): string {
  const broken = results.filter(r => !r.exists);
  const working = results.filter(r => r.exists);
  
  let report = '# 🔗 Route Check Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `- Total Routes: ${results.length}\n`;
  report += `- ✅ Working: ${working.length}\n`;
  report += `- ❌ Broken: ${broken.length}\n\n`;
  
  if (broken.length > 0) {
    report += '## ❌ Broken Routes\n\n';
    
    // Group by error type
    const byError = broken.reduce((acc, r) => {
      const key = r.error || 'Unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(r);
      return acc;
    }, {} as Record<string, RouteCheck[]>);
    
    Object.entries(byError).forEach(([error, routes]) => {
      report += `### ${error}\n\n`;
      routes.forEach(r => {
        report += `- \`${r.path}\`\n`;
      });
      report += '\n';
    });
    
    report += '## 🔧 Recommended Fixes\n\n';
    broken.forEach(r => {
      report += `### ${r.path}\n`;
      report += `- **Issue**: ${r.error}\n`;
      if (r.error?.includes('not defined')) {
        report += `- **Fix**: Add route to App.tsx or create ComingSoonPage\n`;
      } else if (r.error?.includes('missing')) {
        report += `- **Fix**: Create page component at appropriate location\n`;
      }
      report += '\n';
    });
  }
  
  report += '## ✅ Working Routes\n\n';
  working.forEach(r => {
    report += `- ${r.path}\n`;
  });
  
  return report;
}

// Run the check
try {
  const { broken } = checkAllRoutes();
  process.exit(broken.length > 0 ? 1 : 0);
} catch (error) {
  console.error('Error running route check:', error);
  process.exit(1);
}

