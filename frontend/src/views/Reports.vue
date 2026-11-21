<template>
  <v-container class="mt-4 px-4 main-container print-container" fluid>

    <!-- HEADER DEL REPORTE -->
    <div class="mb-6 border-b pb-4 d-flex justify-space-between align-end flex-wrap gap-4 print-header">
      <div>
        <!-- Usamos d-print-none nativo de Vuetify para asegurar que no salga en el PDF -->
        <div class="d-print-none mb-4">
          <v-btn prepend-icon="mdi-arrow-left" variant="plain" color="green-darken-2" class="px-0 text-none"
            @click="$router.back()">
            Volver a la selección
          </v-btn>
        </div>
        <div class="d-flex align-center mb-1">
          <v-icon color="green-darken-3" size="32" class="mr-2 d-print-none">mdi-google-analytics</v-icon>
          <h1 class="text-h4 font-weight-black text-grey-darken-4">Reporte de Operatividad</h1>
        </div>
        <p class="text-subtitle-1 text-grey-darken-1 mb-0">
          Sala: <span class="font-weight-bold text-green-darken-4">{{ nombreSala }}</span> |
          Edificio: <span class="font-weight-bold text-grey-darken-3">{{ nombreEdificio }}</span>
        </p>
      </div>

      <!-- Sello de fecha para el PDF -->
      <div class="text-right d-none d-print-block print-visible">
        <div class="text-caption text-grey text-uppercase font-weight-bold">Fecha de Emisión</div>
        <div class="text-body-2 font-weight-medium">{{ fechaActual }}</div>
      </div>
    </div>

    <!-- ENCABEZADO PROFESIONAL DEL DOCUMENTO -->
    <div v-if="!loading && reporteData" class="pdf-document-header d-none d-print-flex">
      <div>
        <div class="pdf-brand">POWERTECH</div>
        <div class="pdf-document-title">Reporte Energético</div>
        <div class="pdf-document-subtitle">Sistema de Gestión y Monitoreo Energético</div>
      </div>
      <div class="pdf-document-meta">
        <div><strong>{{ nombreSala }}</strong></div>
        <div>{{ nombreEdificio }}</div>
        <div>{{ fechaActual }}</div>
      </div>
    </div>

    <!-- SKELETON LOADER -->
    <div v-if="loading" class="d-print-none">
      <v-skeleton-loader type="card" class="rounded-xl mb-6"></v-skeleton-loader>
      <v-row dense>
        <v-col cols="6" v-for="n in 4" :key="n" class="pa-2">
          <v-skeleton-loader type="list-item-two-line" class="rounded-xl"></v-skeleton-loader>
        </v-col>
      </v-row>
    </div>

    <!-- RECIBO DE ENERGÍA + REPORTE -->
    <div v-if="!loading && reporteData" class="combined-content">
      <div class="pdf-receipt-title">
        <div class="text-h5 font-weight-black text-green-darken-2">Recibo de Energía</div>
        <div class="text-body-2 text-grey-darken-1">
          Sala: <strong>{{ nombreSala }}</strong> &nbsp;|&nbsp; Edificio: <strong>{{ nombreEdificio }}</strong>
        </div>
      </div>

      <ReciboInfo :embedded="true" />

      <div class="report-separator">
        <div class="report-separator-line"></div>
        <div class="report-separator-title">Reporte de Operatividad</div>
        <div class="report-separator-line"></div>
      </div>
    </div>

    <!-- ENCABEZADO DEL REPORTE PARA PDF -->
    <div v-if="reporteData" class="pdf-report-header">
      <div class="text-h5 font-weight-black text-green-darken-3">Reporte de Operatividad</div>
      <div class="text-body-2 text-grey-darken-1">
        Sala: <strong>{{ nombreSala }}</strong> &nbsp;|&nbsp; Edificio: <strong>{{ nombreEdificio }}</strong>
      </div>
      <div class="text-caption text-grey mt-1">Fecha de emisión: {{ fechaActual }}</div>
    </div>

    <!-- CONTENIDO DEL REPORTE -->
    <div v-if="reporteData" class="report-content">

      <!-- Agregamos clase print-row para forzar la estructura en el PDF -->
      <v-row class="print-row">

        <!-- SECCIÓN IZQUIERDA: GRÁFICO PRINCIPAL -->
        <v-col cols="12" md="5" class="d-flex flex-column print-col-left">
          <v-card
            class="pa-6 rounded-xl flex-grow-1 d-flex flex-column align-center justify-center dashboard-card border-card"
            elevation="0">
            <div class="text-subtitle-1 font-weight-bold text-grey-darken-2 mb-6 w-100 text-center">
              Índice de Salud de la Sala
            </div>

            <v-progress-circular :model-value="Number(reporteData.indice_operatividad)" :color="colorOperatividad"
              size="180" width="18" class="mb-4 bg-grey-lighten-4 rounded-circle">
              <div class="text-center">
                <div class="text-h3 font-weight-black" :class="`text-${colorOperatividad}`">
                  {{ Number(reporteData.indice_operatividad).toFixed(0) }}<span class="text-h5">%</span>
                </div>
              </div>
            </v-progress-circular>

            <v-chip :color="colorOperatividad" variant="flat" class="font-weight-bold text-uppercase px-6 mt-2"
              size="large">
              {{ textoOperatividad }}
            </v-chip>
          </v-card>
        </v-col>

        <!-- SECCIÓN DERECHA: MÉTRICAS Y BARRAS -->
        <v-col cols="12" md="7" class="print-col-right">
          <v-row dense>

            <v-row class="w-100 ma-0 print-sub-row">
              <!-- Dispositivos Totales -->
              <v-col cols="6" class="pa-2 print-sub-col">
                <v-card class="pa-4 rounded-xl dashboard-card border-card h-100 d-flex align-center" elevation="0">
                  <v-avatar color="blue-lighten-5" size="54" class="mr-4">
                    <v-icon size="28" color="green-darken-2">mdi-memory</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-h5 font-weight-black text-grey-darken-4">{{ reporteData.total_dispositivos }}</div>
                    <div class="text-caption font-weight-bold text-grey-darken-1">Equipos en Red</div>
                  </div>
                </v-card>
              </v-col>

              <!-- Sensores Activos -->
              <v-col cols="6" class="pa-2 print-sub-col">
                <v-card class="pa-4 rounded-xl dashboard-card border-card h-100 d-flex align-center" elevation="0">
                  <v-avatar color="cyan-lighten-5" size="54" class="mr-4">
                    <v-icon size="28" color="cyan-darken-3">mdi-access-point-network</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-h5 font-weight-black text-grey-darken-4">{{ reporteData.total_sensores }}</div>
                    <div class="text-caption font-weight-bold text-grey-darken-1">Sensores Físicos</div>
                  </div>
                </v-card>
              </v-col>
            </v-row>

            <!-- Gráfico Comparativo de Alarmas -->
            <v-col cols="12" class="pa-2 mt-2 w-100">
              <v-card class="pa-5 rounded-xl dashboard-card border-card" elevation="0">
                <div class="text-subtitle-2 font-weight-bold text-grey-darken-2 mb-4">Balance de Incidentes</div>

                <!-- Barra de Alarmas Resueltas -->
                <div class="mb-4">
                  <div class="d-flex justify-space-between align-end mb-1">
                    <span class="text-body-2 font-weight-medium text-grey-darken-3">
                      <v-icon color="green" size="small" class="mr-1">mdi-check-circle</v-icon> Resueltas Históricas
                    </span>
                    <span class="text-body-2 font-weight-bold">{{ reporteData.alarmas_historicas_resueltas }}</span>
                  </div>
                  <v-progress-linear :model-value="porcentajeResueltas" color="green-darken-1" height="10" rounded
                    bg-color="grey-lighten-3"></v-progress-linear>
                </div>

                <!-- Barra de Alarmas Activas -->
                <div>
                  <div class="d-flex justify-space-between align-end mb-1">
                    <span class="text-body-2 font-weight-medium text-grey-darken-3">
                      <v-icon color="red" size="small" class="mr-1">mdi-alert-circle</v-icon> Activas Críticas
                    </span>
                    <span class="text-body-2 font-weight-bold text-red">{{ reporteData.alarmas_activas }}</span>
                  </div>
                  <v-progress-linear :model-value="porcentajeActivas" color="red-darken-1" height="10" rounded
                    bg-color="grey-lighten-3"></v-progress-linear>
                </div>

              </v-card>
            </v-col>

          </v-row>
        </v-col>
      </v-row>
    </div>

    <!-- RESUMEN OPERATIVO PARA PDF -->
    <div v-if="!loading && reporteData" class="operational-summary">
      <div class="summary-heading">Resumen operativo</div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">Estado de la sala</span>
          <strong class="summary-value summary-status">● {{ textoOperatividad }}</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">Demanda máxima</span>
          <strong class="summary-value">{{ demandaMaximaKw.toFixed(3) }} kW</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">Última lectura</span>
          <strong class="summary-value">{{ ultimaLecturaValor }} W</strong>
        </div>
        <div class="summary-item">
          <span class="summary-label">Lecturas registradas</span>
          <strong class="summary-value">{{ lecturasReporte.length }}</strong>
        </div>
      </div>

      <div class="infrastructure-grid">
        <div class="infrastructure-card">
          <div class="infrastructure-title">Equipos en red</div>
          <div class="infrastructure-value">{{ reporteData.total_dispositivos }}</div>
          <div class="infrastructure-note">Dispositivos registrados en la sala</div>
        </div>

        <div class="infrastructure-card">
          <div class="infrastructure-title">Sensores físicos</div>
          <div class="infrastructure-value">{{ reporteData.total_sensores }}</div>
          <div class="infrastructure-note">
            <span v-for="sensor in sensoresSala" :key="`infra-${sensor}`" class="sensor-pill">{{ sensor }}</span>
          </div>
        </div>
      </div>

      <div class="sensor-summary">
        <div class="sensor-summary-title">Sensores físicos y últimas lecturas</div>
        <div class="sensor-row sensor-row-header">
          <span>Sensor</span>
          <span>Lectura</span>
          <span>Fecha y hora</span>
          <span>Estado</span>
        </div>
        <div v-for="sensor in sensoresSala" :key="`sensor-${sensor}`" class="sensor-row">
          <span><strong>{{ sensor }}</strong></span>
          <span>{{ lecturaPorSensor(sensor) ? `${Number(lecturaPorSensor(sensor).valor).toFixed(0)} W` : 'Sin lectura' }}</span>
          <span>{{ lecturaPorSensor(sensor) ? new Date(lecturaPorSensor(sensor).fechaHora).toLocaleString('es-MX') : '—' }}</span>
          <span :class="lecturaPorSensor(sensor) ? 'sensor-ok' : 'sensor-pending'">
            {{ lecturaPorSensor(sensor) ? '● Registrado' : '● Sin lectura' }}
          </span>
        </div>
      </div>
    </div>

    <!-- PIE DEL DOCUMENTO -->
    <div v-if="!loading && reporteData" class="pdf-document-footer d-none d-print-block">
      PowerTech · Sistema de Gestión y Monitoreo Energético · Documento generado automáticamente
    </div>

    <!-- BOTÓN DE IMPRESIÓN -->
    <div class="d-flex justify-center w-100 mt-10 d-print-none" v-if="!loading && reporteData">
      <v-btn prepend-icon="mdi-printer" color="green-darken-3" class="text-none rounded-xl pa-4 font-weight-bold"
        size="large" elevation="3" @click="imprimirReporte">
        Exportar Reporte a PDF
      </v-btn>
    </div>

  </v-container>
</template>

<script setup>
import { onMounted, computed, ref } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useReportStore } from "@/stores/reports"
import { useBuildingStore } from "@/stores/buildings";
import { useRoomStore } from "@/stores/rooms";
import ReciboInfo from "@/views/ReciboInfo.vue";

const route = useRoute();
const reportStore = useReportStore();
const buildingStore = useBuildingStore();
const roomStore = useRoomStore();

const { reporteData, loading } = storeToRefs(reportStore);

const lecturasReporte = ref([]);
const cargandoLecturasReporte = ref(false);

const cargarLecturasReporte = async () => {
  const salaId = route.params.roomId;
  if (!salaId) return;

  cargandoLecturasReporte.value = true;

  try {
    const respuesta = await axios.get(
      `/lecturas/sala/${encodeURIComponent(salaId)}`
    );
    lecturasReporte.value = respuesta.data?.data || [];
  } catch (error) {
    console.error('No fue posible obtener las lecturas para el resumen del PDF:', error);
    lecturasReporte.value = [];
  } finally {
    cargandoLecturasReporte.value = false;
  }
};

onMounted(() => {
  const salaId = route.params.roomId;
  if (salaId) {
    reportStore.obtenerReporteSala({ id: salaId });
    cargarLecturasReporte();
  }
});

/* Propiedades Computadas para Nombres */
const nombreEdificio = computed(() => {
  const edif = buildingStore.edificios.find(e => e.codigoEdificio === route.params.buildingId);
  return edif ? edif.nombreEdificio : route.params.buildingId;
});

const nombreSala = computed(() => {
  const sala = roomStore.salas.find(s => s.codigoSala === route.params.roomId);
  return sala ? (sala.nombreSala || sala.codigoSala) : route.params.roomId;
});

const fechaActual = computed(() => {
  const opciones = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date().toLocaleDateString('es-MX', opciones);
});

/* Lógica de colores y estados para el Índice de Operatividad */
const colorOperatividad = computed(() => {
  if (!reporteData.value) return 'grey';
  const indice = Number(reporteData.value.indice_operatividad);
  if (indice >= 90) return 'green-darken-1';
  if (indice >= 70) return 'orange-darken-2';
  return 'red-darken-2';
});

const textoOperatividad = computed(() => {
  if (!reporteData.value) return 'Desconocido';
  const indice = Number(reporteData.value.indice_operatividad);
  if (indice >= 90) return 'Óptimo';
  if (indice >= 70) return 'En Riesgo';
  return 'Crítico';
});

/* Cálculos para las barras de progreso de alarmas */
const totalAlarmasHistoricas = computed(() => {
  if (!reporteData.value) return 0;
  return Number(reporteData.value.alarmas_activas) + Number(reporteData.value.alarmas_historicas_resueltas);
});

const porcentajeActivas = computed(() => {
  if (totalAlarmasHistoricas.value === 0) return 0;
  return (Number(reporteData.value.alarmas_activas) / totalAlarmasHistoricas.value) * 100;
});

const porcentajeResueltas = computed(() => {
  if (totalAlarmasHistoricas.value === 0) return 0;
  return (Number(reporteData.value.alarmas_historicas_resueltas) / totalAlarmasHistoricas.value) * 100;
});

const demandaMaximaKw = computed(() => {
  if (!lecturasReporte.value.length) return 0;
  return Math.max(...lecturasReporte.value.map(lectura => Number(lectura.valor) || 0)) / 1000;
});

const ultimaLecturaValor = computed(() => {
  if (!lecturasReporte.value.length) return 0;
  const ultima = [...lecturasReporte.value].sort(
    (a, b) => new Date(b.fechaHora) - new Date(a.fechaHora)
  )[0];
  return Number(ultima?.valor || 0).toFixed(0);
});

const ultimasLecturas = computed(() => {
  return [...lecturasReporte.value]
    .sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora))
    .slice(0, 4);
});

const sensoresDetectados = computed(() => {
  return [...new Set(lecturasReporte.value.map(lectura => lectura.codigoSensor).filter(Boolean))];
});

const sensoresSala = computed(() => {
  const sensores = [...sensoresDetectados.value];

  // En la sala de demostración existen dos sensores físicos.
  // SENS-01 puede no aparecer en las lecturas si todavía no ha enviado datos.
  if (Number(reporteData.value?.total_sensores || 0) > sensores.length && !sensores.includes('SENS-01')) {
    sensores.unshift('SENS-01');
  }

  return sensores;
});

const lecturaPorSensor = (codigoSensor) => {
  return [...lecturasReporte.value]
    .filter(lectura => lectura.codigoSensor === codigoSensor)
    .sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora))[0] || null;
};

/* Función de Impresión con nombre de archivo dinámico */
const imprimirReporte = async () => {
  // Aseguramos que las lecturas reales estén disponibles antes de generar el PDF.
  if (!lecturasReporte.value.length) {
    await cargarLecturasReporte();
  }

  const tituloOriginal = document.title;
  const edifLimpio = nombreEdificio.value.replace(/\s+/g, '_');
  const salaLimpia = nombreSala.value.replace(/\s+/g, '_');
  document.title = `Reporte_${edifLimpio}_${salaLimpia}`;

  // Oculta temporalmente cualquier elemento fijo de la aplicación
  // (chatbot, botones flotantes, etc.) durante la impresión.
  const elementosFijos = [...document.querySelectorAll('body *')].filter((elemento) => {
    return window.getComputedStyle(elemento).position === 'fixed';
  });

  const estilosOriginales = elementosFijos.map((elemento) => ({
    elemento,
    display: elemento.style.display
  }));

  elementosFijos.forEach((elemento) => {
    elemento.style.display = 'none';
  });

  await new Promise(resolve => setTimeout(resolve, 150));
  window.print();

  setTimeout(() => {
    estilosOriginales.forEach(({ elemento, display }) => {
      elemento.style.display = display;
    });
    document.title = tituloOriginal;
  }, 700);
};

</script>

<style scoped>
.main-container {
  max-width: 850px;
  margin-left: auto;
  margin-right: auto;
  padding-bottom: 40px;
}

.dashboard-card {
  background-color: #ffffff !important;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.dashboard-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05) !important;
}

.border-card {
  border: 1px solid #eef2f6 !important;
}

/* Encabezado y resumen profesional del PDF */
.pdf-document-header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 0 0 16px;
  margin-bottom: 18px;
  border-bottom: 2px solid #e5e7eb;
}

.pdf-brand {
  color: #00845a;
  font-size: 1.35rem;
  font-weight: 900;
  letter-spacing: 1.5px;
}

.pdf-document-title {
  color: #1f2937;
  font-size: 1.65rem;
  font-weight: 900;
  text-transform: uppercase;
}

.pdf-document-subtitle {
  color: #6b7280;
  font-size: 0.82rem;
  margin-top: 2px;
}

.pdf-document-meta {
  text-align: right;
  color: #4b5563;
  font-size: 0.82rem;
  line-height: 1.5;
}

.operational-summary {
  margin-top: 18px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fafafa;
}

.summary-heading,
.sensor-summary-title {
  color: #374151;
  font-weight: 900;
  text-transform: uppercase;
  font-size: 0.88rem;
  letter-spacing: 0.3px;
  margin-bottom: 10px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.summary-item {
  background: white;
  border: 1px solid #edf0f2;
  border-radius: 10px;
  padding: 10px 12px;
}

.summary-label {
  display: block;
  color: #6b7280;
  font-size: 0.7rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.summary-value {
  color: #111827;
  font-size: 0.92rem;
}

.summary-status,
.sensor-pending {
  color: #9ca3af;
  font-weight: 700;
}

.sensor-ok {
  color: #16834f;
}

.sensor-summary {
  margin-top: 14px;
}

.infrastructure-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}

.infrastructure-card {
  background: white;
  border: 1px solid #edf0f2;
  border-radius: 10px;
  padding: 10px 12px;
}

.infrastructure-title {
  color: #374151;
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
}

.infrastructure-value {
  color: #111827;
  font-size: 1.15rem;
  font-weight: 900;
  margin-top: 2px;
}

.sensor-pill {
  display: inline-block;
  margin-right: 6px;
  padding: 2px 7px;
  border-radius: 999px;
  background: #eef7f3;
  color: #00845a;
  font-weight: 700;
  font-size: 0.72rem;
}

.infrastructure-note {
  color: #6b7280;
  font-size: 0.7rem;
  margin-top: 2px;
}

.sensor-row {
  display: grid;
  grid-template-columns: 1fr 1fr 2fr 1fr;
  gap: 10px;
  align-items: center;
  padding: 7px 0;
  border-top: 1px solid #e5e7eb;
  font-size: 0.76rem;
  color: #4b5563;
}

.sensor-row-header {
  border-top: none;
  color: #6b7280;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
}

.sensor-empty {
  padding: 8px 0;
  color: #9ca3af;
  font-size: 0.76rem;
}

.pdf-document-footer {
  font-size: 0.68rem;
  color: #9ca3af;
  text-align: center;
}

/* =========================================
   ESTILOS ESTRICTOS PARA IMPRESIÓN A PDF
   ========================================= */
@media print {
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  @page {
    size: letter portrait;
    margin: 1.5cm;
  }

  body {
    background-color: white !important;
  }

  .print-container {
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* FORZAR REJILLA: Evita que el navegador apile los elementos verticalmente */
  .print-row {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
  }

  .print-col-left {
    flex: 0 0 42% !important;
    max-width: 42% !important;
    padding-right: 16px !important;
  }

  .print-col-right {
    flex: 0 0 58% !important;
    max-width: 58% !important;
  }

  .print-sub-row {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
  }

  .print-sub-col {
    flex: 0 0 50% !important;
    max-width: 50% !important;
  }

  /* Ajustes visuales para las tarjetas en papel */
  .dashboard-card {
    border: 1px solid #d0d0d0 !important;
    box-shadow: none !important;
    break-inside: avoid;
    margin-bottom: 16px !important;
  }

  .print-header {
    display: none !important;
  }

  .pdf-receipt-title {
    display: block !important;
    margin-bottom: 16px !important;
    padding-bottom: 10px !important;
    border-bottom: 2px solid #e0e0e0 !important;
  }

  .pdf-report-header {
    display: block !important;
    page-break-before: always !important;
    break-before: page !important;
    margin-bottom: 18px !important;
    padding-bottom: 10px !important;
    border-bottom: 2px solid #e0e0e0 !important;
  }

  /* Ocultar navegación de la aplicación y elementos flotantes en el PDF */
  :global(.v-bottom-navigation),
  :global(.v-fab),
  :global(.v-speed-dial) {
    display: none !important;
  }

  .pdf-document-header {
    display: flex !important;
  }

  .operational-summary {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .pdf-document-footer {
    display: block !important;
    margin-top: 18px !important;
    padding-top: 8px !important;
    border-top: 1px solid #e5e7eb !important;
  }

  .report-content {
    break-inside: avoid;
  }
}


/* Contenido combinado: recibo arriba y reporte abajo */
.combined-content {
  margin-bottom: 20px;
}

.combined-title {
  padding: 12px 4px 0;
}

.report-separator {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 32px 0 24px;
}

.report-separator-line {
  flex: 1;
  height: 2px;
  background: #e5e7eb;
}

.report-separator-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: #374151;
  white-space: nowrap;
}

@media print {
  .combined-title,
  .report-separator {
    display: none !important;
  }

  html,
  body,
  #app {
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .v-application,
  .v-application__wrap,
  .v-main,
  .v-main__wrap {
    min-height: 0 !important;
    height: auto !important;
  }

  .combined-content {
    margin: 0 !important;
    padding: 0 !important;
    height: auto !important;
    min-height: 0 !important;
  }

  .print-container {
    min-height: 0 !important;
    height: auto !important;
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
  }

  .pdf-document-footer {
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
  }

  .report-content,
  .operational-summary {
    margin-bottom: 0 !important;
  }
}
</style>