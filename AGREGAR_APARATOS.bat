@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
echo.
echo Agregando los aparatos de la casa...
echo.
node scripts\agregarAparatos.js
echo.
pause
