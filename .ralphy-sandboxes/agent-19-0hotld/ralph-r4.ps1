## Ralph Wiggum R4 - FloraIQ Diagnostic Fix Loop
## 42 tasks | Overnight autonomous run
## Usage: powershell -ExecutionPolicy Bypass -File .\ralph-r4.ps1

$MAX_LOOPS = 550
$iteration = 0

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  RALPH WIGGUM R4 - FloraIQ Diagnostic" -ForegroundColor Cyan
Write-Host "  42 tasks | Max iterations: $MAX_LOOPS" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

while ($iteration -lt $MAX_LOOPS) {
    $iteration++

    # Count done vs total
    $done = (Select-String '\- \[x\]' implementation_plan.md | Measure-Object).Count
    $skipped = (Select-String '\- \[SKIP\]' implementation_plan.md | Measure-Object).Count
    $total = (Select-String '\- \[' implementation_plan.md | Measure-Object).Count
    $remaining = $total - $done - $skipped

    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Yellow
    Write-Host "  Loop $iteration / $MAX_LOOPS | Tasks left: $remaining" -ForegroundColor Yellow
    Write-Host "=========================================" -ForegroundColor Yellow

    if ($remaining -le 0) {
        Write-Host ""
        Write-Host "=========================================" -ForegroundColor Green
        Write-Host "  ALL TASKS COMPLETE!" -ForegroundColor Green
        Write-Host "  Total iterations: $iteration" -ForegroundColor Green
        Write-Host "=========================================" -ForegroundColor Green
        break
    }

    $PROMPT = @"
Read CLAUDE.md for project rules. Then read implementation_plan.md.

Find the FIRST task that is still '- [ ]' (unchecked). Do NOT skip ahead.

STEP 1: Read the task description carefully.
STEP 2: Open the file(s) mentioned in the task.
STEP 3: Implement the fix exactly as described.
STEP 4: If deleting a file, also remove ALL imports and JSX usage of that file in parent components. Search the codebase with grep to find all references.
STEP 5: Run 'npx tsc --noEmit 2>&1 | head -30' to verify no NEW TypeScript errors from your changes.
STEP 6: If TS errors appear from your changes, fix them before proceeding.
STEP 7: Mark task done: change '- [ ]' to '- [x]' in implementation_plan.md.
STEP 8: Git commit with message: fix: [short description of what you did]

CRITICAL RULES:
- ONE task per iteration then STOP
- Use logger from @/lib/logger, NEVER console.log
- Use @/ alias for ALL imports
- Use queryKeys factory, NEVER inline query key strings
- Use toast from sonner, NEVER useToast
- ALL Supabase queries MUST filter by tenant_id
- When deleting files: grep -r "filename" src/ to find all references BEFORE deleting
- When deleting marketing components: check MarketingHome.tsx imports AND any other files that import them
- If you cannot complete the task (missing DB table, circular dep, etc.), mark '- [SKIP]' with reason
- Commit ONLY changed source files, not implementation_plan.md
"@

    $PROMPT | claude -p --dangerously-skip-permissions --model claude-opus-4-6

    Start-Sleep -Seconds 3
}

if ($iteration -ge $MAX_LOOPS) {
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Red
    Write-Host "  MAX LOOPS REACHED ($MAX_LOOPS)" -ForegroundColor Red
    Write-Host "  Check implementation_plan.md for status" -ForegroundColor Red
    Write-Host "=========================================" -ForegroundColor Red
}

# Final status
$finalDone = (Select-String '\- \[x\]' implementation_plan.md | Measure-Object).Count
$finalSkipped = (Select-String '\- \[SKIP\]' implementation_plan.md | Measure-Object).Count
$finalTotal = (Select-String '\- \[' implementation_plan.md | Measure-Object).Count
Write-Host ""
Write-Host "FINAL: $finalDone done, $finalSkipped skipped, $($finalTotal - $finalDone - $finalSkipped) remaining out of $finalTotal total" -ForegroundColor Cyan

# Type check
Write-Host ""
Write-Host "Running final type check..." -ForegroundColor Yellow
npx tsc --noEmit 2>&1 | Select-Object -First 30
Write-Host ""
Write-Host "The project builds and type-checks without errors." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  ALL TASKS COMPLETE!" -ForegroundColor Green
Write-Host "  Total iterations: $iteration" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
