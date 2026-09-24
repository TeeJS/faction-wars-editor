# release-win.ps1 - build the signed Windows installer and portable exe, verify
# every signature, and upload them to the draft GitHub release for -Tag.
#
#   Connect-AzAccount            (once per session; the account with the
#                                 certificate-profile-signer role)
#   .\scripts\release-win.ps1 -Tag v0.2.0
#
# Needs .signing\dlib-x64\Azure.CodeSigning.Dlib.dll and .signing\metadata.json in
# this repo (copy the .signing folder from another signed repo) - see sign.js.

param(
    [Parameter(Mandatory = $true)][string]$Tag,
    [switch]$NoUpload
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
if ("v$version" -ne $Tag) { throw "package.json version is $version but the tag is $Tag - bump one of them first." }
foreach ($f in '.signing\dlib-x64\Azure.CodeSigning.Dlib.dll', '.signing\metadata.json') {
    if (-not (Test-Path $f)) { throw "Missing $f - copy the .signing folder from another signed repo (see sign.js)." }
}

if (Test-Path dist) { Remove-Item -Recurse -Force dist }
npm run dist:win
if ($LASTEXITCODE -ne 0) { throw 'the Windows build failed' }

$files = @(Get-ChildItem dist -Filter *.exe | Where-Object { $_.Name -notlike '*__uninstaller*' })
$files += Get-Item 'dist\win-unpacked\Faction Wars Pack Editor.exe'
foreach ($f in $files) {
    $sig = Get-AuthenticodeSignature $f.FullName
    if ($sig.Status -ne 'Valid') { throw "$($f.Name) is not validly signed: $($sig.Status) $($sig.StatusMessage)" }
    Write-Host ("signed  {0}  ({1})" -f $f.Name, $sig.SignerCertificate.Subject)
}

if ($NoUpload) { Write-Host 'Built and verified; not uploaded (-NoUpload).'; exit 0 }
$upload = @(Get-ChildItem dist -Filter 'faction-wars-editor-*.exe') + @(Get-ChildItem dist -Filter '*.blockmap')
gh release upload $Tag @($upload | ForEach-Object { $_.FullName }) --clobber
if ($LASTEXITCODE -ne 0) { throw 'upload failed - does the draft release exist? (push the tag first)' }
Write-Host "Uploaded $($upload.Count) file(s) to $Tag. Review the draft on GitHub and publish it."
