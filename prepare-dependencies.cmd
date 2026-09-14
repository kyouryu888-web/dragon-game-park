@echo off
pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\prepare-dependencies.ps1"
if errorlevel 1 (
  echo ERROR: Preparation failed. Please keep this message for troubleshooting.
) else (
  echo SUCCESS: Dependencies are ready. You may close this window.
)
pause
