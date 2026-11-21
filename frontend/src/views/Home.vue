<template>
  <v-container class="mt-6 px-4 main-container" fluid>
    <!-- ENCABEZADO -->
    <div class="text-center mb-6">
      <h1 class="text-h3 font-weight-bold mb-2" style="color: #478D4B;">Bienvenido</h1>
      <p class="text-subtitle-1 text-grey-darken-1">
        ¿Qué quieres hacer el día de hoy{{ nombreFormateado ? `, ${nombreFormateado}` : '' }}?
      </p>
    </div>

    <!-- DASHBOARD -->
    <v-card class="dashboard-card rounded-xl pa-4 mb-5" elevation="1">
      <div class="d-flex align-center justify-space-between mb-4">
        <div>
          <div class="text-h6 font-weight-bold text-grey-darken-3">Resumen de PowerTech</div>
          <div class="text-caption text-grey-darken-1">
            Estado actual del sistema
          </div>
        </div>

        <v-chip
          :color="alarmasActivas.length > 0 ? 'red' : 'green'"
          variant="tonal"
          size="small"
          class="font-weight-bold"
        >
          {{ alarmasActivas.length > 0 ? 'Atención requerida' : 'Todo en orden' }}
        </v-chip>
      </div>

      <v-row dense>
        <!-- Alarmas -->
        <v-col cols="6" md="3">
          <div class="metric-card metric-alert">
            <v-icon
              :color="alarmasActivas.length > 0 ? 'red-darken-1' : 'green-darken-2'"
              size="24"
              class="mb-1"
            >
              {{ alarmasActivas.length > 0 ? 'mdi-alert-circle-outline' : 'mdi-check-circle' }}
            </v-icon>

            <div
              class="text-h5 font-weight-black"
              :class="alarmasActivas.length > 0 ? 'text-red-darken-1' : 'text-green-darken-2'"
            >
              {{ alarmasActivas.length }}
            </div>

            <div class="text-caption text-grey-darken-1">Alarmas activas</div>
          </div>
        </v-col>

        <!-- Sensores -->
        <v-col cols="6" md="3">
          <div class="metric-card">
            <v-icon color="green-darken-2" size="24" class="mb-1">mdi-access-point-network</v-icon>
              <div class="text-h5 font-weight-black text-green-darken-2">
              {{ sensores.length }}
            </div>
            <div class="text-caption text-grey-darken-1">Sensores</div>
          </div>
        </v-col>

        <!-- Sensores con datos -->
        <v-col cols="6" md="3">
          <div class="metric-card">
            <v-icon color="green-darken-2" size="24" class="mb-1">mdi-signal</v-icon>
            <div class="text-h5 font-weight-black text-green-darken-2">
              {{ sensoresConDatos }}
            </div>
            <div class="text-caption text-grey-darken-1">Sensores con datos</div>
          </div>
        </v-col>

        <!-- Última lectura -->
        <v-col cols="6" md="3">
          <div class="metric-card">
            <v-icon color="orange-darken-2" size="24" class="mb-1">mdi-lightning-bolt</v-icon>
            <div class="text-h6 font-weight-black text-orange-darken-2">
              {{ ultimaLecturaTexto }}
            </div>
            <div class="text-caption text-grey-darken-1">Última lectura</div>
          </div>
        </v-col>
      </v-row>
    </v-card>

    <!-- ÚLTIMO ESTADO -->
    <v-card class="rounded-xl pa-4 mb-5 system-status-card" elevation="1">
      <div class="d-flex align-center">
        <v-avatar
          :color="alarmasActivas.length > 0 ? 'red-lighten-5' : 'green-lighten-5'"
          size="44"
          class="mr-3"
        >
          <v-icon
            :color="alarmasActivas.length > 0 ? 'red-darken-1' : 'green-darken-2'"
          >
            {{ alarmasActivas.length > 0 ? 'mdi-alert-outline' : 'mdi-shield-check-outline' }}
          </v-icon>
        </v-avatar>

        <div class="flex-grow-1">
          <div class="text-subtitle-2 font-weight-bold text-grey-darken-3">
            Estado del sistema
          </div>
          <div class="text-caption text-grey-darken-1">
            {{ mensajeEstado }}
          </div>
        </div>

        <v-icon
          :color="alarmasActivas.length > 0 ? 'red-darken-1' : 'green-darken-2'"
          size="20"
        >
          {{ alarmasActivas.length > 0 ? 'mdi-alert-circle' : 'mdi-check-circle' }}
        </v-icon>
      </div>
    </v-card>

    <!-- ACCIONES -->
    <div class="text-subtitle-1 font-weight-bold text-grey-darken-3 mb-3">
      Accesos rápidos
    </div>

    <v-row dense>
      <v-col cols="6" md="3">
        <v-card
          class="action-card rounded-xl pa-4 text-center d-flex flex-column align-center"
          elevation="1"
          ripple
          tag="router-link"
          :to="{ name: 'report-selection' }"
        >
          <v-icon size="34" color="green-darken-2" class="mb-2">mdi-file-document-outline</v-icon>
          <span class="text-caption font-weight-bold">Reportes</span>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card
          class="action-card rounded-xl pa-4 text-center d-flex flex-column align-center"
          elevation="1"
          ripple
          tag="router-link"
          :to="{ name: 'buildings' }"
        >
          <v-icon size="34" color="green-darken-2" class="mb-2">mdi-office-building-outline</v-icon>
          <span class="text-caption font-weight-bold" style="color: #478D4B;">Mis edificios</span>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card
          class="action-card rounded-xl pa-4 text-center d-flex flex-column align-center"
          elevation="1"
          ripple
          tag="router-link"
          :to="{ name: 'notifications' }"
        >
          <v-icon
            size="34"
            :color="alarmasActivas.length > 0 ? 'red-darken-1' : 'green-darken-2'"
            class="mb-2"
          >
            {{ alarmasActivas.length > 0 ? 'mdi-bell-alert-outline' : 'mdi-bell-outline' }}
          </v-icon>
          <span class="text-caption font-weight-bold">Notificaciones</span>
        </v-card>
      </v-col>

      <v-col cols="6" md="3">
        <v-card
          class="action-card rounded-xl pa-4 text-center d-flex flex-column align-center"
          elevation="1"
          ripple
          tag="router-link"
          :to="{ name: 'sensors' }"
        >
          <v-icon size="34" color="green-darken-2" class="mb-2">mdi-access-point-network</v-icon>
          <span class="text-caption font-weight-bold" style="color: #478D4B;">Mis sensores</span>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/users';
import { useAlarmStore } from '@/stores/alarms';
import { useSensorStore } from '@/stores/sensors';

const userStore = useUserStore();
const alarmStore = useAlarmStore();
const sensorStore = useSensorStore();

const { alarmas } = storeToRefs(alarmStore);
const { sensores } = storeToRefs(sensorStore);

const ultimaLectura = ref(null);
const ultimasLecturasPorSensor = ref({});
const nombreFormateado = computed(() => {
  const nombreCompleto = userStore.usuario?.nombre;
  if (!nombreCompleto) return '';
  const primerNombre = nombreCompleto.split(' ')[0];
  return primerNombre.charAt(0).toUpperCase() + primerNombre.slice(1).toLowerCase();
});

const alarmasActivas = computed(() => {
  return alarmas.value?.filter(
    a => a.estado?.toUpperCase() === 'ACTIVA'
  ) || [];
});

const sensoresConDatos = computed(() => {
  return Object.keys(ultimasLecturasPorSensor.value).length;
});

const ultimaLecturaTexto = computed(() => {
  if (!ultimaLectura.value) return '—';

  const valor = Number(ultimaLectura.value.valor);
  if (Number.isNaN(valor)) return '—';

  return `${valor.toFixed(0)} W`;
});

const mensajeEstado = computed(() => {
  if (alarmasActivas.value.length > 0) {
    return `Hay ${alarmasActivas.value.length} alarma${alarmasActivas.value.length === 1 ? '' : 's'} activa${alarmasActivas.value.length === 1 ? '' : 's'} que requiere${alarmasActivas.value.length === 1 ? '' : 'n'} atención.`;
  }

  if (sensores.value.length === 0) {
    return 'No hay sensores registrados actualmente.';
  }

  if (sensoresConDatos.value > 0) {
    return 'El sistema está operativo y se han recibido lecturas de sensores.';
  }

  return 'Los sensores están registrados, pero todavía no hay lecturas disponibles.';
});

const cargarDatos = async () => {
  const userId = userStore.usuario?.idUsuario;
  if (!userId) return;

  alarmStore.listarAlarmas({ id: userId });
  sensorStore.listarSensoresPorUsuario({ id: userId });
};

let lecturaRequestId = 0;
const cargarUltimaLectura = async () => {
  const requestId = ++lecturaRequestId;
  if (!sensores.value?.length) {
    ultimaLectura.value = null;
    ultimasLecturasPorSensor.value = {};
    return;
  }

  const lecturasPorSensor = {};

  await Promise.all(
    sensores.value.map(async sensor => {
      try {
        if (typeof sensorStore.obtenerLecturasSensor !== 'function') return;

        const resultado = await sensorStore.obtenerLecturasSensor(sensor.codigoSensor);
        const registros = Array.isArray(resultado) ? resultado : [];

        const validas = registros.filter(
          lectura => lectura?.fechaHora && lectura?.valor !== undefined
        );

        if (validas.length === 0) return;

        validas.sort((a, b) => {
          return new Date(b.fechaHora).getTime() - new Date(a.fechaHora).getTime();
        });

        lecturasPorSensor[sensor.codigoSensor] = validas[0];
      } catch (error) {
        console.warn(`No se pudo obtener la lectura de ${sensor.codigoSensor}`, error);
      }
    })
  );

  if (requestId !== lecturaRequestId) return;
  ultimasLecturasPorSensor.value = lecturasPorSensor;

  const todasLasLecturas = Object.values(lecturasPorSensor);

  if (todasLasLecturas.length === 0) {
    ultimaLectura.value = null;
    return;
  }

  todasLasLecturas.sort((a, b) => {
    return new Date(b.fechaHora).getTime() - new Date(a.fechaHora).getTime();
  });

  ultimaLectura.value = todasLasLecturas[0];
};



watch(
  () => userStore.usuario?.idUsuario,
  (newId) => {
    if (newId) cargarDatos();
  },
  { immediate: true }
);

watch(
  sensores,
  () => {
    cargarUltimaLectura();
  },
  { deep: true, immediate: true }
);
</script>

<style scoped>
.main-container {
  max-width: 1120px;
  margin-left: auto;
  margin-right: auto;
}

.dashboard-card {
  border: 1px solid #e9efea !important;
  background: linear-gradient(180deg, #ffffff 0%, #f8fcf9 100%) !important;
}

.metric-card {
  min-height: 96px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid #edf1ee;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.metric-alert {
  background: linear-gradient(180deg, #ffffff 0%, #fffafa 100%);
}

.system-status-card {
  border: 1px solid #edf1ee !important;
  background: #ffffff !important;
}

.action-card {
  min-height: 105px;
  justify-content: center;
  border: 1px solid #edf1ee !important;
  background: #f8f9fb !important;
  transition: transform 0.2s ease;
}

.action-card:active {
  transform: scale(0.98);
}
</style>
