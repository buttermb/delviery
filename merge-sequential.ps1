# Sequential merge script with conflict resolution
$ErrorActionPreference = "Continue"

# Get all ralphy branches
$branches = git for-each-ref --format='%(refname:short)' refs/heads/ralphy/

Write-Host "Found $($branches.Count) branches to merge" -ForegroundColor Cyan

$merged = 0
$failed = 0

foreach ($branch in $branches) {
    Write-Host "Merging: $branch" -ForegroundColor Yellow -NoNewline
    
    $result = git merge $branch --no-edit -X theirs 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $merged++
        Write-Host " [OK]" -ForegroundColor Green
    } else {
        # Check for conflicts
        $status = git status --porcelain | Select-String "^UU|^AA|^DD"
        if ($status) {
            Write-Host " [CONFLICT - resolving with theirs]" -ForegroundColor Yellow
            git checkout --theirs . 2>$null
            git add . 2>$null
            git commit -m "Merge $branch with conflict resolution" --no-edit 2>$null
            $merged++
        } else {
            Write-Host " [FAIL]" -ForegroundColor Red
            git merge --abort 2>$null
            $failed++
        }
    }
}

Write-Host "`n=== MERGE COMPLETE ===" -ForegroundColor Cyan
Write-Host "Merged: $merged" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if($failed -gt 0){"Red"}else{"Green"})
