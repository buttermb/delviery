# ralph.ps1 — Ralph Wiggum autonomous loop for FloraIQ
# Usage: .\ralph.ps1
# Run from: C:\Users\Alex\Downloads\delviery-fresh
#
# Prerequisites:
#   1. Docker Desktop running (for Context-Engine)
#   2. ctx quickstart (indexes codebase, starts MCP services)
#   3. Claude Code installed with MCP endpoints configured

$ErrorActionPreference = "Continue"
$SPEC = "spec.md"
$PLAN = "implementation_plan.md"
$MAX_LOOPS = 150
$LOOP_COUNT = 0

# Check Context-Engine status
$env:PYTHONIOENCODING = "utf-8"
$ctxRunning = $false
try {
    $ctxOut = ctx status 2>&1 | Out-String
    if ($ctxOut -match "Running") {
        $ctxRunning = $true
        Write-Host "  Context-Engine: ACTIVE" -ForegroundColor Green
    } else {
        Write-Host "  Context-Engine: STOPPED (falling back to built-in search)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Context-Engine: NOT AVAILABLE" -ForegroundColor Yellow
}

Write-Host "=========================================" -ForegroundColor Yellow
Write-Host "  RALPH WIGGUM LOOP - FloraIQ Polish" -ForegroundColor Yellow
Write-Host "  142 tasks | Max iterations: $MAX_LOOPS" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Yellow

while ($LOOP_COUNT -lt $MAX_LOOPS) {
    $LOOP_COUNT++

    $REMAINING = (Select-String -Path $PLAN -Pattern "^\- \[ \]" -ErrorAction SilentlyContinue).Count

    if ($REMAINING -eq 0) {
        Write-Host "`n=========================================" -ForegroundColor Green
        Write-Host "  ALL TASKS COMPLETE!" -ForegroundColor Green
        Write-Host "  Total iterations: $LOOP_COUNT" -ForegroundColor Green
        Write-Host "=========================================" -ForegroundColor Green
        exit 0
    }

    Write-Host "`n=========================================" -ForegroundColor Cyan
    Write-Host "  Loop $LOOP_COUNT / $MAX_LOOPS | Tasks left: $REMAINING" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan

    # Build prompt — include Context-Engine instructions when available
    $CE_INSTRUCTIONS = ""
    if ($ctxRunning) {
        $CE_INSTRUCTIONS = @"

CONTEXT-ENGINE: MCP semantic search is available. When searching for code patterns, related files,
or understanding how modules connect, prefer using the Context-Engine MCP tools (repo_search,
search_callers_for, search_importers_for, symbol_graph) over Grep/Glob. Use Grep/Glob only for
exact string matches (like dead route literals). Use repo_search for understanding patterns and
finding related code across the codebase.
"@
    }

    $PROMPT = @"
You are working on the FloraIQ project in C:\Users\Alex\Downloads\delviery-fresh.
$CE_INSTRUCTIONS
STEP 1: Read spec.md for project rules, valid routes, dead routes, and usability audit findings.
STEP 2: Read implementation_plan.md for the task checklist.
STEP 3: Find the FIRST unchecked task (line starting with '- [ ]').
STEP 4: Complete that ONE task fully.
STEP 5: Run 'npx tsc --noEmit 2>&1 | head -30' to verify no TypeScript errors.
STEP 6: Mark task done: change '- [ ]' to '- [x]' in implementation_plan.md.
STEP 7: Git commit with descriptive message (stage only changed source files, not spec.md or implementation_plan.md).

If you cannot complete the task, mark it '- [SKIP]' with reason and move to next.

RULES:
- ONE task per iteration then STOP
- Do NOT modify App.tsx route definitions
- Check spec.md dead routes map for correct replacement paths
- Check spec.md usability findings for exact file locations and line numbers
- Commit after completing each task
- Use logger from @/lib/logger, never console.log
- Use @/ alias for all imports
- Always filter queries by tenant_id
"@

    $PROMPT | claude -p --dangerously-skip-permissions --model claude-opus-4-6

    Start-Sleep -Seconds 3
}

Write-Host "`n=========================================" -ForegroundColor Red
Write-Host "  MAX LOOPS REACHED ($MAX_LOOPS)" -ForegroundColor Red
Write-Host "  Check implementation_plan.md for status" -ForegroundColor Red
Write-Host "=========================================" -ForegroundColor Red
