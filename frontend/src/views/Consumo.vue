<template>
  <v-container class="mt-8 px-4 main-container" fluid>
    <div class="mb-5">
      <h1 class="text-h4 font-weight-bold">Consumo</h1>
      <p class="text-subtitle-2 text-grey-darken-1">Cuánta energía usa tu casa y en qué momento del día</p>
    </div>

    <v-alert v-if="sinHogar" type="info" variant="tonal" class="rounded-xl">
      Primero hay que configurar el hogar y registrar el sensor de consumo.
      <template #append v-if="userStore.esTitular"><v-btn size="small" variant="flat" color="blue-darken-2" class="text-none" to="/hogar">Configurar</v-btn></template>
    </v-alert>

    <template v-else>
      <!-- Últimas 24 horas -->
      <v-card class="pa-5 rounded-xl mb-4 section-card" elevation="0">
        <div class="d-flex justify-space-between align-center mb-2">
          <div>
            <div class="text-subtitle-1 font-weight-bold">Últimas 24 horas</div>
            <div class="text-caption text-grey-darken-1">Potencia promedio cada 5 minutos</div>
          </div>
          <div class="text-right">
            <div class="text-caption text-grey-darken-1">Máximo</div>
            <div class="text-subtitle-1 font-weight-bold text-orange-darken-2">{{ maximo24 ? watts(maximo24) : '—' }}</div>
          </div>
        </div>
        <!-- Eje de tiempo fijo: de hace 24 h a ahora. Los huecos son momentos sin lecturas. -->
        <div class="chart chart-24">
          <div v-for="(c, i) in casillas24" :key="i" class="slot" :class="{ vacio: !c.p }"
            :title="c.p ? `${horaDe(c.t)} · ${watts(c.p.valor)}` : `${horaDe(c.t)} · sin datos`">
            <div v-if="c.p" class="bar" :class="{ alta: hogar && c.p.valor > hogar.umbralAltoW }"
              :style="{ height: `${Math.max(2, (c.p.valor / max24) * 100)}%` }"></div>
          </div>
        </div>
        <div class="d-flex justify-space-between text-caption text-grey mt-1">
          <span>{{ horaDe(casillas24[0].t) }}</span><span>{{ horaDe(casillas24[144].t) }}</span><span>Ahora</span>
        </div>
        <div v-if="sinDatosDesde" class="text-caption text-red-darken-2 font-weight-bold mt-2">
          <v-icon size="16" color="red-darken-2">mdi-wifi-off</v-icon>
          Sin señal del sensor desde las {{ horaDe(sinDatosDesde) }} ({{ horasSinDatos }})
        </div>
        <div v-else-if="!ultimas24.length" class="text-caption text-grey mt-2">Sin lecturas en las últimas 24 horas</div>
      </v-card>

      <!-- Filtros -->
      <v-row dense class="mb-2">
        <v-col cols="6">
          <v-select v-model="anio" :items="anios" label="Año" variant="solo-filled" rounded="xl" flat hide-details
            bg-color="green-lighten-5" density="comfortable" :disabled="!anios.length" />
        </v-col>
        <v-col cols="6">
          <v-select v-model="mes" :items="mesesDelAnio" item-title="text" item-value="value" label="Mes" variant="solo-filled"
            rounded="xl" flat hide-details bg-color="green-lighten-5" density="comfortable" :disabled="!anio" />
        </v-col>
      </v-row>

      <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
      <div v-if="cargando" class="d-flex justify-center my-8"><v-progress-circular indeterminate color="green-darken-2" /></div>

      <v-card v-else-if="!fechas.length" class="pa-8 text-center rounded-xl bg-transparent elevation-0 border-dashed">
        <v-icon size="56" color="grey-lighten-1" class="mb-3">mdi-chart-bar-off</v-icon>
        <div class="text-subtitle-1 text-grey-darken-2">Todavía no hay lecturas del sensor</div>
      </v-card>

      <template v-else-if="datos">
        <!-- Resumen del mes -->
        <v-row dense class="mb-3">
          <v-col cols="4"><div class="metric"><div class="text-caption text-grey-darken-1">Total del mes</div><div class="text-h6 font-weight-bold text-green-darken-2">{{ kwh(datos.total) }}</div></div></v-col>
          <v-col cols="4"><div class="metric"><div class="text-caption text-grey-darken-1">Promedio diario</div><div class="text-h6 font-weight-bold">{{ kwh(datos.diasConDatos ? datos.total / datos.diasConDatos : 0) }}</div></div></v-col>
          <v-col cols="4"><div class="metric"><div class="text-caption text-grey-darken-1">Pico</div><div class="text-h6 font-weight-bold text-orange-darken-2">{{ datos.picoW ? watts(datos.picoW.valor) : '—' }}</div></div></v-col>
        </v-row>

        <!-- Gráfica -->
        <v-card class="pa-5 rounded-xl mb-4 section-card" elevation="0">
          <div class="d-flex justify-space-between align-center mb-3 flex-wrap ga-2">
            <div class="text-subtitle-1 font-weight-bold">{{ tituloGrafica }}</div>
            <v-btn-toggle v-model="vista" color="green-darken-2" mandatory rounded="xl" density="compact" class="bg-green-lighten-5">
              <v-btn value="mes" class="text-caption text-none">Por día</v-btn>
              <v-btn value="semana" class="text-caption text-none">Por día de la semana</v-btn>
              <v-btn value="dia" class="text-caption text-none">Por hora</v-btn>
            </v-btn-toggle>
          </div>
          <div class="chart">
            <div v-for="(v, i) in valores" :key="i" class="col-bar" :title="`${etiquetaLarga(i)} · ${kwh(v, 2)}`">
              <div class="bar" :style="{ height: `${Math.max(1, (v / maxValores) * 100)}%` }"></div>
              <span class="label">{{ etiquetas[i] }}</span>
            </div>
          </div>
        </v-card>

        <!-- Franjas del día -->
        <v-card class="pa-5 rounded-xl mb-4 section-card" elevation="0">
          <div class="text-subtitle-1 font-weight-bold mb-3">¿En qué momento del día gastas más?</div>
          <div v-for="f in franjas" :key="f.franja" class="mb-3">
            <div class="d-flex justify-space-between text-body-2 mb-1">
              <span><v-icon size="18" class="mr-1">{{ f.icono }}</v-icon>{{ f.nombre }}</span>
              <span class="font-weight-bold">{{ kwh(f.kwh) }} · {{ f.porcentaje }}%</span>
            </div>
            <v-progress-linear :model-value="f.porcentaje" :color="f.color" height="8" rounded />
          </div>
        </v-card>
      </template>

      <!-- Estimación por aparato -->
      <v-card class="pa-5 rounded-xl mb-4 section-card" elevation="0">
        <div class="text-subtitle-1 font-weight-bold">¿Qué aparato gasta más? (estimado)</div>
        <p class="text-caption text-grey-darken-1 mb-3">
          El sensor mide toda la casa; este reparto se calcula con la potencia y las horas de uso de tus aparatos.
        </p>
        <div v-if="!estimado.length || !estimado.some((a) => a.kwhBimestre > 0)" class="text-caption text-grey">
          Agrega tus aparatos con su potencia y horas de uso en <router-link to="/aparatos">Aparatos</router-link>.
        </div>
        <template v-else>
          <div v-for="a in estimado.filter((x) => x.kwhBimestre > 0)" :key="a.idAparato" class="mb-3">
            <div class="d-flex justify-space-between text-body-2 mb-1">
              <span>{{ a.nombre }}<span v-if="a.cuarto" class="text-grey"> · {{ a.cuarto }}</span></span>
              <span class="font-weight-bold">{{ kwh(a.kwhBimestre, 0) }} / bimestre</span>
            </div>
            <v-progress-linear :model-value="a.porcentaje" color="teal" height="8" rounded />
          </div>
          <div v-if="p" class="text-caption text-grey-darken-1 mt-2">
            Suma estimada: <b>{{ kwh(totalEstimado, 0) }}</b> · pronóstico medido del bimestre: <b>{{ kwh(p.proyeccion, 0) }}</b>.
            {{ Math.abs(totalEstimado - p.proyeccion) > p.proyeccion * 0.3 && p.confiable ? 'La diferencia es grande: ajusta las horas de uso para que la estimación se acerque a lo medido.' : '' }}
          </div>
        </template>
      </v-card>
    </template>
  </v-container>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/users';
import { useHogarStore, watts, kwh, MESES, mensajeError } from '@/stores/hogar';

const userStore = useUserStore();
const hogarStore = useHogarStore();
const { hogar, periodo: p } = storeToRefs(hogarStore);

const sinHogar = ref(false);
const cargando = ref(false);
const error = ref('');
const fechas = ref([]);
const anio = ref(null);
const mes = ref(null);
const vista = ref('mes');
const datos = ref(null);
const ultimas24 = ref([]);
const estimado = ref([]);

const anios = computed(() => [...new Set(fechas.value.map((f) => f.anio))].sort((a, b) => b - a));
const mesesDelAnio = computed(() => fechas.value.filter((f) => f.anio === anio.value).map((f) => f.mes)
  .sort((a, b) => a - b).map((m) => ({ text: MESES[m - 1], value: m })));

const horaDe = (f) => new Date(f).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
const max24 = computed(() => Math.max(1, ...ultimas24.value.map((p) => p.valor)));
// 288 casillas de 5 minutos, de hace 24 h hasta ahora; se actualiza cada minuto
const reloj = ref(Date.now());
const casillas24 = computed(() => {
  const paso = 5 * 60000;
  const fin = Math.floor(reloj.value / paso) * paso;
  const porCasilla = new Map(ultimas24.value.map((p) => [Math.floor(new Date(p.fechaHora).getTime() / paso) * paso, p]));
  return Array.from({ length: 288 }, (_, i) => {
    const t = fin - (287 - i) * paso;
    return { t, p: porCasilla.get(t) || null };
  });
});
// Si la última lectura fue hace más de 30 min, el sensor está desconectado
const ultimaLectura = computed(() => (ultimas24.value.length ? new Date(ultimas24.value.at(-1).fechaHora).getTime() + 5 * 60000 : null));
const sinDatosDesde = computed(() => (ultimaLectura.value && reloj.value - ultimaLectura.value > 30 * 60000 ? ultimaLectura.value : null));
const horasSinDatos = computed(() => {
  const min = Math.round((reloj.value - sinDatosDesde.value) / 60000);
  return min < 60 ? `hace ${min} min` : `hace ${Math.floor(min / 60)} h ${min % 60} min`;
});
const maximo24 = computed(() => (ultimas24.value.length ? Math.max(...ultimas24.value.map((p) => p.maximo)) : 0));

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const longitud = computed(() => (vista.value === 'dia' ? 24 : vista.value === 'semana' ? 7 : new Date(anio.value, mes.value, 0).getDate()));
const valores = computed(() => {
  const v = Array(longitud.value).fill(0);
  for (const g of datos.value?.grafica || []) {
    const i = g.etiqueta - (vista.value === 'mes' ? 1 : 0);
    if (i >= 0 && i < v.length) v[i] = g.kwh;
  }
  return v;
});
const maxValores = computed(() => Math.max(0.001, ...valores.value));
const etiquetas = computed(() => valores.value.map((_, i) => (vista.value === 'semana' ? DIAS[i]
  : vista.value === 'dia' ? (i % 4 === 0 ? `${i}h` : '') : ((i + 1) % 5 === 0 || i === 0 ? `${i + 1}` : ''))));
const etiquetaLarga = (i) => (vista.value === 'semana' ? DIAS_LARGOS[i] : vista.value === 'dia' ? `${i}:00–${i + 1}:00` : `${i + 1} de ${MESES[mes.value - 1]}`);
const tituloGrafica = computed(() => ({ mes: 'Consumo de cada día', semana: 'Consumo por día de la semana', dia: 'Consumo por hora del día' }[vista.value]));

const FRANJAS = {
  madrugada: { nombre: 'Madrugada (0–6 h)', icono: 'mdi-weather-night', color: 'indigo' },
  manana: { nombre: 'Mañana (6–12 h)', icono: 'mdi-weather-sunset-up', color: 'amber-darken-2' },
  tarde: { nombre: 'Tarde (12–18 h)', icono: 'mdi-weather-sunny', color: 'orange-darken-2' },
  noche: { nombre: 'Noche (18–24 h)', icono: 'mdi-weather-sunset-down', color: 'deep-purple' },
};
const franjas = computed(() => {
  const total = (datos.value?.franjas || []).reduce((s, f) => s + f.kwh, 0) || 1;
  return (datos.value?.franjas || []).map((f) => ({ ...f, ...FRANJAS[f.franja], porcentaje: Math.round((f.kwh / total) * 100) }));
});
const totalEstimado = computed(() => estimado.value.reduce((s, a) => s + a.kwhBimestre, 0));

let pedido = 0;
const cargarMes = async () => {
  const id = ++pedido;
  if (!anio.value || !mes.value) return;
  cargando.value = true;
  error.value = '';
  try {
    const r = await hogarStore.consumoMes({ mes: mes.value, anio: anio.value, periodo: vista.value });
    if (id === pedido) datos.value = r;
  } catch (e) {
    if (id === pedido) error.value = mensajeError(e, 'No se pudo cargar el consumo');
  } finally {
    if (id === pedido) cargando.value = false;
  }
};

let intervalo = null;
onBeforeUnmount(() => clearInterval(intervalo));
onMounted(async () => {
  intervalo = setInterval(async () => {
    reloj.value = Date.now();
    try { ultimas24.value = await hogarStore.recientes(24); } catch { /* se reintenta en el siguiente minuto */ }
  }, 60000);
  cargando.value = true;
  try {
    const h = hogar.value || await hogarStore.cargar();
    if (!h) { sinHogar.value = true; return; }
    const [f, r24, est] = await Promise.all([
      hogarStore.fechasConLecturas(), hogarStore.recientes(24), hogarStore.estimacionAparatos(),
      p.value ? null : hogarStore.cargarPeriodo().catch(() => null),
    ]);
    fechas.value = f;
    ultimas24.value = r24;
    estimado.value = est.aparatos;
    anio.value = f[0]?.anio ?? null;
    mes.value = f[0]?.mes ?? null;
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo cargar el consumo');
  } finally {
    cargando.value = false;
  }
});

watch(anio, () => {
  if (!mesesDelAnio.value.some((m) => m.value === mes.value)) mes.value = mesesDelAnio.value.at(-1)?.value ?? null;
}, { flush: 'sync' });
watch([anio, mes, vista], cargarMes);
</script>

<style scoped>
.main-container { max-width: 760px; margin: 0 auto; }
.section-card { background: #fff !important; border: 1px solid #e9efea !important; }
.metric { padding: 10px 12px; border: 1px solid #edf1ee; border-radius: 14px; background: #fff; height: 100%; }
.border-dashed { border: 2px dashed #d1d5db !important; }
.chart { display: flex; align-items: flex-end; gap: 2px; height: 160px; }
.chart-24 { height: 90px; gap: 0; border-bottom: 1px solid #e0e0e0; }
.chart-24 .slot { flex: 1; height: 100%; display: flex; align-items: flex-end; min-width: 0; }
.chart-24 .slot.vacio { background: repeating-linear-gradient(135deg, transparent 0 3px, #f3f3f3 3px 5px); }
.chart-24 .bar { width: 100%; background: #81c784; border-radius: 1px 1px 0 0; }
.chart-24 .bar.alta { background: #e57373; }
.col-bar { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; min-width: 0; }
.col-bar .bar { width: 100%; background: #a5d6a7; border-radius: 3px 3px 0 0; }
.col-bar:hover .bar { background: #66bb6a; }
.label { font-size: 10px; color: #757575; height: 14px; margin-top: 2px; white-space: nowrap; }
</style>
