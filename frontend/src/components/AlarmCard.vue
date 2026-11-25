<template>
  <v-card class="alarm-card mb-4 pa-4 rounded-xl" :class="{ 'is-active-card': !desactivado }" elevation="0"
    :ripple="!desactivado">
    <div class="d-flex align-center">
      <!--Icono-->
      <v-avatar :color="colorNivel.fondo" size="52" class="mr-4">
        <v-icon :color="colorNivel.texto" size="28">{{ iconoTipo }}</v-icon>
      </v-avatar>

      <div class="flex-grow-1 overflow-hidden">
        <div class="d-flex justify-space-between align-start mb-1">
          <!-- Título -->
          <h3 class="text-subtitle-1 font-weight-bold text-truncate" :class="'text-' + colorNivel.texto">
            {{ alarma.tipoAlarma }}
          </h3>
          <!-- Fecha -->
          <span class="text-caption text-grey-darken-1 flex-shrink-0 ml-2">
            {{ formatearFecha(alarma.fechaHora) }}
          </span>
        </div>

        <!-- Detalle -->
        <p class="text-body-2 text-grey-darken-2 mb-2">
          {{ alarma.detalle }}
        </p>

        <!-- Casa -->
        <div class="d-flex align-center text-caption text-grey-darken-1 mt-1">
          <v-icon size="14" class="mr-1">mdi-home-outline</v-icon>
          <span class="text-truncate font-weight-medium">
            {{ alarma.nombreHogar || 'Mi casa' }}
          </span>

          <v-spacer></v-spacer>

          <!-- Chip de Estado -->
          <v-chip size="x-small" class="font-weight-bold"
            :class="{ 'mr-2': alarma.estado?.toUpperCase() === 'ACTIVA' && !desactivado }"
            :color="alarma.estado?.toUpperCase() === 'ACTIVA' ? 'red-lighten-4' : 'green-lighten-4'" variant="flat"
            label>
            {{ alarma.estado }}
          </v-chip>

          <!-- Botón para Atender -->
          <v-btn v-if="alarma.estado?.toUpperCase() === 'ACTIVA' && !desactivado && puedeAtender" size="x-small" color="blue-darken-2"
            variant="flat" class="text-none font-weight-bold rounded-pill" @click.stop="$emit('atender')">
            Enterado
          </v-btn>
        </div>
      </div>
    </div>
  </v-card>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  alarma: { type: Object, required: true },
  desactivado: { type: Boolean, default: false }, // historial
  puedeAtender: { type: Boolean, default: true }   // los familiares solo consultan
});

// Declaración del evento emitido hacia la vista padre
const emit = defineEmits(['atender']);

/* Lógica de colores por nivel */
const colorNivel = computed(() => {
  const nivel = props.alarma.nivel;
  if (nivel >= 4) return { fondo: 'red-lighten-5', texto: 'red-darken-2' };
  if (nivel === 3) return { fondo: 'orange-lighten-5', texto: 'orange-darken-2' };
  return { fondo: 'blue-lighten-5', texto: 'blue-darken-2' };
});

/* Icono según el tipo de aviso */
const iconoTipo = computed(() => {
  const tipo = (props.alarma.tipoAlarma || '').toLowerCase();
  if (tipo.includes('sueño')) return 'mdi-weather-night';
  if (tipo.includes('vacaciones')) return 'mdi-bag-suitcase-outline';
  if (tipo.includes('dac') || tipo.includes('meta')) return 'mdi-receipt-text-outline';
  if (tipo.includes('alto')) return 'mdi-flash-alert';
  return 'mdi-bell-alert-outline';
});

/* Formateo de fecha */
const formatearFecha = (fechaIso) => {
  if (!fechaIso) return '';
  const fecha = new Date(fechaIso);
  if (new Date().toDateString() === fecha.toDateString()) {
    return fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return fecha.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};
</script>

<style scoped>
/* [REGLA DE CONSISTENCIA]: Tarjetas con fondo #f8f9fb */
.alarm-card {
  transition: transform 0.2s ease, background-color 0.2s ease;
  background-color: #f8f9fb !important;
  border: none !important;
}

/* Efectos hover/active SOLO cuando la tarjeta NO está en el historial (desactivada) */
.is-active-card:hover {
  background-color: #f0f7ff !important;
  transform: translateY(-2px);
  cursor: pointer;
}

.is-active-card:active {
  transform: scale(0.98);
}
</style>