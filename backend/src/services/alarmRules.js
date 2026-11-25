// Reglas para generar avisos (alarmas) del hogar.
// Funciones puras (sin base de datos) para poder probarlas fácilmente.
//
// Con cada lectura del medidor general:
//  RN-01 Consumo alto: la casa supera umbralAltoW              → nivel 4 (5 si supera 150 %)
//  RN-02 Modo vacaciones: la casa consume más que consumoBaseW → nivel 4
//        (hay algo encendido mientras no hay nadie)
//  RN-03 Horas de sueño: la casa consume más que consumoNocheW → nivel 2
//        (quedó algo encendido al dormir)
//
// Con el consumo del periodo bimestral (se revisa cada cierto tiempo):
//  RN-04 Meta bimestral: el pronóstico supera la meta del hogar → nivel 3
//  RN-05 Riesgo DAC: el consumo mensual estimado supera el
//        límite de alto consumo de la tarifa                     → nivel 4

const TIPOS = {
  ALTO: 'Consumo alto',
  VACACIONES: 'Consumo en vacaciones',
  SUENO: 'Consumo en horas de sueño',
  META: 'Meta bimestral en riesgo',
  DAC: 'Riesgo de tarifa DAC',
};

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const hora = (t) => {
  if (!t) return null;
  const m = String(t).match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  return m ? `${m[1]}:${m[2]}:${m[3] || '00'}` : null;
};
const corta = (t) => (hora(t) || '').slice(0, 5);

// "YYYY-MM-DD HH:MM:SS" o ISO → "HH:MM:SS" (hora local enviada por el medidor)
function horaDeLectura(fechaHora) {
  const m = String(fechaHora).match(/[ T](\d{2}:\d{2}(?::\d{2})?)/);
  return m ? hora(m[1]) : null;
}

// ¿La hora cae en el rango [inicio, fin)? El rango puede cruzar la medianoche (23:00–06:00).
function enRango(h, inicio, fin) {
  const e = hora(inicio), s = hora(fin);
  if (!h || !e || !s || e === s) return false;
  return e < s ? h >= e && h < s : h >= e || h < s;
}

const enHorasDeSueno = (fechaHora, inicio, fin) => enRango(horaDeLectura(fechaHora), inicio, fin);

function evaluarLectura({ valor, fechaHora, umbralAltoW, consumoBaseW, consumoNocheW, horaDormirInicio, horaDormirFin, modoVacaciones }) {
  const v = Number(valor);
  const alto = num(umbralAltoW);
  const base = num(consumoBaseW);
  const noche = num(consumoNocheW);
  const alarmas = [];

  if (alto !== null && v > alto) {
    alarmas.push({
      tipo: TIPOS.ALTO,
      nivel: v > alto * 1.5 ? 5 : 4,
      detalle: `La casa está consumiendo ${Math.round(v)} W, más que el límite de ${Math.round(alto)} W. Revisa si hay varios aparatos grandes encendidos a la vez.`,
    });
  }
  if (modoVacaciones && base !== null && v > base) {
    alarmas.push({
      tipo: TIPOS.VACACIONES,
      nivel: 4,
      detalle: `La casa consume ${Math.round(v)} W en modo vacaciones (lo normal sin nadie es hasta ${Math.round(base)} W). Puede haber algo encendido.`,
    });
  } else if (!modoVacaciones && noche !== null && v > noche && enHorasDeSueno(fechaHora, horaDormirInicio, horaDormirFin)) {
    alarmas.push({
      tipo: TIPOS.SUENO,
      nivel: 2,
      detalle: `Son horas de dormir (${corta(horaDormirInicio)}–${corta(horaDormirFin)}) y la casa consume ${Math.round(v)} W, más de lo normal de noche (${Math.round(noche)} W). ¿Quedó algo encendido?`,
    });
  }
  return alarmas;
}

// pronostico: resultado de consumoService.resumenPeriodo
function evaluarPeriodo({ proyeccionKwh, metaBimestralKwh, kwhMensualEstimado, limiteDAC, confiable = true }) {
  const alarmas = [];
  if (!confiable) return alarmas; // con muy pocos días de datos no se avisa
  const meta = num(metaBimestralKwh);
  if (meta && proyeccionKwh > meta) {
    alarmas.push({
      tipo: TIPOS.META,
      nivel: 3,
      detalle: `A este ritmo el bimestre cerrará en unos ${Math.round(proyeccionKwh)} kWh, arriba de tu meta de ${Math.round(meta)} kWh.`,
    });
  }
  if (limiteDAC && kwhMensualEstimado > limiteDAC) {
    alarmas.push({
      tipo: TIPOS.DAC,
      nivel: 4,
      detalle: `El consumo estimado es de ${Math.round(kwhMensualEstimado)} kWh al mes; el límite de tu tarifa es ${limiteDAC}. Si el promedio de 12 meses lo supera, CFE te cambia a la tarifa DAC, mucho más cara.`,
    });
  }
  return alarmas;
}

module.exports = { evaluarLectura, evaluarPeriodo, enHorasDeSueno, enRango, horaDeLectura, TIPOS };
