<template>
  <v-container class="mt-8 px-4 main-container" fluid>

    <!-- Titulo -->
    <div class="mb-6">
      <v-btn icon="mdi-arrow-left" variant="text" color="green-darken-2" @click="$router.back()"></v-btn>
      <span class="text-subtitle-1 font-weight-bold ml-2">Volver a salas</span>
      <h1 class="text-h4 font-weight-bold">Mis dispositivos</h1>
      <p class="text-subtitle-2 text-grey-darken-1">Sala: {{ $route.params.id }}</p>
    </div>

    <!-- Loading -->
    <v-row v-if="loading">
      <v-col cols="6" sm="4" v-for="n in 4" :key="n">
        <v-skeleton-loader type="card" class="rounded-xl"></v-skeleton-loader>
      </v-col>
    </v-row>

    <!-- Placeholder por si no hay dispositivos -->
    <v-card v-else-if="!dispositivos || dispositivos.length === 0"
      class="pa-8 text-center rounded-xl bg-transparent elevation-0 border-dashed w-100">
      <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-devices</v-icon>
      <div class="text-h6 text-grey-darken-2">No hay equipos</div>
      <div class="text-body-2 text-grey">Aún no has registrado dispositivos en esta sala.</div>
    </v-card>

    <div v-else>
      <v-row>
        <!-- Tarjetas de dispositivos -->
        <v-col v-for="item in dispositivos" :key="item.codigoDispositivo" cols="6" sm="4">
          <v-card class="device-card pa-4 rounded-xl text-center d-flex flex-column align-center justify-start"
            elevation="0" hover @click="abrirModalDetalles(item)">

            <!-- Botón de eliminar -->
            <v-btn v-if="esAdmin" icon="mdi-close-circle" variant="text" color="red-lighten-2" size="small" class="delete-btn"
              @click.stop="confirmarEliminar(item.codigoDispositivo)"></v-btn>

            <!-- Icono general de dispositivo -->
            <v-avatar :color="item.sensor ? 'green-lighten-5' : 'grey-lighten-4'" size="56" class="mb-2 mt-2">
              <v-icon size="28" :color="item.sensor ? 'green-darken-2' : 'grey'">{{ iconoTipo(item.tipo) }}</v-icon>
            </v-avatar>

            <!-- Código y tipo -->
            <div class="text-caption font-weight-bold text-green-darken-2 text-uppercase mb-1">
              {{ item.codigoDispositivo }} · {{ item.tipo === 'A' ? 'Aire' : 'PC' }}
            </div>

            <!-- Nombre del dispositivo -->
            <div class="text-subtitle-2 font-weight-bold text-grey-darken-3 text-truncate w-100 px-1 mb-1"
              style="line-height: 1.1;">
              {{ item.nombre }}
            </div>

            <v-spacer></v-spacer>

            <!-- Sensor vinculado (NUEVO) -->
            <div class="text-caption text-truncate w-100 px-1 mt-auto font-weight-medium"
              :class="item.sensor ? 'text-green-darken-3' : 'text-grey-darken-1'" style="line-height: 1.1;">
              <v-icon size="12" class="mr-1 pb-1">{{ item.sensor ? 'mdi-access-point' : 'mdi-link-off' }}</v-icon>
              {{ item.sensor ? item.sensor.nombreSensor : 'Sin sensor' }}
            </div>

          </v-card>
        </v-col>
      </v-row>
    </div>

    <div class="fab-container" v-if="esAdmin">
      <v-btn color="green-darken-2" icon="mdi-plus" size="large" elevation="4" @click="dialogoVisible = true"></v-btn>
    </div>

    <!-- MODAL: AGREGAR NUEVO DISPOSITIVO -->
    <v-dialog v-model="dialogoVisible" max-width="500px" persistent>
      <v-card class="rounded-xl pa-4 elevation-12">
        <v-card-title class="text-h5 font-weight-bold text-center" style="color: #478D4B;">
          Nuevo Equipo
        </v-card-title>

        <v-card-text>
          <v-form ref="formRef" v-model="formValido">

            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2 text-grey-darken-2">Código del Equipo</div>
            <v-text-field v-model="nuevoDispositivo.codigoDispositivo" placeholder="Ej: EQ-01" variant="outlined"
              density="comfortable" rounded="lg" :rules="reglas.codigo" required />

            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2 text-grey-darken-2">Nombre / Etiqueta</div>
            <v-text-field v-model="nuevoDispositivo.nombre" placeholder="Ej: Servidor Principal" variant="outlined"
              density="comfortable" rounded="lg" :rules="reglas.nombre" required />

            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2 text-grey-darken-2">Tipo de equipo</div>
            <v-btn-toggle v-model="nuevoDispositivo.tipo" mandatory color="green-darken-2" variant="outlined" rounded="lg"
              density="comfortable" class="mb-3">
              <v-btn value="C" class="text-none"><v-icon start>mdi-desktop-classic</v-icon>Computadora</v-btn>
              <v-btn value="A" class="text-none"><v-icon start>mdi-air-conditioner</v-icon>Aire acondicionado</v-btn>
            </v-btn-toggle>

            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2 text-grey-darken-2">Marca (Opcional)</div>
            <v-text-field v-model="nuevoDispositivo.marca" placeholder="Ej: Mirage" variant="outlined"
              density="comfortable" rounded="lg" :rules="reglas.marca" />

            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2 text-grey-darken-2">Vincular Sensor (Opcional)
            </div>
            <v-select v-model="nuevoDispositivo.codigoSensor" :items="sensoresDisponibles" item-title="nombreSensor"
              item-value="codigoSensor" placeholder="Seleccionar sensor disponible" variant="outlined"
              density="comfortable" rounded="lg" clearable></v-select>

            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2 text-grey-darken-2">Relevador (Opcional)</div>
            <v-text-field v-model="nuevoDispositivo.controlUrl" placeholder="Ej: http://192.168.1.50" variant="outlined"
              density="comfortable" rounded="lg" :rules="reglas.url"
              hint="Dirección de un relevador con firmware Tasmota para encender o apagar el equipo" persistent-hint />
            <v-switch v-model="nuevoDispositivo.autoApagado" :disabled="!nuevoDispositivo.controlUrl" color="green-darken-2"
              label="Apagar automáticamente si consume fuera de horario" density="comfortable" hide-details class="mt-2" />

          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" color="black" @click="cerrarModal" class="text-none">Cancelar</v-btn>
          <v-btn color="green-darken-2" class="text-none rounded-pill px-6" variant="flat" :disabled="!formValido"
            :loading="loading" @click="guardarDispositivo">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- MODAL: GESTIONAR DISPOSITIVO Y SENSOR -->
    <v-dialog v-model="dialogoDetallesVisible" max-width="500px">
      <v-card class="rounded-xl pa-4 elevation-12">
        <v-card-title class="text-h5 font-weight-bold text-center mb-2" style="color: #478D4B;">
          Gestión del Equipo
        </v-card-title>

        <v-card-text class="pt-2" v-if="dispositivoSeleccionado">
          <div class="d-flex align-center mb-6">
            <v-avatar color="green-lighten-5" size="56" class="mr-4">
              <v-icon size="28" color="green-darken-2">{{ iconoTipo(dispositivoSeleccionado.tipo) }}</v-icon>
            </v-avatar>
            <div>
              <div class="text-subtitle-1 font-weight-bold text-grey-darken-3" style="line-height: 1.2;">
                {{ dispositivoSeleccionado.nombre }}
              </div>
              <div class="text-caption font-weight-bold text-green-darken-2 mt-1">
                {{ dispositivoSeleccionado.codigoDispositivo }}
              </div>
            </div>
          </div>

          <v-divider class="mb-4"></v-divider>

          <div class="text-subtitle-2 font-weight-bold mb-3 text-grey-darken-2">Reasignar Sensor Vinculado</div>

          <v-select v-model="sensorTemporal" :items="opcionesSensoresDetalle" item-title="nombreSensor"
            item-value="codigoSensor" placeholder="No hay sensor asignado" variant="outlined" density="comfortable"
            rounded="lg" clearable :disabled="!esAdmin"></v-select>

          <!-- Control del equipo mediante relevador -->
          <div class="text-subtitle-2 font-weight-bold mb-2 mt-2 text-grey-darken-2">Control del equipo</div>
          <v-text-field v-model="controlTemporal.controlUrl" placeholder="http://192.168.1.50 (relevador Tasmota)"
            variant="outlined" density="comfortable" rounded="lg" :rules="reglas.url" :disabled="!esAdmin" clearable />
          <v-switch v-model="controlTemporal.autoApagado" :disabled="!esAdmin || !controlTemporal.controlUrl"
            color="green-darken-2" label="Apagar automáticamente fuera de horario" density="comfortable" hide-details />
          <div v-if="dispositivoSeleccionado.controlUrl" class="d-flex ga-2 mt-2">
            <v-btn color="green-darken-2" variant="tonal" class="text-none flex-grow-1" prepend-icon="mdi-power"
              :loading="enviandoComando === 'ON'" @click="enviarComando('ON')">Encender</v-btn>
            <v-btn color="red-darken-2" variant="tonal" class="text-none flex-grow-1" prepend-icon="mdi-power-off"
              :loading="enviandoComando === 'OFF'" @click="enviarComando('OFF')">Apagar</v-btn>
          </div>

          <!-- Lectura del sensor actual (si aplica) -->
          <v-card v-if="dispositivoSeleccionado.sensor" class="mt-4 pa-3 rounded-lg"
            style="background-color: #f8f9fb; border: 1px solid rgba(0,0,0,0.05);" elevation="0">
            <div class="d-flex justify-space-between align-center mb-1">
              <span class="text-body-2 font-weight-bold text-grey-darken-3">
                <v-icon size="16" color="green-darken-2" class="mr-1">mdi-access-point</v-icon>
                Última Lectura
              </span>
              <span v-if="dispositivoSeleccionado.sensor.ultimaLectura"
                class="text-subtitle-1 font-weight-black text-green-accent-4">
                {{ Number(dispositivoSeleccionado.sensor.ultimaLectura.valor).toFixed(1) }} {{
                  dispositivoSeleccionado.sensor.unidadMedida }}
              </span>
              <span v-else class="text-caption text-grey">Sin datos</span>
            </div>
            <div class="text-caption text-grey-darken-1 mt-1 text-right">
              {{ formatearFecha(dispositivoSeleccionado.sensor.ultimaLectura?.fechaHora) }}
            </div>
          </v-card>

        </v-card-text>

        <v-card-actions class="pa-4 pt-0">
          <v-spacer></v-spacer>
          <v-btn variant="text" color="black" @click="dialogoDetallesVisible = false" class="text-none">Cancelar</v-btn>
          <v-btn color="green-darken-2" class="text-none rounded-pill px-6" variant="flat"
            @click="actualizarSensorDispositivo" :loading="loading">
            Guardar Cambios
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useDeviceStore } from "@/stores/devices"
import { useNotifyStore } from "@/stores/notify"
import { useUserStore } from "@/stores/users"

const route = useRoute();
const deviceStore = useDeviceStore();
const notify = useNotifyStore();
const { esAdmin } = storeToRefs(useUserStore());

const iconoTipo = (tipo) => (tipo === 'A' ? 'mdi-air-conditioner' : 'mdi-desktop-classic');
const nuevoVacio = () => ({ codigoDispositivo: '', codigoSala: route.params.id, nombre: '', marca: '', tipo: 'C', codigoSensor: null, controlUrl: '', autoApagado: false });

const { dispositivos, loading } = storeToRefs(deviceStore);

/* Lista de sensores que no tienen ningún dispositivo asignado */
const sensoresDisponibles = ref([]);

/* Estados para el Modal Agregar */
const dialogoVisible = ref(false);
const formRef = ref(null);
const formValido = ref(false);

const nuevoDispositivo = ref(nuevoVacio());

/* Estados para el Modal Detalles (Reasignación) */
const dialogoDetallesVisible = ref(false);
const dispositivoSeleccionado = ref(null);
const sensorTemporal = ref(null);
const controlTemporal = ref({ controlUrl: '', autoApagado: false });
const enviandoComando = ref(null);

/* Validaciones */
const reglas = {
  codigo: [v => !!v || "Obligatorio", v => (v && v.length <= 10) || "Máximo 10 caracteres"],
  nombre: [v => !!v || "Obligatorio", v => (v && v.length <= 100) || "Máximo 100 caracteres"],
  marca: [v => !v || v.length <= 60 || "Máximo 60 caracteres"],
  url: [v => !v || /^https?:\/\/.+/.test(v) || "Debe iniciar con http:// o https://"]
};

/* Formateador de fechas */
const formatearFecha = (fechaISO) => {
  if (!fechaISO) return "Esperando registro...";
  const opciones = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
  return new Date(fechaISO).toLocaleDateString('es-MX', opciones);
};

/* Cargar sensores huérfanos desde el backend */
const cargarSensoresLibres = async () => {
  try {
    const res = await deviceStore.obtenerSensoresLibres(route.params.id);
    sensoresDisponibles.value = res.data;
  } catch (error) {
    console.error("Error al cargar sensores libres", error);
  }
};

/* Opciones de sensores para el modal de detalles (Libres + El actual) */
const opcionesSensoresDetalle = computed(() => {
  const opciones = [...sensoresDisponibles.value];
  if (dispositivoSeleccionado.value?.sensor) {
    opciones.push({
      codigoSensor: dispositivoSeleccionado.value.sensor.codigoSensor,
      nombreSensor: `(Actual) ${dispositivoSeleccionado.value.sensor.nombreSensor}`
    });
  }
  return opciones;
});

const abrirModalDetalles = (dispositivo) => {
  dispositivoSeleccionado.value = dispositivo;
  // Pre-cargar el select con el sensor que ya tiene (si tiene uno)
  sensorTemporal.value = dispositivo.sensor ? dispositivo.sensor.codigoSensor : null;
  controlTemporal.value = { controlUrl: dispositivo.controlUrl || '', autoApagado: !!dispositivo.autoApagado };
  dialogoDetallesVisible.value = true;
};

const enviarComando = async (estado) => {
  enviandoComando.value = estado;
  try {
    const r = await deviceStore.encenderApagar(dispositivoSeleccionado.value.codigoDispositivo, estado);
    notify.show(r.mensaje, "success");
  } catch (error) {
    notify.show(error.response?.data?.mensaje || "No se pudo comunicar con el relevador", "error");
  } finally {
    enviandoComando.value = null;
  }
};

const cerrarModal = () => {
  dialogoVisible.value = false;
  nuevoDispositivo.value = nuevoVacio();
  if (formRef.value) formRef.value.resetValidation();
};

const guardarDispositivo = async () => {
  const { valid } = await formRef.value.validate();
  if (!valid) return;

  deviceStore.agregarDispositivo({
    datos: nuevoDispositivo.value,
    onComplete: () => {
      notify.show("Equipo registrado", "success");
      cerrarModal();
      deviceStore.listarDispositivosPorSala({ id: route.params.id });
      cargarSensoresLibres(); // Actualizar la lista de sensores libres
    },
    onError: (error) => notify.show(error.response?.data?.mensaje || "Error al registrar", "error")
  });
};

const actualizarSensorDispositivo = async () => {
  if (!dispositivoSeleccionado.value) return;

  // 1. Guardar la configuración del relevador si cambió
  const d = dispositivoSeleccionado.value;
  const nuevaUrl = controlTemporal.value.controlUrl || '';
  const nuevoAuto = !!controlTemporal.value.autoApagado && !!nuevaUrl;
  let cambioControl = false;
  if (esAdmin.value && (nuevaUrl !== (d.controlUrl || '') || nuevoAuto !== !!d.autoApagado)) {
    try {
      await deviceStore.configurarControl(d.codigoDispositivo, { controlUrl: nuevaUrl || null, autoApagado: nuevoAuto });
      notify.show("Control del equipo actualizado", "success");
      cambioControl = true;
      deviceStore.listarDispositivosPorSala({ id: route.params.id });
    } catch (error) {
      notify.show(error.response?.data?.mensaje || "Error al guardar el control", "error");
      return;
    }
  }

  // 2. Reasignar el sensor si cambió
  const sensorActual = dispositivoSeleccionado.value.sensor?.codigoSensor ?? null;
  const sensorNuevo = sensorTemporal.value ?? null;

  // Normalizamos ambos valores porque el backend puede devolver el código
  // como texto mientras el select puede manejarlo con otro tipo.
  const codigoActual = sensorActual === null ? null : String(sensorActual);
  const codigoNuevo = sensorNuevo === null ? null : String(sensorNuevo);

  // Si el sensor ya es el mismo, no hacemos ninguna petición.
  if (codigoActual === codigoNuevo) {
    if (!cambioControl) notify.show("No hubo cambios", "success");
    dialogoDetallesVisible.value = false;
    return;
  }

  deviceStore.asignarSensorADispositivo({
    codigoDispositivo: dispositivoSeleccionado.value.codigoDispositivo,
    codigoSensor: sensorNuevo === null ? null : String(sensorNuevo),
    onComplete: () => {
      notify.show("Sensor actualizado", "success");
      dialogoDetallesVisible.value = false;
      deviceStore.listarDispositivosPorSala({ id: route.params.id });
      cargarSensoresLibres();
    },
    onError: (error) => {
      console.error("Error al actualizar sensor:", error);
      notify.show(
        error?.response?.data?.mensaje || "Error al actualizar sensor",
        "error"
      );
    }
  });
};

const confirmarEliminar = (id) => {
  if (confirm("¿Eliminar este equipo? El sensor asociado quedará libre.")) {
    deviceStore.eliminarDispositivo({
      id: id,
      onComplete: () => {
        notify.show("Equipo eliminado", "success");
        deviceStore.listarDispositivosPorSala({ id: route.params.id });
        cargarSensoresLibres();
      },
      onError: (error) => notify.show(error.response?.data?.mensaje || "Error al eliminar", "error")
    });
  }
};

onMounted(() => {
  const salaId = route.params.id;
  if (salaId) {
    deviceStore.listarDispositivosPorSala({ id: salaId });
    cargarSensoresLibres();
  }
});
</script>

<style scoped>
.main-container {
  max-width: 520px;
  margin-left: auto;
  margin-right: auto;
  padding-bottom: 120px;
}

.device-card {
  /* Reemplazamos aspect-ratio por min-height */
  min-height: 180px;
  height: 100%;
  transition: transform 0.2s ease, background-color 0.2s ease;
  background-color: #f8f9fb !important;
  border: none !important;
  position: relative;
  cursor: pointer;
}

.device-card:hover {
  background-color: #f1f8f2 !important;
  transform: translateY(-4px);
}

.device-card:active {
  transform: scale(0.96);
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

:deep(.v-field--focused) {
  border-color: #478D4B !important;
}

:deep(.v-field--focused .v-field__outline) {
  color: #478D4B !important;
}

:deep(.v-selection-control--dirty .v-icon),
:deep(.v-select .v-field__append-inner .v-icon) {
  color: #478D4B !important;
}

:deep(.v-select .v-field__input) {
  color: #478D4B !important;
}

:deep(.v-btn[color="green-darken-2"]) {
  color: white !important;
}
</style>