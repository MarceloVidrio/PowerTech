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
// CONSULTAS A MYSQL
// Todas reciben "owner" (la cuenta del usuario que pregunta) y
// filtran por ella: PowerBot nunca ve datos de otras empresas.
// ============================================================

const query = (sql, params = []) => db.query(sql, params);

// 1. EDIFICIOS
async function obtenerEdificios(owner) {
  return query(`
    SELECT codigoEdificio, nombreEdificio, horarioEntrada, horarioSalida
    FROM EDIFICIOS WHERE idUsuario = ? ORDER BY nombreEdificio`, [owner]);
}

// 2. SALAS
async function obtenerSalas(owner, codigoEdificio = null) {
  return query(`
    SELECT s.codigoSala, s.nombreSala, s.codigoEdificio, e.nombreEdificio
    FROM SALAS s JOIN EDIFICIOS e ON s.codigoEdificio = e.codigoEdificio
    WHERE e.idUsuario = ? ${codigoEdificio ? 'AND s.codigoEdificio = ?' : ''}
    ORDER BY e.nombreEdificio, s.nombreSala`, codigoEdificio ? [owner, codigoEdificio] : [owner]);
}

// 3. DISPOSITIVOS
async function obtenerDispositivos(owner, codigoSala = null) {
  return query(`
    SELECT d.codigoDispositivo, d.nombre, d.marca,
           CASE d.tipo WHEN 'A' THEN 'Aire acondicionado' ELSE 'Computadora' END AS tipo,
           d.codigoSala, s.nombreSala, e.codigoEdificio, e.nombreEdificio
    FROM DISPOSITIVOS d
    JOIN SALAS s ON d.codigoSala = s.codigoSala
    JOIN EDIFICIOS e ON s.codigoEdificio = e.codigoEdificio
    WHERE e.idUsuario = ? ${codigoSala ? 'AND d.codigoSala = ?' : ''}
    ORDER BY e.nombreEdificio, s.nombreSala, d.nombre`, codigoSala ? [owner, codigoSala] : [owner]);
}

// 4. SENSORES
async function obtenerSensores(owner, codigoSensor = null) {
  return query(`
    SELECT se.codigoSensor, se.nombreSensor, se.tipoSensor, se.unidadMedida, se.umbralBajo, se.umbralAlto, se.activo,
           d.codigoDispositivo, d.nombre AS nombreDispositivo, s.codigoSala, s.nombreSala, e.codigoEdificio, e.nombreEdificio
    FROM SENSORES se
    LEFT JOIN DISPOSITIVOS d ON se.codigoDispositivo = d.codigoDispositivo
    LEFT JOIN SALAS s ON d.codigoSala = s.codigoSala
    LEFT JOIN EDIFICIOS e ON s.codigoEdificio = e.codigoEdificio
    WHERE se.idUsuario = ? ${codigoSensor ? 'AND se.codigoSensor = ?' : ''}
    ORDER BY e.nombreEdificio, s.nombreSala, se.nombreSensor`, codigoSensor ? [owner, codigoSensor] : [owner]);
}

// 5. ÚLTIMAS LECTURAS
async function obtenerLecturas(owner, codigoSensor = null, limite = 50) {
  return query(`
    SELECT l.codigoSensor, l.fechaHora, l.valor, l.detalle, se.nombreSensor, se.unidadMedida, se.umbralBajo, se.umbralAlto
    FROM LECTURAS l JOIN SENSORES se ON l.codigoSensor = se.codigoSensor
    WHERE se.idUsuario = ? ${codigoSensor ? 'AND l.codigoSensor = ?' : ''}
    ORDER BY l.fechaHora DESC LIMIT ?`, codigoSensor ? [owner, codigoSensor, limite] : [owner, limite]);
}

// 6. ALARMAS
async function obtenerAlarmas(owner, estado = null) {
  return query(`
    SELECT a.codigoAlarma, a.codigoEdificio, e.nombreEdificio, a.codigoSala, s.nombreSala,
           a.codigoSensor, se.nombreSensor, a.tipoAlarma, a.nivel, a.estado, a.fechaHora, a.detalle
    FROM ALARMAS a
    JOIN EDIFICIOS e ON a.codigoEdificio = e.codigoEdificio
    JOIN SALAS s ON a.codigoSala = s.codigoSala
    JOIN SENSORES se ON a.codigoSensor = se.codigoSensor
    WHERE e.idUsuario = ? ${estado ? 'AND a.estado = ?' : ''}
    ORDER BY a.fechaHora DESC LIMIT 100`, estado ? [owner, estado] : [owner]);
}

// 7. REPORTE DE SALA
async function obtenerReporteSala(owner, codigoSala) {
  return query(`
    SELECT v.codigoSala, v.nombreSala, v.codigoEdificio, v.nombreEdificio, v.indice_operatividad,
           v.total_dispositivos, v.alarmas_activas, v.cant_computadoras, v.cant_aires
    FROM VISTA_REPORTE_SALA v JOIN EDIFICIOS e ON e.codigoEdificio = v.codigoEdificio
    WHERE v.codigoSala = ? AND e.idUsuario = ?`, [codigoSala, owner]);
}

// 8. ANÁLISIS DE SENSOR
async function analizarSensor(owner, codigoSensor) {
  const sensorRows = await obtenerSensores(owner, codigoSensor);
  if (!sensorRows.length) return { encontrado: false, mensaje: `No existe el sensor ${codigoSensor}.` };
  const sensor = sensorRows[0];
  const lecturas = await obtenerLecturas(owner, codigoSensor, 100);
  const analisis = {
    sensor, lecturas, totalLecturas: lecturas.length, valorActual: null, valorAnterior: null,
    diferencia: null, porcentajeCambio: null, demandaMaxima: null, superaUmbral: false,
  };
  if (lecturas.length) {
    const ordenadas = [...lecturas].sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora));
    analisis.valorActual = Number(ordenadas[ordenadas.length - 1].valor);
    if (ordenadas.length >= 2) {
      analisis.valorAnterior = Number(ordenadas[ordenadas.length - 2].valor);
      analisis.diferencia = analisis.valorActual - analisis.valorAnterior;
      if (analisis.valorAnterior !== 0) analisis.porcentajeCambio = (analisis.diferencia / Math.abs(analisis.valorAnterior)) * 100;
    }
    analisis.demandaMaxima = Math.max(...ordenadas.map((l) => Number(l.valor)));
    analisis.superaUmbral = sensor.umbralAlto !== null && analisis.valorActual > Number(sensor.umbralAlto);
  }
  return analisis;
}

// 9. DETECCIÓN DE ANOMALÍAS
async function detectarAnomalias(owner) {
  const sensores = await obtenerSensores(owner);
  const resultados = [];
  for (const sensor of sensores) {
    const lecturas = await obtenerLecturas(owner, sensor.codigoSensor, 20);
    if (!lecturas.length) {
      resultados.push({ tipo: 'SIN_DATOS', sensor: sensor.codigoSensor, nombreSensor: sensor.nombreSensor, mensaje: 'El sensor no tiene lecturas registradas.' });
      continue;
    }
    const ultima = lecturas[0];
    if (sensor.umbralAlto !== null && Number(ultima.valor) > Number(sensor.umbralAlto)) {
      resultados.push({ tipo: 'UMBRAL_ALTO', sensor: sensor.codigoSensor, nombreSensor: sensor.nombreSensor, valor: Number(ultima.valor), umbral: Number(sensor.umbralAlto), unidad: sensor.unidadMedida });
    }
    if (sensor.umbralBajo !== null && Number(ultima.valor) < Number(sensor.umbralBajo)) {
      resultados.push({ tipo: 'UMBRAL_BAJO', sensor: sensor.codigoSensor, nombreSensor: sensor.nombreSensor, valor: Number(ultima.valor), umbral: Number(sensor.umbralBajo), unidad: sensor.unidadMedida });
    }
  }
  return { anomalíasDetectadas: resultados, alarmasActivas: await obtenerAlarmas(owner, 'ACTIVA') };
}

// 10. RESUMEN GENERAL
async function obtenerResumenGeneral(owner) {
  return {
    edificios: await obtenerEdificios(owner),
    salas: await obtenerSalas(owner),
    dispositivos: await obtenerDispositivos(owner),
    sensores: await obtenerSensores(owner),
    alarmasActivas: await obtenerAlarmas(owner, 'ACTIVA'),
    ultimasLecturas: await obtenerLecturas(owner, null, 30),
  };
}


// ============================================================
// 11. CONSEJO DE AHORRO
// ============================================================

async function generarConsejoAhorro(datosEdificio) {

  const prompt = `
Actúa como asesor energético de PowerTech.

Datos:
${JSON.stringify(datosEdificio, null, 2)}

Genera un consejo energético práctico.
Máximo 3 líneas.
No inventes datos.
`;

  return await generarContenidoSeguro(prompt);
}


// ============================================================
// 12. POWERBOT
// ============================================================

async function obtenerConsejoPowerBot(consulta, owner) {

  if (!owner) throw new Error("PowerBot requiere el usuario que consulta");

  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
  throw new Error(
    "No existe GEMINI_API_KEY ni GROQ_API_KEY en el archivo .env"
  );
  }

  const pregunta = consulta.trim();

  let contexto = {};

  // ==========================================================
  // DETECCIÓN INTELIGENTE DE LA CONSULTA
  // ==========================================================

  const texto = pregunta.toLowerCase();


  // ----------------------------------------------------------
  // EDIFICIOS
  // ----------------------------------------------------------

  if (
    texto.includes("edificio") ||
    texto.includes("edificios")
  ) {

    contexto.edificios = await obtenerEdificios(owner);
  }


  // ----------------------------------------------------------
  // SALAS
  // ----------------------------------------------------------

  if (
    texto.includes("sala") ||
    texto.includes("salas")
  ) {

    contexto.salas = await obtenerSalas(owner);
  }


  // ----------------------------------------------------------
  // DISPOSITIVOS
  // ----------------------------------------------------------

  if (
    texto.includes("dispositivo") ||
    texto.includes("dispositivos") ||
    texto.includes("equipo") ||
    texto.includes("equipos")
  ) {

    contexto.dispositivos = await obtenerDispositivos(owner);
  }


  // ----------------------------------------------------------
  // SENSORES
  // ----------------------------------------------------------

  if (
    texto.includes("sensor") ||
    texto.includes("sensores")
  ) {

    contexto.sensores = await obtenerSensores(owner);
  }


  // ----------------------------------------------------------
  // LECTURAS / CONSUMO / DEMANDA
  // ----------------------------------------------------------

  if (
    texto.includes("lectura") ||
    texto.includes("lecturas") ||
    texto.includes("consumo") ||
    texto.includes("demanda") ||
    texto.includes("energía") ||
    texto.includes("energia") ||
    texto.includes("potencia") ||
    texto.includes("watt") ||
    texto.includes("watts") ||
    texto.includes("kw") ||
    texto.includes("kwh")
  ) {

    contexto.lecturas = await obtenerLecturas(owner, null, 50);
  }


  // ----------------------------------------------------------
  // ALARMAS / ANOMALÍAS
  // ----------------------------------------------------------

  if (
    texto.includes("alarma") ||
    texto.includes("alarmas") ||
    texto.includes("alerta") ||
    texto.includes("alertas") ||
    texto.includes("anomalía") ||
    texto.includes("anomalia") ||
    texto.includes("problema")
  ) {

    contexto.alarmas = await obtenerAlarmas(owner);
    contexto.anomalias = await detectarAnomalias(owner);
  }


  // ----------------------------------------------------------
  // REPORTE
  // ----------------------------------------------------------

  if (
    texto.includes("reporte") ||
    texto.includes("operatividad")
  ) {

    contexto.reportes = await obtenerResumenGeneral(owner);
  }


  // ----------------------------------------------------------
  // SI NO IDENTIFICAMOS UNA CATEGORÍA
  // ----------------------------------------------------------

  if (Object.keys(contexto).length === 0) {

    contexto = await obtenerResumenGeneral(owner);
  }


  // ==========================================================
  // IA
  // ==========================================================

  const prompt = `
Eres **PowerBot**, el asistente inteligente oficial de la
plataforma **PowerTech**.

Tu objetivo es ayudar al administrador a comprender,
analizar y utilizar PowerTech.

============================================================
FUNCIONAMIENTO DE POWERTECH
============================================================

PowerTech administra infraestructura energética mediante:

USUARIO
→ EDIFICIO
→ SALA
→ DISPOSITIVO
→ SENSOR
→ LECTURA

Las lecturas pueden generar automáticamente ALARMAS cuando
superan el umbral configurado en el sensor.

Las alarmas tienen estados:

- ACTIVA
- ATENDIDA
- CERRADA

PowerTech también genera reportes de las salas y presenta
información energética mediante el módulo de monitoreo.

============================================================
BASE DE DATOS REAL
============================================================

Estos son los datos que PowerBot ha consultado para responder
la pregunta actual:

${JSON.stringify(contexto, null, 2)}

============================================================
REGLAS
============================================================

1. Utiliza los datos proporcionados.

2. NO inventes información.

3. Si algo no aparece en la base de datos, dilo.

4. Las lecturas almacenadas en W representan POTENCIA.

5. W NO es lo mismo que kWh.

6. Para hablar de energía consumida en kWh se necesita considerar
   el tiempo transcurrido entre lecturas.

7. Si existe un umbral alto y una lectura lo supera,
   indícalo claramente.

8. Si existe una alarma relacionada, explica la relación.

9. Cuando sea útil, muestra:
   - edificio
   - sala
   - dispositivo
   - sensor
   - lectura
   - umbral
   - alarma

10. Si el usuario pregunta "¿por qué?", explica la cadena de
    acontecimientos usando los datos disponibles.

11. Si el usuario pregunta cómo funciona una sección de PowerTech,
    explica su funcionamiento de forma sencilla.

12. Si pregunta sobre los recibos, recuerda que PowerTech muestra
    una representación didáctica y no un recibo oficial de CFE.

13. Responde siempre en español.

14. Utiliza Markdown de forma sencilla y visual.

15. Utiliza **negritas** para valores importantes.

16. NO utilices tablas Markdown.

17. Para listas de edificios, salas, dispositivos, sensores o alarmas,
    utiliza listas con viñetas.

18. Utiliza títulos pequeños y claros. Evita títulos excesivamente grandes.

19. Mantén las respuestas fáciles de leer dentro de un panel lateral
    de aproximadamente 400 píxeles de ancho.

20. Evita párrafos largos.

21. Separa la información en bloques cortos.

22. Cuando muestres varios registros, utiliza este formato:

    **Código — Nombre**
    - Dato: valor
    - Dato: valor

23. Cuando exista un total, muéstralo al principio.

24. No repitas información innecesariamente.

25. No inventes emojis. Úsalos solamente cuando ayuden a identificar
    visualmente una categoría.

26. No seas innecesariamente largo.

27. Si la pregunta requiere explicación, puedes extenderte.

============================================================
PREGUNTA DEL ADMINISTRADOR
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
  generarConsejoAhorro,
  obtenerConsejoPowerBot,
  obtenerEdificios,
  obtenerSalas,
  obtenerDispositivos,
  obtenerSensores,
  obtenerLecturas,
  obtenerAlarmas,
  obtenerReporteSala,
  analizarSensor,
  detectarAnomalias,
  obtenerResumenGeneral
};