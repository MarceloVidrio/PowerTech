// Avisos del hogar: en tiempo real (SSE) para todos y por correo al titular para nivel ≥ 4.
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
    const rows = await db.query('SELECT email, nombre FROM USUARIOS WHERE idUsuario = ?', [owner]);
    if (!rows.length || !process.env.EMAIL_USER) return;
    const r = rows[0];
    const casa = alarma.nombreHogar || 'tu casa';
    await mailer()({
      para: r.email,
      asunto: `PowerTech Hogar · ${alarma.tipoAlarma}`,
      texto: `Hola ${r.nombre},\n\n${alarma.tipoAlarma} en ${casa}.\n${alarma.detalle}\n\nRevisa la sección Avisos de PowerTech.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
        <h2 style="color:#C62828">PowerTech Hogar · ${escapar(alarma.tipoAlarma)}</h2>
        <p>Hola <strong>${escapar(r.nombre)}</strong>,</p>
        <p>Hay un aviso en <strong>${escapar(casa)}</strong>:</p>
        <p>${escapar(alarma.detalle)}</p>
        <p>Revisa la sección <em>Avisos</em> de PowerTech.</p></div>`,
    });
  } catch (e) {
    console.error('No se pudo enviar el correo de alarma:', e.message);
  }
}

module.exports = { notificarAlarma };
