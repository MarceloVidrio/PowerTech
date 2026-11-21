<template>
  <nav class="menu-bar" aria-label="Navegación principal">
    <template v-if="userStore.usuario">
      <RouterLink v-for="item in items" :key="item.to" :to="item.to"
        class="menu-item" :class="{ 'menu-item-active': route.path === item.to }"
        :aria-current="route.path === item.to ? 'page' : undefined">
        <v-icon size="22" aria-hidden="true">{{ item.icon }}</v-icon>
        <span>{{ item.label }}</span>
      </RouterLink>
      <button type="button" class="menu-item logout-item" @click="cerrarSesion">
        <v-icon size="22" aria-hidden="true">mdi-logout</v-icon><span>Salir</span>
      </button>
    </template>
    <template v-else>
      <RouterLink class="menu-item" to="/login">Iniciar sesión</RouterLink>
      <RouterLink class="menu-item" to="/signup">Crear cuenta</RouterLink>
    </template>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useUserStore } from '@/stores/users';
const userStore = useUserStore();
const route = useRoute();
const itemsEmpresa = [
  { to: '/', label: 'Inicio', icon: 'mdi-home-outline' },
  { to: '/notifications', label: 'Avisos', icon: 'mdi-bell-outline' },
  { to: '/monitoring', label: 'Monitoreo', icon: 'mdi-chart-line' },
  { to: '/all-devices', label: 'Equipos', icon: 'mdi-devices' },
  { to: '/sensors', label: 'Sensores', icon: 'mdi-access-point' },
  { to: '/others', label: 'Más', icon: 'mdi-dots-grid' },
];
// El administrador del sistema solo usa su panel
const itemsSistema = [
  { to: '/admin', label: 'Usuarios', icon: 'mdi-account-cog-outline' },
];
const items = computed(() => (userStore.esSuperAdmin ? itemsSistema : itemsEmpresa));
const cerrarSesion = () => {
  userStore.logout();
  window.location.href = '/login';
};
</script>

<style scoped>
.menu-bar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: max(12px, env(safe-area-inset-bottom));
  width: min(760px, calc(100% - 24px));
  display: flex;
  padding: 6px;
  gap: 2px;
  border: 1px solid #dce8df;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 8px 32px #183e2420;
  z-index: 1000;
}
.menu-item {
  flex: 1;
  min-width: 0;
  min-height: 54px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 15px;
  color: #526259;
  text-decoration: none;
  font-size: 12px;
  font-weight: 600;
  transition: background-color .15s, color .15s;
}
.menu-item:hover, .menu-item-active { background: #eaf4ed; color: #28633a; }
.menu-item:focus-visible { outline: 3px solid #478d4b; outline-offset: 2px; }
.logout-item:hover { background: #fff0ef; color: #b42318; }
@media (max-width: 420px) {
  .menu-bar { width: calc(100% - 12px); padding: 4px; gap: 0; }
  .menu-item { font-size: 10px; }
}
</style>
