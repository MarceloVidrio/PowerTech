<template>
  <v-container class="fill-height bg-transparent" fluid>
    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="4" lg="3">
        <!-- Forma de la carta y elevación (más elevado significa más sombra)-->
        <v-card class="pa-8 rounded-xl" elevation="1">
          
          <div class="text-center mb-8">
            <!-- v-avatar muestra el logo en forma circular, y v-icon es ícono en forma de rayo-->
            <v-avatar color="white" size="80" class="elevation-1 border-multicolor">
           <v-img
            src="/logopower.png"
           alt="PowerTech"
    contain
  />
</v-avatar>
            <h1 class="text-h4 font-weight-bold mt-4" style="color: #478D4B;">PowerTech Hogar</h1>
            <p class="text-body-2 text-grey-darken-1 mt-1">Conoce y baja el consumo de luz de tu casa</p>
          </div>

          <v-form ref="formRef" v-model="esValido" @submit.prevent="login">
            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1">Correo Electrónico</div>
            <!--Rounded es un border-radius para hacerlo ovalado-->
            <!-- Email -->
            <v-text-field
              v-model="email"
              placeholder="nombre@ejemplo.com"
              variant="outlined"
              density="comfortable"
              rounded="lg" 
              :rules="reglas.email"
              required
            />

            <!-- Contraseña -->
            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2">Contraseña</div>
            <v-text-field
              v-model="contrasena"
              type="password"
              placeholder="••••••••"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              :rules="reglas.contrasena"
              required
            />

            <!-- Link para la contraseña olvidada -->
            <div class="text-left mb-6">
              <router-link to="/recover" class="text-caption font-weight-bold text-decoration-none" style="color: #478D4B;">
                ¿Olvidaste tu contraseña?
              </router-link>
            </div>

            <!-- Botón para iniciar sesión -->
            <v-btn
              block
              size="large"
              color="#478D4B"
              class="text-none rounded-pill mb-4"
              :loading="loading"
              :disabled="!esValido"
              type="submit"
            >
              Iniciar sesión
            </v-btn>
          </v-form>

          <!-- Hipervínculo para el registro-->
          <div class="text-center mt-4">
            <span class="text-caption text-grey-darken-1">¿Aún no tienes una cuenta?</span>
            <br />
            <v-btn 
              variant="text" 
              class="text-none text-caption font-weight-bold pa-0" 
              color="#478D4B"
              :to="{name: 'signup'}"
            >
              Crear una cuenta
            </v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useUserStore } from "@/stores/users";
import { useNotifyStore } from "@/stores/notify";

const router = useRouter();
const userStore = useUserStore(); // Instanciamos el store de usuario
const notify = useNotifyStore();
const { loading } = storeToRefs(userStore); // Obtenemos el estado de carga del store correcto

const formRef = ref(null);
const esValido = ref(false);

const email = ref("");
const contrasena = ref("");

const reglas = {
  email: [v => !!v || "El correo es obligatorio", v => /.+@.+\..+/.test(v) || "Correo no válido"],
  contrasena: [v => !!v || "La contraseña es obligatoria", v => v.length >= 6 || "Mínimo 6 caracteres"]
};


const login = async () => {
  const { valid } = await formRef.value.validate();
  if (!valid) return;

  // Preparamos los datos con las claves que espera userController (email y contrasena)
  const datos = {
    email: email.value.trim(),
    contrasena: contrasena.value.trim(),
  };

  // Llamamos a la acción de login en el store
  await userStore.login({
    datos,
    onComplete: (response) => {
      const msg = response.data?.mensaje || "Sesión iniciada";
      notify.show(msg, "success");
      // Redirigimos al root (home) tras el éxito
      router.push("/"); 
    },
    onError: (error) => {
      console.error(error);
      const msg = error.response?.data?.mensaje || "Error al iniciar sesión";
      notify.show(msg, "error");
    },
  });
};
</script>

<style scoped>
/* Simulación del borde multicolor de la imagen */

.border-multicolor {
  border: 4px solid #478D4B !important;
}

/* Estilo para que los inputs se sientan más "limpios" */
:deep(.v-field__outline) {
  --v-field-border-opacity: 0.15;
}
</style>