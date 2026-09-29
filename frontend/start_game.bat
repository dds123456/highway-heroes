@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found in PATH.
  echo Install Node.js first, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/3] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [2/3] Finding a free port...
for /f "delims=" %%P in ('powershell -NoProfile -Command "$p=5173; while(Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue){$p++}; Write-Output $p"') do set "PORT=%%P"
if not defined PORT set "PORT=5173"

echo [3/3] Starting Highway Heroes at http://127.0.0.1:%PORT%/
start "Highway Heroes Dev Server" /min cmd /c "npm run dev -- --port %PORT% --strictPort"

powershell -NoProfile -Command "$u='http://127.0.0.1:%PORT%/'; for($i=0;$i -lt 90;$i++){ try { $r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 1; if($r.StatusCode -eq 200){ Start-Process $u; exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; Write-Host 'Server did not become ready in time.'; exit 1"
if errorlevel 1 (
  echo [ERROR] Could not connect to the dev server.
)

echo.
echo The game is running. Close this window to stop it.
pause
endlocal
