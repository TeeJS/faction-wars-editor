# gamecheck.ps1 - prove the GAME accepts and plays what the editor writes.
#
#   .\scripts\gamecheck.ps1
#   .\scripts\gamecheck.ps1 -FactionWars D:\Github\faction-wars -Days 60
#
# What it does, without touching the faction-wars checkout:
#   1. copies the game project to a temp folder (src, tests, packs, art, assets, .godot)
#   2. points that copy's user:// at a throwaway folder (use_custom_user_dir)
#   3. has the editor write its test packs (the starter with renamed sides, and a
#      WW2 clone with a planet moved and a unit and a faction renamed), each through
#      a zip export and back, plus deliberately broken packs with the errors the
#      editor reports for each (tests/gamecheck.test.ts)
#   4. runs the game's own validator on the good packs (the game's tests/validate_pack.gd)
#   5. runs it on the broken packs: it must print exactly the editor's errors, in order
#   6. imports the zips with the game's own importer and loads them from
#      user://packs, as the pack picker does (tests/gamecheck/import_check.gd)
#   7. plays each imported pack headless with the AI on both sides (tests/soak.gd)
#   8. deletes the throwaway user folder
# Exit code 0 = every step passed.

param(
    [string]$FactionWars = (Join-Path (Split-Path -Parent $PSScriptRoot) '..\faction-wars'),
    [string]$Godot = 'D:\Downloads\Godot_v4.7.1-stable_mono_win64\Godot_v4.7.1-stable_mono_win64_console.exe',
    [int]$Days = 30,
    [int]$Seed = 4242
)

$ErrorActionPreference = 'Stop'
$editor = Split-Path -Parent $PSScriptRoot
$FactionWars = (Resolve-Path $FactionWars).Path
if (-not (Test-Path (Join-Path $FactionWars 'project.godot'))) { throw "No Faction Wars project at $FactionWars" }
if (-not (Test-Path $Godot)) { throw "Godot console binary not found: $Godot" }

$work = Join-Path $env:TEMP ('fwe-gamecheck-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
$copy = Join-Path $work 'faction-wars'
$zips = Join-Path $work 'zips'
$userDirName = 'fwe-gamecheck-' + (Split-Path -Leaf $work)
$failed = 0

function Step([string]$what) { Write-Host "`n== $what" -ForegroundColor Cyan }
function Run-Godot([string[]]$GodotArgs, [string]$Log) {
    $p = Start-Process -FilePath $Godot -ArgumentList $GodotArgs -RedirectStandardOutput $Log -RedirectStandardError ($Log + '.err') -PassThru -NoNewWindow
    if (-not $p.WaitForExit(900 * 1000)) { $p.Kill(); return 124 }
    return $p.ExitCode
}
# The game's tests/validate_pack.gd on one folder: its exit code and the errors it printed.
function Validate-Pack([string]$Dir, [string]$Log) {
    $code = Run-Godot @('--headless', '--path', $copy, '-s', 'tests/validate_pack.gd', '--', ('--dir=' + ($Dir -replace '\\', '/'))) $Log
    $prefix = '[validate_pack] '
    $printed = @(Get-Content -Encoding UTF8 $Log | Where-Object { $_.StartsWith($prefix) } | ForEach-Object { $_.Substring($prefix.Length) })
    $errors = @($printed | Where-Object { -not ($_.StartsWith('PASS: ') -or $_.StartsWith('FAIL: ')) })
    return @{ Code = $code; Printed = $printed; Errors = $errors }
}

try {
    Step "Copying the game project to $copy"
    New-Item -ItemType Directory -Force $copy, $zips | Out-Null
    foreach ($d in 'src', 'tests', 'packs', 'art', 'assets', '.godot', 'script_templates', 'feature_profiles', 'text_editor_themes') {
        $from = Join-Path $FactionWars $d
        if (Test-Path $from) { Copy-Item -Recurse -Force $from (Join-Path $copy $d) }
    }
    Get-ChildItem -File $FactionWars | Where-Object { $_.Extension -in '.godot', '.tscn', '.cfg' } | Copy-Item -Destination $copy
    $orig = Join-Path $copy 'packs\star-wars-rebellion\original'
    if (Test-Path $orig) { Remove-Item -Recurse -Force $orig }
    $proj = Join-Path $copy 'project.godot'
    (Get-Content $proj -Raw) -replace 'config/name="faction-wars"', "config/name=`"faction-wars`"`nconfig/use_custom_user_dir=true`nconfig/custom_user_dir_name=`"$userDirName`"" | Set-Content -NoNewline $proj
    Copy-Item (Join-Path $editor 'tests\gamecheck\*.gd') (Join-Path $copy 'tests')

    Step 'Writing the editor packs (each through a zip and back)'
    $env:FWE_GAMECHECK_DIR = $zips
    $env:FACTION_WARS_DIR = $FactionWars
    Push-Location $editor
    try { npx vitest run tests/gamecheck.test.ts } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw 'the editor could not write its test packs' }
    $packs = Get-ChildItem -Directory $zips | Where-Object { $_.Name -ne 'parity' } | ForEach-Object { $_.Name }

    Step 'Importing the project (class cache)'
    Run-Godot @('--headless', '--path', $copy, '--import') (Join-Path $work 'import.log') | Out-Null

    Step "The game's validator on the written folders"
    foreach ($id in $packs) {
        $r = Validate-Pack (Join-Path $zips $id) (Join-Path $work "validate-$id.log")
        $r.Printed | ForEach-Object { "  $_" }
        if ($r.Code -ne 0) { $failed++ }
    }

    Step "The game's validator on the broken packs: word for word what the editor says"
    $parity = Join-Path $zips 'parity'
    foreach ($dir in Get-ChildItem -Directory $parity) {
        $expected = @(Get-Content -Encoding UTF8 (Join-Path $parity "$($dir.Name).expected.txt") | Where-Object { $_ -ne '' })
        $r = Validate-Pack $dir.FullName (Join-Path $work "parity-$($dir.Name).log")
        $same = ($r.Errors.Count -eq $expected.Count) -and ($r.Code -eq $(if ($expected.Count -gt 0) { 1 } else { 0 }))
        for ($i = 0; $same -and $i -lt $expected.Count; $i++) { if ($r.Errors[$i] -cne $expected[$i]) { $same = $false } }
        if ($same) {
            Write-Host "  same  $($dir.Name): $($expected.Count) error(s)"
        } else {
            $failed++
            Write-Host "  DIFFERENT  $($dir.Name) (game exit $($r.Code))" -ForegroundColor Red
            Write-Host '    the editor:'; $expected | ForEach-Object { "      $_" }
            Write-Host '    the game:'; $r.Errors | ForEach-Object { "      $_" }
        }
    }

    Step "The game's importer on the zips, then loading from user://packs"
    $zipArgs = $packs | ForEach-Object { '--zip=' + (Join-Path $zips "$_.zip") }
    $code = Run-Godot (@('--headless', '--path', $copy, '-s', 'tests/import_check.gd', '--') + $zipArgs) (Join-Path $work 'importcheck.log')
    Get-Content (Join-Path $work 'importcheck.log') | Select-String '\[import_check\]' | ForEach-Object { $_.Line }
    if ($code -ne 0) { $failed++ }

    foreach ($id in $packs) {
        $side = (Get-Content (Join-Path $zips "$id\factions.json") -Raw | ConvertFrom-Json).factions[0].id
        Step "Playing $id for $Days days (AI on both sides, as $side)"
        $log = Join-Path $work "soak-$id.log"
        $code = Run-Godot @('--headless', '--path', $copy, '-s', 'tests/soak.gd', '--', "--pack=$id", "--faction=$side", "--days=$Days", "--seed=$Seed") $log
        $errors = (Select-String -Path $log -Pattern 'SCRIPT ERROR').Count
        # soak.gd plays on with an empty galaxy when the pack does not load, and exits 0,
        # so check that the pack loaded and day zero placed its planets.
        $packErrors = @(Select-String -Path ($log + '.err') -Pattern 'ERROR: \[Pack\]' | ForEach-Object { $_.Line })
        $planets = 0
        $m = Select-String -Path $log -Pattern '^Planets:\s+(\d+)' | Select-Object -First 1
        if ($m) { $planets = [int]$m.Matches[0].Groups[1].Value }
        Get-Content $log | Select-String 'SOAK COMPLETE|worlds   ' | ForEach-Object { $_.Line }
        $packErrors | Select-Object -First 3 | ForEach-Object { "  $_" }
        Write-Host "exit $code, script errors $errors, pack load errors $($packErrors.Count), planets $planets"
        if ($code -ne 0 -or $errors -gt 0 -or $packErrors.Count -gt 0 -or $planets -eq 0) { $failed++ }
    }
}
finally {
    $userDir = Join-Path $env:APPDATA $userDirName
    if (Test-Path $userDir) { Remove-Item -Recurse -Force $userDir }
    Remove-Item Env:FWE_GAMECHECK_DIR -ErrorAction SilentlyContinue
    Write-Host "`nLogs: $work"
}

if ($failed -gt 0) { Write-Host "GAMECHECK FAILED ($failed step(s))" -ForegroundColor Red; exit 1 }
Write-Host 'GAMECHECK PASSED: the game validates, imports and plays every editor-made pack.' -ForegroundColor Green
exit 0
