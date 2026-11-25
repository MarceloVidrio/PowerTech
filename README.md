# PowerTech Hogar

En México la mayoría de las familias solo se entera de cuánta luz gastó cuando llega el recibo bimestral de CFE. En ciudades calurosas como Culiacán el minisplit, el refrigerador y los hábitos de consumo pueden llevar la casa al escalón excedente, o incluso a la tarifa DAC (sin subsidio), sin que nadie lo note a tiempo.

**PowerTech Hogar** es una plataforma web que mide el consumo eléctrico de una casa en tiempo real con un sensor de bajo costo instalado en la pastilla principal del centro de carga (por ejemplo un Sonoff POW Ring; no se conecta al medidor de CFE), calcula el recibo estimado con la tarifa doméstica de CFE (1, 1A–1F) y avisa a la familia cuando algo se sale de lo normal, para que pueda decidir cómo ahorrar.

---

## Qué hace

- **Consumo en tiempo real** de toda la casa y gráfica de las últimas 24 horas.
- **Consumo por mes**, por día de la semana y por hora, y en qué momento del día se gasta más.
- **Recibo estimado del bimestre** con los escalones de CFE (básico, intermedio, excedente), IVA y pronóstico al cierre del periodo.
- **Riesgo de tarifa DAC** y **meta bimestral** de consumo.
- **Aparatos**: inventario con potencia y horas de uso para estimar qué gasta más; enchufes inteligentes (Tasmota) opcionales para apagarlos desde la app, al dormir o al activar el modo vacaciones.
- **Avisos**: consumo alto, consumo en horas de sueño, consumo en modo vacaciones, meta en riesgo y riesgo de DAC (en la app, notificación del navegador y correo para los importantes).
- **Familia**: el titular del hogar invita a sus familiares, que solo pueden consultar.
- **PowerBot**: asistente con IA que responde preguntas con los datos reales de la casa.
- **Administrador del sistema** (`/admin`): ve a todos los usuarios, detecta problemas (medidor sin señal, cuenta bloqueada…) y los corrige. Todo queda en un historial.

## Roles

| Rol | Qué puede hacer |
| --- | --- |
| Titular del hogar | Se registra desde la app; configura la casa, el medidor y los aparatos; invita a su familia. |
| Familiar | Consulta consumo, recibo, aparatos y avisos. No cambia nada. |
| Administrador del sistema | Ve y corrige las cuentas de todos. Se crea con `npm run configurar`. |

---

## Puesta en marcha

### 1. Instalar (Windows)
Doble clic en **INSTALAR.bat**: instala las dependencias, crea la base de datos limpia y te pide los datos del administrador del sistema.

A mano:
```bash
cd backend && npm install
cd ../frontend && npm install
cd ../backend && npm run configurar
```

El asistente `npm run configurar` guarda la contraseña de MySQL en `backend/.env`, crea la base **PowerTech** sin usuarios y crea la cuenta del administrador del sistema. Si encuentra la base de la versión anterior (para empresas) avisa que hay que crearla de nuevo (hay que escribir `SI`).

### 2. Ejecutar
Doble clic en **INICIAR.bat**, o:
```bash
cd backend && npm run dev      # API en http://localhost:3000
cd frontend && npm run dev     # app en http://localhost:5173
```

### 3. Primeros pasos en la app
1. **Crear cuenta** → eres el titular del hogar.
2. **Más → Datos y medidor**: tarifa de CFE, fecha de inicio del periodo del recibo, horas de sueño y límites de consumo.
3. **Registrar medidor**: la app genera el código y el token del medidor.
4. **Aparatos**: agrega los que más gastan (minisplit, refrigerador, bomba…).

### 4. El medidor
Cada lectura es un `POST /lecturas` con el encabezado `X-Sensor-Token`:
```json
{ "codigoMedidor": "MED-1A2B3C4D", "fechaHora": "2026-11-24 18:30:00", "valor": 1250 }
```
`valor` es la potencia total de la casa en watts. Sin el aparato puedes simular una casa con doble clic en **SIMULAR.bat** (con el programa encendido): busca solo el medidor registrado y genera datos del 10/11/2026 al 24/11/2026 a las 18:00, cuando el prototipo «se desconecta». A mano:
```bash
npm run simular -- --desde "2026-11-10 00:00" --hasta "2026-11-24 18:00"   # lo mismo que SIMULAR.bat
npm run demo                                               # últimos 20 días y luego en vivo
cd backend
npm run simular -- --medidor MED-1A2B3C4D --historico 20   # rellena 20 días de datos
npm run simular -- --medidor MED-1A2B3C4D                  # lecturas en vivo cada 10 s
```

### 5. Tarifas de CFE
Los precios por kWh están en `backend/src/services/tarifaCFE.js`. CFE los ajusta cada mes: para que el recibo estimado coincida con el real, copia ahí los precios de tu recibo.

### 6. Pruebas
```bash
cd backend && npm test
cd frontend && npm test
```

### 7. Producción (AWS)
El contenedor recibe los secretos con `--env-file /home/ubuntu/powertech.env` (mismo formato que `.env.example`). Con AWS RDS usa `DB_SSL=true`.

---

## Estructura

```
backend/
  src/database/powertech.sql      Base de datos (USUARIOS, HOGARES, MEDIDORES, APARATOS, LECTURAS, ALARMAS…)
  src/services/tarifaCFE.js       Tarifas domésticas de CFE y cálculo del recibo
  src/services/consumoService.js  kWh a partir de las lecturas, pronóstico del bimestre
  src/services/alarmRules.js      Reglas de los avisos
  src/services/programador.js     Apagado automático con enchufes inteligentes
  scripts/configurar.js           Base limpia y administrador del sistema
  scripts/simuladorLecturas.js    Simulador del medidor
frontend/src/views/               Inicio, Consumo, Recibo, Aparatos, Avisos, Mi hogar, Familia, Admin
```
