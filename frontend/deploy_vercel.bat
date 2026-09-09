@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ==============================================
echo   HIGHWAY HEROES - Vercel one-click deploy
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install it from https://nodejs.org then retry.
  pause
  exit /b 1
)

echo [1/3] Installing dependencies ^(skipped if already present^)...
if not exist "node_modules" (
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
) else (
  echo       node_modules already exists, skipping.
)

echo [2/3] Building for production...
call npm run build
if errorlevel 1 (
  echo [ERROR] Build failed.
  pause
  exit /b 1
)

echo [3/3] Deploying to Vercel...
echo       First run: a browser opens so you can log in / link the project.
echo       Later runs: fully automatic, no action needed.
npx --yes vercel --prod --yes

if errorlevel 1 (
  echo.
  echo [ERROR] Deploy failed. Common causes:
  echo   - First-time login: rerun this file and finish the login in the browser.
  echo   - Network issue: check your connection and retry.
  pause
  exit /b 1
)

echo.
echo ==============================================
echo   Done! Your production URL is shown in the
echo   console output above ^(e.g. https://xxx.vercel.app^).
echo ==============================================
echo.
pause
endlocal