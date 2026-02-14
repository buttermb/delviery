## Ralph Wiggum Loop - Windows PowerShell Edition
## Each iteration = fresh Claude Code context (no context rot)
## Usage: .\ralph.ps1

$maxIterations = 420
$iteration = 0

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Ralph Wiggum Loop - FloraIQ Build" -ForegroundColor Cyan
Write-Host "  Max iterations: $maxIterations" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

while ($iteration -lt $maxIterations) {
    $iteration++
    
    # Check how many tasks are done
    $done = (Select-String '"passes": true' prd.json | Measure-Object).Count
    $total = (Select-String '"passes"' prd.json | Measure-Object).Count
    $remaining = $total - $done
    
    if ($remaining -eq 0) {
        Write-Host "" -ForegroundColor Green
        Write-Host "ALL $total TASKS COMPLETE!" -ForegroundColor Green
        Write-Host "" -ForegroundColor Green
        break
    }
    
    Write-Host "" -ForegroundColor Yellow
    Write-Host "--- Iteration $iteration / $maxIterations ---" -ForegroundColor Yellow
    Write-Host "--- Tasks: $done / $total done ($remaining remaining) ---" -ForegroundColor Yellow
    Write-Host "" -ForegroundColor Yellow
    
    # Run Claude Code headless with fresh context each time
    claude -p "Read CLAUDE.md for project rules. Then read prd.json and find the FIRST task where passes is false. Implement that ONE task completely. After implementing, mark it as passes: true in prd.json. Append what you learned to progress.txt. Commit with message: feat: [task title]. Only do ONE task then stop."
    
    # Brief pause between iterations
    Start-Sleep -Seconds 3
}

Write-Host "Ralph loop finished after $iteration iterations." -ForegroundColor Cyan
