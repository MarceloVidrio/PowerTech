// Agrega a la casa los aparatos que corresponden al perfil de consumo del medidor
// (refrigerador, minisplit, cocina, TV, luces, lavadora y bomba). Con ellos la
// estimación por aparato coincide con lo que mide el medidor (~27 kWh al día).
// No duplica: si ya existe un aparato con el mismo nombre, lo deja como está.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const readline = require('readline');

const APARATOS = [
  { nombre: 'Minisplit recámara principal', tipo: 'MINISPLIT', cuarto: 'Recámara principal', potenciaW: 1400, horasDia: 12.2 },
  { nombre: 'Refrigerador', tipo: 'REFRIGERADOR', cuarto: 'Cocina', potenciaW: 150, horasDia: 24 },
  { nombre: 'Módem, cargadores y aparatos en espera', tipo: 'OTRO', cuarto: 'Sala', potenciaW: 80, horasDia: 24 },
  { nombre: 'Microondas y cafetera', tipo: 'MICROONDAS', cuarto: 'Cocina', potenciaW: 1000, horasDia: 2.1 },
  { nombre: 'Televisión', tipo: 'TELEVISION', cuarto: 'Sala', potenciaW: 150, horasDia: 4.5 },
  { nombre: 'Iluminación', tipo: 'ILUMINACION', cuarto: 'Sala', potenciaW: 200, horasDia: 4.5 },
  { nombre: 'Lavadora', tipo: 'LAVADORA', cuarto: 'Lavandería', potenciaW: 500, horasDia: 0.9 },
  { nombre: 'Bomba de agua', tipo: 'BOMBA', cuarto: 'Patio', potenciaW: 750, horasDia: 0.4 },
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'PowerTech',
  });
  try {
    const [hogares] = await conn.query(
      'SELECT h.idHogar, h.nombre, u.nombre AS titular FROM HOGARES h JOIN USUARIOS u ON u.idUsuario = h.idUsuario ORDER BY h.idHogar');
    if (!hogares.length) throw new Error('No hay ningún hogar configurado. En la app ve a Más → Datos y sensor.');
    let h = hogares[0];
    if (hogares.length > 1) {
      hogares.forEach((x, i) => console.log(`  ${i + 1}. ${x.nombre} (${x.titular})`));
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const n = await new Promise((r) => rl.question('¿A qué casa? (número): ', (v) => { rl.close(); r(Number(v)); }));
      h = hogares[n - 1];
      if (!h) throw new Error('Número no válido');
    }
    console.log(`Casa: ${h.nombre} (${h.titular})\n`);
    for (const a of APARATOS) {
      const [ya] = await conn.query('SELECT 1 FROM APARATOS WHERE idHogar = ? AND nombre = ?', [h.idHogar, a.nombre]);
      if (ya.length) { console.log(`  · ${a.nombre}: ya existía`); continue; }
      await conn.query('INSERT INTO APARATOS SET ?', [{ ...a, idHogar: h.idHogar }]);
      console.log(`  ✓ ${a.nombre} (${a.potenciaW} W, ${a.horasDia} h/día)`);
    }
    console.log('\nListo. Recarga la app (F5) y revisa Aparatos y Consumo.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => { console.error(`\n✗ ${e.message}`); process.exit(1); });
