@echo off
echo ========================================================
echo ST. XAVIER'S HIGH SCHOOL, JAGATPUR - WEBSITE RUNNER
echo ========================================================
echo.
echo Starting the school website server directly from the pendrive...
echo.

cd /d "%~dp0"

:: Check if Node is installed
node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
  echo ERROR: Node.js is not installed on this computer!
  echo Please download and install Node.js from https://nodejs.org/
  echo then try running this file again.
  echo.
  pause
  exit /b
)

:: Start the server in the background
start cmd /k "node server.js"

:: Wait a couple seconds for server to start
timeout /t 3 >nul

:: Open the frontend website
start http://localhost:3000

:: Open the admin panel
start http://localhost:3000/admin

echo The website and Admin Dashboard should now be open in your browser!
echo Use the Antigravity assistant on any PC to work on this folder.
echo.
pause
