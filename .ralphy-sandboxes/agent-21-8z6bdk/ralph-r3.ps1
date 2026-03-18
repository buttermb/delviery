# ralph-r3.ps1 — Ralph Wiggum Round 3 Master: Wire, Secure, Feature Flags, Polish
# Usage: powershell -ExecutionPolicy Bypass -File .\ralph-r3.ps1
# Run from: C:\Users\Alex\Downloads\delviery-fresh

$ErrorActionPreference = "Continue"
$SPEC = "spec.md"
$PLAN = "implementation_plan.md"
$MAX_LOOPS = 155
$LOOP_COUNT = 0

# Check Context-Engine
$env:PYTHONIOENCODING = "utf-8"
$ctxRunning = $false
try {
    $ctxOut = ctx status 2>&1 | Out-String
    if ($ctxOut -match "Running") {
        $ctxRunning = $true
        Write-Host "  Context-Engine: ACTIVE" -ForegroundColor Green
    } else {
        Write-Host "  Context-Engine: STOPPED (using built-in search)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Context-Engine: NOT AVAILABLE" -ForegroundColor Yellow
}

Write-Host "=========================================" -ForegroundColor Yellow
Write-Host "  RALPH WIGGUM R3 MASTER - FloraIQ" -ForegroundColor Yellow
Write-Host "  140 tasks | Max iterations: $MAX_LOOPS" -ForegroundColor Yellow
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

    $CE_INSTRUCTIONS = ""
    if ($ctxRunning) {
        $CE_INSTRUCTIONS = @"

CONTEXT-ENGINE: MCP semantic search available. Use repo_search for finding patterns,
search_callers_for and search_importers_for for tracing dependencies. Use Grep only for exact strings.
"@
    }

    $PROMPT = @"
You are working on the FloraIQ project in C:\Users\Alex\Downloads\delviery-fresh.
$CE_INSTRUCTIONS
STEP 1: Read spec.md for project rules, disconnected components, missing logic, security issues, and patterns.
STEP 2: Read implementation_plan.md for the task checklist.
STEP 3: Find the FIRST unchecked task (line starting with '- [ ]').
STEP 4: Complete that ONE task fully.

CRITICAL WIRING RULES:
- Before wiring a component, OPEN IT and READ its props interface. Do not guess prop names.
- If a component has TypeScript errors when imported, FIX the component first.
- Every new button needs: visibility conditions, disabled={isPending}, onClick handler.
- Every modal needs: open state, onOpenChange, onSuccess that invalidates queries + shows toast.
- Always check the component compiles after wiring: npx tsc --noEmit 2>&1 | head -30

STEP 5: Run 'npx tsc --noEmit 2>&1 | head -30' to verify no TypeScript errors.
STEP 6: Mark task done: change '- [ ]' to '- [x]' in implementation_plan.md.
STEP 7: Git commit with descriptive message (stage only changed source files, not spec.md or implementation_plan.md).

If you cannot complete the task (e.g. missing DB table, component doesn't exist), mark '- [SKIP]' with reason.

RULES:
- ONE task per iteration then STOP
- All Supabase queries MUST filter by tenant_id
- Use existing patterns: ConfirmDeleteDialog, CurrencyInput, useMutation+toast, isPending, RHF+Zod
- Use logger from @/lib/logger, never console.log
- Use @/ alias for all imports
- Commit after each task
"@

    $PROMPT | claude -p --dangerously-skip-permissions --model claude-opus-4-6

    Start-Sleep -Seconds 3
}

Write-Host "`n=========================================" -ForegroundColor Red
Write-Host "  MAX LOOPS REACHED ($MAX_LOOPS)" -ForegroundColor Red
Write-Host "  Check implementation_plan.md for status" -ForegroundColor Red
Write-Host "=========================================" -ForegroundColor Red
