// Apagado automático con enchufes inteligentes.
//  · Al empezar las horas de sueño apaga los aparatos marcados "apagar al dormir".
//  · Al activar el modo vacaciones apaga los marcados "apagar en vacaciones".
// Se revisa cada minuto; cada aparato se apaga una sola vez por noche.
const db = require('../config/db');
const { enviarComando } = require('./controlService');
const { enRango } = require('./alarmRules');
const { fechaISO } = require('./tarifaCFE');

const apagadosHoy = new Map(); // idAparato → "YYYY-MM-DD" de la noche en que se apagó

const hhmmss = (d) => d.toTimeString().slice(0, 8);
// La "noche" se identifica por la fecha en que empezó (si es de madrugada, es la del día anterior).
function nocheDe(d, horaInicio) {
  const n = new Date(d);
  if (hhmmss(d) < String(horaInicio)) n.setDate(n.getDate() - 1);
  return fechaISO(n);
}

async function apagar(aparatos, motivo) {
  const resultados = [];
  for (const a of aparatos) {
    try {
      await enviarComando(a.controlUrl, 'OFF');
      resultados.push({ idAparato: a.idAparato, nombre: a.nombre, ok: true });
    } catch (e) {
      console.error(`No se pudo apagar ${a.nombre} (${motivo}):`, e.message);
      resultados.push({ idAparato: a.idAparato, nombre: a.nombre, ok: false });
    }
  }
  return resultados;
}

// Apaga los aparatos marcados para vacaciones de un hogar (lo llama hogarController).
async function apagarPorVacaciones(idHogar) {
  const aparatos = await db.query(
    'SELECT idAparato, nombre, controlUrl FROM APARATOS WHERE idHogar = ? AND apagarEnVacaciones = 1 AND controlUrl IS NOT NULL', [idHogar]);
  return apagar(aparatos, 'vacaciones');
}

async function revisarHorasDeSueno(ahora = new Date()) {
  const aparatos = await db.query(`
    SELECT a.idAparato, a.nombre, a.controlUrl, h.horaDormirInicio, h.horaDormirFin
    FROM APARATOS a JOIN HOGARES h ON h.idHogar = a.idHogar
    WHERE a.apagarAlDormir = 1 AND a.controlUrl IS NOT NULL`);
  const pendientes = aparatos.filter((a) => {
    if (!enRango(hhmmss(ahora), a.horaDormirInicio, a.horaDormirFin)) return false;
    return apagadosHoy.get(a.idAparato) !== nocheDe(ahora, a.horaDormirInicio);
  });
  for (const a of pendientes) apagadosHoy.set(a.idAparato, nocheDe(ahora, a.horaDormirInicio));
  return apagar(pendientes, 'horas de sueño');
}

function iniciar() {
  const tick = () => revisarHorasDeSueno().catch((e) => console.error('Programador:', e.message));
  return setInterval(tick, 60 * 1000);
}

module.exports = { iniciar, revisarHorasDeSueno, apagarPorVacaciones, _apagadosHoy: apagadosHoy };
