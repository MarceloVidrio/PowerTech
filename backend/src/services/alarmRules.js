// Reglas de negocio para generar alarmas a partir de una lectura.
// Función pura (sin base de datos) para poder probarla fácilmente.
//
//  RN-01 Pico de consumo: valor > umbralAlto              → nivel 4 (5 si supera 150 %)
//  RN-02 Fuera de horario: fuera del horario del edificio
//        y valor > umbralBajo (equipo encendido)          → nivel 3
//  RN-03 Consumo bajo: dentro del horario y valor < umbralBajo
//        (equipo apagado o sensor desconectado)           → nivel 2

const TIPOS = {
  PICO: 'Pico de Consumo',
  FUERA_HORARIO: 'Consumo fuera de horario',
  BAJO: 'Consumo bajo',
};

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const hora = (t) => {
  if (!t) return null;
  const m = String(t).match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  return m ? `${m[1]}:${m[2]}:${m[3] || '00'}` : null;
};

// "YYYY-MM-DD HH:MM:SS" o ISO → "HH:MM:SS" (hora local enviada por el sensor)
function horaDeLectura(fechaHora) {
  const m = String(fechaHora).match(/[ T](\d{2}:\d{2}(?::\d{2})?)/);
  return m ? hora(m[1]) : null;
}

function dentroDeHorario(fechaHora, entrada, salida) {
  const h = horaDeLectura(fechaHora);
  const e = hora(entrada), s = hora(salida);
  if (!h || !e || !s) return null; // sin horario no se puede decidir
  return h >= e && h < s;
}

function evaluarLectura({ valor, fechaHora, umbralAlto, umbralBajo, unidad = 'W', horarioEntrada, horarioSalida }) {
  const v = Number(valor);
  const alto = num(umbralAlto);
  const bajo = num(umbralBajo);
  const enHorario = dentroDeHorario(fechaHora, horarioEntrada, horarioSalida);
  const alarmas = [];

  if (alto !== null && v > alto) {
    alarmas.push({
      tipo: TIPOS.PICO,
      nivel: v > alto * 1.5 ? 5 : 4,
      detalle: `La lectura de ${v} ${unidad} supera el umbral alto de ${alto} ${unidad}`,
    });
  }
  if (bajo !== null && enHorario === false && v > bajo) {
    alarmas.push({
      tipo: TIPOS.FUERA_HORARIO,
      nivel: 3,
      detalle: `Consumo de ${v} ${unidad} fuera del horario del edificio (${hora(horarioEntrada)}–${hora(horarioSalida)})`,
    });
  }
  if (bajo !== null && enHorario === true && v < bajo) {
    alarmas.push({
      tipo: TIPOS.BAJO,
      nivel: 2,
      detalle: `La lectura de ${v} ${unidad} está por debajo del umbral bajo de ${bajo} ${unidad}: el equipo podría estar apagado o el sensor desconectado`,
    });
  }
  return alarmas;
}

module.exports = { evaluarLectura, dentroDeHorario, horaDeLectura, TIPOS };
