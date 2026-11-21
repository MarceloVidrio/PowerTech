Actualmente, las pequeñas y medianas empresas (PyMEs) gestionan la problemática del alto consumo eléctrico de forma reactiva y manual, basando sus decisiones únicamente en la revisión de la facturación mensual sin contar con mecanismos técnicos que permitan optimizar la operación de sistemas críticos como la climatización e iluminación. El origen del "dolor" o insatisfacción principal del cliente radica en la ausencia total de sistemas de medición en tiempo real, lo cual impide identificar de manera precisa los desperdicios operativos, los horarios de máxima demanda y el uso de equipos ineficientes. Ante el incremento sostenido de las tarifas eléctricas en México, esta falta de visibilidad compromete la estabilidad financiera del sector productivo, generando una necesidad crítica por soluciones que permitan intervenir en el consumo antes de que este impacte la rentabilidad operativa. En consecuencia, el beneficio que el usuario desearía obtener es una herramienta accesible que le otorgue control y visibilidad sobre sus flujos energéticos para reducir sus costos de forma proyectada.

Para atender estas necesidades, PowerTech se propone como una solución tecnológica integral consistente en un ecosistema de sensores inteligentes, dispositivos IoT y sistemas de automatización orientados al monitoreo y la optimización del consumo eléctrico en tiempo real. Los atributos clave de esta propuesta, basados en el uso de hardware abierto de bajo costo y el análisis de datos mediante tecnologías emergentes, responden directamente a la necesidad de las PyMEs de contar con tecnología de vanguardia sin inversiones prohibitivas. El beneficio principal es una reducción potencial de entre un 20% y un 30% en el consumo energético de los edificios comerciales, lo que no solo satisface la expectativa económica del cliente al disminuir gastos operativos, sino que también fortalece su cultura de eficiencia y sustentabilidad ambiental.

---

## Puesta en marcha (versión 2)

### 1. Variables de entorno
Los secretos ya no están en el código. Copia `backend/.env.example` como `backend/.env` y llena los valores. Para generar `JWT_SECRET` y `DEVICE_SECRET`:

```bash
cd backend
npm run secretos
```

### 2. Base de datos y administrador del sistema
La forma fácil (Windows): doble clic en **CONFIGURAR_BASE.bat**, o bien:

```bash
cd backend
npm run configurar
```

El asistente guarda la contraseña de MySQL en `.env`, crea la base **PowerTech limpia (sin usuarios ni datos)** y te pide los datos de la cuenta del **administrador del sistema**. Si la base ya existe, pregunta antes de borrarla (hay que escribir `SI`); si la conservas, la actualiza.

A mano:
- **Instalación nueva:** ejecuta `backend/src/database/powertech.sql` (no trae usuarios) y crea el administrador con `npm run configurar`.
- **Base existente (conserva los datos):** haz un respaldo y ejecuta `migracion_v2.sql` y luego `migracion_v3.sql`, una sola vez cada una.
- **Opcional, cuando crezca LECTURAS:** `backend/src/database/optimizacion_lecturas.sql`.

Las contraseñas antiguas en texto plano se convierten a hash automáticamente la siguiente vez que cada usuario inicia sesión.

### 3. Ejecutar
```bash
cd backend && npm install && npm run dev      # API en http://localhost:3000
cd frontend && npm install && npm run dev     # interfaz en http://localhost:5173
```

### 4. Sensores
Cada lectura (`POST /lecturas`) debe llevar el encabezado `X-Sensor-Token`. El administrador obtiene el token de cada sensor en **Sensores → detalle → Ver token**. Para pruebas: `npm run simular -- --sensor SENS-02` (calcula el token con `DEVICE_SECRET`).

### 5. Pruebas
```bash
cd backend && npm test
cd frontend && npm test
```

### 6. Producción (AWS)
El contenedor recibe los secretos con `--env-file /home/ubuntu/powertech.env` (mismo formato que `.env.example`). Ese archivo vive solo en el servidor. Con AWS RDS usa `DB_SSL=true`.

### Novedades
- Sesión con token firmado, contraseñas con hash y permisos por cuenta: cada usuario solo ve y modifica su información.
- Roles: **administrador del sistema**, **administrador de empresa** y **técnico** (Más → Mi equipo).
- Panel del administrador del sistema (`/admin`): ve a todos los usuarios y lo que tienen (edificios, sensores, alarmas), resalta las cuentas con problemas y permite corregirlas: editar nombre, correo, rol o empresa; restablecer la contraseña (temporal o escrita); quitar bloqueos por intentos fallidos; activar o desactivar la cuenta; activar sensores; cerrar alarmas atoradas y eliminar cuentas. Todo queda en un historial de cambios. Una cuenta desactivada pierde el acceso de inmediato.
- Alarmas sin duplicados: pico de consumo, consumo fuera de horario y consumo bajo (umbral bajo), con avisos en tiempo real y correo para nivel 4 y 5.
- Tipo de dispositivo (computadora o aire acondicionado), control de relevadores Tasmota y apagado automático fuera de horario.
- Pronóstico del consumo del mes en Monitoreo.
