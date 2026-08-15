@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if exist ".env.local" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env.local") do (
    if "%%A"=="GITHUB_TOKEN" set "GITHUB_TOKEN=%%B"
    if "%%A"=="VERCEL_TOKEN" set "VERCEL_TOKEN=%%B"
  )
)

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  pause
  exit /b 1
)

where gh >nul 2>nul
if errorlevel 1 (
  echo [1/5] Installing GitHub CLI...
  winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
)

if defined GITHUB_TOKEN (
  echo [2/5] Using GitHub token from .env.local
  echo %GITHUB_TOKEN%| gh auth login --with-token
) else (
  gh auth status >nul 2>nul
  if errorlevel 1 (
    echo [2/5] Please finish GitHub login in the browser window.
    gh auth login --web
  )
)

echo [3/5] Preparing repository...
if not exist ".git" git init
for /f "delims=" %%U in ('gh api user --jq .login') do set "GH_NAME=%%U"
if not defined GH_NAME set "GH_NAME=highway-heroes"
git config user.name "%GH_NAME%"
git config user.email "%GH_NAME%@users.noreply.github.com"
git add -A
git commit -m "feat: highway heroes cartoon motorcycle racer"

echo [4/5] Uploading to GitHub...
gh repo view highway-heroes >nul 2>nul
if errorlevel 1 (
  gh repo create highway-heroes --public --source .
)
git remote remove origin >nul 2>nul
git remote add origin "https://github.com/%GH_NAME%/highway-heroes.git"
git push -u origin HEAD

echo [5/5] Deploying to Vercel...
if defined VERCEL_TOKEN (
  npx vercel --prod --yes --name highway-heroes --token "%VERCEL_TOKEN%"
) else (
  npx vercel login
  npx vercel --prod --yes --name highway-heroes
)

echo.
echo Done. Your game is live on Vercel.
pause
endlocal
