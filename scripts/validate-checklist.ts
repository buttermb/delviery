#!/usr/bin/env tsx
/**
 * Pre-Launch Checklist Validator
 * Validates the structure and completeness of PRE_LAUNCH_CHECKLIST.md
 * 
 * Usage: tsx scripts/validate-checklist.ts
 * 
 * Note: This script uses Node.js built-in modules. Type checking may show errors
 * in IDE but the script runs correctly with tsx which handles Node.js types.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalCheckboxes: number;
    completedCheckboxes: number;
    sections: number;
    routes: number;
    edgeFunctions: number;
  };
}

function validateChecklist(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      totalCheckboxes: 0,
      completedCheckboxes: 0,
      sections: 0,
      routes: 0,
      edgeFunctions: 0,
    },
  };

  try {
    const filePath = join(process.cwd(), 'PRE_LAUNCH_CHECKLIST.md');
    const content = readFileSync(filePath, 'utf-8');

    // Count checkboxes
    const checkboxPattern = /^- \[([ x])\]/gm;
    const checkboxes = content.match(checkboxPattern) || [];
    result.stats.totalCheckboxes = checkboxes.length;
    result.stats.completedCheckboxes = checkboxes.filter((cb) => cb.includes('x')).length;

    // Count sections (## headings)
    const sectionPattern = /^## /gm;
    const sections = content.match(sectionPattern) || [];
    result.stats.sections = sections.length;

    // Count routes (paths with /)
    const routePattern = /`([\/:a-zA-Z0-9\-_]+)`/g;
    const routes = content.match(routePattern) || [];
    result.stats.routes = routes.length;

    // Count edge functions (edge function references)
    const edgeFunctionPattern = /`([a-z\-]+)` edge function/gi;
    const edgeFunctions = content.match(edgeFunctionPattern) || [];
    result.stats.edgeFunctions = edgeFunctions.length;

    // Validate structure
    if (!content.includes('# 🚀 Pre-Launch Feature Verification Checklist')) {
      result.errors.push('Missing main title');
      result.valid = false;
    }

    if (!content.includes('Launch Readiness Scorecard')) {
      result.errors.push('Missing Launch Readiness Scorecard');
      result.valid = false;
    }

    if (!content.includes('Quick Reference: All Routes')) {
      result.errors.push('Missing Quick Reference section');
      result.valid = false;
    }

    if (!content.includes('Feature Tier Mapping')) {
      result.errors.push('Missing Feature Tier Mapping');
      result.valid = false;
    }

    if (!content.includes('Critical Path Testing Scenarios')) {
      result.errors.push('Missing Critical Path Testing Scenarios');
      result.valid = false;
    }

    // Check for required sections
    const requiredSections = [
      'Infrastructure & Environment',
      'Authentication & Authorization',
      'Marketing & Public Pages',
      'Super Admin Panel',
      'Tenant Admin Features',
      'Customer Portal',
      'Courier Portal',
      'Big Plug CRM',
      'Disposable Menu System',
      'Security & Compliance',
      'Edge Functions',
      'Subscription & Billing',
      'Performance & Infrastructure',
      'Testing & Quality',
      'Documentation',
    ];

    for (const section of requiredSections) {
      if (!content.includes(section)) {
        result.errors.push(`Missing required section: ${section}`);
        result.valid = false;
      }
    }

    // Warnings
    if (result.stats.completedCheckboxes === 0) {
      result.warnings.push('No checkboxes are marked as complete');
    }

    if (result.stats.totalCheckboxes < 500) {
      result.warnings.push(`Low checkbox count: ${result.stats.totalCheckboxes} (expected 500+)`);
    }

    if (result.stats.sections < 15) {
      result.warnings.push(`Low section count: ${result.stats.sections} (expected 15+)`);
    }

    // Check for empty sections
    const emptySectionPattern = /^## .+\n\n### .+\n\n- \[ \] No items/gm;
    if (emptySectionPattern.test(content)) {
      result.warnings.push('Some sections appear to be empty');
    }

  } catch (error) {
    result.valid = false;
    result.errors.push(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

function printReport(result: ValidationResult): void {
  console.log('\n📋 Pre-Launch Checklist Validation Report\n');
  console.log('═'.repeat(60));

  // Statistics
  console.log('\n📊 Statistics:');
  console.log(`  Total Checkboxes: ${result.stats.totalCheckboxes}`);
  console.log(`  Completed: ${result.stats.completedCheckboxes} (${((result.stats.completedCheckboxes / result.stats.totalCheckboxes) * 100).toFixed(1)}%)`);
  console.log(`  Sections: ${result.stats.sections}`);
  console.log(`  Routes Documented: ${result.stats.routes}`);
  console.log(`  Edge Functions Referenced: ${result.stats.edgeFunctions}`);

  // Errors
  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach((error) => {
      console.log(`  - ${error}`);
    });
  }

  // Warnings
  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    result.warnings.forEach((warning) => {
      console.log(`  - ${warning}`);
    });
  }

  // Overall status
  console.log('\n' + '═'.repeat(60));
  if (result.valid && result.errors.length === 0) {
    console.log('\n✅ Checklist structure is valid!');
  } else {
    console.log('\n❌ Checklist has issues that need to be fixed.');
  }
  console.log('═'.repeat(60) + '\n');
}

// Main execution
const result = validateChecklist();
printReport(result);
process.exit(result.valid ? 0 : 1);

export { validateChecklist, printReport };

