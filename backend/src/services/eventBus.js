// Canal interno de eventos en tiempo real (alarmas nuevas, lecturas).
// Lo consume la ruta /events (Server-Sent Events).
const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(500);

// Publica un evento solo para la cuenta dueña de la información.
function publicar(owner, tipo, datos) {
  bus.emit('evento', { owner: Number(owner), tipo, datos });
}

module.exports = { bus, publicar };
