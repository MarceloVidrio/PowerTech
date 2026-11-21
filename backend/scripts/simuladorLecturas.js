#!/usr/bin/env node
/*
 * Simulador de lecturas de PowerTech
 * ----------------------------------
 * Se comporta como un sensor de consumo (por ejemplo el SONOFF POWCT):
 * envía lecturas de potencia en watts a  POST /lecturas  con el mismo
 * formato que usará el hardware real:
 *
 *   { codigoSensor, fechaHora: "YYYY-MM-DD HH:MM:SS", valor, detalle }
 *
 * Modos:
 *   En vivo   → manda una lectura cada N segundos (Ctrl+C para detener).
 *   Histórico → rellena los últimos D días para que las gráficas tengan datos.
 *
 * Ejemplos:
 *   npm run simular -- --sensor SENS-02
 *   npm run simular -- --sensor SENS-02 --intervalo 5 --picos 0.1
 *   npm run simular -- --sensor SENS-01 --historico 7
 *   npm run simular -- --sensor SENS-02 --una 520      (una sola lectura de 520 W)
 *
 * El sensor debe existir en la tabla SENSORES. Si una lectura supera su
 * umbralAlto (o consume fuera del horario del edificio), el backend crea la alarma.
 *
 * Autenticación: cada lectura lleva el encabezado X-Sensor-Token. El simulador
 * lo calcula con DEVICE_SECRET de backend/.env, o lo puedes pasar con --token
 * (lo obtienes en GET /sensor/:id/token con la sesión del administrador).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createHmac } = require('crypto');

const OPCIONES = {
  sensor: { def: null, ayuda: 'Código del sensor (obligatorio), p. ej. SENS-02' },
  url: { def: 'http://localhost:3000', ayuda: 'URL del backend' },
  intervalo: { def: 10, ayuda: 'Segundos entre lecturas en modo en vivo' },
  base: { def: 220, ayuda: 'Potencia típica en horario laboral (W)' },
  reposo: { def: 35, ayuda: 'Potencia fuera de horario (W), consumo "fantasma"' },
  entrada: { def: 8, ayuda: 'Hora de entrada del edificio (0-23)' },
  salida: { def: 18, ayuda: 'Hora de salida del edificio (0-23)' },
  picos: { def: 0.05, ayuda: 'Probabilidad (0-1) de un pico de consumo en modo en vivo' },
  pico: { def: 520, ayuda: 'Potencia de un pico (W); pon un valor mayor al umbralAlto' },
  historico: { def: 0, ayuda: 'Días hacia atrás a rellenar (0 = modo en vivo)' },
  paso: { def: 5, ayuda: 'Minutos entre lecturas en modo histórico' },
  una: { def: null, ayuda: 'Envía una sola lectura con este valor (W) y termina' },
  token: { def: null, ayuda: 'Token del sensor (si no, se calcula con DEVICE_SECRET de .env)' },
};

function tokenDe(cfg) {
  if (cfg.token) return cfg.token;
  if (!process.env.DEVICE_SECRET) throw new Error('Falta DEVICE_SECRET en backend/.env o la opción --token');
  return createHmac('sha256', process.env.DEVICE_SECRET).update(String(cfg.sensor)).digest('hex').slice(0, 40);
}

function leerArgs(argv) {
  const out = Object.fromEntries(Object.entries(OPCIONES).map(([k, v]) => [k, v.def]));
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { out.ayuda = true; continue; }
    const m = a.match(/^--([a-z]+)(?:=(.*))?$/);
    if (!m || !(m[1] in OPCIONES)) throw new Error(`Opción desconocida: ${a}`);
    const valor = m[2] ?? argv[++i];
    if (valor === undefined) throw new Error(`Falta el valor de --${m[1]}`);
    out[m[1]] = typeof OPCIONES[m[1]].def === 'number' ? Number(valor) : valor;
  }
  return out;
}

const pad = n => String(n).padStart(2, '0');
// Hora local en el formato DATETIME de MySQL
const formatoFecha = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// Potencia "realista": alta en horario laboral, baja de noche y fines de semana,
// con una rampa suave al inicio/fin de la jornada y ruido de ±8 %.
function potenciaEsperada(fecha, cfg) {
  const h = fecha.getHours() + fecha.getMinutes() / 60;
  const finDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
  let w = cfg.reposo;
  if (!finDeSemana && h >= cfg.entrada && h < cfg.salida) {
    const rampa = Math.min(1, (h - cfg.entrada) / 0.75, (cfg.salida - h) / 0.75);
    const comida = h >= 14 && h < 15 ? 0.75 : 1; // baja a la hora de comida
    w = cfg.reposo + (cfg.base - cfg.reposo) * Math.max(0.2, rampa) * comida;
  }
  const ruido = 1 + (Math.random() * 2 - 1) * 0.08;
  return Math.max(0, Math.round(w * ruido * 10) / 10);
}

async function enviar(cfg, fecha, valor, detalle) {
  const res = await fetch(`${cfg.url.replace(/\/$/, '')}/lecturas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sensor-Token': tokenDe(cfg) },
    body: JSON.stringify({ codigoSensor: cfg.sensor, fechaHora: formatoFecha(fecha), valor, detalle }),
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const j = await res.json(); msg += ` — ${j.mensaje || ''}`; } catch { /* sin cuerpo */ }
    throw new Error(msg.trim());
  }
}

async function modoHistorico(cfg) {
  const fin = new Date();
  fin.setSeconds(0, 0);
  const inicio = new Date(fin.getTime() - cfg.historico * 24 * 3600 * 1000);
  const fechas = [];
  for (let t = inicio.getTime(); t < fin.getTime(); t += cfg.paso * 60 * 1000) fechas.push(new Date(t));

  console.log(`Rellenando ${fechas.length} lecturas de ${cfg.sensor} (${cfg.historico} días, cada ${cfg.paso} min)…`);
  let ok = 0, dup = 0;
  const LOTE = 8; // peticiones en paralelo
  for (let i = 0; i < fechas.length; i += LOTE) {
    await Promise.all(fechas.slice(i, i + LOTE).map(f =>
      enviar(cfg, f, potenciaEsperada(f, cfg), 'Simulador PowerTech (histórico)')
        .then(() => ok++)
        .catch(e => { if (/duplicad/i.test(e.message)) dup++; else throw e; })));
    process.stdout.write(`\r  ${Math.min(i + LOTE, fechas.length)}/${fechas.length}`);
  }
  console.log(`\nListo: ${ok} lecturas nuevas${dup ? `, ${dup} ya existían` : ''}.`);
}

async function modoEnVivo(cfg) {
  console.log(`Simulando ${cfg.sensor} → ${cfg.url}/lecturas cada ${cfg.intervalo}s (Ctrl+C para detener)`);
  const tick = async () => {
    const ahora = new Date();
    const esPico = Math.random() < cfg.picos;
    const valor = esPico ? cfg.pico : potenciaEsperada(ahora, cfg);
    try {
      await enviar(cfg, ahora, valor, esPico ? 'Simulador PowerTech (pico)' : 'Simulador PowerTech');
      console.log(`${formatoFecha(ahora)}  ${String(valor).padStart(7)} W${esPico ? '  ⚡ pico' : ''}`);
    } catch (e) {
      console.error(`${formatoFecha(ahora)}  error: ${e.message}`);
    }
  };
  await tick();
  setInterval(tick, cfg.intervalo * 1000);
}

async function main() {
  const cfg = leerArgs(process.argv.slice(2));
  if (cfg.ayuda || !cfg.sensor) {
    console.log('Uso: npm run simular -- --sensor <codigoSensor> [opciones]\n');
    for (const [k, v] of Object.entries(OPCIONES)) console.log(`  --${k.padEnd(10)} ${v.ayuda}${v.def !== null ? ` (por defecto: ${v.def})` : ''}`);
    process.exit(cfg.ayuda ? 0 : 1);
  }
  if (cfg.una !== null) {
    const ahora = new Date();
    await enviar(cfg, ahora, Number(cfg.una), 'Simulador PowerTech (manual)');
    console.log(`Lectura enviada: ${cfg.sensor} = ${cfg.una} W (${formatoFecha(ahora)})`);
  } else if (cfg.historico > 0) {
    await modoHistorico(cfg);
  } else {
    await modoEnVivo(cfg);
  }
}

main().catch(e => {
  console.error(`Error: ${e.message}`);
  if (/fetch failed|ECONNREFUSED/i.test(e.message + (e.cause?.code || ''))) console.error('¿Está corriendo el backend? (npm run dev en /backend)');
  process.exit(1);
});
