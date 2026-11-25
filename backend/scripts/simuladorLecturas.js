#!/usr/bin/env node
/*
 * Simulador del sensor de consumo de PowerTech Hogar (pastilla principal)
 * ------------------------------------------------
 * Se comporta como el medidor del tablero (por ejemplo Sonoff POW Ring):
 * envía la potencia total de la casa en watts a  POST /lecturas  con el
 * mismo formato que usará el hardware real:
 *
 *   { codigoMedidor, fechaHora: "YYYY-MM-DD HH:MM:SS", valor }
 *
 * El perfil imita una casa en Culiacán: refrigerador siempre, minisplit en la
 * tarde y la noche, cocina en la mañana y TV/luces en la noche.
 *
 * Modos:
 *   En vivo   → manda una lectura cada N segundos (Ctrl+C para detener).
 *   Histórico → rellena los últimos D días para que las gráficas tengan datos.
 *
 * La forma fácil: doble clic en SIMULAR.bat (o "npm run demo"). Busca solo el
 * medidor registrado en la app, rellena los últimos 20 días y sigue en vivo.
 *
 * Ejemplos:
 *   npm run demo
 *   npm run simular -- --medidor MED-1A2B3C4D
 *   npm run simular -- --medidor MED-1A2B3C4D --historico 20
 *   npm run simular -- --medidor MED-1A2B3C4D --una 6500     (una sola lectura de 6500 W)
 *
 * El código del medidor aparece en la app en Más → Mi hogar → Medidor.
 * Autenticación: cada lectura lleva el encabezado X-Sensor-Token. El simulador
 * lo calcula con DEVICE_SECRET de backend/.env, o lo puedes pasar con --token.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createHmac } = require('crypto');

const OPCIONES = {
  medidor: { def: null, ayuda: 'Código del medidor (obligatorio), p. ej. MED-1A2B3C4D' },
  url: { def: 'http://localhost:3000', ayuda: 'URL del backend' },
  intervalo: { def: 10, ayuda: 'Segundos entre lecturas en modo en vivo' },
  base: { def: 180, ayuda: 'Consumo de fondo: refrigerador y aparatos en espera (W)' },
  minisplit: { def: 1400, ayuda: 'Potencia del minisplit cuando está encendido (W); 0 = sin minisplit' },
  picos: { def: 0.03, ayuda: 'Probabilidad (0-1) de un pico de consumo en modo en vivo' },
  pico: { def: 6500, ayuda: 'Potencia de un pico (W); pon un valor mayor al límite de consumo alto' },
  historico: { def: 0, ayuda: 'Días hacia atrás a rellenar (0 = modo en vivo)' },
  paso: { def: 5, ayuda: 'Minutos entre lecturas en modo histórico' },
  una: { def: null, ayuda: 'Envía una sola lectura con este valor (W) y termina' },
  token: { def: null, ayuda: 'Token del medidor (si no, se calcula con DEVICE_SECRET de .env)' },
  demo: { def: null, ayuda: 'Días a rellenar y después seguir en vivo (solo rellena lo que falte)' },
  desde: { def: null, ayuda: 'Inicio de un rango a rellenar, "AAAA-MM-DD HH:MM" (con --hasta, sin modo en vivo)' },
  hasta: { def: null, ayuda: 'Fin del rango: después de esta hora el medidor "se desconecta" y no hay datos' },
};

function tokenDe(cfg) {
  if (cfg.token) return cfg.token;
  if (!process.env.DEVICE_SECRET) throw new Error('Falta DEVICE_SECRET en backend/.env o la opción --token');
  return createHmac('sha256', process.env.DEVICE_SECRET).update(String(cfg.medidor)).digest('hex').slice(0, 40);
}

function leerArgs(argv) {
  const out = Object.fromEntries(Object.entries(OPCIONES).map(([k, v]) => [k, v.def]));
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { out.ayuda = true; continue; }
    if (a === '--demo' && (argv[i + 1] === undefined || argv[i + 1].startsWith('--'))) { out.demo = 20; continue; }
    const m = a.match(/^--([a-z]+)(?:=(.*))?$/);
    if (!m || !(m[1] in OPCIONES)) throw new Error(`Opción desconocida: ${a}`);
    const valor = m[2] ?? argv[++i];
    if (valor === undefined) throw new Error(`Falta el valor de --${m[1]}`);
    out[m[1]] = typeof OPCIONES[m[1]].def === 'number' || m[1] === 'demo' ? Number(valor) : valor;
  }
  return out;
}

const pad = n => String(n).padStart(2, '0');
// Hora local en el formato DATETIME de MySQL
const formatoFecha = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// Potencia "realista" de una casa (W) según la hora, con ruido de ±10 %.
function potenciaEsperada(fecha, cfg) {
  const h = fecha.getHours() + fecha.getMinutes() / 60;
  const finDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
  let w = cfg.base + (Math.sin(fecha.getTime() / 900000) > 0.3 ? 120 : 0); // ciclos del refrigerador
  if (h >= 6.5 && h < 8.5) w += 900 * Math.random();                       // cocina, plancha, secadora de pelo
  if (h >= 13 && h < 15) w += 600;                                         // comida (microondas, estufa eléctrica)
  if (h >= 15 && h < 24) w += cfg.minisplit * (h < 19 ? 1 : 0.8);          // minisplit en la tarde y noche
  if (h >= 19 && h < 23.5) w += 350;                                       // TV, luces, computadora
  if (h < 6) w += cfg.minisplit * 0.7;                                     // minisplit mientras duermen
  if (finDeSemana && h >= 10 && h < 13) w += 800;                          // lavadora y bomba de agua
  const ruido = 1 + (Math.random() * 2 - 1) * 0.1;
  return Math.max(0, Math.round(w * ruido * 10) / 10);
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Envía una lectura. Si el servidor pide esperar (429, demasiadas peticiones), espera y reintenta.
async function enviar(cfg, fecha, valor, intento = 1) {
  const res = await fetch(`${cfg.url.replace(/\/$/, '')}/lecturas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sensor-Token': tokenDe(cfg) },
    body: JSON.stringify({ codigoMedidor: cfg.medidor, fechaHora: formatoFecha(fecha), valor }),
  });
  if (res.status === 429 && intento <= 10) {
    const segundos = Number(res.headers.get('Retry-After')) || 15;
    if (!enviar.avisado) { process.stdout.write(`\n  El servidor pidió una pausa; continúo en ${segundos} s…\n`); enviar.avisado = true; }
    await esperar(segundos * 1000);
    enviar.avisado = false;
    return enviar(cfg, fecha, valor, intento + 1);
  }
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const j = await res.json(); msg += ` — ${j.mensaje || ''}`; } catch { /* sin cuerpo */ }
    throw new Error(msg.trim());
  }
}

function leerFecha(texto, nombre) {
  const m = String(texto).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!m) throw new Error(`--${nombre} debe tener el formato "AAAA-MM-DD HH:MM"`);
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
}

async function modoHistorico(cfg, desde = null, rango = null) {
  const fin = rango ? rango.fin : new Date();
  fin.setSeconds(0, 0);
  let inicio = rango ? rango.inicio : new Date(fin.getTime() - cfg.historico * 24 * 3600 * 1000);
  if (desde && desde > inicio) inicio = new Date(desde.getTime() + cfg.paso * 60 * 1000);
  if (inicio >= fin) { console.log('El historial ya está completo.'); return; }
  const fechas = [];
  for (let t = inicio.getTime(); t <= fin.getTime(); t += cfg.paso * 60 * 1000) fechas.push(new Date(t));

  console.log(`Rellenando ${fechas.length} lecturas de ${cfg.medidor} (${formatoFecha(inicio)} a ${formatoFecha(fin)}, cada ${cfg.paso} min)…`);
  let ok = 0, dup = 0;
  const LOTE = 8; // peticiones en paralelo
  for (let i = 0; i < fechas.length; i += LOTE) {
    await Promise.all(fechas.slice(i, i + LOTE).map(f =>
      enviar(cfg, f, potenciaEsperada(f, cfg))
        .then(() => ok++)
        .catch(e => { if (/duplicad/i.test(e.message)) dup++; else throw e; })));
    process.stdout.write(`\r  ${Math.min(i + LOTE, fechas.length)}/${fechas.length}`);
    await esperar(150); // no saturar el límite de peticiones
  }
  console.log(`\nListo: ${ok} lecturas nuevas${dup ? `, ${dup} ya existían` : ''}.`);
}

async function modoEnVivo(cfg) {
  console.log(`Simulando ${cfg.medidor} → ${cfg.url}/lecturas cada ${cfg.intervalo}s (Ctrl+C para detener)`);
  const tick = async () => {
    const ahora = new Date();
    const esPico = Math.random() < cfg.picos;
    const valor = esPico ? cfg.pico : potenciaEsperada(ahora, cfg);
    try {
      await enviar(cfg, ahora, valor);
      console.log(`${formatoFecha(ahora)}  ${String(valor).padStart(7)} W${esPico ? '  ⚡ pico' : ''}`);
    } catch (e) {
      console.error(`${formatoFecha(ahora)}  error: ${e.message}`);
    }
  };
  await tick();
  setInterval(tick, cfg.intervalo * 1000);
}

/* ---------------- medidor automático (lee la base de datos) ---------------- */
async function conectarBD() {
  const mysql = require('mysql2/promise');
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'PowerTech',
  });
}

async function elegirMedidor() {
  const conn = await conectarBD();
  try {
    const [rows] = await conn.query(`
      SELECT m.codigoMedidor, m.activo, h.nombre AS hogar, u.nombre AS titular,
             (SELECT MAX(l.fechaHora) FROM LECTURAS l WHERE l.codigoMedidor = m.codigoMedidor) AS ultima
      FROM MEDIDORES m JOIN HOGARES h ON h.idHogar = m.idHogar JOIN USUARIOS u ON u.idUsuario = h.idUsuario
      ORDER BY m.instalado`);
    if (!rows.length) throw new Error('No hay ningún sensor registrado. En la app ve a Más → Datos y sensor → Registrar sensor.');
    let m = rows[0];
    if (rows.length > 1) {
      console.log('Sensores registrados:');
      rows.forEach((r, i) => console.log(`  ${i + 1}. ${r.codigoMedidor} · ${r.hogar} (${r.titular})`));
      const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
      const n = await new Promise((res) => rl.question('¿Cuál quieres simular? (número): ', (r) => { rl.close(); res(Number(r)); }));
      m = rows[n - 1];
      if (!m) throw new Error('Número no válido');
    }
    if (!m.activo) throw new Error(`El sensor ${m.codigoMedidor} está pausado. Reanúdalo en la app (Más → Datos y sensor).`);
    console.log(`Sensor: ${m.codigoMedidor} · ${m.hogar} (${m.titular})`);
    return { codigo: m.codigoMedidor, ultima: m.ultima ? new Date(m.ultima) : null };
  } finally {
    await conn.end();
  }
}

async function backendEncendido(cfg) {
  try {
    await fetch(`${cfg.url.replace(/\/$/, '')}/lecturas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const cfg = leerArgs(process.argv.slice(2));
  if (cfg.ayuda) {
    console.log('Uso: npm run demo   o   npm run simular -- --medidor <codigoMedidor> [opciones]\n');
    for (const [k, v] of Object.entries(OPCIONES)) console.log(`  --${k.padEnd(10)} ${v.ayuda}${v.def !== null ? ` (por defecto: ${v.def})` : ''}`);
    process.exit(0);
  }
  if (!(await backendEncendido(cfg))) {
    throw new Error('El programa no está encendido. Primero abre INICIAR.bat y espera a que cargue.');
  }
  let ultima = null;
  if (!cfg.medidor) ({ codigo: cfg.medidor, ultima } = await elegirMedidor());

  if (cfg.una !== null) {
    const ahora = new Date();
    await enviar(cfg, ahora, Number(cfg.una));
    console.log(`Lectura enviada: ${cfg.medidor} = ${cfg.una} W (${formatoFecha(ahora)})`);
  } else if (cfg.desde || cfg.hasta) {
    if (!cfg.desde || !cfg.hasta) throw new Error('Usa --desde y --hasta juntos');
    const rango = { inicio: leerFecha(cfg.desde, 'desde'), fin: leerFecha(cfg.hasta, 'hasta') };
    if (rango.fin <= rango.inicio) throw new Error('--hasta debe ser después de --desde');
    if (rango.fin > new Date()) throw new Error('--hasta no puede ser una fecha futura');
    // Si ya hay datos dentro del rango, se continúa después de la última lectura
    const continuar = ultima && ultima >= rango.inicio && ultima < rango.fin ? ultima : null;
    await modoHistorico(cfg, continuar, rango);
    if (ultima && ultima > rango.fin) {
      console.log(`\nOjo: el sensor ya tenía lecturas después del ${formatoFecha(rango.fin).slice(0, 16)} (la última: ${formatoFecha(ultima).slice(0, 16)}).`);
      console.log('Para que se vea desconectado desde esa hora, deja la base limpia con CONFIGURAR_BASE.bat y vuelve a simular.');
    } else {
      console.log(`Después del ${formatoFecha(rango.fin).slice(0, 16)} no hay lecturas: el sensor quedó "desconectado".`);
    }
  } else if (cfg.demo) {
    cfg.historico = cfg.demo;
    await modoHistorico(cfg, ultima);
    console.log('Ahora sigue en vivo. Deja esta ventana abierta mientras usas la app.\n');
    await modoEnVivo(cfg);
  } else if (cfg.historico > 0) {
    await modoHistorico(cfg, ultima);
  } else {
    await modoEnVivo(cfg);
  }
}

main().catch(e => {
  console.error(`Error: ${e.message}`);
  if (/fetch failed|ECONNREFUSED/i.test(e.message + (e.cause?.code || ''))) console.error('¿Está corriendo el backend? (npm run dev en /backend)');
  process.exit(1);
});
