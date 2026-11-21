const db = require('../config/db');
const own = require('../services/ownership');
const { ok } = require('../utils/http');

/*
 * Las lecturas guardan POTENCIA instantánea (W), no energía.
 * Para obtener energía (kWh) se integra la potencia en el tiempo:
 *
 *   kWh del intervalo = promedio(W anterior, W actual) × segundos / 3,600,000
 *
 * Si entre dos lecturas pasaron más de MAX_INTERVALO_SEG (sensor apagado o
 * sin conexión), ese intervalo cuenta como 0: no se sabe qué pasó y no se
 * debe inventar consumo.
 */
const MAX_INTERVALO_SEG = 15 * 60;

// Valida rangos tipo "08:00-17:59,20:00-21:59" y arma el filtro de horario.
// Devuelve { sql, params } para usar consultas parametrizadas.
function buildTimeFilter(rangosParam) {
    if (!rangosParam) return { sql: '', params: [] };
    const formato = /^\d{2}:\d{2}(:\d{2})?$/;
    const condiciones = [];
    const params = [];

    for (const r of String(rangosParam).split(',')) {
        let [inicio, fin] = r.split('-');
        if (!formato.test(inicio || '') || !formato.test(fin || '')) continue;
        if (inicio.length === 5) inicio += ':00';
        if (fin.length === 5) fin += ':59';
        condiciones.push('(TIME(E.fechaHora) >= ? AND TIME(E.fechaHora) <= ?)');
        params.push(inicio, fin);
    }

    return condiciones.length
        ? { sql: ` AND (${condiciones.join(' OR ')}) `, params }
        : { sql: '', params: [] };
}

// Filtro de mes/año (por defecto, el mes actual).
function buildDateFilter(mes, anio) {
    if (mes && anio) {
        return { sql: 'MONTH(E.fechaHora) = ? AND YEAR(E.fechaHora) = ?', params: [mes, anio] };
    }
    return { sql: 'MONTH(E.fechaHora) = MONTH(CURDATE()) AND YEAR(E.fechaHora) = YEAR(CURDATE())', params: [] };
}

// CTE que calcula la energía (kWh) de cada lectura de un edificio.
// Cada fila "E" trae: codigoSensor, fechaHora, valor (W), codigoDispositivo,
// nombreDispositivo y kwh (energía del intervalo que termina en esa lectura).
const ENERGIA_CTE = `
    WITH base AS (
        SELECT
            L.codigoSensor,
            L.fechaHora,
            L.valor,
            D.codigoDispositivo,
            D.nombre AS nombreDispositivo,
            LAG(L.fechaHora) OVER w AS fechaPrevia,
            LAG(L.valor)     OVER w AS valorPrevio
        FROM LECTURAS L
        INNER JOIN SENSORES S      ON S.codigoSensor = L.codigoSensor
        INNER JOIN DISPOSITIVOS D  ON D.codigoDispositivo = S.codigoDispositivo
        INNER JOIN SALAS Sa        ON Sa.codigoSala = D.codigoSala
        WHERE Sa.codigoEdificio = ?
        WINDOW w AS (PARTITION BY L.codigoSensor ORDER BY L.fechaHora)
    ),
    energia AS (
        SELECT
            base.*,
            CASE
                WHEN fechaPrevia IS NULL THEN 0
                WHEN TIMESTAMPDIFF(SECOND, fechaPrevia, fechaHora) > ${MAX_INTERVALO_SEG} THEN 0
                ELSE (valorPrevio + valor) / 2
                     * TIMESTAMPDIFF(SECOND, fechaPrevia, fechaHora)
                     / 3600000
            END AS kwh
        FROM base
    )
`;

// Todas las consultas verifican primero que el edificio sea de la cuenta.
async function consultar(req, res, sql, params) {
    await own.edificio(req.user.owner, req.params.id);
    ok(res, await db.query(sql, params));
}

// 1. OBTENER MESES Y AÑOS QUE TIENEN LECTURAS
async function obtenerFechasDisponibles(req, res) {
    const { id } = req.params;
    const sql = `
        SELECT DISTINCT MONTH(L.fechaHora) AS mes, YEAR(L.fechaHora) AS anio
        FROM LECTURAS L
        INNER JOIN SENSORES S     ON S.codigoSensor = L.codigoSensor
        INNER JOIN DISPOSITIVOS D ON D.codigoDispositivo = S.codigoDispositivo
        INNER JOIN SALAS Sa       ON Sa.codigoSala = D.codigoSala
        WHERE Sa.codigoEdificio = ?
        ORDER BY anio DESC, mes DESC;
    `;
    await consultar(req, res, sql, [id]);
}

// 2. CONSUMO TOTAL (kWh) DEL MES/AÑO Y HORARIO SELECCIONADO
async function obtenerMonitoreoMensual(req, res) {
    const { id } = req.params;
    const { mes, anio, rangos } = req.query;
    const fecha = buildDateFilter(mes, anio);
    const horario = buildTimeFilter(rangos);

    const sql = `${ENERGIA_CTE}
        SELECT ROUND(SUM(E.kwh), 4) AS total
        FROM energia E
        WHERE ${fecha.sql} ${horario.sql};
    `;
    await consultar(req, res, sql, [id, ...fecha.params, ...horario.params]);
}

// 3. DESGLOSE DE CONSUMO (kWh) POR DISPOSITIVO
async function obtenerDesgloseDispositivos(req, res) {
    const { id } = req.params;
    const { mes, anio, rangos } = req.query;
    const fecha = buildDateFilter(mes, anio);
    const horario = buildTimeFilter(rangos);

    const sql = `${ENERGIA_CTE}
        SELECT E.nombreDispositivo AS nombre_dispositivo, ROUND(SUM(E.kwh), 4) AS total_valor
        FROM energia E
        WHERE ${fecha.sql} ${horario.sql}
        GROUP BY E.codigoDispositivo, E.nombreDispositivo
        ORDER BY total_valor DESC;
    `;
    await consultar(req, res, sql, [id, ...fecha.params, ...horario.params]);
}

// 4. DATOS PARA LA GRÁFICA (kWh por hora, día de la semana o día del mes)
async function obtenerHistorialGrafica(req, res) {
    const { id } = req.params;
    const { mes, anio, periodo, rangos } = req.query;
    const fecha = buildDateFilter(mes, anio);
    const horario = buildTimeFilter(rangos);

    // Solo valores fijos: nunca se interpola texto del usuario aquí.
    const agrupacion = {
        dia: 'HOUR(E.fechaHora)',
        semana: 'WEEKDAY(E.fechaHora)',
    }[periodo] || 'DAY(E.fechaHora)';

    const sql = `${ENERGIA_CTE}
        SELECT ${agrupacion} AS etiqueta, ROUND(SUM(E.kwh), 4) AS total_valor
        FROM energia E
        WHERE ${fecha.sql} ${horario.sql}
        GROUP BY ${agrupacion}
        ORDER BY etiqueta ASC;
    `;
    await consultar(req, res, sql, [id, ...fecha.params, ...horario.params]);
}

// 5. PRONÓSTICO DEL CONSUMO DEL MES
// Proyección = consumo del mes hasta hoy + promedio diario reciente × días que faltan.
function proyectarMes(dias, hoy = new Date()) {
    const anio = hoy.getFullYear(), mes = hoy.getMonth();
    const clave = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const hoyClave = clave(hoy);
    const inicioMes = clave(new Date(anio, mes, 1));
    const hace14 = clave(new Date(anio, mes, hoy.getDate() - 14));
    let consumoMes = 0, sumaReciente = 0, diasRecientes = 0;
    for (const d of dias) {
        const dia = String(d.dia).slice(0, 10);
        const kwh = Number(d.kwh) || 0;
        if (dia >= inicioMes && dia <= hoyClave) consumoMes += kwh;
        if (dia >= hace14 && dia < hoyClave) { sumaReciente += kwh; diasRecientes++; }
    }
    const diasMes = new Date(anio, mes + 1, 0).getDate();
    const fraccionHoy = (hoy.getHours() * 60 + hoy.getMinutes()) / 1440;
    const diasRestantes = diasMes - hoy.getDate() + (1 - fraccionHoy);
    const promedioDiario = diasRecientes ? sumaReciente / diasRecientes : 0;
    const r = (n) => Math.round(n * 100) / 100;
    return {
        consumoActual: r(consumoMes),
        promedioDiario: r(promedioDiario),
        diasRestantes: r(diasRestantes),
        proyeccion: r(consumoMes + promedioDiario * diasRestantes),
        diasConDatos: diasRecientes,
        confiable: diasRecientes >= 3,
    };
}

async function obtenerPronostico(req, res) {
    await own.edificio(req.user.owner, req.params.id);
    const dias = await db.query(`${ENERGIA_CTE}
        SELECT DATE(E.fechaHora) AS dia, SUM(E.kwh) AS kwh
        FROM energia E
        WHERE E.fechaHora >= CURDATE() - INTERVAL 45 DAY
        GROUP BY DATE(E.fechaHora)
        ORDER BY dia;`, [req.params.id]);
    ok(res, proyectarMes(dias));
}

module.exports = {
    obtenerPronostico,
    proyectarMes,
    obtenerFechasDisponibles,
    obtenerMonitoreoMensual,
    obtenerDesgloseDispositivos,
    obtenerHistorialGrafica,
    MAX_INTERVALO_SEG,
};
