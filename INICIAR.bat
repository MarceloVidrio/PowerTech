@echo off
cd /d "%~dp0"
start "PowerTech - API" cmd /k "cd /d ""%~dp0backend"" && npm run dev"
start "PowerTech - Web" cmd /k "cd /d ""%~dp0frontend"" && npm run dev -- --open"
