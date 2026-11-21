@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ===== PowerTech: instalacion =====
echo.
echo [1/3] Instalando dependencias del backend...
pushd backend
call npm install
if errorlevel 1 goto error
popd
echo.
echo [2/3] Instalando dependencias del frontend...
pushd frontend
call npm install
if errorlevel 1 goto error
popd
echo.
echo [3/3] Base de datos limpia y cuenta del administrador del sistema...
pushd backend
node scripts\configurar.js
if errorlevel 1 goto error
popd
echo.
echo Instalacion terminada. Para abrir PowerTech usa INICIAR.bat
pause
exit /b 0
:error
popd
echo.
echo Ocurrio un error. Toma una captura de esta ventana y mandasela a Claude.
pause
exit /b 1
