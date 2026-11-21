<!-- Muestra UNA sola vez la contraseña temporal generada por el administrador. -->
<template>
  <v-dialog :model-value="!!modelValue" max-width="420px" persistent>
    <v-card v-if="modelValue" class="rounded-xl pa-4">
      <v-card-title class="text-h6 font-weight-bold text-center" style="color: #478D4B;">Contraseña temporal</v-card-title>
      <v-card-text class="text-center">
        <p class="text-body-2 mb-3">Compártela con <strong>{{ modelValue.usuario }}</strong> por un medio seguro.
          Solo se muestra esta vez; luego podrá cambiarla con «¿Olvidaste tu contraseña?».</p>
        <div class="clave">{{ modelValue.contrasena }}</div>
      </v-card-text>
      <v-card-actions>
        <v-btn variant="text" class="text-none" prepend-icon="mdi-content-copy" @click="copiar">{{ copiado ? 'Copiada' : 'Copiar' }}</v-btn>
        <v-spacer />
        <v-btn color="green-darken-2" variant="flat" class="text-none rounded-pill px-6" @click="cerrar">Listo</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref } from 'vue'
const props = defineProps({ modelValue: { type: Object, default: null } });
const emit = defineEmits(['update:modelValue']);
const copiado = ref(false);
const copiar = async () => {
  try { await navigator.clipboard.writeText(props.modelValue.contrasena); copiado.value = true; } catch { copiado.value = false; }
};
const cerrar = () => { copiado.value = false; emit('update:modelValue', null); };
</script>

<style scoped>
.clave { font-family: ui-monospace, Consolas, monospace; font-size: 26px; font-weight: 700; letter-spacing: 2px;
  background: #f1f6f2; color: #28633a; border-radius: 10px; padding: 14px; user-select: all; }
</style>
