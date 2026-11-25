// Datos del hogar: configuración, medidor, aparatos, consumo y recibo estimado.
import { defineStore } from "pinia";
import axios from "axios";
import { ref, computed } from "vue";

const datos = (p) => p.then((r) => r.data.data);
const respuesta = (p) => p.then((r) => r.data);

export const TIPOS_APARATO = [
  { value: "MINISPLIT", title: "Minisplit / aire", icono: "mdi-air-conditioner", potencia: 1400, horas: 8 },
  { value: "REFRIGERADOR", title: "Refrigerador", icono: "mdi-fridge-outline", potencia: 150, horas: 24 },
  { value: "LAVADORA", title: "Lavadora", icono: "mdi-washing-machine", potencia: 500, horas: 1 },
  { value: "SECADORA", title: "Secadora", icono: "mdi-tumble-dryer", potencia: 3000, horas: 0.5 },
  { value: "TELEVISION", title: "Televisión", icono: "mdi-television", potencia: 120, horas: 5 },
  { value: "COMPUTADORA", title: "Computadora", icono: "mdi-laptop", potencia: 150, horas: 6 },
  { value: "ILUMINACION", title: "Iluminación", icono: "mdi-lightbulb-outline", potencia: 100, horas: 6 },
  { value: "BOMBA", title: "Bomba de agua", icono: "mdi-water-pump", potencia: 750, horas: 1 },
  { value: "CALENTADOR", title: "Calentador / boiler eléctrico", icono: "mdi-water-boiler", potencia: 2000, horas: 1 },
  { value: "MICROONDAS", title: "Microondas", icono: "mdi-microwave", potencia: 1100, horas: 0.3 },
  { value: "PLANCHA", title: "Plancha", icono: "mdi-iron-outline", potencia: 1200, horas: 0.3 },
  { value: "VENTILADOR", title: "Ventilador", icono: "mdi-fan", potencia: 60, horas: 8 },
  { value: "OTRO", title: "Otro", icono: "mdi-power-plug-outline", potencia: null, horas: null },
];
export const tipoAparato = (v) => TIPOS_APARATO.find((t) => t.value === v) || TIPOS_APARATO.at(-1);

export const TARIFAS = [
  { value: "1F", title: "1F · Verano de 33 °C o más" },
  { value: "1E", title: "1E · Verano de 32 °C o más" },
  { value: "1D", title: "1D · Verano de 31 °C o más" },
  { value: "1C", title: "1C · Verano de 30 °C o más" },
  { value: "1B", title: "1B · Verano de 28 °C o más" },
  { value: "1A", title: "1A · Verano de 25 °C o más" },
  { value: "1", title: "1 · Sin subsidio de verano" },
];
export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export const pesos = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
export const kwh = (n, d = 1) => `${(Number(n) || 0).toLocaleString("es-MX", { maximumFractionDigits: d })} kWh`;
export const watts = (n) => {
  const v = Number(n) || 0;
  return v >= 1000 ? `${(v / 1000).toLocaleString("es-MX", { maximumFractionDigits: 2 })} kW` : `${Math.round(v)} W`;
};
export const fechaCorta = (f) => {
  if (!f) return "";
  const [a, m, d] = String(f).slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
};
export const mensajeError = (e, porDefecto) =>
  e?.response?.data?.detalles?.[0] || e?.response?.data?.mensaje || porDefecto;

export const useHogarStore = defineStore("hogar", () => {
  const hogar = ref(null);       // null = aún no configurado
  const cargado = ref(false);
  const aparatos = ref([]);
  const periodo = ref(null);

  const tieneMedidor = computed(() => !!hogar.value?.medidor);

  /* Hogar y medidor */
  const cargar = async () => {
    hogar.value = await datos(axios.get("/api/hogar"));
    cargado.value = true;
    return hogar.value;
  };
  const guardar = async (body) => {
    const r = await respuesta(axios.put("/api/hogar", body));
    hogar.value = { ...hogar.value, ...r.data };
    return r;
  };
  const cambiarVacaciones = async (activo) => {
    const r = await respuesta(axios.patch("/api/hogar/vacaciones", { activo }));
    if (hogar.value) hogar.value.modoVacaciones = activo;
    return r;
  };
  const registrarMedidor = (body) => respuesta(axios.post("/api/hogar/medidor", body));
  const actualizarMedidor = (body) => respuesta(axios.patch("/api/hogar/medidor", body));
  const eliminarMedidor = () => respuesta(axios.delete("/api/hogar/medidor"));
  const tokenMedidor = () => datos(axios.get("/api/hogar/medidor/token"));

  /* Aparatos */
  const cargarAparatos = async () => (aparatos.value = await datos(axios.get("/api/aparatos")));
  const crearAparato = (body) => respuesta(axios.post("/api/aparatos", body));
  const actualizarAparato = (id, body) => respuesta(axios.put(`/api/aparatos/${id}`, body));
  const eliminarAparato = (id) => respuesta(axios.delete(`/api/aparatos/${id}`));
  const encenderApagar = (id, estado) => respuesta(axios.post(`/api/aparatos/${id}/power`, { estado }));

  /* Consumo y recibo */
  const cargarPeriodo = async () => (periodo.value = await datos(axios.get("/api/consumo/periodo")));
  const fechasConLecturas = () => datos(axios.get("/api/consumo/fechas"));
  const consumoMes = (params) => datos(axios.get("/api/consumo/mes", { params }));
  const estimacionAparatos = () => datos(axios.get("/api/consumo/aparatos"));
  const historial = () => datos(axios.get("/api/consumo/historial"));
  const tarifa = () => datos(axios.get("/api/consumo/tarifa"));
  const recientes = (horas = 24) => datos(axios.get("/lecturas/recientes", { params: { horas } }));

  const limpiar = () => { hogar.value = null; cargado.value = false; aparatos.value = []; periodo.value = null; };

  return {
    hogar, cargado, aparatos, periodo, tieneMedidor,
    cargar, guardar, cambiarVacaciones, registrarMedidor, actualizarMedidor, eliminarMedidor, tokenMedidor,
    cargarAparatos, crearAparato, actualizarAparato, eliminarAparato, encenderApagar,
    cargarPeriodo, fechasConLecturas, consumoMes, estimacionAparatos, historial, tarifa, recientes, limpiar,
  };
});
