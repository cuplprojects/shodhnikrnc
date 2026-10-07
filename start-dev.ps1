<#
.SYNOPSIS
    Starts all four dev processes for the Shodhanik-x-RNC integration, each in
    its own terminal window, plus the gateway in front of them.

.DESCRIPTION
    Target ports, matching Gateway/appsettings.Development.json:
        Shodhanik UI  -> 5173          RNC UI  -> 5174
        Shodhanik API -> 7290 (https)  RNC API -> 7054 (https)

    Two port traps this script works around:
    - Shodhanik's UI and RNC's UI both default to Vite's 5173 with no --port
      pinned in package.json, so starting them in the "wrong" order would
      leave one of them on whatever port Vite falls back to. --port and
      --strictPort below make the port explicit and fail loudly instead of
      silently picking a different one, so process start order never matters.
      Called as `.\node_modules\.bin\vite.cmd ...` rather than `npm run dev
      -- ...`: the latter's `--` was getting swallowed somewhere across
      cmd.exe's argument handling of npm.cmd (itself a batch wrapper), so
      Vite received a bare "5173" positional argument -- which it reads as a
      mode name, not a port -- instead of `--port 5173`. `npx vite ...` was
      tried next and does pass the flags through, but npx's own resolution
      step made the process unstable (observed exiting silently within a few
      seconds). Invoking the already-installed local binary directly skips
      both problems.
    - Both APIs' launchSettings.json list an "http" profile before "https",
      and `dotnet run` with no --launch-profile uses the first one -- binding
      a port the gateway doesn't proxy to (5166 / 5116) rather than the
      https ports above. --launch-profile https below selects the right one
      explicitly.

.PARAMETER SkipGateway
    Start only the four app processes, not the gateway -- e.g. while working
    on the gateway itself in its own window.
#>
param(
    [switch]$SkipGateway
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Start-DevWindow {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Command
    )
    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-Command',
        "`$host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$WorkingDirectory'; $Command"
    )
}

Start-DevWindow -Title 'Shodhanik API (7290)' `
    -WorkingDirectory (Join-Path $root 'Shodhanik Configurable plan\API\RMS\RMS') `
    -Command 'dotnet run --launch-profile https'

Start-DevWindow -Title 'Shodhanik UI (5173)' `
    -WorkingDirectory (Join-Path $root 'Shodhanik Configurable plan\UI') `
    -Command '.\node_modules\.bin\vite.cmd --port 5173 --strictPort'

Start-DevWindow -Title 'RNC API (7054)' `
    -WorkingDirectory (Join-Path $root 'MNNITRNC\API\API') `
    -Command 'dotnet run --launch-profile https'

Start-DevWindow -Title 'RNC UI (5174)' `
    -WorkingDirectory (Join-Path $root 'MNNITRNC\UI') `
    -Command '.\node_modules\.bin\vite.cmd --port 5174 --strictPort'

if (-not $SkipGateway) {
    Start-DevWindow -Title 'Gateway' `
        -WorkingDirectory (Join-Path $root 'Gateway') `
        -Command 'dotnet run'
}

Write-Host "Started: Shodhanik API, Shodhanik UI, RNC API, RNC UI$(if (-not $SkipGateway) { ', Gateway' }) -- each in its own window."
Write-Host "Close a window (or Ctrl+C inside it) to stop that one process only."
