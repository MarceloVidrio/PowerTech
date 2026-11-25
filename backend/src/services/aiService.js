const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");
require("../config/env");

const db = require("../config/db");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});


// ============================================================
// CONFIGURACIÓN
// ============================================================

const MODEL_NAME = "gemini-3.8-flash";
const FALLBACK_MODEL_NAME = "gemini-3.7-flash";

// Espera entre intentos para manejar errores temporales de Gemini.
const esperar = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Genera contenido con reintentos y un modelo de respaldo.
// Esto evita que PowerBot falle inmediatamente cuando Gemini
// devuelve errores temporales como 503 (alta demanda) o 429.
async function generarContenidoSeguro(prompt) {
  let ultimoError = null;

  // ==========================================================
  // 1. GROQ - PROVEEDOR PRINCIPAL
  // ==========================================================

  if (process.env.GROQ_API_KEY) {

    console.log(
      "PowerBot: intentando primero con Groq..."
    );

    for (let intento = 1; intento <= 2; intento++) {

      try {

        console.log(
          `PowerBot - Groq - intento ${intento}`
        );

        const solicitud = groq.chat.completions.create({

          model: "openai/gpt-oss-120b",

          messages: [
            {
              role: "user",
              content: prompt
            }
          ],

          temperature: 0.3
        });

        const resultado = await Promise.race([

          solicitud,

          new Promise((_, reject) =>
            setTimeout(() => {
              reject(
                new Error(
                  "TIMEOUT_GROQ: Groq tardó demasiado en responder."
                )
              );
            }, 15000)
          )

        ]);

        console.log(
          "PowerBot: respuesta recibida de Groq."
        );

        return resultado.choices[0].message.content;

      } catch (error) {

        ultimoError = error;

        const mensaje = error?.message || "";

        console.error(
          `PowerBot - Groq - intento ${intento}:`,
          mensaje
        );

        const esErrorTemporal =
          mensaje.includes("429") ||
          mensaje.includes("500") ||
          mensaje.includes("502") ||
          mensaje.includes("503") ||
          mensaje.includes("504") ||
          mensaje.includes("rate limit") ||
          mensaje.includes("Rate limit") ||
          mensaje.includes("Too Many Requests") ||
          mensaje.includes("TIMEOUT_GROQ") ||
          mensaje.includes("temporarily unavailable");

        if (!esErrorTemporal || intento === 2) {
          break;
        }

        console.log(
          "PowerBot: esperando antes del siguiente intento de Groq..."
        );

        await esperar(2000);
      }
    }

    console.warn(
      "PowerBot: Groq no respondió correctamente. Cambiando a Gemini..."
    );

  } else {

    console.warn(
      "PowerBot: no existe GROQ_API_KEY. Se utilizará Gemini."
    );
  }


  // ==========================================================
  // 2. GEMINI - PROVEEDOR DE RESPALDO
  // ==========================================================

  if (!process.env.GEMINI_API_KEY) {

    throw ultimoError || new Error(
      "PowerBot no tiene configurada una API de Groq ni una API de Gemini."
    );
  }

  const modelosGemini = [
    MODEL_NAME,
    FALLBACK_MODEL_NAME
  ];

  for (const nombreModelo of modelosGemini) {

    const model = genAI.getGenerativeModel({
      model: nombreModelo
    });

    console.log(
      `PowerBot: intentando con Gemini (${nombreModelo}) como respaldo...`
    );

    for (let intento = 1; intento <= 2; intento++) {

      try {

        console.log(
          `PowerBot - Gemini ${nombreModelo} - intento ${intento}`
        );

        const solicitud = model.generateContent(prompt);

        const resultado = await Promise.race([

          solicitud,

          new Promise((_, reject) =>
            setTimeout(() => {
              reject(
                new Error(
                  "TIMEOUT_GEMINI: Gemini tardó demasiado en responder."
                )
              );
            }, 15000)
          )

        ]);

        console.log(
          `PowerBot: respuesta recibida de Gemini (${nombreModelo})`
        );

        return resultado.response.text();

      } catch (error) {

        ultimoError = error;

        const mensaje = error?.message || "";

        console.error(
          `PowerBot - Gemini ${nombreModelo} - intento ${intento}:`,
          mensaje
        );

        const esCuotaAgotada =
          mensaje.includes("429") &&
          (
            mensaje.includes("quota") ||
            mensaje.includes("Quota") ||
            mensaje.includes("GenerateRequestsPerDay") ||
            mensaje.includes("free_tier") ||
            mensaje.includes("rate limit")
          );

        if (esCuotaAgotada) {

          console.warn(
            `PowerBot: cuota de Gemini agotada en ${nombreModelo}.`
          );

          break;
        }

        const esErrorTemporal =
          mensaje.includes("429") ||
          mensaje.includes("500") ||
          mensaje.includes("502") ||
          mensaje.includes("503") ||
          mensaje.includes("504") ||
          mensaje.includes("Service Unavailable") ||
          mensaje.includes("high demand") ||
          mensaje.includes("Too Many Requests") ||
          mensaje.includes("TIMEOUT_GEMINI") ||
          mensaje.includes("temporarily unavailable");

        if (!esErrorTemporal) {

          console.warn(
            "PowerBot: error no temporal de Gemini."
          );

          break;
        }

        if (intento < 2) {

          console.log(
            "PowerBot: esperando antes del siguiente intento de Gemini..."
          );

          await esperar(2000);
        }
      }
    }

    console.warn(
      `PowerBot: Gemini ${nombreModelo} no respondió correctamente.`
    );
  }


  // ==========================================================
  // 3. NINGÚN PROVEEDOR RESPONDIÓ
  // ==========================================================

  throw ultimoError || new Error(
    "PowerBot no pudo comunicarse con Groq ni con Gemini."
  );
}
// ============================================================
// DATOS DEL HOGAR
// Todas las consultas reciben "owner" (el titular del hogar de quien
// pregunta) y filtran por él: PowerBot nunca ve datos de otras casas.
// ============================================================

const own = require("./ownership");
const { resumenPeriodo, estimarAparatos } = require("./consumoService");
const { describirTarifa } = require("./tarifaCFE");

async function obtenerHogar(owner) {
  try {
    return await own.hogar(owner);
  } catch {
    return null;
  }
}

async function obtenerAparatos(idHogar) {
  return db.query(
    "SELECT nombre, tipo, cuarto, potenciaW, horasDia, controlUrl IS NOT NULL AS conEnchufe FROM APARATOS WHERE idHogar = ? ORDER BY cuarto, nombre",
    [idHogar]);
}

async function obtenerAlarmas(idHogar, estado = null) {
  return db.query(`
    SELECT tipoAlarma, nivel, estado, fechaHora, detalle FROM ALARMAS
    WHERE idHogar = ? ${estado ? "AND estado = ?" : ""}
    ORDER BY fechaHora DESC LIMIT 30`, estado ? [idHogar, estado] : [idHogar]);
}

// Potencia promedio por hora de las últimas 24 h (W)
async function obtenerUltimas24h(codigoMedidor) {
  if (!codigoMedidor) return [];
  return db.query(`
    SELECT DATE_FORMAT(fechaHora, '%Y-%m-%d %H:00') AS hora, ROUND(AVG(valor)) AS promedioW, ROUND(MAX(valor)) AS maximoW
    FROM LECTURAS WHERE codigoMedidor = ? AND fechaHora >= NOW() - INTERVAL 24 HOUR
    GROUP BY DATE_FORMAT(fechaHora, '%Y-%m-%d %H:00') ORDER BY hora`, [codigoMedidor]);
}

async function contextoDelHogar(owner, texto) {
  const h = await obtenerHogar(owner);
  if (!h) return { hogar: null, nota: "El titular todavía no configura su hogar en PowerTech." };

  const contexto = {
    hogar: {
      nombre: h.nombre, ciudad: h.ciudad, tarifaCFE: h.tarifa, personas: h.personas,
      metaBimestralKwh: h.metaBimestralKwh, modoVacaciones: !!h.modoVacaciones,
      horasDeSueno: `${String(h.horaDormirInicio).slice(0, 5)}–${String(h.horaDormirFin).slice(0, 5)}`,
      consumoMinimoW: Number(h.consumoBaseW), consumoNormalNocheW: Number(h.consumoNocheW), limiteConsumoAltoW: Number(h.umbralAltoW),
      medidor: h.codigoMedidor ? { codigo: h.codigoMedidor, activo: !!h.medidorActivo } : "sin medidor registrado",
    },
  };
  const aparatos = await obtenerAparatos(h.idHogar);
  contexto.aparatos = aparatos;

  if (h.codigoMedidor) {
    const r = await resumenPeriodo(h, h.codigoMedidor);
    contexto.bimestreActual = {
      periodo: r.periodo, consumidoKwh: r.consumido, promedioDiarioKwh: r.promedioDiario,
      pronosticoCierreKwh: r.proyeccion, pronosticoConfiable: r.confiable,
      reciboEstimadoHastaHoy: r.reciboActual.total, reciboEstimadoAlCierre: r.reciboProyectado.total,
      escalonActual: r.reciboProyectado.escalonActual, escalones: r.reciboProyectado.escalones,
      riesgoDAC: r.dac, meta: r.meta,
    };
  }
  contexto.consumoEstimadoPorAparato = estimarAparatos(aparatos);

  const t = texto.toLowerCase();
  const menciona = (...palabras) => palabras.some((p) => t.includes(p));
  if (menciona("hoy", "ahorita", "ahora", "noche", "madrugada", "hora", "pico", "potencia", "watt", "gráfica", "grafica", "24")) {
    contexto.ultimas24hPorHora = await obtenerUltimas24h(h.codigoMedidor);
  }
  if (menciona("aviso", "alarma", "alerta", "problema", "por qué", "porque")) {
    contexto.avisos = await obtenerAlarmas(h.idHogar);
  } else {
    contexto.avisosActivos = await obtenerAlarmas(h.idHogar, "ACTIVA");
  }
  if (menciona("tarifa", "recibo", "escalón", "escalon", "dac", "subsidio", "precio", "cobra", "pagar", "cuesta")) {
    contexto.tarifa = describirTarifa(h.tarifa, h.mesInicioVerano);
  }
  return contexto;
}


// ============================================================
// POWERBOT
// ============================================================

async function obtenerConsejoPowerBot(consulta, owner) {

  if (!owner) throw new Error("PowerBot requiere el usuario que consulta");

  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    throw new Error("No existe GEMINI_API_KEY ni GROQ_API_KEY en el archivo .env");
  }

  const pregunta = consulta.trim();
  const contexto = await contextoDelHogar(owner, pregunta);

  const prompt = `
Eres **PowerBot**, el asistente de **PowerTech Hogar**, una app que ayuda a
las familias mexicanas a entender y bajar su recibo de luz de CFE.

============================================================
CÓMO FUNCIONA POWERTECH HOGAR
============================================================

- Un sensor (por ejemplo Sonoff POW Ring) instalado en la pastilla principal
  del centro de carga (no en el medidor de CFE) mide la potencia TOTAL de la casa (W) y la envía cada pocos segundos.
- Con esas lecturas la app calcula la energía (kWh), el consumo del bimestre,
  un pronóstico al cierre y el recibo estimado con la tarifa doméstica de CFE.
- El sensor NO sabe qué aparato consume: el consumo por aparato es una
  ESTIMACIÓN hecha con la potencia y las horas de uso que capturó la familia.
- CFE cobra por escalones (básico, intermedio, excedente). En las tarifas
  1A–1F los escalones son más amplios en los 6 meses de verano. Si el promedio
  mensual de 12 meses supera el límite de la tarifa, la casa pasa a DAC (sin subsidio).
- Avisos: consumo alto, consumo en horas de sueño, consumo en modo vacaciones,
  meta bimestral en riesgo y riesgo de tarifa DAC.
- Los aparatos con enchufe inteligente se pueden apagar desde la app y apagarse
  solos al dormir o al activar el modo vacaciones.

============================================================
DATOS REALES DE ESTA CASA
============================================================

${JSON.stringify(contexto, null, 2)}

============================================================
REGLAS
============================================================

1. Usa solo estos datos; no inventes cifras. Si algo no está, dilo.
2. W es potencia y kWh es energía; no los confundas.
3. Aclara que el recibo es una ESTIMACIÓN; el oficial lo emite CFE.
4. Da consejos de ahorro prácticos para una casa en México (minisplit a 24–25 °C,
   limpiar filtros, refrigerador, "consumo fantasma", horarios de uso, etc.),
   relacionados con los datos cuando sea posible.
5. Si preguntan cómo usar una sección de la app, explícalo de forma sencilla.
6. Responde siempre en español, en tono amable y cercano.
7. Markdown sencillo: **negritas** para cifras importantes, listas con viñetas,
   títulos pequeños. NO uses tablas.
8. Respuestas cortas y fáciles de leer en un panel de unos 400 px.

============================================================
PREGUNTA
============================================================

${pregunta}

Responde directamente.
`;

  return await generarContenidoSeguro(prompt);
}


// ============================================================
// EXPORTACIONES
// ============================================================

module.exports = {
  obtenerConsejoPowerBot,
  contextoDelHogar,
};
