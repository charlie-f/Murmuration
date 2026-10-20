# Packs the shared web app (../web) into the screensaver as Windows resources.
# Writes build/web_files.rc (one RCDATA resource per file) and build/web_files.txt
# (a build id, then "resource-id relative/path" per line), which murmuration.cpp reads.
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\web')).Path
$build = Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Force -Path $build | Out-Null

$files = Get-ChildItem -Path $root -Recurse -File | Sort-Object FullName
$content = New-Object IO.MemoryStream
$list = @()
$rc = @()
$id = 1000
foreach ($f in $files) {
    $rel = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
    $relBytes = [Text.Encoding]::UTF8.GetBytes($rel)
    $bytes = [IO.File]::ReadAllBytes($f.FullName)
    $content.Write($relBytes, 0, $relBytes.Length)
    $content.Write($bytes, 0, $bytes.Length)
    $list += "$id $rel"
    $rc += "$id RCDATA `"$($f.FullName.Replace('\', '\\'))`""
    $id++
}

# The build id changes whenever any web file does, so installs pick up new versions
$sha = [Security.Cryptography.SHA256]::Create()
$buildId = -join ($sha.ComputeHash($content.ToArray())[0..7] | ForEach-Object { $_.ToString('x2') })

$listPath = Join-Path $build 'web_files.txt'
Set-Content -Path $listPath -Value (@($buildId) + $list) -Encoding ascii
$rc = @("100 RCDATA `"$($listPath.Replace('\', '\\'))`"") + $rc
Set-Content -Path (Join-Path $build 'web_files.rc') -Value $rc -Encoding ascii

Write-Host "Packed $($files.Count) web files (build $buildId)"
