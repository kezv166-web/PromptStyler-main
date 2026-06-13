# PromptStyler Build Script
# Creates a clean zip for Chrome Web Store submission
# Excludes dev files that are only needed on GitHub

$extensionName = "PromptStyler-v1.4"
$outputZip = "$extensionName.zip"

# Files/folders to include in the CWS package
$includeFiles = @(
    "manifest.json",
    "popup.html",
    "popup.js",
    "popup.css",
    "content.js",
    "background.js",
    "options.html",
    "options.js",
    "icons",
    "shared"
)

# Clean previous build
if (Test-Path $outputZip) { Remove-Item $outputZip }
if (Test-Path "build") { Remove-Item -Recurse -Force "build" }

# Create temp build directory
New-Item -ItemType Directory -Path "build" | Out-Null

# Copy only extension files
foreach ($item in $includeFiles) {
    $source = Join-Path $PSScriptRoot $item
    $dest = Join-Path "build" $item
    if (Test-Path $source) {
        if ((Get-Item $source).PSIsContainer) {
            Copy-Item -Recurse $source $dest
            # Remove Python files from shared/ (dev-only)
            Get-ChildItem -Path $dest -Filter "*.py" -Recurse | Remove-Item -Force
        } else {
            Copy-Item $source $dest
        }
    }
}

# Create zip
Compress-Archive -Path "build\*" -DestinationPath $outputZip

# Cleanup
Remove-Item -Recurse -Force "build"

Write-Host ""
Write-Host "  Built: $outputZip" -ForegroundColor Green
Write-Host ""
Write-Host "  Included:" -ForegroundColor Cyan
foreach ($f in $includeFiles) { Write-Host "    + $f" }
Write-Host ""
Write-Host "  Excluded (GitHub-only):" -ForegroundColor Yellow
Write-Host "    - ai_testing/"
Write-Host "    - README.md"
Write-Host "    - .git/"
Write-Host "    - .gitignore"
Write-Host "    - prompt_engineering_guide.txt"
Write-Host "    - system_prompt.md"
Write-Host "    - shared/*.py"
Write-Host ""
Write-Host "  Upload this zip to: https://chrome.google.com/webstore/devconsole" -ForegroundColor Cyan
