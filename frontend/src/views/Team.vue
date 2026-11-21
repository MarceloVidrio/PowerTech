<template>
  <v-container class="mt-8 px-4 main-container" fluid>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" color="green-darken-2" @click="$router.back()"></v-btn>
      <div class="ml-2">
        <h1 class="text-h5 font-weight-bold">Mi equipo</h1>
        <p class="text-caption text-grey-darken-1">
          Los técnicos pueden ver la información, atender alarmas, activar sensores y encender o apagar equipos.
          No pueden crear ni eliminar edificios, salas, dispositivos o sensores.
        </p>
      </div>
    </div>

    <div v-if="cargando" class="d-flex justify-center my-8">
      <v-progress-circular indeterminate color="green-darken-2"></v-progress-circular>
    </div>

    <v-card v-else-if="!tecnicos.length" class="pa-8 text-center rounded-xl bg-transparent elevation-0 border-dashed">
      <v-icon size="56" color="grey-lighten-1" class="mb-3">mdi-account-hard-hat-outline</v-icon>
      <div class="text-subtitle-1 text-grey-darken-2">Aún no has agregado técnicos</div>
    </v-card>

    <v-card v-for="t in tecnicos" :key="t.idUsuario" class="pa-4 mb-3 rounded-xl tech-card" elevation="0">
      <div class="d-flex align-center">
        <v-avatar color="green-lighten-5" class="mr-3"><v-icon color="green-darken-2">mdi-account-hard-hat</v-icon></v-avatar>
        <div class="flex-grow-1">
          <div class="font-weight-bold text-grey-darken-3">{{ t.nombre }}</div>
          <div class="text-caption text-grey-darken-1">{{ t.email }}</div>
        </div>
        <v-btn icon="mdi-delete-outline" variant="text" color="red-lighten-1" @click="eliminar(t)"></v-btn>
      </div>
    </v-card>

    <div class="fab-container">
      <v-btn color="green-darken-2" icon="mdi-plus" size="large" elevation="4" @click="dialogo = true"></v-btn>
    </div>

    <v-dialog v-model="dialogo" max-width="480px" persistent>
      <v-card class="rounded-xl pa-4">
        <v-card-title class="text-h6 font-weight-bold text-center" style="color: #478D4B;">Nuevo técnico</v-card-title>
        <v-card-text>
          <v-form ref="formRef" v-model="formValido">
            <v-text-field v-model="nuevo.nombre" label="Nombre de usuario" variant="outlined" rounded="lg"
              density="comfortable" :rules="[v => !!v || 'Obligatorio', v => (v && v.length <= 50) || 'Máximo 50 caracteres']" />
            <v-text-field v-model="nuevo.email" label="Correo electrónico" type="email" variant="outlined" rounded="lg"
              density="comfortable" :rules="[v => /.+@.+\..+/.test(v || '') || 'Correo no válido']" />
            <v-text-field v-model="nuevo.contrasena" label="Contraseña temporal" :type="ver ? 'text' : 'password'"
              :append-inner-icon="ver ? 'mdi-eye-off' : 'mdi-eye'" @click:append-inner="ver = !ver"
              variant="outlined" rounded="lg" density="comfortable"
              :rules="[v => (v && v.length >= 8) || 'Mínimo 8 caracteres', v => (/[A-Za-z]/.test(v || '') && /\d/.test(v || '')) || 'Incluye letras y números']"
              hint="Compártela con el técnico; podrá cambiarla con «¿Olvidaste tu contraseña?»" persistent-hint />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" class="text-none" @click="cerrar">Cancelar</v-btn>
          <v-btn color="green-darken-2" variant="flat" class="text-none rounded-pill px-6" :disabled="!formValido"
            :loading="guardando" @click="guardar">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/users'
import { useNotifyStore } from '@/stores/notify'

const userStore = useUserStore();
const notify = useNotifyStore();

const tecnicos = ref([]);
const cargando = ref(false);
const dialogo = ref(false);
const formRef = ref(null);
const formValido = ref(false);
const guardando = ref(false);
const ver = ref(false);
const vacio = () => ({ nombre: '', email: '', contrasena: '' });
const nuevo = ref(vacio());

const mensajeError = (e, porDefecto) => e.response?.data?.detalles?.[0] || e.response?.data?.mensaje || porDefecto;

const cargar = async () => {
  cargando.value = true;
  try {
    tecnicos.value = await userStore.listarTecnicos();
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo cargar el equipo'), 'error');
  } finally {
    cargando.value = false;
  }
};

const cerrar = () => {
  dialogo.value = false;
  nuevo.value = vacio();
  formRef.value?.resetValidation();
};

const guardar = async () => {
  const { valid } = await formRef.value.validate();
  if (!valid) return;
  guardando.value = true;
  try {
    await userStore.crearTecnico(nuevo.value);
    notify.show('Técnico agregado', 'success');
    cerrar();
    cargar();
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo agregar al técnico'), 'error');
  } finally {
    guardando.value = false;
  }
};

const eliminar = async (t) => {
  if (!confirm(`¿Quitar el acceso de ${t.nombre}?`)) return;
  try {
    await userStore.eliminarTecnico(t.idUsuario);
    notify.show('Técnico eliminado', 'success');
    cargar();
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo eliminar'), 'error');
  }
};

onMounted(cargar);
</script>

<style scoped>
.main-container { max-width: 520px; margin-left: auto; margin-right: auto; }
.tech-card { background: #fff; border: 1px solid rgba(0, 0, 0, 0.06); }
.fab-container { position: fixed; bottom: 96px; right: 24px; z-index: 10; }
</style>
