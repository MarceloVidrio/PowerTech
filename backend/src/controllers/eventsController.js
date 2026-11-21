// Tiempo real con Server-Sent Events (sin dependencias).
// EventSource no permite encabezados, así que primero se pide un "ticket"
// de 60 s con la sesión normal y luego se abre /events?ticket=...
const { bus } = require('../services/eventBus');
const { signToken, verifyToken } = require('../utils/security');
const { ok, unauthorized } = require('../utils/http');

// POST /events/ticket (requiere sesión)
function ticket(req, res) {
  const t = signToken({ sub: req.user.id, own: req.user.owner, typ: 'sse' }, 1 / 60);
  ok(res, { ticket: t });
}

// GET /events?ticket=...
function stream(req, res, next) {
  const p = verifyToken(String(req.query.ticket || ''));
  if (!p || p.typ !== 'sse') return next(unauthorized());
  const owner = Number(p.own);

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 5000\n\n');

  const enviar = (ev) => {
    if (ev.owner !== owner) return;
    res.write(`event: ${ev.tipo}\ndata: ${JSON.stringify(ev.datos)}\n\n`);
  };
  bus.on('evento', enviar);
  const latido = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(latido);
    bus.off('evento', enviar);
  });
}

module.exports = { ticket, stream };
