// Control de relevadores (por ejemplo Sonoff con firmware Tasmota).
// Tasmota acepta comandos HTTP:  http://<ip>/cm?cmnd=Power%20Off
const COMANDOS = { ON: 'Power On', OFF: 'Power Off' };

function validarUrl(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  return u;
}

async function enviarComando(controlUrl, estado, { timeoutMs = 4000 } = {}) {
  const u = validarUrl(controlUrl);
  if (!u) throw new Error('URL del relevador no válida');
  const cmd = COMANDOS[estado];
  if (!cmd) throw new Error('Estado no válido: usa ON u OFF');
  const destino = new URL('/cm', u);
  destino.searchParams.set('cmnd', cmd);
  const res = await fetch(destino, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`El relevador respondió ${res.status}`);
  let cuerpo = null;
  try { cuerpo = await res.json(); } catch { /* algunos firmwares no responden JSON */ }
  return { estado, respuesta: cuerpo };
}

module.exports = { enviarComando, validarUrl };
