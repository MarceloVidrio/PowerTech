@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
title PowerTech - Simulador del sensor
echo.
echo ===== PowerTech Hogar: simulador del sensor =====
echo Genera el consumo de la casa del 10/11/2026 00:00 al 24/11/2026 18:00.
echo Despues de esa hora no hay datos: el prototipo se "desconecto".
echo Tarda alrededor de un minuto. Si lo corres otra vez solo agrega lo que falte.
echo.
node scripts\simuladorLecturas.js --desde "2026-11-10 00:00" --hasta "2026-11-24 18:00"
echo.
pause
