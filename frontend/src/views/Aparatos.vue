<template>
  <v-container class="mt-8 px-4 main-container" fluid>
    <div class="mb-4">
      <h1 class="text-h4 font-weight-bold">Aparatos</h1>
      <p class="text-subtitle-2 text-grey-darken-1">
        Registra tus aparatos para estimar cuánto gasta cada uno. Si tienen enchufe inteligente, puedes apagarlos desde aquí.
      </p>
      <v-btn v-if="userStore.esTitular && !sinHogar && !cargando" color="green-darken-2" class="text-none rounded-pill mt-3"
        prepend-icon="mdi-plus" @click="abrir()">Agregar aparato</v-btn>
    </div>

    <v-alert v-if="userStore.esFamiliar" type="info" variant="tonal" density="compact" class="mb-4 text-caption">
      Tu cuenta es de consulta: solo el titular puede agregar, cambiar o apagar aparatos.
    </v-alert>

    <div v-if="cargando" class="d-flex justify-center my-10"><v-progress-circular indeterminate color="green-darken-2" /></div>

    <v-alert v-else-if="sinHogar" type="info" variant="tonal" class="rounded-xl">
      Primero hay que configurar el hogar.
      <template #append v-if="userStore.esTitular"><v-btn size="small" variant="flat" color="blue-darken-2" class="text-none" to="/hogar">Configurar</v-btn></template>
    </v-alert>

    <template v-else>
      <v-card v-if="!aparatos.length" class="pa-8 text-center rounded-xl bg-transparent elevation-0 border-dashed">
        <v-icon size="56" color="grey-lighten-1" class="mb-3">mdi-power-plug-off-outline</v-icon>
        <div class="text-subtitle-1 text-grey-darken-2">Aún no hay aparatos registrados</div>
        <div v-if="userStore.esTitular" class="text-caption text-grey">Empieza por los que más gastan: minisplit, refrigerador, bomba de agua…</div>
      </v-card>

      <div v-for="grupo in grupos" :key="grupo.cuarto" class="mb-4">
        <div class="text-subtitle-2 font-weight-bold text-grey-darken-2 mb-2 ml-1">{{ grupo.cuarto }}</div>
        <v-card v-for="a in grupo.aparatos" :key="a.idAparato" class="pa-4 mb-2 rounded-xl item-card" elevation="0"
          @click="userStore.esTitular && abrir(a)">
          <div class="d-flex align-center">
            <v-avatar color="green-lighten-5" class="mr-3"><v-icon color="green-darken-2">{{ tipoAparato(a.tipo).icono }}</v-icon></v-avatar>
            <div class="flex-grow-1" style="min-width: 0">
              <div class="font-weight-bold text-truncate">{{ a.nombre }}</div>
              <div class="text-caption text-grey-darken-1">
                <template v-if="a.potenciaW">{{ watts(a.potenciaW) }}</template><template v-if="a.potenciaW && a.horasDia"> · {{ a.horasDia }} h/día</template>
                <template v-if="a.estimado?.kwhBimestre"> · ≈ {{ kwh(a.estimado.kwhBimestre, 0) }}/bim. ({{ a.estimado.porcentaje }}%)</template>
                <template v-if="!a.potenciaW">Agrega su potencia para estimar su consumo</template>
              </div>
              <div v-if="a.conEnchufe" class="d-flex flex-wrap ga-1 mt-1">
                <v-chip size="x-small" color="blue" variant="tonal" prepend-icon="mdi-power-socket-us">Enchufe inteligente</v-chip>
                <v-chip v-if="a.apagarAlDormir" size="x-small" variant="tonal" prepend-icon="mdi-weather-night">Se apaga al dormir</v-chip>
                <v-chip v-if="a.apagarEnVacaciones" size="x-small" variant="tonal" prepend-icon="mdi-bag-suitcase-outline">Se apaga en vacaciones</v-chip>
              </div>
            </div>
            <div v-if="a.conEnchufe && userStore.esTitular" class="d-flex flex-column ga-1 ml-2" @click.stop>
              <v-btn size="small" variant="tonal" color="green-darken-2" class="text-none" :loading="trabajando === `${a.idAparato}ON`" @click="power(a, 'ON')">Encender</v-btn>
              <v-btn size="small" variant="tonal" color="red-darken-2" class="text-none" :loading="trabajando === `${a.idAparato}OFF`" @click="power(a, 'OFF')">Apagar</v-btn>
            </div>
          </div>
        </v-card>
      </div>

    </template>

    <!-- Alta / edición -->
    <v-dialog v-model="dialogo" max-width="500px" scrollable>
      <v-card class="rounded-xl">
        <v-card-title class="text-h6 font-weight-bold text-center pt-5" style="color: #478D4B;">{{ editando ? 'Editar aparato' : 'Nuevo aparato' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef" v-model="formValido">
            <v-select v-model="form.tipo" :items="TIPOS_APARATO" label="Tipo" variant="outlined" rounded="lg" density="comfortable"
              @update:model-value="sugerir">
              <template #item="{ props, item }"><v-list-item v-bind="props" :prepend-icon="item.raw.icono" /></template>
            </v-select>
            <v-text-field v-model="form.nombre" label="Nombre" placeholder="Ej. Minisplit de la recámara" variant="outlined" rounded="lg"
              density="comfortable" :rules="[v => !!v || 'Obligatorio', v => (v || '').length <= 80 || 'Máximo 80 caracteres']" />
            <v-combobox v-model="form.cuarto" :items="cuartos" label="Cuarto (opcional)" variant="outlined" rounded="lg" density="comfortable" />
            <v-row dense>
              <v-col cols="6">
                <v-text-field v-model.number="form.potenciaW" type="number" label="Potencia" suffix="W" variant="outlined" rounded="lg"
                  density="comfortable" hint="Viene en la etiqueta del aparato" persistent-hint :rules="[v => v === '' || v === null || (v >= 0 && v <= 50000) || '0 a 50,000 W']" />
              </v-col>
              <v-col cols="6">
                <v-text-field v-model.number="form.horasDia" type="number" label="Uso al día" suffix="h" variant="outlined" rounded="lg"
                  density="comfortable" hint="Horas encendido" persistent-hint :rules="[v => v === '' || v === null || (v >= 0 && v <= 24) || '0 a 24 h']" />
              </v-col>
            </v-row>

            <div class="text-subtitle-2 font-weight-bold mt-4 mb-1">Enchufe inteligente (opcional)</div>
            <p class="text-caption text-grey-darken-1 mb-2">Si el aparato está conectado a un enchufe con Tasmota (p. ej. Sonoff S31), escribe su dirección en tu red, como http://192.168.1.50</p>
            <v-text-field v-model="form.controlUrl" label="Dirección del enchufe" placeholder="http://192.168.1.50" variant="outlined" rounded="lg"
              density="comfortable" :rules="[v => !v || /^https?:\/\//.test(v) || 'Debe iniciar con http:// o https://']" />
            <v-switch v-model="form.apagarAlDormir" :disabled="!form.controlUrl" color="green-darken-2" density="compact" hide-details
              label="Apagarlo al empezar las horas de sueño" />
            <v-switch v-model="form.apagarEnVacaciones" :disabled="!form.controlUrl" color="green-darken-2" density="compact" hide-details
              label="Apagarlo al activar el modo vacaciones" />
          </v-form>
        </v-card-text>
        <v-card-actions class="px-5 pb-4">
          <v-btn v-if="editando" variant="text" color="red-darken-2" class="text-none" @click="eliminar">Eliminar</v-btn>
          <v-spacer />
          <v-btn variant="text" class="text-none" @click="dialogo = false">Cancelar</v-btn>
          <v-btn color="green-darken-2" variant="flat" class="text-none rounded-pill px-6" :disabled="!formValido" :loading="guardando" @click="guardar">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/users';
import { useNotifyStore } from '@/stores/notify';
import { useHogarStore, TIPOS_APARATO, tipoAparato, watts, kwh, mensajeError } from '@/stores/hogar';

const userStore = useUserStore();
const notify = useNotifyStore();
const hogarStore = useHogarStore();
const { aparatos } = storeToRefs(hogarStore);

const cargando = ref(true);
const sinHogar = ref(false);
const trabajando = ref('');

const grupos = computed(() => {
  const mapa = new Map();
  for (const a of aparatos.value) {
    const c = a.cuarto || 'Sin cuarto';
    if (!mapa.has(c)) mapa.set(c, []);
    mapa.get(c).push(a);
  }
  return [...mapa].map(([cuarto, lista]) => ({ cuarto, aparatos: lista }));
});
const cuartos = computed(() => [...new Set(['Sala', 'Cocina', 'Recámara principal', 'Recámara 2', 'Lavandería', 'Patio',
  ...aparatos.value.map((a) => a.cuarto).filter(Boolean)])]);

const cargar = async () => {
  try {
    if (!hogarStore.cargado) await hogarStore.cargar();
    if (!hogarStore.hogar) { sinHogar.value = true; return; }
    await hogarStore.cargarAparatos();
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudieron cargar los aparatos'), 'error');
  } finally {
    cargando.value = false;
  }
};

/* Formulario */
const dialogo = ref(false);
const formRef = ref(null);
const formValido = ref(false);
const guardando = ref(false);
const editando = ref(null);
const vacio = () => ({ tipo: 'MINISPLIT', nombre: '', cuarto: '', potenciaW: 1400, horasDia: 8, controlUrl: '', apagarAlDormir: false, apagarEnVacaciones: false });
const form = ref(vacio());

const abrir = (a = null) => {
  editando.value = a;
  form.value = a ? { ...a, cuarto: a.cuarto || '', controlUrl: a.controlUrl || '' } : vacio();
  dialogo.value = true;
};
// Al cambiar el tipo se sugieren una potencia y horas de uso típicas
const sugerir = (tipo) => {
  const t = tipoAparato(tipo);
  if (!form.value.nombre || TIPOS_APARATO.some((x) => x.title === form.value.nombre)) form.value.nombre = t.value === 'OTRO' ? '' : t.title;
  if (t.potencia !== null) { form.value.potenciaW = t.potencia; form.value.horasDia = t.horas; }
};

const guardar = async () => {
  const { valid } = await formRef.value.validate();
  if (!valid) return;
  guardando.value = true;
  const vacioANull = (v) => (v === '' || v === undefined ? null : v);
  const body = { ...form.value, cuarto: vacioANull(form.value.cuarto), controlUrl: vacioANull(form.value.controlUrl),
    potenciaW: vacioANull(form.value.potenciaW), horasDia: vacioANull(form.value.horasDia) };
  try {
    const r = editando.value ? await hogarStore.actualizarAparato(editando.value.idAparato, body) : await hogarStore.crearAparato(body);
    notify.show(r.mensaje, 'success');
    dialogo.value = false;
    await hogarStore.cargarAparatos();
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo guardar el aparato'), 'error');
  } finally {
    guardando.value = false;
  }
};

const eliminar = async () => {
  if (!confirm(`¿Eliminar «${editando.value.nombre}»?`)) return;
  try {
    const r = await hogarStore.eliminarAparato(editando.value.idAparato);
    notify.show(r.mensaje, 'success');
    dialogo.value = false;
    await hogarStore.cargarAparatos();
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo eliminar'), 'error');
  }
};

const power = async (a, estado) => {
  trabajando.value = `${a.idAparato}${estado}`;
  try {
    const r = await hogarStore.encenderApagar(a.idAparato, estado);
    notify.show(r.mensaje, 'success');
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo comunicar con el enchufe'), 'error');
  } finally {
    trabajando.value = '';
  }
};

onMounted(cargar);
</script>

<style scoped>
.main-container { max-width: 620px; margin: 0 auto; }
.item-card { background: #fff; border: 1px solid rgba(0, 0, 0, 0.06); }
.border-dashed { border: 2px dashed #d1d5db !important; }
</style>
