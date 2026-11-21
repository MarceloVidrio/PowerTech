<template>
  <v-app> <div class="main"></div>
  <!-- Contenido de cada vista -->
  <div class="page">
  <router-view :key="$route.fullPath" />
  </div>

  <!-- Toast (notificaciones) -->
  <div class="toast-container">
    <v-alert
    v-if="toast"
    :type="toast.color"
    
    border="start"
    elevation="2"
    class="mb-2"
>
      {{ toast.message }}
    </v-alert>
  </div>

  <!-- Menú global inferior -->
  <Menu />
  <!-- ChatBot -->
  <ChatBot v-if="!userStore.esSuperAdmin" />
  </v-app>
</template>

<script setup>
import { onBeforeUnmount } from "vue";
import { storeToRefs } from "pinia";
import { useNotifyStore } from "@/stores/notify";
import { useUserStore } from "@/stores/users";
import { useAlarmStore } from "@/stores/alarms";
import { iniciarTiempoReal } from "@/utils/tiempoReal";
import Menu from "@/components/Menu.vue";
import ChatBot from "./views/ChatBot.vue";

const notify = useNotifyStore();
const userStore = useUserStore();
const { toast } = storeToRefs(notify);

// Alarmas en tiempo real mientras haya una sesión abierta
const tiempoReal = iniciarTiempoReal({ userStore, alarmStore: useAlarmStore(), notify });
onBeforeUnmount(() => tiempoReal.cerrar());
</script>

<style>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 280px;
  z-index: 9999;
}

/* Para que el menú fijo no tape el contenido */
.page {
  padding-bottom: 112px; /* ajusta si tu menú es más alto */
}

/* Fondo azul bajito para TODAS las vistas */
body,
.v-application {
  background-color: #f6f9f7;
}
</style>
