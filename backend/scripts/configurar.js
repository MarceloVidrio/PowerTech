// Asistente de configuración de PowerTech (se ejecuta con: npm run configurar).
//  1. Crea backend/.env si no existe y guarda la contraseña de MySQL.
//  2. Crea la base de datos PowerTech LIMPIA (sin usuarios ni datos).
//  3. Crea la cuenta del administrador del sistema (SUPERADMIN).
// Opciones:  --limpiar  → borra la base sin preguntar dos veces (sigue pidiendo confirmación escrita).
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const RAIZ = path.join(__dirname, '..');
const ENV = path.join(RAIZ, '.env');
const SQL_BASE = path.join(RAIZ, 'src', 'database', 'powertech.sql');
const SQL_MIGRACION = path.join(RAIZ, 'src', 'database', 'migracion_v3.sql');

/* ---------------- entrada por teclado ---------------- */
// Una sola interfaz para todo el script (las líneas se guardan en cola aunque
// lleguen antes de preguntar). En modo oculto se muestran * en lugar del texto.
let rl = null;
let lineas = null;
let oculto = false;
function interfaz() {
  if (rl) return rl;
  rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
  lineas = rl[Symbol.asyncIterator]();
  rl._writeToOutput = (s) => {
    if (!oculto) return rl.output.write(s);
    const prompt = rl.getPrompt();
    if (s.startsWith(prompt)) rl.output.write(prompt + '*'.repeat(s.length - prompt.length));
    else if (s === '\r\n' || s === '\n') rl.output.write(s);
    else rl.output.write('*'.repeat(s.length));
  };
  return rl;
}

async function preguntar(texto, { oculto: ocultar = false } = {}) {
  const r = interfaz();
  oculto = ocultar;
  r.setPrompt(texto);
  r.prompt();
  const { value, done } = await lineas.next();
  oculto = false;
  if (!process.stdin.isTTY) process.stdout.write('\n');
  if (done) throw new Error('Se cerró la entrada antes de terminar la configuración.');
  return value;
}

function cerrarEntrada() {
  if (rl) rl.close();
}

/* ---------------- archivo .env ---------------- */
function leerEnv() {
  if (!fs.existsSync(ENV)) {
    const plantilla = [path.join(RAIZ, 'env-PLANTILLA.txt'), path.join(RAIZ, '.env.example')].find((p) => fs.existsSync(p));
    if (!plantilla) throw new Error('No encontré backend/.env ni una plantilla para crearlo.');
    let txt = fs.readFileSync(plantilla, 'utf8');
    const crypto = require('crypto');
    // Si la plantilla trae secretos vacíos o de ejemplo, se generan nuevos.
    for (const k of ['JWT_SECRET', 'DEVICE_SECRET']) {
      const m = txt.match(new RegExp(`^${k}=(.*)$`, 'm'));
      if (!m || m[1].trim().length < 32) txt = txt.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${crypto.randomBytes(48).toString('hex')}`);
    }
    fs.writeFileSync(ENV, txt);
    console.log('· Se creó backend/.env');
  }
  return fs.readFileSync(ENV, 'utf8');
}

function valorEnv(txt, clave, porDefecto = '') {
  const m = txt.match(new RegExp(`^${clave}=(.*)$`, 'm'));
  if (!m) return porDefecto;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v || porDefecto;
}

function guardarEnv(txt, clave, valor) {
  const v = valor === '' ? '' : (valor.includes("'") ? `"${valor.replace(/"/g, '\\"')}"` : `'${valor}'`);
  const linea = `${clave}=${v}`;
  const nuevo = new RegExp(`^${clave}=.*$`, 'm').test(txt) ? txt.replace(new RegExp(`^${clave}=.*$`, 'm'), () => linea) : `${txt.trimEnd()}\n${linea}\n`;
  fs.writeFileSync(ENV, nuevo);
  return nuevo;
}

/* ---------------- MySQL ---------------- */
async function conectar(env, password) {
  const mysql = require('mysql2/promise');
  return mysql.createConnection({
    host: valorEnv(env, 'DB_HOST', 'localhost'),
    port: Number(valorEnv(env, 'DB_PORT', '3306')),
    user: valorEnv(env, 'DB_USER', 'root'),
    password,
    multipleStatements: true,
  });
}

async function main() {
  console.log('\n=========== PowerTech · Configuración ===========\n');
  let env = leerEnv();
  const base = valorEnv(env, 'DB_NAME', 'PowerTech');

  // 1) Contraseña de MySQL: primero la del .env; si no sirve, se pide.
  let password = valorEnv(env, 'DB_PASSWORD');
  let conn = null;
  if (password) {
    try { conn = await conectar(env, password); } catch { conn = null; }
  }
  for (let intento = 1; !conn && intento <= 3; intento++) {
    password = await preguntar('Contraseña de root de MySQL: ', { oculto: true });
    try {
      conn = await conectar(env, password);
    } catch (e) {
      console.log(`  ✗ No se pudo conectar (${e.code || e.message}).${intento < 3 ? ' Intenta de nuevo.' : ''}`);
    }
  }
  if (!conn) throw new Error('No se pudo conectar con MySQL. Revisa que el servicio MySQL84 esté iniciado y la contraseña.');
  if (valorEnv(env, 'DB_PASSWORD') !== password) {
    env = guardarEnv(env, 'DB_PASSWORD', password);
    console.log('· Contraseña de MySQL guardada en backend/.env');
  }
  console.log('✓ Conectado a MySQL\n');

  // 2) Base de datos limpia
  const [[existe]] = await conn.query('SELECT COUNT(*) AS n FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [base]);
  let crearLimpia = !existe.n;
  if (existe.n) {
    let usuarios = '?';
    try { [[{ n: usuarios }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${base}\`.USUARIOS`); } catch { /* base incompleta */ }
    console.log(`La base ${base} ya existe y tiene ${usuarios} usuario(s).`);
    const r = await preguntar('¿Borrar TODO y dejarla limpia, sin usuarios ni datos? Escribe SI para confirmar (Enter = conservarla): ');
    crearLimpia = r.trim().toUpperCase() === 'SI';
  }
  if (crearLimpia) {
    if (base !== 'PowerTech') throw new Error('El script powertech.sql crea la base "PowerTech"; ajusta DB_NAME=PowerTech en .env');
    await conn.query(fs.readFileSync(SQL_BASE, 'utf8'));
    console.log('✓ Base PowerTech creada limpia (sin usuarios)\n');
  } else {
    // Base conservada: si es de una versión anterior se actualiza.
    const [[col]] = await conn.query(
      "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'USUARIOS' AND COLUMN_NAME = 'activo'", [base]);
    if (!col.n) {
      await conn.query(fs.readFileSync(SQL_MIGRACION, 'utf8'));
      console.log('✓ Base actualizada para el administrador del sistema\n');
    } else {
      console.log('· Se conservó la base actual\n');
    }
  }

  // 3) Administrador del sistema
  const [[sa]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${base}\`.USUARIOS WHERE rol = 'SUPERADMIN'`);
  if (sa.n) {
    console.log(`Ya existe ${sa.n} administrador(es) del sistema.`);
    const r = await preguntar('¿Crear otro? (s/N): ');
    if (r.trim().toLowerCase() !== 's') { await conn.end(); return fin(); }
  }
  console.log('--- Cuenta del ADMINISTRADOR DEL SISTEMA ---');
  console.log('Con esta cuenta podrás ver a todos los usuarios y corregir sus problemas.\n');
  const { hashPassword } = require('../src/utils/security');
  const { contrasenaSegura, EMAIL_RE } = require('../src/utils/validar');
  for (;;) {
    const nombre = (await preguntar('Nombre de usuario: ')).trim();
    const email = (await preguntar('Correo electrónico: ')).trim().toLowerCase();
    const c1 = await preguntar('Contraseña (mín. 8, letras y números): ', { oculto: true });
    const c2 = await preguntar('Repite la contraseña: ', { oculto: true });
    const errores = [];
    if (!nombre || nombre.length > 50) errores.push('El nombre es obligatorio (máx. 50 caracteres)');
    if (!EMAIL_RE.test(email)) errores.push('El correo no es válido');
    contrasenaSegura(errores, c1);
    if (c1 !== c2) errores.push('Las contraseñas no coinciden');
    if (!errores.length) {
      try {
        await conn.query(`INSERT INTO \`${base}\`.USUARIOS (nombre, email, contrasena, rol) VALUES (?, ?, ?, 'SUPERADMIN')`,
          [nombre, email, hashPassword(c1)]);
        console.log(`\n✓ Administrador del sistema "${nombre}" creado. Inicia sesión con ${email}`);
        break;
      } catch (e) {
        errores.push(e.code === 'ER_DUP_ENTRY' ? 'Ese nombre o correo ya existe' : e.message);
      }
    }
    console.log(`\n  ✗ ${errores.join('\n  ✗ ')}\n  Intenta de nuevo.\n`);
  }
  await conn.end();
  fin();
}

function fin() {
  cerrarEntrada();
  console.log('\nListo. Para abrir PowerTech usa INICIAR.bat (o "npm run dev" en backend y frontend).\n');
}

main().catch((e) => {
  cerrarEntrada();
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
