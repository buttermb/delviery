## Ralph Wiggum R5 - FloraIQ Feature Build + Hardening
## 400 tasks | Overnight autonomous run
## Usage: powershell -ExecutionPolicy Bypass -File .\ralph-r5.ps1

$MAX_LOOPS = 450
$iteration = 0

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  RALPH WIGGUM R5 - FloraIQ" -ForegroundColor Cyan
Write-Host "  400 tasks | Max iterations: $MAX_LOOPS" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

while ($iteration -lt $MAX_LOOPS) {
    $iteration++

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

STEP 1: Read the task description carefully. Understand what file(s) to modify.
STEP 2: Open and read the target file(s).
STEP 3: Implement the fix exactly as described.
STEP 4: When CREATING new files: follow existing patterns in the codebase. Check similar files for imports, structure, and naming.
STEP 5: When DELETING files: grep -r "filename" src/ FIRST to find all imports. Remove every reference.
STEP 6: Run 'npx tsc --noEmit 2>&1 | head -40' to verify no NEW TypeScript errors.
STEP 7: If TS errors from YOUR changes, fix them before proceeding.
STEP 8: Mark task done: change '- [ ]' to '- [x]' in implementation_plan.md.
STEP 9: Git commit with message: fix: [short description]

CRITICAL RULES:
- ONE task per iteration then STOP
- Use logger from @/lib/logger — NEVER console.log
- Use @/ alias for ALL imports
- Use queryKeys factory from @/lib/queryKeys — NEVER inline query key strings
- Use toast from sonner — NEVER useToast from use-toast
- Use useTenantAdminAuth() for tenant context
- ALL Supabase queries MUST filter by tenant_id
- Forms use React Hook Form + Zod
- Mutations use useMutation + toast.success/toast.error + isPending
- Modals use useState<boolean> for open state
- Delete actions use ConfirmDeleteDialog
- If you cannot complete the task (missing DB table, circular dep), mark '- [SKIP]' with reason
- Commit ONLY changed source files
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

$finalDone = (Select-String '\- \[x\]' implementation_plan.md | Measure-Object).Count
$finalSkipped = (Select-String '\- \[SKIP\]' implementation_plan.md | Measure-Object).Count
$finalTotal = (Select-String '\- \[' implementation_plan.md | Measure-Object).Count
Write-Host ""
Write-Host "FINAL: $finalDone done, $finalSkipped skipped, $($finalTotal - $finalDone - $finalSkipped) remaining out of $finalTotal total" -ForegroundColor Cyan

Write-Host ""
Write-Host "Running final type check..." -ForegroundColor Yellow
npx tsc --noEmit 2>&1 | Select-Object -First 40
