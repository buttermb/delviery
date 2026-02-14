# Cherry-pick commits from failed merges
$ErrorActionPreference = "Continue"
$mainDir = "C:\Users\Alex\Downloads\delviery-main"
$worktreeDir = "$mainDir\.ralphy-worktrees"

Push-Location $mainDir

$failedWorktrees = @(
    "agent-100-1769660868136-hsh9nw",
    "agent-75-1769660191480-zb7q6d",
    "agent-86-1769660868133-4s3gha",
    "agent-87-1769660868134-is5ctc",
    "agent-88-1769660868134-a0eu5y",
    "agent-89-1769660868134-vdfo59",
    "agent-90-1769660868134-cmwk25",
    "agent-91-1769660868134-e0d13f",
    "agent-92-1769660868134-xiyo6g",
    "agent-93-1769660868134-x0kfrl",
    "agent-94-1769660868135-lrppit",
    "agent-95-1769660868135-o0mvfb",
    "agent-96-1769660868135-d8ofp7",
    "agent-97-1769660868135-h9erop",
    "agent-98-1769660868135-4gnj9b",
    "agent-99-1769660868135-i908gu"
)

$picked = 0
$failed = @()

foreach ($wtName in $failedWorktrees) {
    $wtPath = Join-Path $worktreeDir $wtName
    if (-not (Test-Path $wtPath)) {
        Write-Host "Worktree not found: $wtName" -ForegroundColor Yellow
        continue
    }

    # Get the latest commit hash
    $commitHash = git -C $wtPath rev-parse HEAD 2>$null
    if (-not $commitHash) {
        continue
    }

    Write-Host "Cherry-picking from $wtName ($commitHash)..." -ForegroundColor Gray

    # Try to cherry-pick
    $result = git cherry-pick $commitHash -X theirs --no-commit 2>&1

    if ($LASTEXITCODE -eq 0) {
        # Commit the changes
        $commitMsg = git -C $wtPath log --format=%s -1
        git commit -m "$commitMsg" --no-verify 2>$null
        if ($LASTEXITCODE -eq 0) {
            $picked++
            Write-Host "  Cherry-picked successfully" -ForegroundColor Green
        } else {
            # Nothing to commit - may already have been applied
            git cherry-pick --abort 2>$null
            Write-Host "  Nothing to cherry-pick (may be duplicate)" -ForegroundColor Yellow
        }
    } else {
        # Check if there are conflicts to resolve
        $status = git status --porcelain
        if ($status) {
            # Auto-resolve with theirs
            git checkout --theirs . 2>$null
            git add -A 2>$null
            $commitMsg = git -C $wtPath log --format=%s -1
            git commit -m "$commitMsg (auto-resolved)" --no-verify 2>$null
            if ($LASTEXITCODE -eq 0) {
                $picked++
                Write-Host "  Cherry-picked with auto-resolution" -ForegroundColor Yellow
            } else {
                git cherry-pick --abort 2>$null
                $failed += $wtName
                Write-Host "  Failed to cherry-pick" -ForegroundColor Red
            }
        } else {
            git cherry-pick --abort 2>$null
            $failed += $wtName
            Write-Host "  Failed to cherry-pick" -ForegroundColor Red
        }
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Successfully cherry-picked: $picked" -ForegroundColor Green
if ($failed.Count -gt 0) {
    Write-Host "Failed: $($failed.Count)" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "  - $_" }
}

Pop-Location
