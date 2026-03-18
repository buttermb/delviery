#!/usr/bin/env node

/**
 * create-storefront-beads.js
 *
 * Reads floraiq-storefront-launch-400.yaml, parses 400 tasks across 14 phases,
 * creates epics (one per phase) and child beads using the `bd` CLI,
 * and sets up sequential dependencies within each phase.
 *
 * Usage:
 *   node create-storefront-beads.js              # Run for real
 *   node create-storefront-beads.js --dry-run    # Preview without creating
 */

import { spawnSync } from 'child_process';
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
const YAML_PATH = path.join(`C:${path.sep}Users`, 'Alex', 'Downloads', 'floraiq-storefront-launch-400.yaml');
const MAPPING_PATH = path.join(__dirname, 'storefront-bead-mapping.json');

const QUALITY_GATES = [
  '`npx tsc --noEmit` passes',
  'No `console.log` statements (use logger from @/lib/logger)',
  'All Supabase queries filter by `tenant_id`',
];

// ---------------------------------------------------------------------------
// Phase definitions — derived from YAML comments
// ---------------------------------------------------------------------------

const PHASE_DEFS = [
  { num: 1,  title: 'Build Health & Compilation',   regex: /^# PHASE 1:/m },
  { num: 2,  title: 'Admin Builder',                regex: /^# PHASE 2:/m },
  { num: 3,  title: 'Customer Shopping Experience',  regex: /^# PHASE 3:/m },
  { num: 4,  title: 'Admin Order Management',        regex: /^# PHASE 4:/m },
  { num: 5,  title: 'Edge Cases & Validation',       regex: /^# PHASE 5:/m },
  { num: 6,  title: 'Mobile Responsiveness',          regex: /^# PHASE 6:/m },
  { num: 7,  title: 'Security',                       regex: /^# PHASE 7:/m },
  { num: 8,  title: 'Performance',                    regex: /^# PHASE 8:/m },
  { num: 9,  title: 'Accessibility',                  regex: /^# PHASE 9:/m },
  { num: 10, title: 'Visual Polish',                  regex: /^# PHASE 10:/m },
  { num: 11, title: 'Admin UX Improvements',          regex: /^# PHASE 11:/m },
  { num: 12, title: 'Integration & Flow Testing',     regex: /^# PHASE 12:/m },
  { num: 13, title: 'Edge Function Verification',     regex: /^# PHASE 13:/m },
  { num: 14, title: 'Final Polish & Testing',         regex: /^# PHASE 14:/m },
];

// ---------------------------------------------------------------------------
// YAML Parser (regex-based, no library needed)
// ---------------------------------------------------------------------------

/**
 * Parse the YAML file into an array of task objects.
 * Each task has: { id, title, priority, description }
 */
function parseTasks(yamlContent) {
  const tasks = [];
  const lines = yamlContent.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Look for task start: "  - id: task-NNN"
    const idMatch = line.match(/^\s+-\s+id:\s+(task-\d+)\s*$/);
    if (!idMatch) {
      i++;
      continue;
    }

    const task = { id: idMatch[1], title: '', priority: '', description: '' };

    i++;

    // Parse title
    if (i < lines.length) {
      const titleMatch = lines[i].match(/^\s+title:\s+"(.+)"\s*$/);
      if (titleMatch) {
        task.title = titleMatch[1];
        i++;
      }
    }

    // Parse priority
    if (i < lines.length) {
      const prioMatch = lines[i].match(/^\s+priority:\s+(\S+)\s*$/);
      if (prioMatch) {
        task.priority = prioMatch[1];
        i++;
      }
    }

    // Parse description — can be multi-line (block scalar with |) or single-line
    if (i < lines.length) {
      const descLineRaw = lines[i];
      const blockMatch = descLineRaw.match(/^\s+description:\s*\|\s*$/);
      const inlineMatch = descLineRaw.match(/^\s+description:\s*(.+)\s*$/);

      if (blockMatch) {
        // Multi-line block scalar: collect indented lines
        i++;
        const descLines = [];
        while (i < lines.length) {
          const nextLine = lines[i];
          // Block scalar ends when we hit a line that is:
          // - a new task (  - id:)
          // - a new top-level key at same or less indentation
          // - a comment line at phase level (  # PHASE or # ──)
          // - an empty line followed by a non-indented-enough line
          //
          // Simple heuristic: lines in the block are indented >= 6 spaces
          // or are empty (blank lines within the block)
          if (nextLine.match(/^\s+-\s+id:/) || nextLine.match(/^\s+#\s*(PHASE|──|═)/)) {
            break;
          }
          // Check if this is a new YAML key at task level (4 spaces + key:)
          // but NOT part of the description block (6+ spaces)
          if (nextLine.match(/^\s{4}\S/) && !nextLine.match(/^\s{6}/)) {
            break;
          }
          // Blank line or content line — include it
          if (nextLine.trim() === '') {
            descLines.push('');
          } else {
            // Strip the leading indentation (typically 6 spaces)
            descLines.push(nextLine.replace(/^\s{6}/, ''));
          }
          i++;
        }
        // Trim trailing empty lines
        while (descLines.length > 0 && descLines[descLines.length - 1] === '') {
          descLines.pop();
        }
        task.description = descLines.join('\n');
      } else if (inlineMatch) {
        // Single-line description
        task.description = inlineMatch[1].trim();
        i++;
      } else {
        i++;
      }
    }

    tasks.push(task);
  }

  return tasks;
}

/**
 * Determine which phase a task belongs to based on its numeric ID.
 * We parse the PHASE comment ranges from the YAML to build the mapping.
 */
function assignPhases(yamlContent, tasks) {
  // Extract phase ranges from the YAML comments
  // Format: "# PHASE N: TITLE (Tasks X-Y)"
  const phaseRanges = [];
  const phaseRegex = /# PHASE (\d+):[^(]+\(Tasks (\d+)-(\d+)\)/g;
  let match;
  while ((match = phaseRegex.exec(yamlContent)) !== null) {
    phaseRanges.push({
      num: parseInt(match[1], 10),
      from: parseInt(match[2], 10),
      to: parseInt(match[3], 10),
    });
  }

  // Note: phases can have overlapping ranges (e.g., Phase 4: 141-185, Phase 5: 178-230)
  // We assign each task to the LAST phase whose range includes it,
  // but actually the tasks appear in order in the YAML, so we should assign based on
  // where the task appears relative to the phase headers.
  //
  // Better approach: find which phase comment appears before each task in the YAML.
  // We'll do this by finding the line numbers of phase headers and task IDs.

  const lines = yamlContent.split('\n');
  const phaseLines = []; // { num, lineIdx }
  const taskLines = [];  // { id, lineIdx }

  for (let i = 0; i < lines.length; i++) {
    const phaseMatch = lines[i].match(/# PHASE (\d+):/);
    if (phaseMatch) {
      phaseLines.push({ num: parseInt(phaseMatch[1], 10), lineIdx: i });
    }
    const taskMatch = lines[i].match(/^\s+-\s+id:\s+(task-\d+)/);
    if (taskMatch) {
      taskLines.push({ id: taskMatch[1], lineIdx: i });
    }
  }

  // For each task, find the last phase header that appears before it
  const taskPhaseMap = new Map();
  for (const tl of taskLines) {
    let assignedPhase = 1; // default
    for (const pl of phaseLines) {
      if (pl.lineIdx < tl.lineIdx) {
        assignedPhase = pl.num;
      } else {
        break;
      }
    }
    taskPhaseMap.set(tl.id, assignedPhase);
  }

  // Group tasks by phase
  const phaseGroups = new Map();
  for (const task of tasks) {
    const phaseNum = taskPhaseMap.get(task.id) ?? 1;
    if (!phaseGroups.has(phaseNum)) phaseGroups.set(phaseNum, []);
    phaseGroups.get(phaseNum).push(task);
  }

  return phaseGroups;
}

// ---------------------------------------------------------------------------
// BD helpers (same pattern as create-beads.js)
// ---------------------------------------------------------------------------

/**
 * Write text to a temp file for --body-file usage.
 */
function makeTempDescriptionFile(text) {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `bd-desc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`);
  fs.writeFileSync(tmpFile, text, 'utf8');
  return tmpFile;
}

/**
 * Run a bd command using spawnSync to avoid Windows shell escaping issues.
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
// Build full description with quality gates
// ---------------------------------------------------------------------------

function buildFullDescription(task) {
  const parts = [];
  parts.push(task.description);
  parts.push('');
  parts.push('## Quality Gates');
  QUALITY_GATES.forEach(g => parts.push(`- [ ] ${g}`));
  parts.push('');
  parts.push(`_Source: floraiq-storefront-launch-400.yaml ${task.id}_`);
  return parts.join('\n');
}

/**
 * Map YAML priority (P0/P1/P2) to bd numeric priority.
 */
function priorityFromYaml(prio) {
  switch (prio) {
    case 'P0': return 1;
    case 'P1': return 2;
    case 'P2': return 3;
    default: return 2;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('='.repeat(70));
  console.log('FloraIQ Storefront — Create Beads from 400-Task YAML');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(70));

  // Read YAML
  if (!fs.existsSync(YAML_PATH)) {
    console.error(`YAML file not found: ${YAML_PATH}`);
    process.exit(1);
  }
  const yamlContent = fs.readFileSync(YAML_PATH, 'utf8');
  console.log(`\nRead YAML: ${YAML_PATH}`);

  // Parse tasks
  const tasks = parseTasks(yamlContent);
  console.log(`Parsed ${tasks.length} tasks\n`);

  if (tasks.length === 0) {
    console.error('No tasks found. Check YAML format.');
    process.exit(1);
  }

  // Group by phase
  const phaseGroups = assignPhases(yamlContent, tasks);

  // Report
  console.log('Phase breakdown:');
  for (const phaseDef of PHASE_DEFS) {
    const phaseTasks = phaseGroups.get(phaseDef.num) ?? [];
    console.log(`  Phase ${String(phaseDef.num).padStart(2)}: ${phaseDef.title} — ${phaseTasks.length} tasks`);
  }
  console.log('');

  // ---------------------------------------------------------------------------
  // Resume support: load existing mapping if present
  // ---------------------------------------------------------------------------

  let existingMapping = null;
  if (fs.existsSync(MAPPING_PATH) && !DRY_RUN) {
    try {
      existingMapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
      if (existingMapping.dryRun) existingMapping = null; // ignore dry-run mappings
    } catch (_) { /* ignore corrupt file */ }
  }

  const beadMap = new Map();  // task.id -> bead ID
  const epicMap = new Map();  // phase num -> epic bead ID
  let depsCreated = 0;
  let skippedExisting = 0;

  // Restore previous mappings for resume
  if (existingMapping) {
    if (existingMapping.epics) {
      for (const [k, v] of Object.entries(existingMapping.epics)) {
        epicMap.set(parseInt(k, 10), v);
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
    fs.writeFileSync(MAPPING_PATH, JSON.stringify(mapping, null, 2), 'utf8');
  }

  // Process each phase
  for (const phaseDef of PHASE_DEFS) {
    const phaseTasks = phaseGroups.get(phaseDef.num);
    if (!phaseTasks || phaseTasks.length === 0) continue;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Phase ${phaseDef.num}: ${phaseDef.title} (${phaseTasks.length} tasks)`);
    console.log(`${'─'.repeat(60)}`);

    // Create the epic (or reuse existing)
    let epicId = epicMap.get(phaseDef.num);
    if (epicId) {
      console.log(`  [RESUME] Epic already exists: ${epicId}`);
    } else {
      epicId = bdCreate({
        type: 'epic',
        title: `Storefront: ${phaseDef.title}`,
        description: `Phase ${phaseDef.num} of FloraIQ Storefront Launch Sprint — ${phaseDef.title}. Contains ${phaseTasks.length} tasks.`,
        labels: 'storefront,floraiq,feature',
      });
      epicMap.set(phaseDef.num, epicId);
    }

    // Create beads for each task and track IDs for dependency chaining
    const phaseBeadIds = []; // ordered list of bead IDs in this phase

    for (const task of phaseTasks) {
      const priority = priorityFromYaml(task.priority);

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
          labels: 'storefront,floraiq',
          priority,
          parent: epicId,
        });
        beadMap.set(task.id, beadId);
      }

      phaseBeadIds.push(beadId);
    }

    // Set up sequential dependencies within the phase:
    // task N+1 depends on task N (linear chain)
    for (let i = 1; i < phaseBeadIds.length; i++) {
      const childId = phaseBeadIds[i];
      const depId = phaseBeadIds[i - 1];
      bdDepAdd(childId, depId);
      depsCreated++;
    }

    // Save after each phase for crash recovery
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
  console.log(`Mapping written to: ${MAPPING_PATH}`);
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
