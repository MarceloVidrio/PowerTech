// Panel del administrador del sistema (rol SUPERADMIN).
import { defineStore } from "pinia";
import axios from "axios";
import { ref } from "vue";

export const ROLES = [
  { value: "TITULAR", title: "Titular del hogar" },
  { value: "FAMILIAR", title: "Familiar" },
  { value: "SUPERADMIN", title: "Administrador del sistema" },
];
export const nombreRol = (rol) => ROLES.find((r) => r.value === rol)?.title || rol;
const ACCIONES = {
  CREAR_CUENTA: "Cuenta creada", EDITAR_CUENTA: "Cuenta editada", CAMBIAR_CONTRASENA: "Contraseña restablecida",
  DESBLOQUEAR: "Cuenta desbloqueada", ELIMINAR_CUENTA: "Cuenta eliminada", MEDIDOR: "Sensor", CERRAR_ALARMA: "Alarma cerrada",
};
export const nombreAccion = (a) => ACCIONES[a] || a;
export const mensajeError = (e, porDefecto) =>
  e?.response?.data?.detalles?.[0] || e?.response?.data?.mensaje || porDefecto;

export const useAdminStore = defineStore("admin", () => {
  const resumen = ref(null);
  const usuarios = ref([]);
  const titulares = ref([]);

  const datos = (p) => p.then((r) => r.data.data);
  const respuesta = (p) => p.then((r) => r.data);

  const cargarResumen = async () => (resumen.value = await datos(axios.get("/api/admin/resumen")));
  const cargarUsuarios = async (filtros = {}) =>
    (usuarios.value = await datos(axios.get("/api/admin/usuarios", { params: filtros })));
  const cargarTitulares = async () => (titulares.value = await datos(axios.get("/api/admin/titulares")));
  const detalle = (id) => datos(axios.get(`/api/admin/usuarios/${id}`));
  const bitacora = (limite = 100) => datos(axios.get("/api/admin/bitacora", { params: { limite } }));

  const crear = (body) => respuesta(axios.post("/api/admin/usuarios", body));
  const actualizar = (id, body) => respuesta(axios.patch(`/api/admin/usuarios/${id}`, body));
  const restablecerContrasena = (id, contrasena) =>
    respuesta(axios.post(`/api/admin/usuarios/${id}/contrasena`, contrasena ? { contrasena } : {}));
  const desbloquear = (id) => respuesta(axios.post(`/api/admin/usuarios/${id}/desbloquear`));
  const eliminar = (id) => respuesta(axios.delete(`/api/admin/usuarios/${id}`));
  const cambiarMedidor = (codigo, activo) => respuesta(axios.patch(`/api/admin/medidores/${codigo}`, { activo }));
  const cerrarAlarma = (codigo) => respuesta(axios.post(`/api/admin/alarmas/${codigo}/cerrar`));

  return {
    resumen, usuarios, titulares,
    cargarResumen, cargarUsuarios, cargarTitulares, detalle, bitacora,
    crear, actualizar, restablecerContrasena, desbloquear, eliminar, cambiarMedidor, cerrarAlarma,
  };
});
