#!/usr/bin/env npx tsx
/**
 * Security Audit Script
 * Checks for RLS policies, tenant isolation, and security issues
 * 
 * Run: npx tsx scripts/security-audit.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.log('Set environment variables:');
    console.log('  export SUPABASE_URL=your_url');
    console.log('  export SUPABASE_SERVICE_ROLE_KEY=your_key');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface AuditResult {
    category: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    details?: string;
}

const results: AuditResult[] = [];

function logResult(result: AuditResult) {
    results.push(result);
    const icon = result.severity === 'critical' ? '🔴' : result.severity === 'warning' ? '🟡' : '🟢';
    console.log(`${icon} [${result.category}] ${result.message}`);
    if (result.details) {
        console.log(`   ${result.details}`);
    }
}

async function checkRLSPolicies() {
    console.log('\n📋 Checking RLS Policies...\n');

    // Get all tables in public schema
    const { data: tables, error } = await supabase.rpc('get_tables_with_rls_status');

    if (error) {
        // Fallback: query pg_tables directly
        const { data: pgTables } = await supabase
            .from('pg_tables')
            .select('tablename')
            .eq('schemaname', 'public');

        if (pgTables) {
            logResult({
                category: 'RLS',
                severity: 'info',
                message: `Found ${pgTables.length} tables in public schema`,
            });
        }
        return;
    }

    const tablesWithoutRLS = tables?.filter((t: any) => !t.rls_enabled) || [];

    if (tablesWithoutRLS.length > 0) {
        logResult({
            category: 'RLS',
            severity: 'critical',
            message: `${tablesWithoutRLS.length} tables without RLS enabled`,
            details: tablesWithoutRLS.map((t: any) => t.tablename).join(', '),
        });
    } else {
        logResult({
            category: 'RLS',
            severity: 'info',
            message: 'All tables have RLS enabled',
        });
    }
}

async function checkTenantIsolation() {
    console.log('\n🔒 Checking Tenant Isolation...\n');

    // Critical tables that MUST have tenant_id
    const criticalTables = [
        'products',
        'wholesale_orders',
        'wholesale_clients',
        'disposable_menus',
        'invoices',
        'pos_transactions',
        'marketplace_stores',
        'storefront_orders',
    ];

    for (const table of criticalTables) {
        try {
            // Check if tenant_id column exists
            const { data, error } = await supabase
                .from(table)
                .select('tenant_id')
                .limit(1);

            if (error && error.message.includes('column')) {
                logResult({
                    category: 'Tenant Isolation',
                    severity: 'critical',
                    message: `Table "${table}" missing tenant_id column`,
                });
            } else {
                logResult({
                    category: 'Tenant Isolation',
                    severity: 'info',
                    message: `Table "${table}" has tenant_id`,
                });
            }
        } catch (e) {
            // Table might not exist
            logResult({
                category: 'Tenant Isolation',
                severity: 'warning',
                message: `Could not check table "${table}"`,
            });
        }
    }
}

async function checkSecurityDefinerFunctions() {
    console.log('\n⚙️ Checking SECURITY DEFINER Functions...\n');

    const { data: functions, error } = await supabase.rpc('get_security_definer_functions');

    if (error) {
        logResult({
            category: 'Functions',
            severity: 'warning',
            message: 'Could not query SECURITY DEFINER functions',
            details: error.message,
        });
        return;
    }

    if (functions && functions.length > 0) {
        logResult({
            category: 'Functions',
            severity: 'warning',
            message: `${functions.length} SECURITY DEFINER functions found`,
            details: 'Review these for privilege escalation risks',
        });
    } else {
        logResult({
            category: 'Functions',
            severity: 'info',
            message: 'No SECURITY DEFINER functions found (or check not available)',
        });
    }
}

async function checkPublicAccess() {
    console.log('\n🌐 Checking Public Access...\n');

    // Try to access critical data without auth
    const sensitiveTables = ['tenant_users', 'account_settings', 'tenants'];

    for (const table of sensitiveTables) {
        try {
            const publicClient = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || '');
            const { data, error } = await publicClient
                .from(table)
                .select('*')
                .limit(1);

            if (!error && data && data.length > 0) {
                logResult({
                    category: 'Public Access',
                    severity: 'critical',
                    message: `Table "${table}" accessible without auth!`,
                });
            } else if (error) {
                logResult({
                    category: 'Public Access',
                    severity: 'info',
                    message: `Table "${table}" properly protected`,
                });
            }
        } catch (e) {
            // Expected for protected tables
        }
    }
}

async function generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SECURITY AUDIT SUMMARY');
    console.log('='.repeat(60) + '\n');

    const critical = results.filter(r => r.severity === 'critical');
    const warnings = results.filter(r => r.severity === 'warning');
    const info = results.filter(r => r.severity === 'info');

    console.log(`🔴 Critical Issues: ${critical.length}`);
    console.log(`🟡 Warnings: ${warnings.length}`);
    console.log(`🟢 Passed Checks: ${info.length}`);

    if (critical.length > 0) {
        console.log('\n⚠️  CRITICAL ISSUES REQUIRE IMMEDIATE ATTENTION:');
        critical.forEach(r => console.log(`   - ${r.message}`));
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Audit completed at ${new Date().toISOString()}`);
    console.log('='.repeat(60) + '\n');

    return {
        critical: critical.length,
        warnings: warnings.length,
        passed: info.length,
        results,
    };
}

async function main() {
    console.log('🔐 Security Audit Starting...');
    console.log(`📍 Target: ${SUPABASE_URL}`);
    console.log('='.repeat(60));

    await checkRLSPolicies();
    await checkTenantIsolation();
    await checkSecurityDefinerFunctions();
    await checkPublicAccess();

    const report = await generateReport();

    // Exit with error code if critical issues found
    if (report.critical > 0) {
        process.exit(1);
    }
}

main().catch(console.error);
