<template>
  <v-container class="mt-8 px-4 main-container" fluid>
    <div class="mb-6">
      <h1 class="text-h4 font-weight-bold">Notificaciones</h1>
      <p class="text-subtitle-2 text-grey-darken-1">Alertas de tus edificios</p>
    </div>

    <!-- RESUMEN DE ALARMAS -->
    <v-row class="mb-5" dense>
      <v-col cols="4">
        <v-card class="alarm-summary-card alarm-summary-active rounded-xl pa-3 text-center elevation-1">
          <v-icon color="red-darken-1" size="22" class="mb-1">mdi-alert-circle</v-icon>
          <div class="text-h6 font-weight-bold text-red-darken-1">{{ alarmasPendientes.length }}</div>
          <div class="text-caption text-grey-darken-1">Activas</div>
        </v-card>
      </v-col>

      <v-col cols="4">
        <v-card class="alarm-summary-card rounded-xl pa-3 text-center elevation-1">
          <v-icon color="orange-darken-2" size="22" class="mb-1">mdi-bell-outline</v-icon>
          <div class="text-h6 font-weight-bold text-orange-darken-2">{{ alarmas.length }}</div>
          <div class="text-caption text-grey-darken-1">Total</div>
        </v-card>
      </v-col>

      <v-col cols="4">
        <v-card class="alarm-summary-card alarm-summary-resolved rounded-xl pa-3 text-center elevation-1">
          <v-icon color="green-darken-2" size="22" class="mb-1">mdi-check-circle</v-icon>
          <div class="text-h6 font-weight-bold text-green-darken-2">{{ alarmasHistorial.length }}</div>
          <div class="text-caption text-grey-darken-1">Resueltas</div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Pestañas para filtrar el estado -->
    <v-tabs v-model="tabActual" color="#478D4B" grow class="mb-6 rounded-lg bg-grey-lighten-4">
      <v-tab value="pendientes">
        <v-icon start>mdi-alert-circle-outline</v-icon>
        Pendientes
        <v-badge v-if="alarmasPendientes.length > 0" :content="alarmasPendientes.length" color="red" inline
          class="ml-2"></v-badge>
      </v-tab>
      <v-tab value="historial">
        <v-icon start>mdi-history</v-icon>
        Historial
      </v-tab>
    </v-tabs>

    <v-row v-if="loading">
      <v-col cols="12" v-for="n in 3" :key="n">
        <v-skeleton-loader type="list-item-avatar-three-line" class="rounded-xl mb-3"></v-skeleton-loader>
      </v-col>
    </v-row>

    <v-window v-else v-model="tabActual">
      <!-- PESTAÑA: PENDIENTES -->
      <v-window-item value="pendientes">
        <div class="section-heading">
          <div>
            <div class="text-subtitle-1 font-weight-bold text-grey-darken-3">Alarmas activas</div>
            <div class="text-caption text-grey-darken-1">Eventos que requieren atención.</div>
          </div>
          <v-chip
            :color="alarmasPendientes.length > 0 ? 'red' : 'green'"
            variant="tonal"
            size="small"
            class="font-weight-bold"
          >
            {{ alarmasPendientes.length > 0 ? 'Requiere atención' : 'Todo en orden' }}
          </v-chip>
        </div>

        <v-card v-if="alarmasPendientes.length === 0"
          class="pa-8 text-center rounded-xl bg-transparent elevation-0 border-dashed">
          <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-bell-sleep-outline</v-icon>
          <div class="text-h6 text-grey-darken-2">Sin novedades</div>
          <div class="text-body-2 text-grey">Todo parece estar en orden por ahora.</div>
        </v-card>

        <div v-else class="notification-list">
          <!-- Asume que AlarmCard emite un evento @atender cuando presionan un botón dentro de él -->
          <AlarmCard v-for="alarma in alarmasPendientes" :key="alarma.codigoAlarma" :alarma="alarma"
            @atender="marcarComoAtendida(alarma.codigoAlarma)" />
        </div>
      </v-window-item>

      <!-- PESTAÑA: HISTORIAL -->
      <v-window-item value="historial">
        <div class="section-heading">
          <div>
            <div class="text-subtitle-1 font-weight-bold text-grey-darken-3">Historial de alarmas</div>
            <div class="text-caption text-grey-darken-1">Eventos atendidos y cerrados.</div>
          </div>
          <v-chip color="green" variant="tonal" size="small" class="font-weight-bold">
            {{ alarmasHistorial.length }} resueltas
          </v-chip>
        </div>

        <v-card v-if="alarmasHistorial.length === 0"
          class="pa-8 text-center rounded-xl bg-transparent elevation-0 border-dashed">
          <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-history</v-icon>
          <div class="text-h6 text-grey-darken-2">Historial vacío</div>
          <div class="text-body-2 text-grey">Aún no has resuelto ninguna alerta.</div>
        </v-card>

        <div v-else class="notification-list opacity-80">
          <AlarmCard v-for="alarma in alarmasHistorial" :key="alarma.codigoAlarma" :alarma="alarma"
            :desactivado="true" />
        </div>
      </v-window-item>
    </v-window>

  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/users';
import { useAlarmStore } from '@/stores/alarms';
import { useNotifyStore } from '@/stores/notify';
import AlarmCard from '@/components/AlarmCard.vue';

const userStore = useUserStore();
const alarmStore = useAlarmStore();
const notify = useNotifyStore();

const { usuario } = storeToRefs(userStore);
const { alarmas, loading } = storeToRefs(alarmStore);

const tabActual = ref('pendientes');

const alarmasPendientes = computed(() => {
  return alarmas.value.filter(a => a.estado?.toLowerCase() === 'activa');
});

const alarmasHistorial = computed(() => {
  return alarmas.value.filter(a =>
    ['atendida', 'cerrada'].includes(a.estado?.toLowerCase())
  );
});

const cargarNotificaciones = () => {
  const userId = usuario.value?.idUsuario;
  if (userId) {
    alarmStore.listarAlarmas({ id: userId });
  }
};

const marcarComoAtendida = (codigoAlarma) => {
  alarmStore.atenderAlarma({
    id: codigoAlarma,
    onComplete: () => {
      notify.show("Alarma marcada como resuelta", "success");
      cargarNotificaciones();
    },
    onError: () => {
      notify.show("Error al actualizar la alarma", "error");
    }
  });
};

onMounted(() => {
  cargarNotificaciones();
});

watch(() => usuario.value?.idUsuario, (newId) => {
  if (newId) cargarNotificaciones();
}, { immediate: true });
</script>

<style scoped>
.main-container {
  max-width: 520px;
  margin-left: auto;
  margin-right: auto;
}

.notification-list {
  background-color: transparent;
}

.border-dashed {
  border: 2px dashed rgba(0, 0, 0, 0.1) !important;
}

.alarm-summary-card {
  border: 1px solid #edf1ee !important;
  background: #ffffff !important;
}

.alarm-summary-active {
  background: linear-gradient(180deg, #fffafa 0%, #ffffff 100%) !important;
}

.alarm-summary-resolved {
  background: linear-gradient(180deg, #f7fcf8 0%, #ffffff 100%) !important;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding: 0 2px;
}

.opacity-80 {
  opacity: 0.8;
}
</style>
