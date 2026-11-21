@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
echo.
echo Este asistente puede:
echo  - Borrar la base PowerTech y dejarla limpia, sin usuarios ni datos.
echo  - Crear la cuenta del ADMINISTRADOR DEL SISTEMA.
echo.
node scripts\configurar.js
if errorlevel 1 (
  echo.
  echo Ocurrio un error. Toma una captura de esta ventana y mandasela a Claude.
)
pause
