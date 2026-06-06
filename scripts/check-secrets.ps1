# check-secrets.ps1 — scan all git-tracked files for real secret patterns
# Run from the repo root: powershell -File scripts\check-secrets.ps1

$patterns = @(
    'sk-ant-api03-[A-Za-z0-9]{20,}',       # Anthropic (real keys)
    'sk-proj-[A-Za-z0-9_-]{40,}',           # OpenAI (min 40 chars)
    'npg_[A-Za-z0-9]{20,}',                 # Neon DB
    'AKIA[0-9A-Z]{16}',                     # AWS access key
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ', # Real JWT (longer — rules out pattern docs)
    'xai-[A-Za-z0-9]{40,}',                 # xAI / Grok
    'whsec_[A-Za-z0-9]{30,}',               # Stripe webhook (real)
    'sk_live_[A-Za-z0-9]{24,}',             # Stripe live key
    'sk_test_[A-Za-z0-9]{24,}'              # Stripe test key (real, not placeholder)
)

# Files to skip entirely (contain patterns intentionally as documentation)
$skipFiles = @(
    '.husky/pre-commit',
    '.husky\pre-commit',
    'scripts/check-secrets.ps1',
    'scripts\check-secrets.ps1',
    'STRIPE_SETUP_GUIDE.md'
)

$binaryExts = @('.png','.jpg','.jpeg','.gif','.ico','.woff','.woff2','.ttf','.eot','.pdf','.zip','.tar','.gz','.pyc','.pptx','.docx','.mp4','.mp3','.wav')
$found = $false

$files = git ls-files 2>$null
foreach ($file in $files) {
    # Skip files with illegal path chars (e.g. curly braces on Windows)
    if ($file -match '[{}]') { continue }

    # Skip allowlisted doc/config files that contain patterns intentionally
    $normalised = $file -replace '/', '\'
    if ($skipFiles -contains $file -or $skipFiles -contains $normalised) { continue }

    $ext = $null
    try { $ext = [System.IO.Path]::GetExtension($file).ToLower() } catch { continue }
    if ($binaryExts -contains $ext) { continue }

    $fullPath = Join-Path (Get-Location) $file
    if (-not (Test-Path -LiteralPath $fullPath)) { continue }

    foreach ($pattern in $patterns) {
        $match = Select-String -LiteralPath $fullPath -Pattern $pattern -Quiet -ErrorAction SilentlyContinue
        if ($match) {
            Write-Warning "Possible secret ($pattern) in: $file"
            $found = $true
            break
        }
    }
}

if (-not $found) {
    Write-Host "OK: No real secret patterns found in git-tracked files." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ACTION REQUIRED: Remove or rotate any exposed secrets above." -ForegroundColor Red
    exit 1
}
