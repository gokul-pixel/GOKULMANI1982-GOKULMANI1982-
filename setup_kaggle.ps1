# Kaggle API Setup Script
$kagglePath = "$env:USERPROFILE\.kaggle"
$jsonPath = "$kagglePath\kaggle.json"

# Create folder
New-Item -ItemType Directory -Force -Path $kagglePath | Out-Null

# Remove old file if exists
if (Test-Path $jsonPath) {
    Remove-Item $jsonPath -Force -ErrorAction SilentlyContinue
}

# Write kaggle.json using .NET (avoids BOM / encoding issues)
$content = '{"username":"gokumani","key":"KGAT_3208d2b7c248e1347ecb13ffac876bc1"}'
[System.IO.File]::WriteAllText($jsonPath, $content)

# Verify
Write-Host "File contents:"
Get-Content $jsonPath

# Test kaggle CLI
Write-Host "`nTesting Kaggle CLI..."
kaggle datasets list --max-size 1