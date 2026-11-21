// Conexión en tiempo real con el backend (Server-Sent Events).
// Cuando llega una alarma nueva: muestra un aviso, recarga la lista de alarmas
// y, si el usuario dio permiso, lanza una notificación del navegador.
import axios from "axios";
import { watch } from "vue";

export function iniciarTiempoReal({ userStore, alarmStore, notify }) {
  let fuente = null;
  let reintento = null;

  const cerrar = () => {
    clearTimeout(reintento);
    if (fuente) fuente.close();
    fuente = null;
  };

  const conectar = async () => {
    cerrar();
    if (!userStore.token || typeof EventSource === "undefined") return;
    try {
      // El ticket dura 60 s; EventSource no permite enviar el token en encabezados.
      const { data } = await axios.post("/events/ticket");
      fuente = new EventSource(`/events?ticket=${encodeURIComponent(data.data.ticket)}`);

      fuente.addEventListener("alarma", (e) => {
        const a = JSON.parse(e.data);
        notify.show(`Alarma nivel ${a.nivel}: ${a.tipoAlarma}`, a.nivel >= 4 ? "error" : "warning");
        if (userStore.usuario?.idUsuario) alarmStore.listarAlarmas({ id: userStore.usuario.idUsuario });
        if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
          new Notification(`PowerTech · ${a.tipoAlarma}`, { body: a.detalle, icon: "/logopower.png", tag: a.codigoAlarma });
        }
        window.dispatchEvent(new CustomEvent("powertech:alarma", { detail: a }));
      });
      fuente.addEventListener("lectura", (e) => {
        window.dispatchEvent(new CustomEvent("powertech:lectura", { detail: JSON.parse(e.data) }));
      });
      // Si se corta la conexión se pide un ticket nuevo (el anterior ya venció).
      fuente.onerror = () => {
        cerrar();
        reintento = setTimeout(conectar, 10000);
      };
    } catch {
      reintento = setTimeout(conectar, 30000);
    }
  };

  watch(() => userStore.token, (t) => {
    if (t) {
      conectar();
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    } else {
      cerrar();
    }
  }, { immediate: true });

  return { cerrar };
}
