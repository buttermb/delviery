#!/usr/bin/env node

/**
 * create-beads.js
 *
 * Reads prd.json, categorizes remaining tasks into epic groups,
 * creates epics and child beads using the `bd` CLI, and sets up
 * intra-epic dependencies (migrations -> hooks -> UI -> analytics).
 *
 * Usage:
 *   node create-beads.js              # Run for real
 *   node create-beads.js --dry-run    # Preview without creating
 */

import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');
const PRD_PATH = path.join(__dirname, 'prd.json');

const QUALITY_GATES = [
  '`npx tsc --noEmit` passes',
  'No `console.log` statements (use logger from @/lib/logger)',
  'All Supabase queries filter by `tenant_id`',
  'Loading and error states included',
  'Proper imports with `@/` alias',
];

const UI_QUALITY_GATE = 'Component renders without errors';

// ---------------------------------------------------------------------------
// Epic definitions — order matters for cross-epic deps
// ---------------------------------------------------------------------------

const EPIC_DEFS = [
  {
    key: 'delivery',
    title: 'Delivery Management',
    description: 'Delivery zones, scheduling, fee calculation, batch creation, ETAs, cost tracking, ratings, analytics, and exception handling.',
    match: (t) => matchIds(t, 211, 221),
  },
  {
    key: 'analytics',
    title: 'Analytics & Reporting',
    description: 'Unified analytics dashboard, revenue/product/customer/sales/inventory/delivery/vendor/financial analytics, custom report builder, date range context, data export, real-time ticker, cohort analysis, goal tracking, comparison tools, drill-down, alerts, and analytics API.',
    match: (t) => matchIds(t, 222, 241),
  },
  {
    key: 'settings',
    title: 'Tenant Settings & Configuration',
    description: 'Settings hub, business profile, order/inventory/delivery/notification settings, user/role management, permission matrix, compliance settings, tax config, integrations settings, branding, system health, and feature flags.',
    match: (t) => matchIds(t, 242, 261),
  },
  {
    key: 'platform',
    title: 'Platform & Admin Tools',
    description: 'Unified search, recent activity, quick create, link resolver, keyboard shortcuts, onboarding wizard, health checker, data validator, widget customization, notification center, documentation, performance monitoring, smoke tests, help system, data migration, activity summary, responsive layout, PWA, dark mode, and verification checklist.',
    match: (t) => matchIds(t, 262, 281),
  },
  {
    key: 'payments',
    title: 'Payment Processing',
    description: 'Payment hub, detail page, recording on orders, refund workflow, method analytics, outstanding payments report, reconciliation, cash register/till, customer credit, loyalty points, vendor payments, notifications, tips, dashboard stats, split payments, export, invoices, and disputes.',
    match: (t) => matchIds(t, 282, 301),
  },
  {
    key: 'messaging',
    title: 'Messaging & Communications',
    description: 'Messaging hub, customer messaging from orders, broadcast system, templates, automated triggers, staff messaging, delivery runner messaging, feedback requests, analytics, SMS/email connectors, communication preferences, and scheduling.',
    match: (t) => matchIds(t, 302, 316),
  },
  {
    key: 'pos',
    title: 'Point of Sale (POS)',
    description: 'POS interface, product grid, cart, checkout, receipt printing, customer lookup, real-time inventory, daily summary, barcode scanning, discounts/promos, hold orders, favorites, multi-terminal, returns/exchanges, delivery handoff, analytics, offline mode, staff login, training mode, closeout, customer display, loyalty, and product modifiers.',
    match: (t) => matchIds(t, 317, 340),
  },
  {
    key: 'marketplace',
    title: 'B2B Marketplace',
    description: 'Marketplace landing page, product listings, order placement, vendor storefronts, search/discovery, price comparison, order tracking, buyer-vendor messaging, analytics, wishlists, compliance verification, bulk ordering, vendor ratings, saved vendors, and trending products.',
    match: (t) => matchIds(t, 341, 355),
  },
  {
    key: 'integrations',
    title: 'API & Integrations',
    description: 'API key management, REST APIs (orders/products/customers/inventory), webhook delivery/formatting/testing, API usage analytics, inbound webhooks, Zapier connector, API docs, data sync dashboard, CSV import queue, and external POS integration.',
    match: (t) => matchIds(t, 356, 370),
  },
  {
    key: 'mobile',
    title: 'Mobile Experience',
    description: 'Mobile admin dashboard, order creation, inventory scanner, customer lookup, delivery runner app, push notifications, product quick edit, report viewer, menu builder preview, staff time tracking, offline sync, camera integration, location services, quick actions, inter-module nav, data optimization, install prompt, accessibility, and feedback/support.',
    match: (t) => matchIds(t, 371, 390),
  },
  {
    key: 'crossmodule',
    title: 'Cross-Module & System-Wide',
    description: 'Universal entity links, cascade delete protection, data refresh orchestrator, onboarding checker, duplicate detection, audit trail viewer, data integrity checks, bulk action framework, entity timeline, dashboard personalization, report scheduler, environment migration, changelog, entity graph visualization, module switcher, error tracking, data migration tools, startup self-test, session tracking, and interconnectivity test suite.',
    match: (t) => matchIds(t, 391, 410),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchIds(task, from, to) {
  const num = parseInt(task.id.replace('task-', ''), 10);
  return num >= from && num <= to;
}

/**
 * Determine task tier for dependency ordering and priority:
 *   1 = schema/migration
 *   2 = backend/hooks/utilities
 *   3 = UI components/pages
 *   4 = analytics/polish/tests
 */
function classifyTier(task) {
  const title = task.title.toLowerCase();
  const desc = task.description.toLowerCase();
  const both = title + ' ' + desc;

  // Tier 1: Only actual Supabase migrations (match title, not description mentions)
  if (
    title.includes('supabase migration') ||
    title.includes('migration for') ||
    title.includes('migration table')
  ) {
    return 1;
  }

  // Tier 2: Backend hooks, utilities, context providers, APIs, connectors
  if (
    title.includes('hook') ||
    title.includes('utility') ||
    title.includes('context provider') ||
    title.includes('usefeatureflag') ||
    title.includes('connector') ||
    title.includes('rest api for') ||
    title.includes('edge function') ||
    title.includes('api key management') ||
    title.includes('webhook delivery') ||
    title.includes('webhook event') ||
    title.includes('inbound webhook') ||
    title.includes('data sync status') ||
    title.includes('csv/api import') ||
    both.includes('src/lib/') ||
    both.includes('src/hooks/')
  ) {
    return 2;
  }

  // Tier 4: Analytics, reports, tests, documentation, checklists
  if (
    title.includes('analytics') ||
    title.includes('report') ||
    title.includes('smoke test') ||
    title.includes('test suite') ||
    title.includes('checklist') ||
    title.includes('documentation') ||
    title.includes('self-test')
  ) {
    return 4;
  }

  // Default: UI component/page
  return 3;
}

function isUiTask(task) {
  const tier = classifyTier(task);
  return tier === 3 || tier === 4;
}

function priorityFromTier(tier) {
  // bd priority: 0=highest, 4=lowest. We use 1-4 matching our tiers.
  return tier;
}

/**
 * Escape a string for safe use as a CLI argument.
 * We write to a temp file and use --body-file to avoid shell escaping entirely.
 */
function makeTempDescriptionFile(text) {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `bd-desc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`);
  fs.writeFileSync(tmpFile, text, 'utf8');
  return tmpFile;
}

/**
 * Escape a string for safe use in a shell single-quoted argument.
 * Replace ' with '\'' (end quote, escaped quote, start quote).
 */
function shellEscape(str) {
  return str.replace(/'/g, "'\\''");
}

/**
 * Run a bd command using spawnSync to avoid Windows shell escaping issues.
 * @param {string[]} args - Array of arguments to pass to bd
 * @returns {string} stdout trimmed
 */
function bdRun(args, { silent = false, label = '' } = {}) {
  const displayCmd = `bd ${args.join(' ')}`;
  if (DRY_RUN) {
    console.log(`[DRY-RUN] ${label || displayCmd}`);
    return `dry-run-${Date.now().toString(36)}`;
  }
  const result = spawnSync('bd', args, {
    encoding: 'utf8',
    cwd: process.cwd(),
    timeout: 30_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const errMsg = (result.stderr || result.error?.message || 'unknown error').trim();
    console.error(`  [ERROR] Command failed: ${label || displayCmd}`);
    console.error(`  ${errMsg}`);
    throw new Error(errMsg);
  }
  const out = (result.stdout || '').trim();
  if (!silent) {
    const first = out.split('\n')[0];
    if (first) console.log(`  -> ${first}`);
  }
  return out;
}

/**
 * Create a bead and return its ID.
 */
function bdCreate({ type = 'task', title, description, labels, priority, parent }) {
  // Write description to temp file to avoid shell escaping nightmares
  const tmpFile = makeTempDescriptionFile(description);

  const args = [
    'create',
    '--type', type,
    '--title', title,
    '--body-file', tmpFile.replace(/\\/g, '/'),
  ];
  if (labels) args.push('--labels', labels);
  if (priority !== undefined) args.push('--priority', String(priority));
  if (parent) args.push('--parent', parent);
  args.push('--silent');

  try {
    const id = bdRun(args, { silent: true, label: `bd create --type=${type} "${title}"` });
    console.log(`  Created ${type}: ${id} — ${title}`);
    return id;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore */ }
  }
}

/**
 * Add a dependency: child depends on dep (dep blocks child).
 */
function bdDepAdd(childId, depId) {
  if (childId === depId) {
    console.log(`  [SKIP] Self-dep: ${childId} (would create cycle)`);
    return;
  }
  bdRun(['dep', 'add', childId, depId], { silent: true, label: `bd dep add ${childId} ${depId}` });
  console.log(`  Dep: ${childId} depends on ${depId}`);
}

// ---------------------------------------------------------------------------
// Build acceptance criteria
// ---------------------------------------------------------------------------

function buildAcceptanceCriteria(task) {
  const lines = [];

  // Extract key points from description as acceptance criteria
  const desc = task.description;
  // Pull out sentences that describe concrete deliverables
  const sentences = desc.split(/\.\s+/).filter(s => s.trim().length > 20);
  if (sentences.length > 0) {
    // Take up to 5 key sentences
    const key = sentences.slice(0, 5);
    key.forEach(s => {
      const clean = s.replace(/\.$/, '').trim();
      if (clean) lines.push(`- [ ] ${clean}`);
    });
  }

  lines.push('');
  lines.push('## Quality Gates');
  QUALITY_GATES.forEach(g => lines.push(`- [ ] ${g}`));
  if (isUiTask(task)) {
    lines.push(`- [ ] ${UI_QUALITY_GATE}`);
  }

  return lines.join('\n');
}

function buildFullDescription(task) {
  const parts = [];
  parts.push(task.description);
  parts.push('');
  parts.push('## Acceptance Criteria');
  parts.push(buildAcceptanceCriteria(task));
  parts.push('');
  parts.push(`_Source: prd.json ${task.id}_`);
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('='.repeat(70));
  console.log('FloraIQ — Create Beads from prd.json');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(70));

  // Load prd.json
  const prd = JSON.parse(fs.readFileSync(PRD_PATH, 'utf8'));
  const remaining = prd.filter(t => t.passes !== true);
  console.log(`\nTotal tasks: ${prd.length}, Remaining (passes !== true): ${remaining.length}\n`);

  if (remaining.length === 0) {
    console.log('All tasks pass. Nothing to create.');
    return;
  }

  // Categorize tasks into epics
  const epicTasks = new Map();
  const unmatched = [];

  for (const task of remaining) {
    let matched = false;
    for (const epic of EPIC_DEFS) {
      if (epic.match(task)) {
        if (!epicTasks.has(epic.key)) epicTasks.set(epic.key, []);
        epicTasks.get(epic.key).push(task);
        matched = true;
        break;
      }
    }
    if (!matched) {
      unmatched.push(task);
    }
  }

  // Report categorization
  console.log('Epic categorization:');
  for (const epic of EPIC_DEFS) {
    const tasks = epicTasks.get(epic.key) || [];
    console.log(`  ${epic.key}: ${tasks.length} tasks`);
  }
  if (unmatched.length > 0) {
    console.log(`  UNMATCHED: ${unmatched.length} tasks`);
    unmatched.forEach(t => console.log(`    - ${t.id}: ${t.title}`));
  }
  console.log('');

  // ---------------------------------------------------------------------------
  // Resume support: load existing mapping if present
  // ---------------------------------------------------------------------------
  const mappingPath = path.join(__dirname, 'bead-mapping.json');
  let existingMapping = null;
  if (fs.existsSync(mappingPath) && !DRY_RUN) {
    try {
      existingMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
      if (existingMapping.dryRun) existingMapping = null; // ignore dry-run mappings
    } catch (_) { /* ignore corrupt file */ }
  }

  const beadMap = new Map(); // task.id -> bead ID
  const epicMap = new Map(); // epic.key -> epic bead ID
  let depsCreated = 0;
  let skippedExisting = 0;

  // Restore previous mappings for resume
  if (existingMapping) {
    if (existingMapping.epics) {
      for (const [k, v] of Object.entries(existingMapping.epics)) {
        epicMap.set(k, v);
      }
    }
    if (existingMapping.beads) {
      for (const [k, v] of Object.entries(existingMapping.beads)) {
        beadMap.set(k, v);
      }
    }
    console.log(`Resuming: loaded ${epicMap.size} epics, ${beadMap.size} beads from previous run\n`);
  }

  // Helper to save mapping after each epic (crash recovery)
  function saveMapping() {
    const mapping = {
      createdAt: new Date().toISOString(),
      dryRun: DRY_RUN,
      epics: Object.fromEntries(epicMap),
      beads: Object.fromEntries(beadMap),
    };
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2), 'utf8');
  }

  // Process each epic
  for (const epicDef of EPIC_DEFS) {
    const tasks = epicTasks.get(epicDef.key);
    if (!tasks || tasks.length === 0) continue;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Epic: ${epicDef.title} (${tasks.length} tasks)`);
    console.log(`${'─'.repeat(60)}`);

    // Create the epic (or reuse existing)
    let epicId = epicMap.get(epicDef.key);
    if (epicId) {
      console.log(`  [RESUME] Epic already exists: ${epicId}`);
    } else {
      epicId = bdCreate({
        type: 'epic',
        title: `FloraIQ: ${epicDef.title}`,
        description: epicDef.description,
        labels: 'ralph,floraiq,feature',
      });
      epicMap.set(epicDef.key, epicId);
    }

    // Sort tasks by tier (migrations first, then hooks, then UI, then analytics)
    const sorted = [...tasks].sort((a, b) => classifyTier(a) - classifyTier(b));

    // Group by tier for dependency chaining
    const tiers = new Map(); // tier -> [{task, beadId}]

    for (const task of sorted) {
      const tier = classifyTier(task);
      const priority = priorityFromTier(tier);

      // Reuse existing bead if resuming
      let beadId = beadMap.get(task.id);
      if (beadId) {
        console.log(`  [RESUME] Bead exists: ${beadId} — ${task.id}`);
        skippedExisting++;
      } else {
        beadId = bdCreate({
          type: 'task',
          title: `${task.id}: ${task.title}`,
          description: buildFullDescription(task),
          labels: 'ralph,floraiq',
          priority,
          parent: epicId,
        });
        beadMap.set(task.id, beadId);
      }

      if (!tiers.has(tier)) tiers.set(tier, []);
      tiers.get(tier).push({ task, beadId });
    }

    // Set up intra-epic dependencies
    // Strategy: chain tiers so migrations -> hooks -> UI -> analytics.
    // To avoid O(n*m) dep explosion:
    //   - First task of current tier depends on ALL prev tier tasks (fan-in)
    //   - Remaining tasks of current tier depend on only the first prev tier task
    // This ensures the tier boundary is respected without creating hundreds of edges.
    const tierOrder = [1, 2, 3, 4];
    let prevTierBeads = [];
    const addedDeps = new Set(); // deduplicate "child:dep" pairs

    for (const tier of tierOrder) {
      const currentTier = tiers.get(tier);
      if (!currentTier) continue;

      if (prevTierBeads.length > 0) {
        for (let i = 0; i < currentTier.length; i++) {
          const current = currentTier[i];
          if (i === 0) {
            // First task in this tier depends on ALL prev tier tasks (fan-in point)
            for (const prev of prevTierBeads) {
              const key = `${current.beadId}:${prev.beadId}`;
              if (!addedDeps.has(key)) {
                bdDepAdd(current.beadId, prev.beadId);
                addedDeps.add(key);
                depsCreated++;
              }
            }
          } else {
            // Subsequent tasks depend on only the first prev tier task
            const prev = prevTierBeads[0];
            const key = `${current.beadId}:${prev.beadId}`;
            if (!addedDeps.has(key)) {
              bdDepAdd(current.beadId, prev.beadId);
              addedDeps.add(key);
              depsCreated++;
            }
          }
        }
      }

      prevTierBeads = currentTier;
    }

    // Save after each epic for crash recovery
    saveMapping();
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(70)}`);
  console.log(`Epics created: ${epicMap.size}`);
  console.log(`Beads created: ${beadMap.size} (${skippedExisting} resumed)`);
  console.log(`Dependencies created: ${depsCreated}`);
  console.log(`Total bd operations: ${epicMap.size + beadMap.size - skippedExisting + depsCreated}`);
  console.log('');

  // Final save
  saveMapping();
  console.log(`Mapping written to: ${mappingPath}`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

try {
  main();
} catch (err) {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
}
