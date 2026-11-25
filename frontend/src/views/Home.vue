<template>
  <v-container class="mt-6 px-4 main-container" fluid>
    <div class="mb-5">
      <h1 class="text-h4 font-weight-bold" style="color: #478D4B;">Hola{{ nombreFormateado ? `, ${nombreFormateado}` : '' }}</h1>
      <p class="text-subtitle-2 text-grey-darken-1">{{ hogar?.nombre || 'Tu casa' }}{{ hogar?.ciudad ? ` · ${hogar.ciudad}` : '' }}</p>
    </div>

    <div v-if="cargando" class="d-flex justify-center my-10">
      <v-progress-circular indeterminate color="green-darken-2" />
    </div>

    <!-- Hogar sin configurar -->
    <v-card v-else-if="!hogar" class="pa-6 rounded-xl text-center setup-card" elevation="0">
      <v-icon size="56" color="green-darken-2" class="mb-3">mdi-home-lightning-bolt-outline</v-icon>
      <template v-if="userStore.esTitular">
        <div class="text-h6 font-weight-bold mb-1">Configura tu hogar</div>
        <p class="text-body-2 text-grey-darken-1 mb-4">Dinos tu tarifa de CFE y registra el sensor de consumo para empezar a ver tu consumo.</p>
        <v-btn color="green-darken-2" class="text-none rounded-pill px-6" to="/hogar">Empezar</v-btn>
      </template>
      <template v-else>
        <div class="text-h6 font-weight-bold mb-1">Tu hogar aún no está listo</div>
        <p class="text-body-2 text-grey-darken-1">El titular de la cuenta todavía no configura la casa.</p>
      </template>
    </v-card>

    <template v-else>
      <!-- Sin medidor -->
      <v-alert v-if="!hogar.medidor" type="info" variant="tonal" class="mb-4 rounded-xl" title="Falta el sensor de consumo">
        Registra el sensor de la pastilla principal para empezar a recibir lecturas.
        <template #append v-if="userStore.esTitular">
          <v-btn size="small" variant="flat" color="blue-darken-2" class="text-none" to="/hogar">Registrar</v-btn>
        </template>
      </v-alert>

      <!-- Consumo en este momento -->
      <v-card class="pa-5 rounded-xl mb-4 live-card" elevation="0" :class="claseAhora">
        <div class="d-flex align-center justify-space-between">
          <div>
            <div class="text-caption text-grey-darken-1">Tu casa consume ahora</div>
            <div class="text-h3 font-weight-black" :class="{ 'text-grey': sinSenal }">{{ ultima && !sinSenal ? watts(ultima.valor) : '—' }}</div>
            <div class="text-caption" :class="sinSenal ? 'text-red-darken-2 font-weight-bold' : 'text-grey-darken-1'">{{ textoUltima }}</div>
          </div>
          <v-avatar size="64" :color="colorAhora.fondo"><v-icon size="34" :color="colorAhora.icono">mdi-lightning-bolt</v-icon></v-avatar>
        </div>
        <div v-if="serie.length" class="sparkline mt-3" aria-hidden="true">
          <div v-for="(p, i) in serie" :key="i" class="spark-bar" :style="{ height: `${Math.max(4, (p.valor / maxSerie) * 100)}%` }"></div>
        </div>
        <div v-if="serie.length" class="d-flex justify-space-between text-caption text-grey mt-1">
          <span>hace 6 h</span><span>ahora</span>
        </div>
      </v-card>

      <!-- Bimestre -->
      <v-card v-if="p" class="pa-5 rounded-xl mb-4 section-card" elevation="0">
        <div class="d-flex align-center justify-space-between mb-3">
          <div>
            <div class="text-subtitle-1 font-weight-bold">Este bimestre</div>
            <div class="text-caption text-grey-darken-1">{{ fechaCorta(p.periodo.inicio) }} – {{ fechaCorta(p.periodo.fin) }} · faltan {{ Math.ceil(p.periodo.diasRestantes) }} días</div>
          </div>
          <v-chip size="small" variant="tonal" :color="p.dac.enRiesgo ? 'red' : 'green'" class="font-weight-bold">
            {{ p.reciboProyectado.escalonActual || 'Básico' }}
          </v-chip>
        </div>
        <v-progress-linear :model-value="(p.periodo.diasTranscurridos / p.periodo.diasTotales) * 100" color="green-darken-2" height="6" rounded class="mb-4" />
        <v-row dense>
          <v-col cols="6">
            <div class="metric">
              <div class="text-caption text-grey-darken-1">Llevas</div>
              <div class="text-h6 font-weight-bold text-green-darken-2">{{ kwh(p.consumido) }}</div>
              <div class="text-caption">{{ pesos(p.reciboActual.total) }} aprox.</div>
            </div>
          </v-col>
          <v-col cols="6">
            <div class="metric">
              <div class="text-caption text-grey-darken-1">Pronóstico al cierre</div>
              <div class="text-h6 font-weight-bold text-blue-darken-2">{{ kwh(p.proyeccion, 0) }}</div>
              <div class="text-caption">{{ pesos(p.reciboProyectado.total) }} aprox.</div>
            </div>
          </v-col>
        </v-row>
        <div v-if="!p.confiable" class="text-caption text-orange-darken-3 mt-2">Aún hay pocos días con lecturas: el pronóstico es aproximado.</div>
        <div v-if="p.meta" class="mt-3">
          <div class="d-flex justify-space-between text-caption mb-1">
            <span>Meta del bimestre: {{ kwh(p.meta.kwh, 0) }}</span>
            <span :class="p.meta.superada ? 'text-red-darken-2 font-weight-bold' : 'text-green-darken-2'">{{ p.meta.porcentaje }}%</span>
          </div>
          <v-progress-linear :model-value="Math.min(100, p.meta.porcentaje)" :color="p.meta.superada ? 'red' : 'green'" height="6" rounded />
        </div>
        <v-alert v-if="p.dac.enRiesgo" type="error" variant="tonal" density="compact" class="mt-3 text-caption">
          Vas a unos {{ kwh(p.dac.kwhMensualEstimado, 0) }} al mes; el límite de tu tarifa es {{ p.dac.limiteMensual }} kWh.
          Si te pasas, CFE te cambia a tarifa DAC (sin subsidio).
        </v-alert>
        <v-btn variant="text" color="green-darken-2" class="text-none mt-2 px-0" to="/recibo" append-icon="mdi-chevron-right">Ver recibo estimado</v-btn>
      </v-card>

      <!-- Modo vacaciones y avisos -->
      <v-row dense class="mb-2">
        <v-col cols="12" sm="6">
          <v-card class="pa-4 rounded-xl section-card h-100" elevation="0">
            <div class="d-flex align-center">
              <v-icon :color="hogar.modoVacaciones ? 'blue-darken-2' : 'grey'" class="mr-3">mdi-bag-suitcase-outline</v-icon>
              <div class="flex-grow-1">
                <div class="text-subtitle-2 font-weight-bold">Modo vacaciones</div>
                <div class="text-caption text-grey-darken-1">Te avisa si la casa consume más de {{ watts(hogar.consumoBaseW) }} mientras no hay nadie.</div>
              </div>
              <v-switch :model-value="hogar.modoVacaciones" color="blue-darken-2" hide-details inset density="compact"
                :disabled="!userStore.esTitular" :loading="cambiandoVacaciones" @update:model-value="cambiarVacaciones" />
            </div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6">
          <v-card class="pa-4 rounded-xl section-card h-100" elevation="0" to="/avisos">
            <div class="d-flex align-center">
              <v-icon :color="avisosActivos ? 'red-darken-1' : 'green-darken-2'" class="mr-3">
                {{ avisosActivos ? 'mdi-bell-alert-outline' : 'mdi-bell-check-outline' }}
              </v-icon>
              <div class="flex-grow-1">
                <div class="text-subtitle-2 font-weight-bold">{{ avisosActivos ? `${avisosActivos} aviso(s) pendiente(s)` : 'Sin avisos pendientes' }}</div>
                <div class="text-caption text-grey-darken-1">{{ avisosActivos ? 'Revisa qué está pasando' : 'Todo se ve en orden' }}</div>
              </div>
              <v-icon color="grey">mdi-chevron-right</v-icon>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Consejo -->
      <v-card class="pa-4 rounded-xl tip-card mt-2" elevation="0">
        <div class="d-flex">
          <v-icon color="amber-darken-3" class="mr-3">mdi-lightbulb-on-outline</v-icon>
          <div class="text-body-2">{{ consejo }}</div>
        </div>
      </v-card>
    </template>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/users';
import { useAlarmStore } from '@/stores/alarms';
import { useNotifyStore } from '@/stores/notify';
import { useHogarStore, watts, kwh, pesos, fechaCorta, mensajeError } from '@/stores/hogar';

const userStore = useUserStore();
const alarmStore = useAlarmStore();
const hogarStore = useHogarStore();
const notify = useNotifyStore();
const { hogar, periodo: p } = storeToRefs(hogarStore);
const { alarmas } = storeToRefs(alarmStore);

const cargando = ref(true);
const ultima = ref(null);
const serie = ref([]);
const cambiandoVacaciones = ref(false);

const CONSEJOS = [
  'Pon el minisplit en 24 o 25 °C: cada grado menos puede subir su consumo entre 6 y 8 %.',
  'Limpia los filtros del minisplit cada mes en verano; un filtro sucio lo hace trabajar de más.',
  'Desconecta cargadores, bocinas y consolas que no uses: el "consumo fantasma" puede ser hasta el 10 % del recibo.',
  'El refrigerador separado unos 10 cm de la pared y lejos de la estufa gasta menos.',
  'Junta la ropa y plancha una sola vez a la semana: la plancha es de los aparatos que más potencia usan.',
  'Usa focos LED: gastan hasta 80 % menos que los incandescentes.',
  'Revisa tu escalón: quedarte en el básico o intermedio cuesta mucho menos por kWh que el excedente.',
];
const consejo = CONSEJOS[new Date().getDate() % CONSEJOS.length];

const nombreFormateado = computed(() => {
  const n = userStore.usuario?.nombre?.split(' ')[0];
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : '';
});
const avisosActivos = computed(() => (alarmas.value || []).filter((a) => a.estado === 'ACTIVA').length);
const maxSerie = computed(() => Math.max(1, ...serie.value.map((s) => s.valor)));

const colorAhora = computed(() => {
  const v = ultima.value?.valor;
  if (v === undefined || !hogar.value) return { fondo: 'grey-lighten-3', icono: 'grey' };
  if (v > hogar.value.umbralAltoW) return { fondo: 'red-lighten-5', icono: 'red-darken-2' };
  if (v > hogar.value.consumoNocheW) return { fondo: 'orange-lighten-5', icono: 'orange-darken-2' };
  return { fondo: 'green-lighten-5', icono: 'green-darken-2' };
});
const claseAhora = computed(() => (ultima.value && hogar.value && ultima.value.valor > hogar.value.umbralAltoW ? 'live-alta' : ''));

const ahora = ref(Date.now());
// Más de 30 minutos sin lecturas = el sensor se desconectó
const sinSenal = computed(() => !!ultima.value && ahora.value - new Date(ultima.value.fechaHora).getTime() > 30 * 60000);
const textoUltima = computed(() => {
  if (!ultima.value) return hogar.value?.medidor ? 'El sensor aún no envía lecturas' : 'Sin sensor';
  const min = Math.round((ahora.value - new Date(ultima.value.fechaHora).getTime()) / 60000);
  if (min < 1) return 'Actualizado hace unos segundos';
  if (min < 30) return `Actualizado hace ${min} min`;
  return `Sin señal del sensor desde el ${new Date(ultima.value.fechaHora).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}`;
});

const cargar = async () => {
  try {
    await hogarStore.cargar();
    alarmStore.listarAlarmas();
    if (hogar.value) {
      ultima.value = hogar.value.ultimaLectura;
      await Promise.all([
        hogarStore.cargarPeriodo(),
        hogarStore.recientes(6).then((r) => (serie.value = r)).catch(() => (serie.value = [])),
      ]);
    }
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo cargar la información de tu casa'), 'error');
  } finally {
    cargando.value = false;
  }
};

const cambiarVacaciones = async (activo) => {
  cambiandoVacaciones.value = true;
  try {
    const r = await hogarStore.cambiarVacaciones(activo);
    notify.show(r.mensaje, 'success');
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo cambiar el modo vacaciones'), 'error');
  } finally {
    cambiandoVacaciones.value = false;
  }
};

// Lecturas en tiempo real (llegan por utils/tiempoReal.js)
const alLeer = (e) => {
  ultima.value = { fechaHora: e.detail.fechaHora.replace(' ', 'T'), valor: e.detail.valor };
  ahora.value = Date.now();
};
let reloj = null;
onMounted(() => {
  cargar();
  window.addEventListener('powertech:lectura', alLeer);
  reloj = setInterval(() => (ahora.value = Date.now()), 30000);
});
onBeforeUnmount(() => {
  window.removeEventListener('powertech:lectura', alLeer);
  clearInterval(reloj);
});
</script>

<style scoped>
.main-container { max-width: 720px; margin-left: auto; margin-right: auto; }
.setup-card, .section-card { background: #fff !important; border: 1px solid #e9efea !important; }
.live-card { background: linear-gradient(180deg, #ffffff 0%, #f4faf5 100%) !important; border: 1px solid #e3eee6 !important; }
.live-alta { background: linear-gradient(180deg, #ffffff 0%, #fff3f2 100%) !important; border-color: #f5c2bd !important; }
.metric { padding: 12px; border: 1px solid #edf1ee; border-radius: 14px; background: #fafcfb; height: 100%; }
.tip-card { background: #fff8e6 !important; border: 1px solid #ffe3a3 !important; }
.sparkline { display: flex; align-items: flex-end; gap: 1px; height: 48px; }
.spark-bar { flex: 1; background: #a5d6a7; border-radius: 2px 2px 0 0; min-width: 1px; }
</style>
