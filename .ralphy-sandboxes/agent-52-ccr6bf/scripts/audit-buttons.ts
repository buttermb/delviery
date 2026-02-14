#!/usr/bin/env tsx
/**
 * Button Audit Script
 * Scans all buttons across the site to verify they follow implementation rules
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface ButtonIssue {
  file: string;
  line: number;
  issue: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
}

const issues: ButtonIssue[] = [];
const checkedFiles = new Set<string>();

function scanFile(filePath: string) {
  if (checkedFiles.has(filePath)) return;
  checkedFiles.add(filePath);

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Check for buttons with onClick
    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for Button with onClick but no loading state
      if (line.includes('<Button') && line.includes('onClick')) {
        // Check if there's a loading state in the component
        const hasLoadingState = content.includes('isLoading') || 
                                content.includes('isSubmitting') ||
                                content.includes('isDeleting') ||
                                content.includes('isCreating') ||
                                content.includes('isUpdating') ||
                                content.includes('isSaving') ||
                                content.includes('isPending');

        // Check if button is disabled during loading
        const hasDisabled = content.includes('disabled={') && 
                           (content.includes('isLoading') || 
                            content.includes('isSubmitting') ||
                            content.includes('isPending'));

        // Check for async onClick handlers
        const hasAsync = content.includes('async') && 
                        (content.includes('onClick={async') || 
                         content.includes('const handle') && content.includes('async'));

        // Check for error handling
        const hasTryCatch = content.includes('try {') && content.includes('catch');

        // Check for logger usage
        const hasLogger = content.includes('logger.error') || content.includes('logger.warn');

        // Check for toast notifications
        const hasToast = content.includes('toast.') || content.includes('toast(');

        if (hasAsync && !hasLoadingState) {
          issues.push({
            file: filePath,
            line: lineNum,
            issue: 'Button with async onClick missing loading state',
            severity: 'error',
            code: line.trim()
          });
        }

        if (hasAsync && !hasDisabled) {
          issues.push({
            file: filePath,
            line: lineNum,
            issue: 'Button with async onClick not disabled during operation',
            severity: 'error',
            code: line.trim()
          });
        }

        if (hasAsync && !hasTryCatch) {
          issues.push({
            file: filePath,
            line: lineNum,
            issue: 'Button with async onClick missing error handling (try-catch)',
            severity: 'error',
            code: line.trim()
          });
        }

        if (hasAsync && !hasLogger) {
          issues.push({
            file: filePath,
            line: lineNum,
            issue: 'Button with async onClick missing logger for errors',
            severity: 'warning',
            code: line.trim()
          });
        }

        if (hasAsync && !hasToast) {
          issues.push({
            file: filePath,
            line: lineNum,
            issue: 'Button with async onClick missing toast notifications',
            severity: 'warning',
            code: line.trim()
          });
        }
      }

      // Check for console.log in button handlers
      if (line.includes('console.log') && content.includes('onClick')) {
        issues.push({
          file: filePath,
          line: lineNum,
          issue: 'Button handler uses console.log instead of logger',
          severity: 'warning',
          code: line.trim()
        });
      }

      // Check for any type in error handlers
      if (line.includes('catch') && line.includes(': any')) {
        issues.push({
          file: filePath,
          line: lineNum,
          issue: 'Error handler uses any type instead of unknown',
          severity: 'warning',
          code: line.trim()
        });
      }
    });
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error);
  }
}

function scanDirectory(dir: string) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules, .git, dist, build
      if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry)) {
        scanDirectory(fullPath);
      }
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      if (fullPath.includes('src/')) {
        scanFile(fullPath);
      }
    }
  }
}

// Start scanning
console.log('🔍 Scanning all buttons across the site...\n');
scanDirectory(process.cwd());

// Generate report
const errors = issues.filter(i => i.severity === 'error');
const warnings = issues.filter(i => i.severity === 'warning');
const infos = issues.filter(i => i.severity === 'info');

console.log('📊 Button Audit Report\n');
console.log(`Total Issues: ${issues.length}`);
console.log(`  ❌ Errors: ${errors.length}`);
console.log(`  ⚠️  Warnings: ${warnings.length}`);
console.log(`  ℹ️  Info: ${infos.length}\n`);

if (errors.length > 0) {
  console.log('❌ CRITICAL ISSUES (Must Fix):\n');
  errors.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.file}:${issue.line}`);
    console.log(`   ${issue.issue}`);
    console.log(`   Code: ${issue.code.substring(0, 80)}...\n`);
  });
}

if (warnings.length > 0) {
  console.log('⚠️  WARNINGS (Should Fix):\n');
  warnings.slice(0, 20).forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.file}:${issue.line}`);
    console.log(`   ${issue.issue}\n`);
  });
  if (warnings.length > 20) {
    console.log(`... and ${warnings.length - 20} more warnings\n`);
  }
}

// Summary by file
const issuesByFile = new Map<string, ButtonIssue[]>();
issues.forEach(issue => {
  const fileIssues = issuesByFile.get(issue.file) || [];
  fileIssues.push(issue);
  issuesByFile.set(issue.file, fileIssues);
});

console.log('\n📁 Files with Most Issues:\n');
Array.from(issuesByFile.entries())
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 10)
  .forEach(([file, fileIssues]) => {
    console.log(`${file}: ${fileIssues.length} issues`);
  });

console.log(`\n✅ Scanned ${checkedFiles.size} files`);

