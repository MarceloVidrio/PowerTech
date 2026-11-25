<template>
  <v-container class="mt-8 px-4 main-container" fluid>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" color="green-darken-2" @click="$router.push('/admin')" />
      <div class="ml-2 flex-grow-1" style="min-width: 0">
        <h1 class="text-h5 font-weight-bold text-truncate">{{ u?.nombre || 'Usuario' }}</h1>
        <p v-if="u" class="text-caption text-grey-darken-1 text-truncate">{{ u.email }} · {{ u.nombreRol }}</p>
      </div>
      <v-chip v-if="u && !u.activo" color="red" variant="tonal">Desactivada</v-chip>
    </div>

    <div v-if="cargando && !u" class="d-flex justify-center my-8">
      <v-progress-circular indeterminate color="green-darken-2" />
    </div>

    <template v-if="u">
      <!-- Problemas detectados -->
      <v-alert v-if="u.problemas.length" type="warning" variant="tonal" class="mb-4 rounded-xl" title="Lo que se detectó">
        <ul class="ml-4"><li v-for="p in u.problemas" :key="p">{{ p }}</li></ul>
      </v-alert>
      <v-alert v-else type="success" variant="tonal" class="mb-4 rounded-xl">No se detectaron problemas en esta cuenta.</v-alert>

      <!-- Acciones rápidas -->
      <v-card class="pa-4 mb-4 rounded-xl seccion" elevation="0">
        <div class="titulo">Corregir acceso</div>
        <div class="d-flex flex-wrap ga-2">
          <v-btn color="green-darken-2" variant="tonal" class="text-none" prepend-icon="mdi-lock-reset" @click="dlgContrasena = true">
            Restablecer contraseña</v-btn>
          <v-btn color="blue-darken-2" variant="tonal" class="text-none" prepend-icon="mdi-lock-open-variant-outline"
            :loading="trabajando === 'desbloquear'" @click="desbloquear">Desbloquear</v-btn>
          <v-btn v-if="!esYo" :color="u.activo ? 'orange-darken-2' : 'green-darken-2'" variant="tonal" class="text-none"
            :prepend-icon="u.activo ? 'mdi-account-off-outline' : 'mdi-account-check-outline'"
            :loading="trabajando === 'activo'" @click="cambiarActivo">{{ u.activo ? 'Desactivar cuenta' : 'Activar cuenta' }}</v-btn>
        </div>
        <div class="text-caption text-grey-darken-1 mt-3">
          Registrada: {{ fecha(u.fechaRegistro) }} · Último acceso: {{ u.ultimoAcceso ? fecha(u.ultimoAcceso) : 'nunca' }}
        </div>
      </v-card>

      <!-- Datos de la cuenta -->
      <v-card class="pa-4 mb-4 rounded-xl seccion" elevation="0">
        <div class="titulo">Datos de la cuenta</div>
        <v-form ref="formRef" v-model="formValido">
          <v-text-field v-model="edicion.nombre" label="Nombre de usuario" variant="outlined" rounded="lg" density="comfortable"
            :rules="[v => !!v || 'Obligatorio', v => (v && v.length <= 50) || 'Máximo 50 caracteres']" />
          <v-text-field v-model="edicion.email" label="Correo electrónico" variant="outlined" rounded="lg" density="comfortable"
            :rules="[v => /.+@.+\..+/.test(v || '') || 'Correo no válido']" />
          <v-select v-model="edicion.rol" :items="ROLES" label="Tipo de cuenta" variant="outlined" rounded="lg"
            density="comfortable" :disabled="esYo" :hint="esYo ? 'No puedes cambiar tu propio rol' : ''" persistent-hint />
          <v-select v-if="edicion.rol === 'FAMILIAR'" v-model="edicion.idPropietario" :items="titularesElegibles"
            item-title="nombre" item-value="idUsuario" label="Familia de (titular del hogar)" variant="outlined" rounded="lg"
            density="comfortable" class="mt-2" :rules="[v => !!v || 'Elige al titular']" />
        </v-form>
        <div class="d-flex mt-2">
          <v-spacer />
          <v-btn color="green-darken-2" variant="flat" class="text-none rounded-pill px-6" :disabled="!formValido || !hayCambios"
            :loading="trabajando === 'guardar'" @click="guardar">Guardar cambios</v-btn>
        </div>
      </v-card>

      <!-- Familiares -->
      <v-card v-if="u.rol === 'TITULAR'" class="pa-4 mb-4 rounded-xl seccion" elevation="0">
        <div class="titulo">Familiares ({{ d.familiares.length }})</div>
        <div v-if="!d.familiares.length" class="text-caption text-grey">No ha invitado a familiares.</div>
        <div v-for="t in d.familiares" :key="t.idUsuario" class="fila" @click="$router.push(`/admin/usuarios/${t.idUsuario}`)">
          <v-icon color="blue-darken-2" class="mr-2">mdi-account-heart-outline</v-icon>
          <div class="flex-grow-1"><div class="text-body-2 font-weight-bold">{{ t.nombre }}</div><div class="text-caption text-grey">{{ t.email }}</div></div>
          <v-chip v-if="!t.activo" size="x-small" color="red" variant="tonal">Desactivada</v-chip>
          <v-icon color="grey">mdi-chevron-right</v-icon>
        </div>
      </v-card>

      <!-- Hogar -->
      <v-card v-if="u.rol !== 'SUPERADMIN'" class="pa-4 mb-4 rounded-xl seccion" elevation="0">
        <div class="titulo">{{ u.rol === 'FAMILIAR' ? 'Hogar de su familia' : 'Hogar' }}</div>
        <div v-if="!d.hogar" class="text-caption text-grey">Todavía no se configura el hogar.</div>
        <template v-else>
          <div class="fila sin-click">
            <v-icon color="green-darken-2" class="mr-2">mdi-home-outline</v-icon>
            <div class="flex-grow-1">
              <div class="text-body-2 font-weight-bold">{{ d.hogar.nombre }}<span v-if="d.hogar.ciudad" class="text-caption text-grey"> · {{ d.hogar.ciudad }}</span></div>
              <div class="text-caption text-grey">
                Tarifa {{ d.hogar.tarifa }}<template v-if="d.hogar.personas"> · {{ d.hogar.personas }} persona(s)</template>
                · duermen {{ d.hogar.horaDormirInicio }}–{{ d.hogar.horaDormirFin }} · límite {{ d.hogar.umbralAltoW }} W
                <template v-if="d.hogar.modoVacaciones"> · en modo vacaciones</template>
              </div>
            </div>
          </div>
          <!-- Medidor -->
          <div class="fila sin-click">
            <v-icon :color="d.hogar.medidor?.activo ? 'green-darken-2' : 'grey'" class="mr-2">mdi-current-ac</v-icon>
            <div class="flex-grow-1" style="min-width: 0">
              <template v-if="d.hogar.medidor">
                <div class="text-body-2 font-weight-bold text-truncate">Sensor de consumo <span class="text-caption text-grey">{{ d.hogar.medidor.codigoMedidor }}</span></div>
                <div class="text-caption text-grey">
                  {{ d.hogar.medidor.ultimaLectura ? `última lectura ${fecha(d.hogar.medidor.ultimaLectura)}` : 'nunca ha enviado lecturas' }}
                  · {{ d.hogar.medidor.lecturas24h }} lectura(s) en 24 h
                </div>
              </template>
              <div v-else class="text-body-2 text-grey">Sin sensor registrado</div>
            </div>
            <v-switch v-if="d.hogar.medidor" :model-value="d.hogar.medidor.activo" color="green-darken-2" hide-details density="compact" inset
              :loading="trabajando === d.hogar.medidor.codigoMedidor" @update:model-value="(v) => cambiarMedidor(d.hogar.medidor, v)" />
          </div>
        </template>
      </v-card>

      <!-- Aparatos -->
      <v-card v-if="d.hogar && u.rol !== 'SUPERADMIN'" class="pa-4 mb-4 rounded-xl seccion" elevation="0">
        <div class="titulo">Aparatos ({{ d.aparatos.length }})</div>
        <div v-if="!d.aparatos.length" class="text-caption text-grey">Sin aparatos registrados.</div>
        <div v-for="a in d.aparatos" :key="a.idAparato" class="fila sin-click">
          <v-icon color="green-darken-2" class="mr-2">mdi-power-plug-outline</v-icon>
          <div class="flex-grow-1">
            <div class="text-body-2 font-weight-bold">{{ a.nombre }}<span v-if="a.cuarto" class="text-caption text-grey"> · {{ a.cuarto }}</span></div>
            <div class="text-caption text-grey">{{ a.potenciaW ? `${Number(a.potenciaW)} W` : 'sin potencia' }}{{ a.horasDia ? ` · ${Number(a.horasDia)} h/día` : '' }}{{ a.conEnchufe ? ' · con enchufe inteligente' : '' }}</div>
          </div>
        </div>
      </v-card>

      <!-- Avisos abiertos -->
      <v-card v-if="u.rol !== 'SUPERADMIN'" class="pa-4 mb-4 rounded-xl seccion" elevation="0">
        <div class="titulo">Avisos abiertos ({{ d.alarmas.length }})</div>
        <div v-if="!d.alarmas.length" class="text-caption text-grey">No hay avisos abiertos.</div>
        <div v-for="a in d.alarmas" :key="a.codigoAlarma" class="fila sin-click">
          <v-icon :color="a.nivel >= 4 ? 'red' : 'orange'" class="mr-2">mdi-alert</v-icon>
          <div class="flex-grow-1" style="min-width: 0">
            <div class="text-body-2 font-weight-bold">{{ a.tipoAlarma }} · nivel {{ a.nivel }} <span class="text-caption text-grey">({{ a.estado }})</span></div>
            <div class="text-caption text-grey">{{ fecha(a.fechaHora) }} · {{ a.detalle }}</div>
          </div>
          <v-btn size="small" variant="text" color="green-darken-2" class="text-none" :loading="trabajando === a.codigoAlarma"
            @click="cerrarAlarma(a)">Cerrar</v-btn>
        </div>
      </v-card>

      <!-- Historial -->
      <v-card class="pa-4 mb-4 rounded-xl seccion" elevation="0">
        <div class="titulo">Historial de cambios del administrador</div>
        <div v-if="!d.bitacora.length" class="text-caption text-grey">Sin cambios registrados.</div>
        <div v-for="b in d.bitacora" :key="b.idBitacora" class="mb-2">
          <div class="text-body-2"><strong>{{ nombreAccion(b.accion) }}</strong> · <span class="text-caption text-grey">{{ fecha(b.fechaHora) }} por {{ b.admin || '—' }}</span></div>
          <div class="text-caption text-grey-darken-1">{{ b.detalle }}</div>
        </div>
      </v-card>

      <!-- Eliminar -->
      <v-card v-if="!esYo" class="pa-4 mb-4 rounded-xl peligro" elevation="0">
        <div class="titulo text-red-darken-2">Zona de peligro</div>
        <p class="text-caption mb-3">
          Eliminar la cuenta borra para siempre
          <template v-if="u.rol === 'TITULAR'">su hogar, su sensor con todas sus lecturas, {{ u.aparatos }} aparato(s), sus avisos y las cuentas de sus {{ u.familiares }} familiar(es).</template>
          <template v-else>el acceso de este usuario.</template>
        </p>
        <v-btn color="red-darken-2" variant="tonal" class="text-none" prepend-icon="mdi-delete-outline" @click="dlgEliminar = true">Eliminar cuenta</v-btn>
      </v-card>
    </template>

    <!-- Restablecer contraseña -->
    <v-dialog v-model="dlgContrasena" max-width="440px">
      <v-card class="rounded-xl pa-4">
        <v-card-title class="text-h6 font-weight-bold text-center" style="color: #478D4B;">Restablecer contraseña</v-card-title>
        <v-card-text>
          <v-radio-group v-model="modoContrasena" hide-details class="mb-2">
            <v-radio value="generar" label="Generar una contraseña temporal" color="green-darken-2" />
            <v-radio value="escribir" label="Escribir la nueva contraseña" color="green-darken-2" />
          </v-radio-group>
          <v-text-field v-if="modoContrasena === 'escribir'" v-model="nuevaContrasena" label="Nueva contraseña"
            variant="outlined" rounded="lg" density="comfortable" class="mt-2"
            :rules="[v => (v && v.length >= 8) || 'Mínimo 8 caracteres', v => (/[A-Za-z]/.test(v || '') && /\d/.test(v || '')) || 'Incluye letras y números']" />
          <p class="text-caption text-grey-darken-1 mt-2">También se anulan sus códigos de recuperación y se quitan los bloqueos por intentos fallidos.</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" class="text-none" @click="dlgContrasena = false">Cancelar</v-btn>
          <v-btn color="green-darken-2" variant="flat" class="text-none rounded-pill px-6" :loading="trabajando === 'contrasena'"
            :disabled="modoContrasena === 'escribir' && !contrasenaValida" @click="restablecer">Restablecer</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Eliminar cuenta -->
    <v-dialog v-model="dlgEliminar" max-width="440px">
      <v-card v-if="u" class="rounded-xl pa-4">
        <v-card-title class="text-h6 font-weight-bold text-center text-red-darken-2">Eliminar cuenta</v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-3">Esta acción no se puede deshacer. Escribe <strong>{{ u.nombre }}</strong> para confirmar.</p>
          <v-text-field v-model="confirmacion" variant="outlined" rounded="lg" density="comfortable" hide-details />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" class="text-none" @click="dlgEliminar = false">Cancelar</v-btn>
          <v-btn color="red-darken-2" variant="flat" class="text-none rounded-pill px-6" :disabled="confirmacion !== u.nombre"
            :loading="trabajando === 'eliminar'" @click="eliminar">Eliminar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ContrasenaTemporal v-model="temporal" />
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/users'
import { useNotifyStore } from '@/stores/notify'
import { useAdminStore, ROLES, mensajeError, nombreAccion } from '@/stores/admin'
import ContrasenaTemporal from '@/components/ContrasenaTemporal.vue'

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const admin = useAdminStore();
const notify = useNotifyStore();

const d = ref(null);
const u = computed(() => d.value?.usuario || null);
const esYo = computed(() => u.value?.idUsuario === userStore.usuario?.idUsuario);
const cargando = ref(false);
const trabajando = ref('');
const temporal = ref(null);

const fecha = (f) => (f ? new Date(f).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '');
const hora = (h) => String(h || '').slice(0, 5);

/* Edición de datos */
const formRef = ref(null);
const formValido = ref(false);
const edicion = ref({ nombre: '', email: '', rol: 'TITULAR', idPropietario: null });
const titularesElegibles = computed(() => admin.titulares.filter((e) => e.idUsuario !== u.value?.idUsuario));
const hayCambios = computed(() => !!u.value && (
  edicion.value.nombre.trim() !== u.value.nombre ||
  edicion.value.email.trim().toLowerCase() !== u.value.email.toLowerCase() ||
  edicion.value.rol !== u.value.rol ||
  (edicion.value.rol === 'FAMILIAR' && edicion.value.idPropietario !== u.value.idPropietario)));

const cargar = async () => {
  cargando.value = true;
  try {
    const [detalle] = await Promise.all([admin.detalle(route.params.id), admin.cargarTitulares()]);
    d.value = detalle;
    const x = detalle.usuario;
    edicion.value = { nombre: x.nombre, email: x.email, rol: x.rol, idPropietario: x.idPropietario };
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo cargar el usuario'), 'error');
    if (e.response?.status === 404) router.push('/admin');
  } finally {
    cargando.value = false;
  }
};

// Ejecuta una acción mostrando su estado de carga y recarga los datos al terminar.
const hacer = async (clave, fn, mensajeFallo) => {
  trabajando.value = clave;
  try {
    const r = await fn();
    if (r?.mensaje) notify.show(r.mensaje, 'success');
    await cargar();
    return r;
  } catch (e) {
    notify.show(mensajeError(e, mensajeFallo), 'error');
    return null;
  } finally {
    trabajando.value = '';
  }
};

const guardar = async () => {
  const { valid } = await formRef.value.validate();
  if (!valid) return;
  const body = { nombre: edicion.value.nombre.trim(), email: edicion.value.email.trim() };
  if (!esYo.value) {
    body.rol = edicion.value.rol;
    if (edicion.value.rol === 'FAMILIAR') body.idPropietario = edicion.value.idPropietario;
  }
  await hacer('guardar', () => admin.actualizar(u.value.idUsuario, body), 'No se pudieron guardar los cambios');
};

const cambiarActivo = () => {
  const activar = !u.value.activo;
  if (!activar && !confirm(`¿Desactivar la cuenta de ${u.value.nombre}? No podrá iniciar sesión hasta que la actives de nuevo.`)) return;
  hacer('activo', () => admin.actualizar(u.value.idUsuario, { activo: activar }), 'No se pudo cambiar el estado');
};

const desbloquear = () => hacer('desbloquear', () => admin.desbloquear(u.value.idUsuario), 'No se pudo desbloquear');

/* Contraseña */
const dlgContrasena = ref(false);
const modoContrasena = ref('generar');
const nuevaContrasena = ref('');
const contrasenaValida = computed(() => nuevaContrasena.value.length >= 8 && /[A-Za-z]/.test(nuevaContrasena.value) && /\d/.test(nuevaContrasena.value));
const restablecer = async () => {
  const escrita = modoContrasena.value === 'escribir' ? nuevaContrasena.value : '';
  const r = await hacer('contrasena', () => admin.restablecerContrasena(u.value.idUsuario, escrita), 'No se pudo restablecer la contraseña');
  if (!r) return;
  dlgContrasena.value = false;
  nuevaContrasena.value = '';
  if (r.data?.contrasenaTemporal) temporal.value = { usuario: u.value.email, contrasena: r.data.contrasenaTemporal };
};

/* Medidor y avisos */
const cambiarMedidor = (m, activo) => hacer(m.codigoMedidor, () => admin.cambiarMedidor(m.codigoMedidor, activo), 'No se pudo cambiar el medidor');
const cerrarAlarma = (a) => hacer(a.codigoAlarma, () => admin.cerrarAlarma(a.codigoAlarma), 'No se pudo cerrar la alarma');

/* Eliminar */
const dlgEliminar = ref(false);
const confirmacion = ref('');
const eliminar = async () => {
  trabajando.value = 'eliminar';
  try {
    const r = await admin.eliminar(u.value.idUsuario);
    notify.show(r.mensaje || 'Cuenta eliminada', 'success');
    router.push('/admin');
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo eliminar la cuenta'), 'error');
  } finally {
    trabajando.value = '';
    dlgEliminar.value = false;
  }
};

onMounted(cargar);
</script>

<style scoped>
.main-container { max-width: 620px; margin-left: auto; margin-right: auto; }
.seccion { background: #fff; border: 1px solid rgba(0, 0, 0, 0.06); }
.peligro { background: #fff8f7; border: 1px solid #f5c2bd; }
.titulo { font-weight: 700; color: #28633a; margin-bottom: 10px; }
.fila { display: flex; align-items: center; padding: 8px 4px; border-top: 1px solid #f0f0f0; cursor: pointer; }
.fila:first-of-type { border-top: none; }
.fila.sin-click { cursor: default; }
</style>
