# Merge all ralphy worktrees from the recent run into main

$ErrorActionPreference = "Continue"
$mainDir = "C:\Users\Alex\Downloads\delviery-main"
$worktreeDir = "$mainDir\.ralphy-worktrees"

# Get all worktrees from the recent run (timestamps 176965* and 176966*)
$recentWorktrees = Get-ChildItem -Path $worktreeDir -Directory | Where-Object {
    $_.Name -match "agent-\d+-176965|agent-\d+-176966"
}

Write-Host "Found $($recentWorktrees.Count) worktrees from recent run" -ForegroundColor Cyan

# First, commit any uncommitted changes in batch 5 worktrees (1769660868*)
$batch5Worktrees = $recentWorktrees | Where-Object { $_.Name -match "1769660868" }
Write-Host "`nProcessing $($batch5Worktrees.Count) batch 5 worktrees with potential uncommitted changes..." -ForegroundColor Yellow

foreach ($wt in $batch5Worktrees) {
    Push-Location $wt.FullName
    $status = git status --porcelain
    if ($status) {
        Write-Host "Committing changes in $($wt.Name)..." -ForegroundColor Green
        git add -A
        $branchName = git rev-parse --abbrev-ref HEAD
        $taskDesc = $branchName -replace "^ralphy/agent-\d+-\d+-\w+-", "" -replace "-", " "
        git commit -m "feat: $taskDesc (batch 5 recovery)" --no-verify 2>$null
    }
    Pop-Location
}

# Now merge all worktrees into main
Write-Host "`nMerging all worktrees into main..." -ForegroundColor Cyan
Push-Location $mainDir

# Fetch latest
git fetch origin

$merged = 0
$failed = @()

foreach ($wt in $recentWorktrees) {
    $branchName = git -C $wt.FullName rev-parse --abbrev-ref HEAD 2>$null
    if ($branchName -and $branchName -ne "HEAD") {
        Write-Host "Merging $branchName..." -ForegroundColor Gray
        $result = git merge $branchName --no-edit -m "Merge $branchName" 2>&1
        if ($LASTEXITCODE -eq 0) {
            $merged++
        } else {
            # Try to abort and continue
            git merge --abort 2>$null
            $failed += $branchName
            Write-Host "  Failed to merge $branchName - conflict" -ForegroundColor Red
        }
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Successfully merged: $merged" -ForegroundColor Green
if ($failed.Count -gt 0) {
    Write-Host "Failed to merge: $($failed.Count)" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}

Pop-Location
Write-Host "`nDone! Run 'git push origin main' to push changes." -ForegroundColor Green
