<template>
  <v-container class="mt-8 px-4 main-container" fluid>
    <div class="d-flex align-center mb-1">
      <v-avatar color="green-darken-2" class="mr-3"><v-icon color="white">mdi-shield-account</v-icon></v-avatar>
      <div>
        <h1 class="text-h5 font-weight-bold">Panel del administrador</h1>
        <p class="text-caption text-grey-darken-1">Hola {{ userStore.usuario?.nombre }} · todos los usuarios de PowerTech Hogar</p>
      </div>
    </div>

    <!-- Resumen -->
    <div v-if="admin.resumen" class="resumen my-4">
      <div v-for="r in tarjetasResumen" :key="r.label" class="resumen-item" :class="r.clase">
        <div class="text-h6 font-weight-bold">{{ r.valor }}</div>
        <div class="text-caption">{{ r.label }}</div>
      </div>
    </div>

    <v-tabs v-model="pestana" color="green-darken-2" class="mb-4" grow>
      <v-tab value="usuarios" class="text-none">Usuarios</v-tab>
      <v-tab value="bitacora" class="text-none">Historial de cambios</v-tab>
    </v-tabs>

    <!-- ===================== USUARIOS ===================== -->
    <template v-if="pestana === 'usuarios'">
      <v-text-field v-model="busqueda" prepend-inner-icon="mdi-magnify" placeholder="Buscar por nombre o correo"
        variant="outlined" rounded="lg" density="comfortable" hide-details clearable class="mb-3" />
      <div class="d-flex flex-wrap ga-2 mb-4">
        <v-chip v-for="f in filtrosRol" :key="f.value" :color="rol === f.value ? 'green-darken-2' : undefined"
          :variant="rol === f.value ? 'flat' : 'outlined'" @click="rol = f.value">{{ f.title }}</v-chip>
        <v-chip :color="soloProblemas ? 'orange-darken-2' : undefined" :variant="soloProblemas ? 'flat' : 'outlined'"
          prepend-icon="mdi-alert-circle-outline" @click="soloProblemas = !soloProblemas">Con problemas</v-chip>
      </div>

      <div v-if="cargando" class="d-flex justify-center my-8">
        <v-progress-circular indeterminate color="green-darken-2" />
      </div>

      <v-card v-else-if="!visibles.length" class="pa-8 text-center rounded-xl bg-transparent elevation-0 border-dashed">
        <v-icon size="56" color="grey-lighten-1" class="mb-3">mdi-account-search-outline</v-icon>
        <div class="text-subtitle-1 text-grey-darken-2">
          {{ admin.usuarios.length <= 1 && !busqueda && !rol ? 'Todavía no hay usuarios registrados' : 'No hay usuarios con ese filtro' }}
        </div>
      </v-card>

      <v-card v-for="u in visibles" :key="u.idUsuario" class="pa-4 mb-3 rounded-xl user-card" elevation="0"
        :class="{ inactivo: !u.activo }" @click="abrir(u)">
        <div class="d-flex align-center">
          <v-avatar :color="colorRol(u.rol).fondo" class="mr-3"><v-icon :color="colorRol(u.rol).icono">{{ iconoRol(u.rol) }}</v-icon></v-avatar>
          <div class="flex-grow-1" style="min-width: 0">
            <div class="font-weight-bold text-grey-darken-3 text-truncate">
              {{ u.nombre }} <span v-if="u.idUsuario === userStore.usuario?.idUsuario" class="text-caption text-grey">(tú)</span>
            </div>
            <div class="text-caption text-grey-darken-1 text-truncate">{{ u.email }}</div>
            <div class="text-caption text-grey-darken-1">
              {{ u.nombreRol }}<template v-if="u.propietario"> · familia de {{ u.propietario }}</template>
              <template v-if="u.rol === 'TITULAR' && u.idHogar"> · «{{ u.nombreHogar }}»{{ u.ciudad ? `, ${u.ciudad}` : '' }} · {{ u.aparatos }} aparato(s), {{ u.familiares }} familiar(es)</template>
            </div>
          </div>
          <v-chip v-if="!u.activo" size="small" color="red" variant="tonal" class="ml-2">Desactivada</v-chip>
          <v-icon color="grey" class="ml-1">mdi-chevron-right</v-icon>
        </div>
        <div v-if="problemasReales(u).length" class="d-flex flex-wrap ga-1 mt-2">
          <v-chip v-for="p in problemasReales(u)" :key="p" size="x-small" color="orange-darken-3" variant="tonal"
            prepend-icon="mdi-alert-outline">{{ p }}</v-chip>
        </div>
      </v-card>

      <div class="fab-container">
        <v-btn color="green-darken-2" icon="mdi-account-plus" size="large" elevation="4" @click="abrirNuevo" />
      </div>
    </template>

    <!-- ===================== BITÁCORA ===================== -->
    <template v-else>
      <div v-if="cargandoBitacora" class="d-flex justify-center my-8">
        <v-progress-circular indeterminate color="green-darken-2" />
      </div>
      <v-card v-else-if="!registros.length" class="pa-8 text-center rounded-xl bg-transparent elevation-0 border-dashed">
        <v-icon size="56" color="grey-lighten-1" class="mb-3">mdi-history</v-icon>
        <div class="text-subtitle-1 text-grey-darken-2">Aún no hay cambios registrados</div>
      </v-card>
      <v-card v-for="b in registros" :key="b.idBitacora" class="pa-3 mb-2 rounded-lg user-card" elevation="0"
        @click="b.idAfectado && $router.push(`/admin/usuarios/${b.idAfectado}`)">
        <div class="d-flex justify-space-between">
          <span class="font-weight-bold text-body-2">{{ accion(b.accion) }} · {{ b.nombreAfectado || '—' }}</span>
          <span class="text-caption text-grey">{{ fecha(b.fechaHora) }}</span>
        </div>
        <div class="text-caption text-grey-darken-1">{{ b.detalle }}</div>
        <div class="text-caption text-grey">por {{ b.admin || 'cuenta eliminada' }}</div>
      </v-card>
    </template>

    <!-- ===================== NUEVA CUENTA ===================== -->
    <v-dialog v-model="dialogo" max-width="480px" persistent>
      <v-card class="rounded-xl pa-4">
        <v-card-title class="text-h6 font-weight-bold text-center" style="color: #478D4B;">Nueva cuenta</v-card-title>
        <v-card-text>
          <v-form ref="formRef" v-model="formValido">
            <v-select v-model="nuevo.rol" :items="ROLES" label="Tipo de cuenta" variant="outlined" rounded="lg" density="comfortable" />
            <v-select v-if="nuevo.rol === 'FAMILIAR'" v-model="nuevo.idPropietario" :items="admin.titulares"
              item-title="nombre" item-value="idUsuario" label="Familia de (titular del hogar)" variant="outlined" rounded="lg"
              density="comfortable" :rules="[v => !!v || 'Elige al titular']" no-data-text="No hay titulares de hogar" />
            <v-text-field v-model="nuevo.nombre" label="Nombre de usuario" variant="outlined" rounded="lg" density="comfortable"
              :rules="[v => !!v || 'Obligatorio', v => (v && v.length <= 50) || 'Máximo 50 caracteres']" />
            <v-text-field v-model="nuevo.email" label="Correo electrónico" type="email" variant="outlined" rounded="lg"
              density="comfortable" :rules="[v => /.+@.+\..+/.test(v || '') || 'Correo no válido']" />
            <v-text-field v-model="nuevo.contrasena" label="Contraseña (opcional)" :type="ver ? 'text' : 'password'"
              :append-inner-icon="ver ? 'mdi-eye-off' : 'mdi-eye'" @click:append-inner="ver = !ver"
              variant="outlined" rounded="lg" density="comfortable" :rules="reglaContrasenaOpcional"
              hint="Déjala vacía y se generará una contraseña temporal" persistent-hint />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" class="text-none" @click="cerrarNuevo">Cancelar</v-btn>
          <v-btn color="green-darken-2" variant="flat" class="text-none rounded-pill px-6" :disabled="!formValido"
            :loading="guardando" @click="guardarNuevo">Crear</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ContrasenaTemporal v-model="temporal" />
  </v-container>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/users'
import { useNotifyStore } from '@/stores/notify'
import { useAdminStore, ROLES, mensajeError, nombreAccion } from '@/stores/admin'
import ContrasenaTemporal from '@/components/ContrasenaTemporal.vue'

const userStore = useUserStore();
const admin = useAdminStore();
const notify = useNotifyStore();
const router = useRouter();

const pestana = ref('usuarios');
const busqueda = ref('');
const rol = ref('');
const soloProblemas = ref(false);
const cargando = ref(false);

const filtrosRol = [{ value: '', title: 'Todos' }, { value: 'TITULAR', title: 'Titulares' }, { value: 'FAMILIAR', title: 'Familiares' }, { value: 'SUPERADMIN', title: 'Sistema' }];

// "Nunca ha iniciado sesión" es informativo: no cuenta como problema para el filtro.
const problemasReales = (u) => (u.problemas || []).filter((p) => p !== 'Nunca ha iniciado sesión');
const visibles = computed(() => (soloProblemas.value ? admin.usuarios.filter((u) => problemasReales(u).length) : admin.usuarios));

const tarjetasResumen = computed(() => {
  const r = admin.resumen || {};
  return [
    { label: 'Hogares', valor: r.hogares || 0 },
    { label: 'Familiares', valor: r.familiares || 0 },
    { label: 'Desactivadas', valor: r.desactivados || 0, clase: r.desactivados ? 'alerta' : '' },
    { label: 'Avisos activos', valor: r.alarmasActivas || 0, clase: r.alarmasActivas ? 'alerta' : '' },
  ];
});

const iconoRol = (r) => ({ SUPERADMIN: 'mdi-shield-account', TITULAR: 'mdi-home-account', FAMILIAR: 'mdi-account-heart-outline' }[r] || 'mdi-account');
const colorRol = (r) => ({
  SUPERADMIN: { fondo: 'green-darken-2', icono: 'white' },
  TITULAR: { fondo: 'green-lighten-5', icono: 'green-darken-2' },
  FAMILIAR: { fondo: 'blue-lighten-5', icono: 'blue-darken-2' },
}[r] || { fondo: 'grey-lighten-3', icono: 'grey' });

const cargar = async () => {
  cargando.value = true;
  try {
    await Promise.all([
      admin.cargarUsuarios({ q: busqueda.value || '', rol: rol.value }),
      admin.cargarResumen(),
    ]);
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo cargar la lista de usuarios'), 'error');
  } finally {
    cargando.value = false;
  }
};

let espera = null;
watch(busqueda, () => { clearTimeout(espera); espera = setTimeout(cargar, 300); });
watch(rol, cargar);

const abrir = (u) => router.push(`/admin/usuarios/${u.idUsuario}`);

/* Bitácora */
const registros = ref([]);
const cargandoBitacora = ref(false);
const accion = nombreAccion;
const fecha = (f) => (f ? new Date(f).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '');
watch(pestana, async (p) => {
  if (p !== 'bitacora') return;
  cargandoBitacora.value = true;
  try { registros.value = await admin.bitacora(150); }
  catch (e) { notify.show(mensajeError(e, 'No se pudo cargar el historial'), 'error'); }
  finally { cargandoBitacora.value = false; }
});

/* Nueva cuenta */
const dialogo = ref(false);
const formRef = ref(null);
const formValido = ref(false);
const guardando = ref(false);
const ver = ref(false);
const temporal = ref(null);
const vacio = () => ({ rol: 'TITULAR', idPropietario: null, nombre: '', email: '', contrasena: '' });
const nuevo = ref(vacio());
const reglaContrasenaOpcional = [
  (v) => !v || v.length >= 8 || 'Mínimo 8 caracteres',
  (v) => !v || (/[A-Za-z]/.test(v) && /\d/.test(v)) || 'Incluye letras y números',
];

const abrirNuevo = async () => {
  dialogo.value = true;
  try { await admin.cargarTitulares(); } catch { /* el select queda vacío */ }
};
const cerrarNuevo = () => {
  dialogo.value = false;
  nuevo.value = vacio();
  formRef.value?.resetValidation();
};
const guardarNuevo = async () => {
  const { valid } = await formRef.value.validate();
  if (!valid) return;
  guardando.value = true;
  try {
    const r = await admin.crear({ ...nuevo.value, email: nuevo.value.email.trim() });
    notify.show(r.mensaje || 'Cuenta creada', 'success');
    if (r.data?.contrasenaTemporal) temporal.value = { usuario: r.data.email, contrasena: r.data.contrasenaTemporal };
    cerrarNuevo();
    cargar();
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo crear la cuenta'), 'error');
  } finally {
    guardando.value = false;
  }
};

onMounted(cargar);
</script>

<style scoped>
.main-container { max-width: 620px; margin-left: auto; margin-right: auto; }
.resumen { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.resumen-item { background: #f3f8f4; border: 1px solid #dce8df; border-radius: 14px; padding: 10px; text-align: center; color: #28633a; }
.resumen-item.alerta { background: #fff4e5; border-color: #ffd8a8; color: #b45309; }
.user-card { background: #fff; border: 1px solid rgba(0, 0, 0, 0.06); cursor: pointer; transition: background .15s; }
.user-card:hover { background: #f6faf7; }
.user-card.inactivo { opacity: .7; }
.fab-container { position: fixed; bottom: 96px; right: 24px; z-index: 10; }
@media (max-width: 420px) { .resumen { grid-template-columns: repeat(2, 1fr); } }
</style>
