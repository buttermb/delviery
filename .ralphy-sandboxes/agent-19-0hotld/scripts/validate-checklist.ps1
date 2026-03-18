# Pre-Launch Checklist Validator
# Validates the structure and completeness of PRE_LAUNCH_CHECKLIST.md

$ErrorActionPreference = "Stop"

$checklistPath = Join-Path (Get-Location) "PRE_LAUNCH_CHECKLIST.md"
if (-not (Test-Path $checklistPath)) {
    Write-Host "Error: PRE_LAUNCH_CHECKLIST.md not found at $checklistPath" -ForegroundColor Red
    exit 1
}
$content = Get-Content $checklistPath -Raw

Write-Host "`n📋 Pre-Launch Checklist Validation Report`n" -ForegroundColor Cyan
Write-Host ("═" * 60) -ForegroundColor Gray

# Statistics
$checkboxes = ([regex]::Matches($content, '- \[([ x])\]')).Count
$completedCheckboxes = ([regex]::Matches($content, '- \[x\]')).Count
$sections = ([regex]::Matches($content, '^## ')).Count
$routes = ([regex]::Matches($content, '`([\/:a-zA-Z0-9\-_]+)`')).Count
$edgeFunctions = ([regex]::Matches($content, '`([a-z\-]+)` edge function', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)).Count

Write-Host "`n📊 Statistics:" -ForegroundColor Yellow
Write-Host "  Total Checkboxes: $checkboxes"
$completionPercent = if ($checkboxes -gt 0) { [math]::Round(($completedCheckboxes / $checkboxes) * 100, 1) } else { 0 }
Write-Host "  Completed: $completedCheckboxes ($completionPercent%)"
Write-Host "  Sections: $sections"
Write-Host "  Routes Documented: $routes"
Write-Host "  Edge Functions Referenced: $edgeFunctions"

# Validation
$errors = @()
$warnings = @()

# Check for required elements
$requiredSections = @(
    "Infrastructure & Environment",
    "Authentication & Authorization",
    "Marketing & Public Pages",
    "Super Admin Panel",
    "Tenant Admin Features",
    "Customer Portal",
    "Courier Portal",
    "Big Plug CRM",
    "Disposable Menu System",
    "Security & Compliance",
    "Edge Functions",
    "Subscription & Billing",
    "Performance & Infrastructure",
    "Testing & Quality",
    "Documentation"
)

foreach ($section in $requiredSections) {
    if ($content -notmatch [regex]::Escape($section)) {
        $errors += "Missing required section: $section"
    }
}

# Check for key sections
if ($content -notmatch "Launch Readiness Scorecard") {
    $errors += "Missing Launch Readiness Scorecard"
}

if ($content -notmatch "Quick Reference: All Routes") {
    $errors += "Missing Quick Reference section"
}

if ($content -notmatch "Feature Tier Mapping") {
    $errors += "Missing Feature Tier Mapping"
}

if ($content -notmatch "Critical Path Testing Scenarios") {
    $errors += "Missing Critical Path Testing Scenarios"
}

# Warnings
if ($completedCheckboxes -eq 0) {
    $warnings += "No checkboxes are marked as complete"
}

if ($checkboxes -lt 500) {
    $warnings += "Low checkbox count: $checkboxes (expected 500+)"
}

if ($sections -lt 15) {
    $warnings += "Low section count: $sections (expected 15+)"
}

# Print errors
if ($errors.Count -gt 0) {
    Write-Host "`n❌ Errors:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  - $error" -ForegroundColor Red
    }
}

# Print warnings
if ($warnings.Count -gt 0) {
    Write-Host "`n⚠️  Warnings:" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  - $warning" -ForegroundColor Yellow
    }
}

# Overall status
Write-Host "`n" + ("═" * 60) -ForegroundColor Gray
if ($errors.Count -eq 0) {
    Write-Host "`n✅ Checklist structure is valid!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n❌ Checklist has issues that need to be fixed." -ForegroundColor Red
    exit 1
}

