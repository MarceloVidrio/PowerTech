// Avisos de alarmas: en tiempo real (SSE) para todas y por correo para nivel ≥ 4.
const db = require('../config/db');
const { publicar } = require('./eventBus');

let enviarCorreo = null;
function mailer() {
  if (!enviarCorreo) enviarCorreo = require('../utils/mailer').enviarCorreo;
  return enviarCorreo;
}

const escapar = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function notificarAlarma(owner, alarma) {
  publicar(owner, 'alarma', alarma);
  if (Number(alarma.nivel) < 4) return;
  try {
    const rows = await db.query(
      `SELECT u.email, u.nombre, e.nombreEdificio, s.nombreSala
       FROM USUARIOS u, EDIFICIOS e, SALAS s
       WHERE u.idUsuario = ? AND e.codigoEdificio = ? AND s.codigoSala = ?`,
      [owner, alarma.codigoEdificio, alarma.codigoSala]);
    if (!rows.length || !process.env.EMAIL_USER) return;
    const r = rows[0];
    await mailer()({
      para: r.email,
      asunto: `PowerTech · Alarma nivel ${alarma.nivel}: ${alarma.tipoAlarma}`,
      texto: `Hola ${r.nombre},\n\n${alarma.tipoAlarma} en ${r.nombreSala} (${r.nombreEdificio}).\n${alarma.detalle}\n\nRevisa la sección Notificaciones de PowerTech.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
        <h2 style="color:#C62828">PowerTech · Alarma nivel ${escapar(alarma.nivel)}</h2>
        <p>Hola <strong>${escapar(r.nombre)}</strong>,</p>
        <p><strong>${escapar(alarma.tipoAlarma)}</strong> en ${escapar(r.nombreSala)} (${escapar(r.nombreEdificio)}).</p>
        <p>${escapar(alarma.detalle)}</p>
        <p>Revisa la sección <em>Notificaciones</em> de PowerTech para atenderla.</p></div>`,
    });
  } catch (e) {
    console.error('No se pudo enviar el correo de alarma:', e.message);
  }
}

module.exports = { notificarAlarma };
