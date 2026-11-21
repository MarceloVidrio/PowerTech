<template>
  <v-container class="mt-8 px-4 main-container" fluid>
    <div class="mb-6">
      <h1 class="text-h4 font-weight-bold">Monitoreo</h1>
      <p class="text-subtitle-2 text-grey-darken-1">Estado energético de tus edificios</p>
    </div>

    <!-- Filtros Dinámicos de Fecha y Edificio -->
    <v-row class="mb-2" align="center" dense>
      <v-col cols="12">
        <v-select v-model="edificioSeleccionado" :items="edificios" item-title="nombreEdificio"
          item-value="codigoEdificio" label="Seleccionar Edificio" variant="solo-filled" rounded="xl" flat hide-details
          bg-color="green-lighten-5" color="green-darken-2" density="comfortable" :loading="loadingBuildings"></v-select>
      </v-col>
    </v-row>
    <v-row class="mb-6" dense>
      <v-col cols="6">
        <v-select v-model="anioSeleccionado" :items="aniosDisponibles" label="Año" variant="solo-filled" rounded="xl"
          flat hide-details bg-color="green-lighten-5" color="green-darken-2" density="comfortable"
          :disabled="!edificioSeleccionado"></v-select>
      </v-col>
      <v-col cols="6">
        <v-select v-model="mesSeleccionado" :items="mesesDisponiblesFiltrados" item-title="text" item-value="value"
          label="Mes" variant="solo-filled" rounded="xl" flat hide-details bg-color="green-lighten-5" color="green-darken-2"
          density="comfortable" :disabled="!anioSeleccionado">
          <template v-slot:no-data>
            <div class="pa-3 text-caption text-grey">Sin lecturas este año</div>
          </template>
        </v-select>
      </v-col>
    </v-row>

    <v-alert v-if="errorCarga" type="error" variant="tonal" class="mb-4" role="alert">
      {{ errorCarga }}
      <v-btn variant="text" size="small" @click="reintentarCarga">Reintentar</v-btn>
    </v-alert>
    <v-row v-if="loading || loadingBuildings">
      <v-col cols="12" v-for="n in 3" :key="n">
        <v-skeleton-loader type="card" class="rounded-xl mb-3"></v-skeleton-loader>
      </v-col>
    </v-row>

    <v-card v-else-if="!errorCarga && consumoTotal === 0 && edificioSeleccionado && nivelSeleccionado === 'General'"
      class="pa-8 text-center rounded-xl bg-transparent elevation-0 border-dashed">
      <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-chart-bar-off</v-icon>
      <div class="text-h6 text-grey-darken-2">Sin datos disponibles</div>
      <div class="text-body-2 text-grey">No hay registros para <b>{{ nombreEdificioMostrado }}</b> en este periodo.
      </div>
    </v-card>

    <div v-else-if="!errorCarga && edificioSeleccionado && mesSeleccionado" class="monitoring-content">

      <!-- RESUMEN ENERGÉTICO -->
      <v-card class="rounded-xl pa-5 mb-6 elevation-1 energy-summary-card">
        <div class="d-flex align-center justify-space-between mb-4">
          <div>
            <div class="text-h6 font-weight-bold text-grey-darken-3">Resumen Energético</div>
            <div class="text-caption text-grey-darken-1">
              {{ nombreEdificioMostrado || 'Edificio seleccionado' }}
            </div>
          </div>

          <v-chip
            color="green-darken-2"
            variant="tonal"
            size="small"
            class="font-weight-bold"
          >
            {{ nivelSeleccionado }}
          </v-chip>
        </div>

        <v-row dense>
          <v-col cols="6">
            <div class="energy-summary-item">
              <div class="d-flex align-center mb-1">
                <v-icon color="green-darken-2" size="20" class="mr-2">mdi-lightning-bolt</v-icon>
                <span class="text-caption text-grey-darken-1">Consumo total</span>
              </div>
              <div class="text-h6 font-weight-bold text-green-darken-2">
                {{ parseFloat(consumoTotal || 0).toFixed(2) }} kWh
              </div>
            </div>
          </v-col>

          <v-col cols="6">
            <div class="energy-summary-item">
              <div class="d-flex align-center mb-1">
                <v-icon color="orange-darken-2" size="20" class="mr-2">mdi-chart-line</v-icon>
                <span class="text-caption text-grey-darken-1">Pico registrado</span>
              </div>
              <div class="text-h6 font-weight-bold text-orange-darken-2">
                {{ picoConsumo.toFixed(2) }} kWh
              </div>
            </div>
          </v-col>

          <v-col cols="6">
            <div class="energy-summary-item">
              <div class="d-flex align-center mb-1">
                <v-icon color="green-darken-2" size="20" class="mr-2">mdi-calendar-range</v-icon>
                <span class="text-caption text-grey-darken-1">Periodo</span>
              </div>
              <div class="text-body-1 font-weight-bold text-grey-darken-3">
                {{ periodoTexto }}
              </div>
            </div>
          </v-col>

          <v-col cols="6">
            <div class="energy-summary-item">
              <div class="d-flex align-center mb-1">
                <v-icon color="green-darken-2" size="20" class="mr-2">mdi-devices</v-icon>
                <span class="text-caption text-grey-darken-1">Dispositivos</span>
              </div>
              <div class="text-h6 font-weight-bold text-green-darken-2">
                {{ dispositivosCrudos.length }}
              </div>
            </div>
          </v-col>
        </v-row>

        <!-- Pronóstico del mes en curso -->
        <div v-if="pronostico" class="forecast-box mt-4 pa-3 rounded-lg">
          <div class="d-flex align-center mb-1">
            <v-icon color="blue-darken-2" size="20" class="mr-2">mdi-crystal-ball</v-icon>
            <span class="text-caption font-weight-bold text-grey-darken-2">Pronóstico de este mes</span>
          </div>
          <div class="d-flex align-baseline flex-wrap ga-2">
            <span class="text-h6 font-weight-bold text-blue-darken-2">{{ pronostico.proyeccion.toFixed(1) }} kWh</span>
            <span class="text-caption text-grey-darken-1">
              llevas {{ pronostico.consumoActual.toFixed(1) }} kWh · promedio {{ pronostico.promedioDiario.toFixed(1) }} kWh/día
            </span>
          </div>
          <div v-if="!pronostico.confiable" class="text-caption text-orange-darken-3 mt-1">
            Aún hay pocos días con lecturas; el pronóstico es aproximado.
          </div>
        </div>

        <div class="energy-summary-status mt-4">
          <v-icon
            :color="consumoTotal > 0 ? 'green-darken-2' : 'grey'"
            size="18"
            class="mr-2"
          >
            {{ consumoTotal > 0 ? 'mdi-check-circle' : 'mdi-information-outline' }}
          </v-icon>

          <span class="text-caption font-weight-medium text-grey-darken-2">
            {{ consumoTotal > 0
              ? 'Se encontraron registros de consumo para el periodo seleccionado.'
              : 'No hay registros de consumo para el periodo seleccionado.' }}
          </span>
        </div>
      </v-card>

      <!-- SECCIÓN: Selector de Tarifa y Horarios Modificables -->
      <div class="mb-6">
        <div class="d-flex justify-center mb-4">
          <v-btn-toggle v-model="tarifaSeleccionada" color="green-darken-3" mandatory rounded="xl" group
            class="elevation-1 bg-white">
            <v-btn value="GDMTH" class="px-8 font-weight-bold">GDMTH</v-btn>
            <v-btn value="GDMTO" class="px-8 font-weight-bold">GDMTO</v-btn>
          </v-btn-toggle>
        </div>

        <v-card class="rounded-xl pa-4 elevation-1 border">
          <div class="d-flex align-center justify-space-between mb-3">
            <div class="d-flex align-center">
              <v-icon color="green-darken-3" class="mr-2">mdi-clock-time-four-outline</v-icon>
              <span class="text-subtitle-2 font-weight-bold text-grey-darken-3">Horarios {{ tarifaSeleccionada }}</span>
            </div>
            <v-btn :icon="editandoHorarios ? 'mdi-check' : 'mdi-pencil'" variant="text" size="small"
              :color="editandoHorarios ? 'green' : 'grey'" @click="editandoHorarios = !editandoHorarios"></v-btn>
          </div>
          <v-row dense>
            <v-col cols="12" v-for="(item, index) in horariosActuales" :key="index">
              <div class="d-flex align-start justify-space-between bg-grey-lighten-4 pa-2 rounded-lg border-sm">
                <div class="d-flex align-center mt-1" style="min-width: 90px;">
                  <v-icon :color="item.color" size="small" class="mr-1">mdi-circle</v-icon>
                  <span class="text-body-2 font-weight-bold text-grey-darken-3">{{ item.nivel }}</span>
                </div>
                <div class="d-flex flex-column align-end flex-grow-1">
                  <div v-for="(bloque, bIdx) in item.bloques" :key="bIdx" class="d-flex align-center mb-1">
                    <span v-if="!editandoHorarios" class="text-caption text-grey-darken-2 font-weight-medium">{{
                      bloque.inicio }} a {{ bloque.fin }}</span>
                    <div v-else class="d-flex align-center">
                      <v-text-field v-model="bloque.inicio" type="time" density="compact" variant="outlined"
                        hide-details class="time-input bg-white"></v-text-field>
                      <span class="mx-2 text-caption text-grey">a</span>
                      <v-text-field v-model="bloque.fin" type="time" density="compact" variant="outlined" hide-details
                        class="time-input bg-white"></v-text-field>
                    </div>
                  </div>
                </div>
              </div>
            </v-col>
          </v-row>
        </v-card>
      </div>

      <!-- SECCIÓN: Consumo total y Gráfica Real -->
      <v-card class="rounded-xl pa-5 mb-4 elevation-1 border-light">
        <div class="d-flex justify-space-between align-start mb-4">
          <div>
            <span class="text-subtitle-1 text-grey-darken-1 d-block">Consumo total</span>
            <span class="text-h4 font-weight-bold text-green-darken-1">{{ parseFloat(consumoTotal).toFixed(2) }}
              kWh</span>
          </div>
        </div>

        <!-- Filtro de Nivel de Tarifa para afectar la Gráfica y Datos -->
        <div class="d-flex justify-center mb-2">
          <v-btn-toggle v-model="nivelSeleccionado" color="green-darken-2" mandatory rounded="xl" group
            density="compact" class="elevation-0 bg-green-lighten-5">
            <v-btn value="General" class="px-3 text-caption font-weight-bold">General</v-btn>
            <v-btn v-for="item in horariosActuales" :key="item.nivel" :value="item.nivel"
              class="px-3 text-caption font-weight-bold">
              {{ item.nivel }}
            </v-btn>
          </v-btn-toggle>
        </div>

        <!-- Selector de periodo (Día, Semana, Mes) -->
        <div class="d-flex justify-center mb-4">
          <v-btn-toggle v-model="periodoSeleccionado" color="green-darken-2" mandatory rounded="xl" group
            density="compact" class="elevation-0 bg-green-lighten-5">
            <v-btn value="dia" class="px-4 text-caption font-weight-bold">Día</v-btn>
            <v-btn value="semana" class="px-4 text-caption font-weight-bold">Semana</v-btn>
            <v-btn value="mes" class="px-4 text-caption font-weight-bold">Mes</v-btn>
          </v-btn-toggle>
        </div>

        <v-sheet height="150" class="d-flex align-end justify-space-between pt-4 pb-2 relative">

          <div v-if="loadingGrafica" class="w-100 h-100 d-flex justify-center align-center position-absolute"
            style="z-index: 2; background: rgba(255,255,255,0.7);">
            <v-progress-circular indeterminate color="green-darken-2" size="32"></v-progress-circular>
          </div>

          <div v-if="!loadingGrafica && maxChartValue === 1 && consumoTotal === 0"
            class="w-100 text-center text-caption text-grey position-absolute" style="bottom: 50%;">
            Sin consumo en este nivel / horario
          </div>

          <div v-for="(altura, i) in datosGraficaAlturas" :key="i"
            class="d-flex flex-column justify-end align-center h-100 chart-bar-container"
            :style="{ width: `${100 / datosGraficaAlturas.length}%` }">
            <v-tooltip activator="parent" location="top">{{ datosGraficaValores[i].toFixed(2) }} kWh</v-tooltip>
            <div class="bg-green-lighten-3 rounded-t-sm w-100 mx-px chart-bar" :style="{ height: altura + '%' }"></div>
            <span class="text-grey-darken-1 mt-1 chart-label">{{ etiquetasGrafica[i] }}</span>
          </div>
        </v-sheet>
      </v-card>

      <!-- SECCIÓN: Consumo Dinámico por Dispositivo -->
      <v-card class="rounded-xl pa-5 mb-4 elevation-1 border-light">
        <p class="text-subtitle-1 text-grey-darken-1 mb-4">Desglose por Dispositivos</p>

        <div v-if="desgloseDispositivos.length === 0" class="text-center text-caption text-grey my-4">
          No hay dispositivos registrados o consumo en este horario.
        </div>

        <div v-else v-for="(disp, index) in desgloseDispositivos" :key="index" class="mb-4">
          <div class="d-flex justify-space-between align-center mb-1">
            <span class="text-body-2 font-weight-medium text-grey-darken-3">{{ disp.nombre }}</span>
            <span class="text-caption font-weight-bold text-grey-darken-1">{{ disp.porcentaje }}% ({{ disp.valor }}
              kWh)</span>
          </div>
          <v-progress-linear :model-value="disp.porcentaje"
            :color="coloresDispositivos[index % coloresDispositivos.length]" height="8" rounded></v-progress-linear>
        </div>
      </v-card>

    </div>
  </v-container>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, ref, computed } from 'vue';
import axios from 'axios';
import { storeToRefs } from 'pinia';
import { useBuildingStore } from '@/stores/buildings';
import { useUserStore } from '@/stores/users';

const buildingStore = useBuildingStore();
const userStore = useUserStore();

const { edificios, loading: loadingBuildings } = storeToRefs(buildingStore);

const loading = ref(false);
const loadingGrafica = ref(false);
const edificioSeleccionado = ref(null);

const fechasDisponibles = ref([]);
const anioSeleccionado = ref(null);
const mesSeleccionado = ref(null);

const nombresMeses = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
};

const aniosDisponibles = computed(() => {
  const anios = fechasDisponibles.value.map(f => f.anio);
  return [...new Set(anios)].sort((a, b) => b - a);
});

const mesesDisponiblesFiltrados = computed(() => {
  if (!anioSeleccionado.value) return [];
  const mesesDelAnio = fechasDisponibles.value.filter(f => f.anio === anioSeleccionado.value).map(f => f.mes);
  const mesesUnicos = [...new Set(mesesDelAnio)].sort((a, b) => a - b);
  return mesesUnicos.map(m => ({ text: nombresMeses[m], value: m }));
});

const tarifaSeleccionada = ref('GDMTH');
const periodoSeleccionado = ref('dia');
const nivelSeleccionado = ref('General'); // Nuevo filtro
const editandoHorarios = ref(false);

const horariosTarifas = ref({
  GDMTH: [
    { nivel: 'Base', bloques: [{ inicio: '00:00', fin: '06:00' }], color: 'green' },
    { nivel: 'Intermedio', bloques: [{ inicio: '06:00', fin: '20:00' }, { inicio: '22:00', fin: '23:59' }], color: 'orange' },
    { nivel: 'Punta', bloques: [{ inicio: '20:00', fin: '22:00' }], color: 'red' }
  ],
  GDMTO: [
    { nivel: 'Base', bloques: [{ inicio: '00:00', fin: '06:00' }], color: 'green' },
    { nivel: 'Intermedio', bloques: [{ inicio: '06:00', fin: '20:00' }, { inicio: '22:00', fin: '23:59' }], color: 'orange' },
    { nivel: 'Punta', bloques: [{ inicio: '20:00', fin: '22:00' }], color: 'red' }
  ]
});

const horariosActuales = computed(() => horariosTarifas.value[tarifaSeleccionada.value]);

// Extraemos los bloques de hora exactos del nivel seleccionado
const rangosFiltro = computed(() => {
  if (nivelSeleccionado.value === 'General') return null;
  const horario = horariosActuales.value.find(h => h.nivel === nivelSeleccionado.value);
  if (!horario) return null;
  return horario.bloques.map(b => `${b.inicio}-${b.fin}`).join(',');
});

const datosGraficaValores = ref([]);
const etiquetasGrafica = ref([]);

const maxChartValue = computed(() => {
  if (datosGraficaValores.value.length === 0) return 1;
  return Math.max(...datosGraficaValores.value) || 1;
});

const datosGraficaAlturas = computed(() => {
  return datosGraficaValores.value.map(v => (v / maxChartValue.value) * 100);
});

const consumoTotal = ref(0);
const dispositivosCrudos = ref([]);
const coloresDispositivos = ['green', 'light-green', 'green-darken-1', 'teal', 'green-darken-2'];

const picoConsumo = computed(() => {
  if (datosGraficaValores.value.length === 0) return 0;
  return Math.max(...datosGraficaValores.value.map(v => parseFloat(v) || 0));
});

const periodoTexto = computed(() => {
  if (periodoSeleccionado.value === 'dia') return 'Día';
  if (periodoSeleccionado.value === 'semana') return 'Semana';
  return 'Mes';
});

const nombreEdificioMostrado = computed(() => {
  const edif = edificios.value.find(e => e.codigoEdificio === edificioSeleccionado.value);
  return edif ? edif.nombreEdificio : edificioSeleccionado.value;
});

const desgloseDispositivos = computed(() => {
  if (consumoTotal.value === 0 || dispositivosCrudos.value.length === 0) return [];
  return dispositivosCrudos.value.map(d => {
    const valor = parseFloat(d.total_valor || 0);
    return {
      nombre: d.nombre_dispositivo || 'Desconocido',
      valor: valor.toFixed(2),
      porcentaje: Math.round((valor / consumoTotal.value) * 100)
    };
  });
});

const limpiarDatos = () => {
  consumoTotal.value = 0;
  dispositivosCrudos.value = [];
  datosGraficaValores.value = [];
  etiquetasGrafica.value = [];
};
let fechasRequestId = 0;
let datosRequestId = 0;
const errorCarga = ref('');

const cargarFechasDisponibles = async () => {
  const requestId = ++fechasRequestId;
  ++datosRequestId;
  fechasDisponibles.value = [];
  anioSeleccionado.value = null;
  mesSeleccionado.value = null;
  limpiarDatos();
  errorCarga.value = '';
  if (!edificioSeleccionado.value) { loading.value = false; return; }
  loading.value = true;
  try {
    const res = await axios.get(`/monitoring/fechas-disponibles/${edificioSeleccionado.value}`);
    if (requestId !== fechasRequestId) return;
    fechasDisponibles.value = (res.data.data || []).map(f => ({ anio: Number(f.anio), mes: Number(f.mes) }))
      .sort((a, b) => b.anio - a.anio || b.mes - a.mes);
    anioSeleccionado.value = fechasDisponibles.value[0]?.anio ?? null;
    mesSeleccionado.value = fechasDisponibles.value[0]?.mes ?? null;
  } catch {
    if (requestId === fechasRequestId) errorCarga.value = 'No se pudieron cargar los periodos. Intenta de nuevo.';
  } finally {
    if (requestId === fechasRequestId) loading.value = false;
  }
};

const cargarDatos = async () => {
  const requestId = ++datosRequestId;
  const id = edificioSeleccionado.value;
  const params = { mes: mesSeleccionado.value, anio: anioSeleccionado.value,
    periodo: periodoSeleccionado.value, rangos: rangosFiltro.value || undefined };
  limpiarDatos();
  if (!id || !params.mes || !params.anio) return;
  loading.value = true;
  errorCarga.value = '';
  try {
    const [general, devices, chart] = await Promise.all([
      axios.get(`/monitoring/general/${id}`, { params }),
      axios.get(`/monitoring/devices/${id}`, { params }),
      axios.get(`/monitoring/chart/${id}`, { params }),
    ]);
    // Ignore responses for filters that have already changed.
    if (requestId !== datosRequestId) return;
    consumoTotal.value = Number(general.data.data?.[0]?.total) || 0;
    dispositivosCrudos.value = devices.data.data || [];
    const length = params.periodo === 'dia' ? 24 : params.periodo === 'semana' ? 7
      : new Date(params.anio, params.mes, 0).getDate();
    const valores = Array(length).fill(0);
    for (const row of chart.data.data || []) {
      const index = Number(row.etiqueta) - (params.periodo === 'mes' ? 1 : 0);
      if (Number.isInteger(index) && index >= 0 && index < length) {
        valores[index] = Number(row.total_valor) || 0;
      }
    }
    datosGraficaValores.value = valores;
    etiquetasGrafica.value = params.periodo === 'semana' ? ['L', 'M', 'M', 'J', 'V', 'S', 'D']
      : Array.from({ length }, (_, i) => params.periodo === 'dia'
        ? (i % 4 === 0 ? `${i}h` : '') : ((i + 1) % 5 === 0 ? `${i + 1}` : ''));
  } catch {
    if (requestId === datosRequestId) {
      errorCarga.value = 'No se pudo cargar el consumo. Revisa la conexión e intenta de nuevo.';
    }
  } finally {
    if (requestId === datosRequestId) loading.value = false;
  }
};

// Pronóstico del consumo del mes en curso (independiente de los filtros)
const pronostico = ref(null);
const cargarPronostico = async () => {
  pronostico.value = null;
  const id = edificioSeleccionado.value;
  if (!id) return;
  try {
    const res = await axios.get(`/monitoring/forecast/${id}`);
    if (id === edificioSeleccionado.value && res.data.data?.diasConDatos > 0) pronostico.value = res.data.data;
  } catch {
    pronostico.value = null;
  }
};

const reintentarCarga = () => {
  if (!anioSeleccionado.value || !mesSeleccionado.value) cargarFechasDisponibles();
  else cargarDatos();
};

onMounted(() => {
  const userId = userStore.usuario?.idUsuario;
  if (userId) {
    buildingStore.listarEdificiosPorUsuario({
      id: userId,
      onComplete: () => {
        if (edificios.value?.length > 0) {
          edificioSeleccionado.value = edificios.value[0].codigoEdificio;
        }
      }
    });
  }
});

// Refrescar al cambiar filtros
watch(edificioSeleccionado, cargarFechasDisponibles);
watch(edificioSeleccionado, cargarPronostico);
watch([mesSeleccionado, anioSeleccionado, nivelSeleccionado, tarifaSeleccionada, periodoSeleccionado], cargarDatos);
watch(anioSeleccionado, () => {
  const meses = mesesDisponiblesFiltrados.value;
  if (!meses.some(m => m.value === mesSeleccionado.value)) {
    mesSeleccionado.value = meses.at(-1)?.value ?? null;
  }
}, { flush: 'sync' });
onBeforeUnmount(() => { ++fechasRequestId; ++datosRequestId; });

// Si el usuario termina de editar horarios y no está en 'General', recargamos con las nuevas horas
watch(editandoHorarios, (nuevoValor) => {
  if (!nuevoValor && nivelSeleccionado.value !== 'General') {
    cargarDatos();
  }
});
</script>

<style scoped>
.forecast-box {
  background-color: #e3f2fd;
  border: 1px solid rgba(21, 101, 192, 0.15);
}

.energy-summary-card {
  border: 1px solid #e8f0ea !important;
  background: linear-gradient(180deg, #ffffff 0%, #f8fcf9 100%) !important;
}

.energy-summary-item {
  min-height: 82px;
  padding: 12px;
  border: 1px solid #edf1ee;
  border-radius: 14px;
  background: #ffffff;
}

.energy-summary-status {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: #eef8f0;
}

.main-container {
  max-width: 960px;
  margin: 0 auto;
}

.v-card {
  background-color: #ffffff !important;
  border: 1px solid #eef0f2 !important;
  transition: transform 0.2s ease;
}

.v-card:active {
  transform: scale(0.99);
}

.border-dashed {
  border: 2px dashed #d1d5db !important;
}

.border {
  border: 1px solid #e0e0e0 !important;
}

.border-light {
  border: 1px solid #f5f5f5 !important;
}

.mx-px {
  margin-left: 1px;
  margin-right: 1px;
}

.bg-green-lighten-5 {
  background-color: #eef7ef !important;
}

/* Ajustes para inputs de hora nativos */
.time-input {
  width: 105px;
}

:deep(.time-input input[type="time"]) {
  font-size: 0.85rem;
  padding: 4px;
  cursor: pointer;
}

/* Gráfica */
.relative {
  position: relative;
}

.chart-bar-container {
  min-width: 0;
}

.chart-bar {
  transition: height 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 2px;
}

.chart-bar:hover {
  background-color: #2E7D32 !important;
}

.chart-label {
  font-size: 0.55rem;
  white-space: nowrap;
  height: 12px;
}
</style>