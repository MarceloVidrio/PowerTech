@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo Borra los archivos de la version anterior de PowerTech (para empresas)
echo que ya no usa PowerTech Hogar. No toca tus datos ni la base de datos.
echo.
pause
if exist "backend\src\controllers\VISTA_REPORTE_SALAController.js" del /q "backend\src\controllers\VISTA_REPORTE_SALAController.js"
if exist "backend\src\controllers\buildingController.js" del /q "backend\src\controllers\buildingController.js"
if exist "backend\src\controllers\deviceController.js" del /q "backend\src\controllers\deviceController.js"
if exist "backend\src\controllers\monitoringdata.js" del /q "backend\src\controllers\monitoringdata.js"
if exist "backend\src\controllers\roomController.js" del /q "backend\src\controllers\roomController.js"
if exist "backend\src\controllers\sensorController.js" del /q "backend\src\controllers\sensorController.js"
if exist "backend\src\database\migracion_v2.sql" del /q "backend\src\database\migracion_v2.sql"
if exist "backend\src\database\migracion_v3.sql" del /q "backend\src\database\migracion_v3.sql"
if exist "backend\src\database\optimizacion_lecturas.sql" del /q "backend\src\database\optimizacion_lecturas.sql"
if exist "backend\src\routes\VISTA_REPORTE_SALARoutes.js" del /q "backend\src\routes\VISTA_REPORTE_SALARoutes.js"
if exist "backend\src\routes\buildingRoutes.js" del /q "backend\src\routes\buildingRoutes.js"
if exist "backend\src\routes\deviceRoutes.js" del /q "backend\src\routes\deviceRoutes.js"
if exist "backend\src\routes\monitoringRoutes.js" del /q "backend\src\routes\monitoringRoutes.js"
if exist "backend\src\routes\roomRoutes.js" del /q "backend\src\routes\roomRoutes.js"
if exist "backend\src\routes\sensorRoutes.js" del /q "backend\src\routes\sensorRoutes.js"
if exist "frontend\src\components\Card.vue" del /q "frontend\src\components\Card.vue"
if exist "frontend\src\components\Table.vue" del /q "frontend\src\components\Table.vue"
if exist "frontend\src\database\powertech.sql" del /q "frontend\src\database\powertech.sql"
if exist "frontend\src\stores\buildings.js" del /q "frontend\src\stores\buildings.js"
if exist "frontend\src\stores\devices.js" del /q "frontend\src\stores\devices.js"
if exist "frontend\src\stores\monitoring.js" del /q "frontend\src\stores\monitoring.js"
if exist "frontend\src\stores\reports.js" del /q "frontend\src\stores\reports.js"
if exist "frontend\src\stores\rooms.js" del /q "frontend\src\stores\rooms.js"
if exist "frontend\src\stores\sensors.js" del /q "frontend\src\stores\sensors.js"
if exist "frontend\src\views\AllDevices.vue" del /q "frontend\src\views\AllDevices.vue"
if exist "frontend\src\views\Buildings.vue" del /q "frontend\src\views\Buildings.vue"
if exist "frontend\src\views\Devices.vue" del /q "frontend\src\views\Devices.vue"
if exist "frontend\src\views\Monitoring.vue" del /q "frontend\src\views\Monitoring.vue"
if exist "frontend\src\views\ReciboInfo.vue" del /q "frontend\src\views\ReciboInfo.vue"
if exist "frontend\src\views\ReciboReporte.vue" del /q "frontend\src\views\ReciboReporte.vue"
if exist "frontend\src\views\ReportSelection.vue" del /q "frontend\src\views\ReportSelection.vue"
if exist "frontend\src\views\Reports.vue" del /q "frontend\src\views\Reports.vue"
if exist "frontend\src\views\Rooms.vue" del /q "frontend\src\views\Rooms.vue"
if exist "frontend\src\views\Sensors.vue" del /q "frontend\src\views\Sensors.vue"
if exist "frontend\src\views\Team.vue" del /q "frontend\src\views\Team.vue"
echo.
echo Listo. Ya puedes borrar este archivo (LIMPIAR_ARCHIVOS_VIEJOS.bat).
pause
