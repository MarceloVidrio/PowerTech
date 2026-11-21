<template>
  <v-container class="mt-8 px-4 main-container" fluid>

    <div class="mb-6">
      <v-btn icon="mdi-arrow-left" variant="text" color="green-darken-2" @click="$router.back()"></v-btn>
      <span class="text-subtitle-1 font-weight-bold ml-2">Volver</span>
      <h1 class="text-h4 font-weight-bold">Mis Sensores</h1>
      <p class="text-subtitle-2 text-grey-darken-1">Vista global de tu hardware</p>
    </div>

    <!-- RESUMEN DE SENSORES Y COMUNICACIÓN -->
    <v-row v-if="!loading && sensores && sensores.length > 0" class="mb-5" dense>
      <v-col cols="4">
        <v-card class="sensor-summary-card rounded-xl pa-3 text-center elevation-1">
          <v-icon color="green-darken-2" size="22" class="mb-1">mdi-access-point-network</v-icon>
          <div class="text-h6 font-weight-bold" style="color: #478D4B;">{{ sensores.length }}</div>
          <div class="text-caption text-grey-darken-1">Sensores</div>
        </v-card>
      </v-col>

      <v-col cols="4">
        <v-card class="sensor-summary-card rounded-xl pa-3 text-center elevation-1">
          <v-icon color="green-darken-2" size="22" class="mb-1">mdi-access-point-check</v-icon>
          <div class="text-h6 font-weight-bold text-green-darken-2">{{ sensoresConComunicacion }}</div>
          <div class="text-caption text-grey-darken-1">Con datos</div>
        </v-card>
      </v-col>

      <v-col cols="4">
        <v-card class="sensor-summary-card rounded-xl pa-3 text-center elevation-1">
          <v-icon color="orange-darken-2" size="22" class="mb-1">mdi-access-point-off</v-icon>
          <div class="text-h6 font-weight-bold text-orange-darken-2">{{ sensoresSinComunicacion }}</div>
          <div class="text-caption text-grey-darken-1">Sin datos</div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Loading -->
    <v-row v-if="loading">
      <v-col cols="6" v-for="n in 4" :key="n">
        <v-skeleton-loader type="card" class="rounded-xl"></v-skeleton-loader>
      </v-col>
    </v-row>

    <!-- Si no hay sensores -->
    <v-card v-else-if="!sensores || sensores.length === 0"
      class="pa-8 text-center rounded-xl bg-transparent elevation-0 border-dashed w-100">
      <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-access-point-network-off</v-icon>
      <div class="text-h6 text-grey-darken-2">No hay sensores</div>
      <div class="text-body-2 text-grey">Tus dispositivos aún no tienen sensores vinculados.</div>
    </v-card>

    <div v-else>
      <v-row>
        <!-- Tarjetas -->
        <v-col v-for="item in sensores" :key="item.codigoSensor" cols="6">
          <v-card class="sensor-card pa-4 rounded-xl text-center h-100 d-flex flex-column align-center justify-center"
            :class="item.activo ? 'bg-green-lighten-5' : 'bg-red-lighten-5'" elevation="0"
            @click="abrirModalDetalles(item)">
            <!-- Botón de eliminar -->
            <v-btn v-if="userStore.esAdmin" icon="mdi-close-circle" variant="text" color="red-lighten-2" size="small" class="delete-btn"
              @click.stop="confirmarEliminar(item.codigoSensor)"></v-btn>

            <!-- Avatar del sensor -->
            <v-avatar :color="item.activo ? 'green-lighten-4' : 'red-lighten-4'" size="52" class="mb-2">
              <v-icon size="28" :color="item.activo ? 'green-darken-3' : 'red-darken-3'">
                mdi-gauge
              </v-icon>
            </v-avatar>

            <!-- Código -->
            <div class="text-caption font-weight-bold text-uppercase"
              :class="item.activo ? 'text-green-darken-3' : 'text-red-darken-3'">
              {{ item.codigoSensor }}
            </div>
            <!-- Nombre -->
            <div class="text-subtitle-2 font-weight-bold text-grey-darken-3 text-truncate w-100 px-1"
              style="line-height: 1.2;">
              {{ item.nombreSensor }}
            </div>
            <!-- Tipo -->
            <div class="text-caption font-weight-bold text-grey-darken-1 text-truncate w-100 mt-1">
              {{ item.tipoSensor }}
            </div>
            <div class="text-caption text-grey-darken-1 text-truncate w-100 mb-1">
              <v-icon size="12" class="mr-1">mdi-devices</v-icon> {{ item.nombreDispositivo || item.codigoDispositivo || 'Sin dispositivo' }}
            </div>

            <!-- Estado de comunicación derivado de la última lectura -->
            <div class="d-flex align-center justify-center mb-2">
              <v-icon
                size="13"
                class="mr-1"
                :color="estadoComunicacion(item.codigoSensor).color"
              >
                {{ estadoComunicacion(item.codigoSensor).icon }}
              </v-icon>

              <span
                class="text-caption font-weight-bold"
                :class="estadoComunicacion(item.codigoSensor).textClass"
              >
                {{ estadoComunicacion(item.codigoSensor).label }}
              </span>
            </div>

            <div
              v-if="ultimaLecturaPorSensor[item.codigoSensor]"
              class="text-caption text-grey-darken-1 mb-2"
            >
              Última: {{ ultimaLecturaPorSensor[item.codigoSensor].valor }}
              {{ item.unidadMedida || '' }}
            </div>

            <!-- Switch de estado -->
            <v-switch v-model="item.activo" :true-value="1" :false-value="0" color="green-darken-3" hide-details
              density="compact" class="mt-auto" @click.stop @change="cambiarEstado(item)"></v-switch>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- Botón flotante para agregar -->
    <div class="fab-container" v-if="userStore.esAdmin">
      <v-btn color="green-darken-2" icon="mdi-plus" size="large" elevation="4" @click="dialogoVisible = true"></v-btn>
    </div>

    <!-- Modal Nuevo Sensor -->
    <v-dialog v-model="dialogoVisible" max-width="500px" persistent>
      <v-card class="rounded-xl pa-4 elevation-12">
        <v-card-title class="text-h5 font-weight-bold text-center" style="color: #478D4B;">Nuevo Sensor</v-card-title>

        <v-card-text>
          <v-form ref="formRef" v-model="formValido">
            <!-- Código -->
            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2 text-grey-darken-2">Código del Sensor</div>
            <v-text-field v-model="nuevoSensor.codigoSensor" placeholder="Ej: SENS-01" variant="outlined"
              density="comfortable" rounded="lg" :rules="reglas.codigo" required />

            <!-- Dispositivo Vinculado -->
            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2 text-grey-darken-2">Dispositivo Vinculado (Opcional)</div>
            <v-select v-model="nuevoSensor.codigoDispositivo" :items="dispositivosSinSensor"
              :item-title="item => item?.codigoDispositivo ? `${item.codigoDispositivo} - ${item.nombre}` : ''"
              item-value="codigoDispositivo" placeholder="Selecciona a qué equipo pertenece" variant="outlined"
              density="comfortable" rounded="lg" clearable>
              <template v-slot:no-data>
                <div class="pa-4 text-caption text-grey">No hay dispositivos registrados</div>
              </template>
            </v-select>

            <!-- Nombre -->
            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2 text-grey-darken-2">Nombre del Sensor</div>
            <v-text-field v-model="nuevoSensor.nombreSensor" placeholder="Ej: Sensor de Computadora" variant="outlined"
              density="comfortable" rounded="lg" :rules="reglas.nombre" required />

            <!-- Tipo y Unidad -->
            <v-row>
              <v-col cols="6">
                <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2 text-grey-darken-2">Tipo</div>
                <v-text-field v-model="nuevoSensor.tipoSensor" placeholder="Ej: De medida" variant="outlined"
                  density="comfortable" rounded="lg" :rules="reglas.tipo" required />
              </v-col>
              <v-col cols="6">
                <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2 text-grey-darken-2">Unidad</div>
                <v-text-field v-model="nuevoSensor.unidadMedida" placeholder="Ej: W" variant="outlined"
                  density="comfortable" rounded="lg" />
              </v-col>
            </v-row>

            <!-- Umbrales que disparan alarmas -->
            <v-row>
              <v-col cols="6">
                <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2 text-grey-darken-2">Umbral bajo</div>
                <v-text-field v-model="nuevoSensor.umbralBajo" type="number" min="0" placeholder="Ej: 50"
                  variant="outlined" density="comfortable" rounded="lg" :rules="reglas.umbralBajo(nuevoSensor)"
                  hint="Encendido fuera de horario / apagado en horario" persistent-hint />
              </v-col>
              <v-col cols="6">
                <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2 text-grey-darken-2">Umbral alto</div>
                <v-text-field v-model="nuevoSensor.umbralAlto" type="number" min="0" placeholder="Ej: 400"
                  variant="outlined" density="comfortable" rounded="lg" :rules="reglas.numero"
                  hint="Pico de consumo" persistent-hint />
              </v-col>
            </v-row>

            <!-- Estado Inicial -->
            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-4 text-grey-darken-2">Estado Inicial</div>
            <v-switch v-model="nuevoSensor.activo"
              :label="nuevoSensor.activo ? 'Activado (Monitoreando)' : 'Desactivado (Apagado)'" color="green-darken-2"
              inset hide-details></v-switch>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" color="black" @click="cerrarModal" class="text-none">Cancelar</v-btn>
          <v-btn color="green-darken-2" class="text-none rounded-pill px-6" variant="flat" :disabled="!formValido"
            :loading="loading" @click="guardarSensor">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Modal de detalles CON GRÁFICA -->
    <v-dialog v-model="dialogoDetallesVisible" max-width="600px" @update:modelValue="manejarCierreModal">
      <v-card class="rounded-xl pa-4 elevation-12">
        <v-card-title class="text-h5 font-weight-bold text-center mb-2" style="color: #478D4B;">
          Detalles y Monitoreo
        </v-card-title>

        <v-card-text class="pt-2" v-if="sensorSeleccionado">
          <div class="d-flex align-center mb-4">
            <v-avatar :color="sensorSeleccionado.activo ? 'green-lighten-4' : 'red-lighten-4'" size="56" class="mr-4">
              <v-icon size="28"
                :color="sensorSeleccionado.activo ? 'green-darken-3' : 'red-darken-3'">mdi-gauge</v-icon>
            </v-avatar>
            <div>
              <div class="text-subtitle-1 font-weight-bold text-grey-darken-3" style="line-height: 1.2;">
                {{ sensorSeleccionado.nombreSensor }}
              </div>
              <div class="text-caption font-weight-bold"
                :class="sensorSeleccionado.activo ? 'text-green-darken-3' : 'text-red-darken-3'">
                {{ sensorSeleccionado.codigoSensor }} | {{ sensorSeleccionado.activo ? 'Activo' : 'Inactivo' }}
              </div>
            </div>
          </div>

          <!-- Última lectura destacada (Lectura segura contra fallos) -->
          <v-row class="mb-4">
            <v-col cols="6">
              <div class="text-caption font-weight-bold text-grey-darken-1 mb-1">Última Lectura</div>
              <div class="text-h6 font-weight-bold" style="color: #478D4B;">
                {{ (lecturas && lecturas.length > 0) ? lecturas[lecturas.length - 1].valor : '--' }}
                <span class="text-caption">{{ sensorSeleccionado.unidadMedida || '' }}</span>
              </div>
            </v-col>
            <v-col cols="6">
              <div class="text-caption font-weight-bold text-grey-darken-1 mb-1">Dispositivo</div>
              <div class="text-body-2 font-weight-bold text-grey-darken-3 text-truncate">
                <v-icon size="16" color="#478D4B" class="mr-1">mdi-devices</v-icon>
                {{ sensorSeleccionado.nombreDispositivo || sensorSeleccionado.codigoDispositivo || 'Sin dispositivo' }}
              </div>
            </v-col>
          </v-row>

          <!-- Umbrales (editables por el administrador) -->
          <v-row class="mb-2" dense>
            <v-col cols="5">
              <v-text-field v-model="umbralesTemporales.umbralBajo" type="number" min="0" label="Umbral bajo"
                variant="outlined" density="compact" rounded="lg" :disabled="!userStore.esAdmin" hide-details />
            </v-col>
            <v-col cols="5">
              <v-text-field v-model="umbralesTemporales.umbralAlto" type="number" min="0" label="Umbral alto"
                variant="outlined" density="compact" rounded="lg" :disabled="!userStore.esAdmin" hide-details />
            </v-col>
            <v-col cols="2" class="d-flex align-center" v-if="userStore.esAdmin">
              <v-btn icon="mdi-content-save" color="green-darken-2" variant="tonal" size="small"
                :loading="guardandoUmbrales" @click="guardarUmbrales"></v-btn>
            </v-col>
          </v-row>

          <!-- Token para configurar el nodo IoT -->
          <div v-if="userStore.esAdmin" class="mb-4">
            <v-btn v-if="!tokenSensor" variant="text" color="green-darken-2" class="text-none px-0"
              prepend-icon="mdi-key-variant" @click="mostrarToken">Ver token para configurar el nodo</v-btn>
            <v-text-field v-else :model-value="tokenSensor" label="Token del sensor (encabezado X-Sensor-Token)" readonly
              variant="outlined" density="compact" rounded="lg" append-inner-icon="mdi-content-copy"
              @click:append-inner="copiarToken" hide-details />
          </div>

          <v-divider class="mb-4"></v-divider>

          <!-- Contenedor de la gráfica -->
          <div class="chart-container" style="height: 250px; position: relative; width: 100%;">
            <!-- Estado de carga (Solo en la primera petición) -->
            <div v-if="cargandoLecturas" class="d-flex justify-center align-center h-100">
              <v-progress-circular indeterminate color="green-darken-2"></v-progress-circular>
            </div>

            <!-- Estado vacío (Si no hay datos en BD) -->
            <div v-else-if="!lecturas || lecturas.length === 0"
              class="d-flex flex-column justify-center align-center h-100 text-grey-darken-1 text-body-2">
              <v-icon size="32" class="mb-2">mdi-chart-line-variant</v-icon>
              Esperando datos del sensor...
            </div>

            <!-- Gráfica (Cuando sí hay datos y ya no carga) -->
            <Line v-else :data="chartData" :options="chartOptions" />
          </div>
        </v-card-text>

        <v-card-actions class="pa-4 pt-0">
          <v-spacer></v-spacer>
          <v-btn color="green-darken-2" class="text-none rounded-pill px-6" variant="flat"
            @click="dialogoDetallesVisible = false">
            Cerrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSensorStore } from "@/stores/sensors"
import { useDeviceStore } from "@/stores/devices"
import { useUserStore } from "@/stores/users"
import { useNotifyStore } from "@/stores/notify"

// Importaciones de Chart.js
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'

// Registrar componentes de Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const sensorStore = useSensorStore();
const deviceStore = useDeviceStore();
const userStore = useUserStore();
const notify = useNotifyStore();

const { sensores, loading } = storeToRefs(sensorStore);
const { dispositivos } = storeToRefs(deviceStore);

const dialogoVisible = ref(false);
const formRef = ref(null);
const formValido = ref(false);

const dialogoDetallesVisible = ref(false);
const sensorSeleccionado = ref(null);

// Variables para la gráfica en tiempo real
const lecturas = ref([]);
const cargandoLecturas = ref(false);
let intervaloMonitoreo = null;

// Última lectura conocida de cada sensor para mostrar el estado de comunicación.
const ultimaLecturaPorSensor = ref({});

const obtenerFechaLectura = (lectura) => {
  if (!lectura?.fechaHora) return null;
  const fecha = new Date(lectura.fechaHora);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const cargarUltimasLecturasSensores = async () => {
  if (!sensores.value || sensores.value.length === 0) return;

  const resultado = {};

  await Promise.all(
    sensores.value.map(async (sensor) => {
      try {
        if (typeof sensorStore.obtenerLecturasSensor !== 'function') return;

        const data = await sensorStore.obtenerLecturasSensor(sensor.codigoSensor);
        const registros = Array.isArray(data) ? data : [];

        if (registros.length === 0) return;

        const ordenadas = [...registros].sort((a, b) => {
          const fa = obtenerFechaLectura(a)?.getTime() || 0;
          const fb = obtenerFechaLectura(b)?.getTime() || 0;
          return fa - fb;
        });

        resultado[sensor.codigoSensor] = ordenadas[ordenadas.length - 1];
      } catch (error) {
        console.warn(`No se pudieron consultar lecturas de ${sensor.codigoSensor}`, error);
      }
    })
  );

  ultimaLecturaPorSensor.value = resultado;
};

const estadoComunicacion = (codigoSensor) => {
  const lectura = ultimaLecturaPorSensor.value[codigoSensor];

  if (!lectura) {
    return {
      label: 'Sin datos',
      color: 'grey',
      icon: 'mdi-help-circle-outline',
      textClass: 'text-grey-darken-1'
    };
  }

  return {
    label: 'Con datos',
    color: 'green-darken-2',
    icon: 'mdi-check-circle',
    textClass: 'text-green-darken-2'
  };
};

const sensoresConComunicacion = computed(() => {
  return (sensores.value || []).filter(
    sensor => estadoComunicacion(sensor.codigoSensor).label === 'Con datos'
  ).length;
});

const sensoresSinComunicacion = computed(() => {
  return (sensores.value || []).length - sensoresConComunicacion.value;
});

const nuevoSensor = ref({
  codigoSensor: '',
  codigoDispositivo: null,
  nombreSensor: '',
  tipoSensor: '',
  unidadMedida: 'W',
  umbralBajo: '',
  umbralAlto: '',
  activo: true
});

/* Solo se ofrecen dispositivos que todavía no tienen sensor (relación 1 a 1) */
const dispositivosSinSensor = computed(() => (dispositivos.value || []).filter(d => !d.sensor));

/* Umbrales y token del sensor abierto en el modal de detalles */
const umbralesTemporales = ref({ umbralBajo: '', umbralAlto: '' });
const guardandoUmbrales = ref(false);
const tokenSensor = ref('');
const aNumero = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

const guardarUmbrales = async () => {
  guardandoUmbrales.value = true;
  try {
    await sensorStore.actualizarUmbrales(sensorSeleccionado.value.codigoSensor, {
      umbralBajo: aNumero(umbralesTemporales.value.umbralBajo),
      umbralAlto: aNumero(umbralesTemporales.value.umbralAlto),
    });
    notify.show("Umbrales actualizados", "success");
    sensorStore.listarSensoresPorUsuario({ id: userStore.usuario.idUsuario });
  } catch (error) {
    notify.show(error.response?.data?.detalles?.[0] || error.response?.data?.mensaje || "Error al guardar umbrales", "error");
  } finally {
    guardandoUmbrales.value = false;
  }
};

const mostrarToken = async () => {
  try {
    tokenSensor.value = (await sensorStore.obtenerToken(sensorSeleccionado.value.codigoSensor)).token;
  } catch (error) {
    notify.show(error.response?.data?.mensaje || "No se pudo obtener el token", "error");
  }
};

const copiarToken = async () => {
  try {
    await navigator.clipboard.writeText(tokenSensor.value);
    notify.show("Token copiado", "success");
  } catch {
    notify.show("No se pudo copiar; selecciónalo manualmente", "error");
  }
};

const reglas = {
  codigo: [v => !!v || "Obligatorio", v => (v && v.length <= 10) || "Máximo 10 caracteres"],
  nombre: [v => !!v || "Obligatorio", v => (v && v.length <= 80) || "Máximo 80 caracteres"],
  tipo: [v => !!v || "Obligatorio", v => (v && v.length <= 40) || "Máximo 40 caracteres"],
  numero: [v => v === '' || v === null || Number(v) >= 0 || "Debe ser un número positivo"],
  umbralBajo: (s) => [
    v => v === '' || v === null || Number(v) >= 0 || "Debe ser un número positivo",
    v => v === '' || v === null || s.umbralAlto === '' || s.umbralAlto === null || Number(v) < Number(s.umbralAlto) || "Debe ser menor al umbral alto",
  ],
};

// ==========================================
// LÓGICA DE LA GRÁFICA (Chart.js)
// ==========================================

const chartData = computed(() => {
  if (!lecturas.value || lecturas.value.length === 0) return { labels: [], datasets: [] };

  return {
    labels: lecturas.value.map(l => {
      const d = new Date(l.fechaHora);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    }),
    datasets: [{
      label: 'Lectura',
      data: lecturas.value.map(l => l.valor),
      borderColor: '#478D4B',
      backgroundColor: 'rgba(71, 141, 75, 0.1)',
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointRadius: 2,
      pointBackgroundColor: '#478D4B'
    }]
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
  scales: {
    y: { beginAtZero: false, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
    x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } }
  },
  animation: { duration: 0 }
};

// NUEVA VERSIÓN BLINDADA DE LA CONSULTA
const consultarLecturas = async () => {
  if (!sensorSeleccionado.value) return;

  try {
    // 1. Validamos que la función SÍ exista en el store
    if (typeof sensorStore.obtenerLecturasSensor !== 'function') {
      console.error("❌ ERROR: La función 'obtenerLecturasSensor' no se encontró en tu archivo sensors.js. Asegúrate de haber guardado los cambios en tu Store.");
      cargandoLecturas.value = false;
      return;
    }

    // 2. Ejecutamos la petición esperando la Promesa
    const data = await sensorStore.obtenerLecturasSensor(sensorSeleccionado.value.codigoSensor);

    // 3. Forzamos a que siempre sea un arreglo, incluso si el backend falla y devuelve algo raro
    lecturas.value = Array.isArray(data) ? data : [];

  } catch (error) {
    // Si hay un error 404 (ruta no existe) o de conexión, caemos aquí de forma segura
    console.warn("⚠️ Advertencia al consultar lecturas (revisa la pestaña Network):", error);
    lecturas.value = [];
  } finally {
    // 4. Se asegura matemáticamente que la carga se detiene
    cargandoLecturas.value = false;
  }
};

const abrirModalDetalles = (sensor) => {
  sensorSeleccionado.value = sensor;
  umbralesTemporales.value = { umbralBajo: sensor.umbralBajo ?? '', umbralAlto: sensor.umbralAlto ?? '' };
  tokenSensor.value = '';
  lecturas.value = [];
  cargandoLecturas.value = true;
  dialogoDetallesVisible.value = true;

  consultarLecturas();
  intervaloMonitoreo = setInterval(consultarLecturas, 3000);
};

const manejarCierreModal = (estadoVisible) => {
  if (!estadoVisible) {
    if (intervaloMonitoreo) {
      clearInterval(intervaloMonitoreo);
      intervaloMonitoreo = null;
    }
    sensorSeleccionado.value = null;
  }
};

// ==========================================
// FIN LÓGICA DE LA GRÁFICA
// ==========================================

const cerrarModal = () => {
  dialogoVisible.value = false;
  nuevoSensor.value = {
    codigoSensor: '', codigoDispositivo: null, nombreSensor: '',
    tipoSensor: '', unidadMedida: 'W', umbralBajo: '', umbralAlto: '', activo: true
  };
  if (formRef.value) formRef.value.resetValidation();
};

const guardarSensor = async () => {
  const { valid } = await formRef.value.validate();
  if (!valid) return;

  const payload = {
    ...nuevoSensor.value,
    umbralBajo: aNumero(nuevoSensor.value.umbralBajo),
    umbralAlto: aNumero(nuevoSensor.value.umbralAlto),
    activo: nuevoSensor.value.activo ? 1 : 0
  };

  sensorStore.agregarSensor({
    datos: payload,
    onComplete: () => {
      notify.show("Sensor registrado", "success");
      cerrarModal();
      sensorStore.listarSensoresPorUsuario({ id: userStore.usuario.idUsuario });
    },
    onError: (error) => {
      const msg = error.response?.data?.detalles?.[0] || error.response?.data?.mensaje || "Error al registrar";
      notify.show(msg, "error");
    }
  });
};

const confirmarEliminar = (id) => {
  if (confirm("¿Eliminar este sensor? Se borrarán sus lecturas y alarmas relacionadas.")) {
    sensorStore.eliminarSensor({
      id: id,
      onComplete: () => {
        notify.show("Sensor eliminado", "success");
        sensorStore.listarSensoresPorUsuario({ id: userStore.usuario.idUsuario });
      },
      onError: (error) => notify.show(error.response?.data?.mensaje || "Error al eliminar", "error")
    });
  }
};

const cambiarEstado = (sensor) => {
  sensorStore.actualizarEstadoSensor({
    id: sensor.codigoSensor,
    activo: sensor.activo,
    onComplete: () => notify.show("Estado actualizado", "success"),
    onError: () => notify.show("Error de conexión", "error")
  });
};

onMounted(() => {
  if (userStore.usuario?.idUsuario) {
    sensorStore.listarSensoresPorUsuario({ id: userStore.usuario.idUsuario });
    deviceStore.listarDispositivosPorUsuario({ id: userStore.usuario.idUsuario });

    // Esperamos a que el store termine de cargar los sensores.
    setTimeout(() => {
      cargarUltimasLecturasSensores();
    }, 500);
  }
});

onUnmounted(() => {
  if (intervaloMonitoreo) clearInterval(intervaloMonitoreo);
});
</script>

<style scoped>
.main-container {
  max-width: 520px;
  margin-left: auto;
  margin-right: auto;
  padding-bottom: 120px;
}

.sensor-summary-card {
  border: 1px solid #edf1ee !important;
  background: #ffffff !important;
}

.raspberry-status {
  border: 1px solid #e8eef5 !important;
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%) !important;
}

.sensor-card {
  aspect-ratio: 1 / 1.28;
  transition: transform 0.2s ease, filter 0.2s ease;
  border: none !important;
  position: relative;
  cursor: pointer;
}

.sensor-card:hover {
  transform: translateY(-4px);
  filter: brightness(0.97);
}

.delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
}

.fab-container {
  position: fixed;
  bottom: 84px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99;
}

.border-dashed {
  border: 2px dashed rgba(0, 0, 0, 0.08) !important;
}
</style>