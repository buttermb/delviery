# Merge all ralphy worktrees using cherry-pick strategy
$ErrorActionPreference = "Continue"
$mainDir = "C:\Users\Alex\Downloads\delviery-main"
$worktreeDir = "$mainDir\.ralphy-worktrees"

Push-Location $mainDir

# Get all worktrees from the recent run
$recentWorktrees = Get-ChildItem -Path $worktreeDir -Directory | Where-Object {
    $_.Name -match "agent-\d+-176965|agent-\d+-176966"
} | Sort-Object Name

Write-Host "Found $($recentWorktrees.Count) worktrees to process" -ForegroundColor Cyan

$merged = 0
$failed = @()
$alreadyMerged = 0

foreach ($wt in $recentWorktrees) {
    $branchName = git -C $wt.FullName rev-parse --abbrev-ref HEAD 2>$null
    if (-not $branchName -or $branchName -eq "HEAD") {
        continue
    }

    # Get the commit that has the actual feature work (not the merge commits)
    $commits = git -C $wt.FullName log --oneline main..$branchName --no-merges 2>$null

    if (-not $commits) {
        $alreadyMerged++
        continue
    }

    Write-Host "Processing $($wt.Name)..." -ForegroundColor Gray

    # Try merge with accepting incoming changes on conflict
    $result = git merge $branchName -X theirs --no-edit -m "Merge $branchName" 2>&1

    if ($LASTEXITCODE -eq 0) {
        $merged++
        Write-Host "  Merged successfully" -ForegroundColor Green
    } else {
        # Check if there's a real conflict or just already merged
        $mergeStatus = git status --porcelain
        if ($mergeStatus -match "^UU|^AA|^DD") {
            # Real conflict - try to auto-resolve by accepting theirs
            git checkout --theirs . 2>$null
            git add -A 2>$null
            $commitResult = git commit -m "Merge $branchName (auto-resolved)" --no-verify 2>&1
            if ($LASTEXITCODE -eq 0) {
                $merged++
                Write-Host "  Merged with auto-resolution" -ForegroundColor Yellow
            } else {
                git merge --abort 2>$null
                $failed += $branchName
                Write-Host "  Failed to merge" -ForegroundColor Red
            }
        } else {
            git merge --abort 2>$null
            $failed += $branchName
            Write-Host "  Failed to merge" -ForegroundColor Red
        }
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Successfully merged: $merged" -ForegroundColor Green
Write-Host "Already merged: $alreadyMerged" -ForegroundColor Gray
if ($failed.Count -gt 0) {
    Write-Host "Failed: $($failed.Count)" -ForegroundColor Red
}

Pop-Location
