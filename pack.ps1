# 打包可上传 Halo 的主题 zip（路径用 /，避免 Linux 解压坏掉）
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$verLine = Select-String -Path (Join-Path $root 'theme.yaml') -Pattern '^\s+version:\s*(.+)$' | Select-Object -First 1
$ver = $verLine.Matches[0].Groups[1].Value.Trim().Trim('"')
$out = Join-Path $root "time-capsule-$ver.zip"
if (Test-Path $out) { Remove-Item $out -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$fs = [System.IO.File]::Open($out, [System.IO.FileMode]::Create)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)

$files = @('theme.yaml', 'settings.yaml', 'annotation-settings.yaml') | ForEach-Object { Join-Path $root $_ }
$files += Get-ChildItem -Path (Join-Path $root 'templates') -Recurse -File | ForEach-Object { $_.FullName }

foreach ($f in $files) {
  $entry = ($f.Substring($root.Length).TrimStart('\', '/')) -replace '\\', '/'
  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
    $zip, $f, $entry, [System.IO.Compression.CompressionLevel]::Optimal)
}

$zip.Dispose(); $fs.Dispose()
Write-Host "OK $out ($([math]::Round((Get-Item $out).Length/1MB, 2)) MB)"
