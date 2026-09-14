param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))

# Google Drive can reject npm's archive writes. Install on a local disk first,
# then copy ordinary files to this project. The lockfile remains unchanged.
$ErrorActionPreference = 'Stop'
$project = (Resolve-Path -LiteralPath $ProjectRoot).Path.TrimEnd('\')
foreach ($name in @('package.json', 'package-lock.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $project $name) -PathType Leaf)) {
        throw "Required file missing: $name"
    }
}
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$stagingBase = Join-Path $env:LOCALAPPDATA 'DragonGamePark\dependency-staging'
$stage = Join-Path $stagingBase ([guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage -Force | Out-Null
try {
    foreach ($name in @('package.json', 'package-lock.json')) {
        Copy-Item -LiteralPath (Join-Path $project $name) -Destination (Join-Path $stage $name)
    }
    Write-Host 'Preparing dependencies on the local disk...'
    Push-Location -LiteralPath $stage
    try {
        & $npm ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed: $LASTEXITCODE" }
    } finally { Pop-Location }
    $modules = [IO.Path]::GetFullPath((Join-Path $project 'node_modules'))
    if ($modules -cne ($project + '\node_modules')) { throw 'Unexpected dependency target' }
    if (Test-Path -LiteralPath $modules) {
        $existing = Get-Item -LiteralPath $modules -Force
        if ($existing.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw 'node_modules is a link; refusing to remove it'
        }
        $childLinks = @(Get-ChildItem -LiteralPath $modules -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
        if ($childLinks.Count -gt 0) { throw 'Existing dependency links require manual inspection' }
        Remove-Item -LiteralPath $modules -Recurse -Force
    }
    Write-Host 'Copying prepared dependencies to the project...'
    robocopy (Join-Path $stage 'node_modules') $modules /E /XJ /R:1 /W:1 /COPY:DAT /DCOPY:DAT /MT:8 /NP /NFL /NDL /NJH
    if ($LASTEXITCODE -ge 8) { throw "Dependency copy failed: $LASTEXITCODE" }
    $expected = @(Get-ChildItem -LiteralPath (Join-Path $stage 'node_modules') -Recurse -Force -File)
    foreach ($file in $expected) {
        $relative = $file.FullName.Substring((Join-Path $stage 'node_modules').Length + 1)
        $copied = Join-Path $modules $relative
        if (-not (Test-Path -LiteralPath $copied -PathType Leaf)) { throw "Missing dependency: $relative" }
        if ((Get-FileHash -LiteralPath $copied -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash) {
            throw "Dependency hash mismatch: $relative"
        }
    }
    Write-Host "SUCCESS: dependencies ready; $($expected.Count) files verified."
} finally {
    $resolvedStage = [IO.Path]::GetFullPath($stage)
    $resolvedBase = [IO.Path]::GetFullPath($stagingBase).TrimEnd('\') + '\'
    if (-not $resolvedStage.StartsWith($resolvedBase, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected staging cleanup path' }
    if (Test-Path -LiteralPath $resolvedStage) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force }
}
