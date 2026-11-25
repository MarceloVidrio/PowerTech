<template>
  <v-container class="mt-8 px-4 main-container" fluid>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" color="green-darken-2" aria-label="Regresar" @click="$router.back()" />
      <div class="ml-2">
        <h1 class="text-h5 font-weight-bold">Mi hogar</h1>
        <p class="text-caption text-grey-darken-1">{{ hogar ? 'Datos de tu casa, tarifa y sensor de consumo' : 'Configura tu casa para empezar' }}</p>
      </div>
    </div>

    <div v-if="cargando" class="d-flex justify-center my-10"><v-progress-circular indeterminate color="green-darken-2" /></div>

    <v-alert v-else-if="userStore.esFamiliar && !hogar" type="info" variant="tonal">El titular de la cuenta todavía no configura el hogar.</v-alert>

    <template v-else>
      <v-alert v-if="userStore.esFamiliar" type="info" variant="tonal" density="compact" class="mb-4 text-caption">
        Tu cuenta es de consulta: solo el titular puede cambiar estos datos.
      </v-alert>

      <!-- Datos de la casa -->
      <v-form ref="formRef" v-model="formValido" :disabled="!userStore.esTitular">
        <v-card class="pa-5 rounded-xl mb-4 section-card" elevation="0">
          <div class="titulo">Tu casa</div>
          <v-text-field v-model="form.nombre" label="Nombre" placeholder="Mi casa" variant="outlined" rounded="lg" density="comfortable"
            :rules="[v => (v || '').length <= 80 || 'Máximo 80 caracteres']" />
          <v-row dense>
            <v-col cols="8"><v-text-field v-model="form.ciudad" label="Ciudad" placeholder="Culiacán" variant="outlined" rounded="lg" density="comfortable" /></v-col>
            <v-col cols="4"><v-text-field v-model.number="form.personas" type="number" label="Personas" variant="outlined" rounded="lg" density="comfortable"
              :rules="[v => v === '' || v === null || (v >= 1 && v <= 30) || '1 a 30']" /></v-col>
          </v-row>
        </v-card>

        <!-- Recibo -->
        <v-card class="pa-5 rounded-xl mb-4 section-card" elevation="0">
          <div class="titulo">Tu recibo de CFE</div>
          <p class="text-caption text-grey-darken-1 mb-3">Copia estos datos de tu último recibo para que el costo estimado se parezca al real.</p>
          <v-select v-model="form.tarifa" :items="TARIFAS" label="Tarifa" variant="outlined" rounded="lg" density="comfortable"
            hint="Aparece en el recibo como «Tarifa: 1F», por ejemplo" persistent-hint class="mb-2" />
          <v-select v-if="form.tarifa !== '1'" v-model="form.mesInicioVerano" :items="MESES.map((m, i) => ({ title: m, value: i + 1 }))"
            label="El verano empieza en" variant="outlined" rounded="lg" density="comfortable" hint="Dura 6 meses. En Sinaloa casi siempre es mayo." persistent-hint class="mb-2" />
          <v-text-field v-model="form.inicioPeriodo" type="date" label="Inicio del periodo facturado" variant="outlined" rounded="lg"
            density="comfortable" hint="Primera fecha de «Periodo facturado» en tu recibo" persistent-hint class="mb-2" />
          <v-text-field v-model.number="form.metaBimestralKwh" type="number" label="Meta de consumo por bimestre (opcional)" suffix="kWh"
            variant="outlined" rounded="lg" density="comfortable" hint="Te avisamos si vas a pasarte" persistent-hint
            :rules="[v => v === '' || v === null || v > 0 || 'Debe ser mayor a 0']" />
        </v-card>

        <!-- Avisos -->
        <v-card class="pa-5 rounded-xl mb-4 section-card" elevation="0">
          <div class="titulo">Cuándo avisarte</div>
          <v-row dense>
            <v-col cols="6"><v-text-field v-model="form.horaDormirInicio" type="time" label="Se duermen a las" variant="outlined" rounded="lg" density="comfortable" /></v-col>
            <v-col cols="6"><v-text-field v-model="form.horaDormirFin" type="time" label="Se levantan a las" variant="outlined" rounded="lg" density="comfortable" /></v-col>
          </v-row>
          <v-text-field v-model.number="form.consumoNocheW" type="number" label="Consumo normal de noche" suffix="W" variant="outlined" rounded="lg"
            density="comfortable" hint="Incluye el minisplit si lo usan al dormir. Si de noche la casa consume más, te avisamos." persistent-hint class="mb-2"
            :rules="reglaNumero" />
          <v-text-field v-model.number="form.consumoBaseW" type="number" label="Consumo mínimo (sin nadie en casa)" suffix="W" variant="outlined" rounded="lg"
            density="comfortable" hint="Refrigerador y aparatos en espera. Se usa en modo vacaciones." persistent-hint class="mb-2" :rules="reglaNumero" />
          <v-text-field v-model.number="form.umbralAltoW" type="number" label="Límite de consumo alto" suffix="W" variant="outlined" rounded="lg"
            density="comfortable" hint="Si toda la casa pasa de esto, te avisamos." persistent-hint :rules="reglaNumero" />
        </v-card>
      </v-form>

      <div v-if="userStore.esTitular" class="d-flex mb-6">
        <v-spacer />
        <v-btn color="green-darken-2" class="text-none rounded-pill px-8" :disabled="!formValido" :loading="guardando" @click="guardar">
          {{ hogar ? 'Guardar cambios' : 'Guardar y continuar' }}
        </v-btn>
      </div>

      <!-- Medidor -->
      <v-card v-if="hogar" class="pa-5 rounded-xl mb-4 section-card" elevation="0">
        <div class="titulo">Sensor de consumo</div>
        <template v-if="!hogar.medidor">
          <p class="text-body-2 mb-3">
            El sensor (por ejemplo un <b>Sonoff POW Ring</b>) se coloca en la <b>pastilla principal</b> del centro de carga de la casa:
            abraza el cable sin cortarlo, mide el consumo de toda la casa y lo manda a PowerTech por WiFi.
            No se conecta al medidor de CFE.
          </p>
          <v-alert type="warning" variant="tonal" density="compact" class="mb-3 text-caption">
            La instalación en el centro de carga debe hacerla un electricista.
          </v-alert>
          <v-btn v-if="userStore.esTitular" color="green-darken-2" class="text-none rounded-pill" prepend-icon="mdi-plus" :loading="trabajando === 'registrar'"
            @click="registrarMedidor">Registrar sensor</v-btn>
        </template>
        <template v-else>
          <div class="d-flex align-center mb-3">
            <v-avatar :color="hogar.medidor.activo ? 'green-lighten-5' : 'grey-lighten-3'" class="mr-3">
              <v-icon :color="hogar.medidor.activo ? 'green-darken-2' : 'grey'">mdi-current-ac</v-icon>
            </v-avatar>
            <div class="flex-grow-1">
              <div class="font-weight-bold">Sensor de la pastilla principal</div>
              <div class="text-caption text-grey-darken-1">{{ hogar.medidor.modelo || 'Modelo sin especificar' }} · n.º <code>{{ hogar.medidor.codigoMedidor }}</code></div>
              <div class="text-caption" :class="`text-${estadoMedidor.color}`">
                <v-icon size="14" :color="estadoMedidor.color">{{ estadoMedidor.icono }}</v-icon> {{ estadoMedidor.texto }} · {{ estadoMedidor.detalle }}
              </div>
            </div>
            <v-chip v-if="!hogar.medidor.activo" size="small" color="grey" variant="tonal">Pausado</v-chip>
          </div>
          <div v-if="userStore.esTitular" class="d-flex flex-wrap ga-2">
            <v-btn variant="tonal" color="blue-darken-2" class="text-none" prepend-icon="mdi-information-outline" @click="verToken">Ver sensor</v-btn>
            <v-btn variant="tonal" :color="hogar.medidor.activo ? 'orange-darken-2' : 'green-darken-2'" class="text-none"
              :loading="trabajando === 'activo'" @click="pausarMedidor">{{ hogar.medidor.activo ? 'Pausar' : 'Reanudar' }}</v-btn>
            <v-btn variant="text" color="red-darken-2" class="text-none" @click="eliminarMedidor">Eliminar</v-btn>
          </div>
        </template>
      </v-card>
    </template>

    <!-- Datos de conexión del medidor -->
    <v-dialog v-model="dlgToken" max-width="520px">
      <v-card v-if="conexion" class="rounded-xl pa-4">
        <v-card-title class="text-h6 font-weight-bold" style="color: #478D4B;">Tu sensor de consumo</v-card-title>
        <v-card-text>
          <div class="d-flex align-center mb-4">
            <v-avatar :color="estadoMedidor.fondo" class="mr-3"><v-icon :color="estadoMedidor.color">{{ estadoMedidor.icono }}</v-icon></v-avatar>
            <div>
              <div class="font-weight-bold" :class="`text-${estadoMedidor.color}`">{{ estadoMedidor.texto }}</div>
              <div class="text-caption text-grey-darken-1">{{ estadoMedidor.detalle }}</div>
            </div>
          </div>
          <div class="dato"><span>Número de sensor</span><code>{{ conexion.codigoMedidor }}</code></div>
          <p class="text-body-2 text-grey-darken-2 mt-3">
            El electricista que instale el sensor en la pastilla principal lo enlazará con tu cuenta. Si te lo pide, compártele la información de abajo.
          </p>

          <v-expansion-panels variant="accordion" class="mt-2">
            <v-expansion-panel title="Información técnica para el instalador">
              <v-expansion-panel-text>
                <div class="dato"><span>Token (clave secreta)</span><code class="token">{{ conexion.token }}</code></div>
                <p class="text-caption mt-2 mb-1">El sensor envía cada 10 segundos un POST a <code>/lecturas</code> con el encabezado <code>X-Sensor-Token</code>:</p>
                <pre class="ejemplo">{ "codigoMedidor": "{{ conexion.codigoMedidor }}", "fechaHora": "2026-11-24 18:30:00", "valor": 1250 }</pre>
                <p class="text-caption text-grey-darken-1 mt-1">«valor» es la potencia de toda la casa en watts. No compartas el token con nadie más.</p>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn color="green-darken-2" variant="flat" class="text-none rounded-pill px-6" @click="dlgToken = false">Listo</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useUserStore } from '@/stores/users';
import { useNotifyStore } from '@/stores/notify';
import { useHogarStore, TARIFAS, MESES, mensajeError } from '@/stores/hogar';

const userStore = useUserStore();
const notify = useNotifyStore();
const hogarStore = useHogarStore();

const hogar = computed(() => hogarStore.hogar);
const cargando = ref(true);
const guardando = ref(false);
const trabajando = ref('');
const formRef = ref(null);
const formValido = ref(true);
const reglaNumero = [(v) => (v !== '' && v !== null && v >= 0) || 'Escribe un número mayor o igual a 0'];

const defecto = () => ({
  nombre: 'Mi casa', ciudad: '', personas: null, tarifa: '1F', mesInicioVerano: 5, inicioPeriodo: '',
  metaBimestralKwh: null, horaDormirInicio: '00:00', horaDormirFin: '06:00', consumoNocheW: 1500, consumoBaseW: 300, umbralAltoW: 5000,
});
const form = ref(defecto());
const llenar = (h) => { form.value = h ? { ...defecto(), ...h, ciudad: h.ciudad || '', inicioPeriodo: h.inicioPeriodo || '' } : defecto(); };

onMounted(async () => {
  try {
    llenar(await hogarStore.cargar());
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudieron cargar los datos'), 'error');
  } finally {
    cargando.value = false;
  }
});

const guardar = async () => {
  const { valid } = await formRef.value.validate();
  if (!valid) return;
  guardando.value = true;
  const nuevo = !hogar.value;
  const v = (x) => (x === '' || x === undefined ? null : x);
  try {
    const r = await hogarStore.guardar({ ...form.value, ciudad: v(form.value.ciudad), personas: v(form.value.personas),
      inicioPeriodo: v(form.value.inicioPeriodo), metaBimestralKwh: v(form.value.metaBimestralKwh) });
    notify.show(r.mensaje, 'success');
    await hogarStore.cargar();
    llenar(hogarStore.hogar);
    if (nuevo) window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudieron guardar los datos'), 'error');
  } finally {
    guardando.value = false;
  }
};

/* Medidor */
const dlgToken = ref(false);
// Estado del medidor según su última lectura (más de 30 min sin lecturas = sin señal)
const estadoMedidor = computed(() => {
  const u = hogar.value?.ultimaLectura;
  if (hogar.value?.medidor && !hogar.value.medidor.activo) return { texto: 'Pausado', detalle: 'No se están registrando lecturas', icono: 'mdi-pause-circle-outline', color: 'grey-darken-1', fondo: 'grey-lighten-3' };
  if (!u) return { texto: 'Esperando conexión', detalle: 'El sensor aún no envía lecturas', icono: 'mdi-timer-sand', color: 'orange-darken-2', fondo: 'orange-lighten-5' };
  const fecha = new Date(u.fechaHora);
  const cuando = fecha.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  if (Date.now() - fecha.getTime() > 30 * 60000) return { texto: 'Sin señal', detalle: `Última lectura: ${cuando}`, icono: 'mdi-wifi-off', color: 'red-darken-2', fondo: 'red-lighten-5' };
  return { texto: 'Conectado', detalle: `Última lectura: ${cuando}`, icono: 'mdi-wifi', color: 'green-darken-2', fondo: 'green-lighten-5' };
});
const conexion = ref(null);

const registrarMedidor = async () => {
  trabajando.value = 'registrar';
  try {
    const r = await hogarStore.registrarMedidor({ modelo: 'Sonoff POW Ring' });
    notify.show(r.mensaje, 'success');
    await hogarStore.cargar();
    conexion.value = r.data;
    dlgToken.value = true;
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo registrar el sensor'), 'error');
  } finally {
    trabajando.value = '';
  }
};
const verToken = async () => {
  try {
    conexion.value = await hogarStore.tokenMedidor();
    dlgToken.value = true;
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo obtener el token'), 'error');
  }
};
const pausarMedidor = async () => {
  trabajando.value = 'activo';
  try {
    const r = await hogarStore.actualizarMedidor({ activo: !hogar.value.medidor.activo });
    notify.show(r.mensaje, 'success');
    await hogarStore.cargar();
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo cambiar el sensor'), 'error');
  } finally {
    trabajando.value = '';
  }
};
const eliminarMedidor = async () => {
  if (!confirm('¿Eliminar el sensor? También se borra TODO su historial de lecturas y no se puede recuperar.')) return;
  try {
    const r = await hogarStore.eliminarMedidor();
    notify.show(r.mensaje, 'success');
    await hogarStore.cargar();
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo eliminar el sensor'), 'error');
  }
};
</script>

<style scoped>
.main-container { max-width: 620px; margin: 0 auto; }
.section-card { background: #fff !important; border: 1px solid #e9efea !important; }
.titulo { font-weight: 700; color: #28633a; margin-bottom: 12px; }
.dato { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; background: #f5f8f6; border-radius: 10px; margin-bottom: 8px; font-size: 13px; }
.dato span { color: #6b7a70; font-size: 12px; }
.token { word-break: break-all; user-select: all; }
.ejemplo { background: #263238; color: #e0f2f1; padding: 10px; border-radius: 8px; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
</style>
