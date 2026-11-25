<template>
  <v-container class="fill-height bg-transparent" fluid>
    <v-row justify="center" align="center">
      <v-col cols="12" sm="8" md="5" lg="4">

        <v-card
          class="pa-6 border-powertech"
          elevation="3"
          rounded="lg"
        >

          <!-- Logo -->
          <div class="d-flex justify-center mb-4">
            <v-img
              src="/logopower.png"
              alt="PowerTech"
              max-width="180"
              contain
            />
          </div>

          <!-- Título -->
          <h1 class="text-center font-weight-bold mb-1">
            Crea la cuenta de tu hogar
          </h1>
          <p class="text-center text-body-2 text-grey-darken-1 mb-6">
            Serás el titular: después podrás invitar a tu familia para que consulte el consumo.
          </p>

          <!-- Formulario -->
          <v-form
            ref="formRef"
            v-model="esValido"
            @submit.prevent="registrar"
          >

            <!-- Nombre -->
            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1">
              Nombre Completo
            </div>

            <v-text-field
              v-model="nombre"
              placeholder="Tu nombre"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              :rules="reglas.nombre"
              prepend-inner-icon="mdi-account"
              required
            />

            <!-- Correo -->
            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2">
              Correo Electrónico
            </div>

            <v-text-field
              v-model="email"
              placeholder="nombre@ejemplo.com"
              type="email"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              :rules="reglas.email"
              prepend-inner-icon="mdi-email"
              required
            />

            <!-- Contraseña -->
            <div class="text-subtitle-2 font-weight-bold mb-1 ml-1 mt-2">
              Contraseña
            </div>

            <v-text-field
              v-model="contrasena"
              :type="mostrarContrasena ? 'text' : 'password'"
              placeholder="••••••••"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              :rules="reglas.contrasena"
              prepend-inner-icon="mdi-lock"
              :append-inner-icon="
                mostrarContrasena
                  ? 'mdi-eye-off'
                  : 'mdi-eye'
              "
              @click:append-inner="
                mostrarContrasena = !mostrarContrasena
              "
              required
            />

            <!-- Botón -->
            <v-btn
              block
              size="large"
              color="#478D4B"
              class="text-none rounded-pill mt-4 mb-4"
              :loading="loading"
              :disabled="!esValido"
              type="submit"
            >
              Crear cuenta
            </v-btn>

          </v-form>

          <!-- Iniciar sesión -->
          <div class="text-center mt-4">
            <span class="text-caption text-grey-darken-1">
              ¿Ya tienes una cuenta?
            </span>

            <br />

            <v-btn
              variant="text"
              class="text-none text-caption font-weight-bold pa-0"
              color="#478D4B"
              :to="{ name: 'login' }"
            >
              Iniciar Sesión
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
const userStore = useUserStore();
const notify = useNotifyStore();

const { loading } = storeToRefs(userStore);

const formRef = ref(null);
const esValido = ref(false);

const nombre = ref("");
const email = ref("");
const contrasena = ref("");

const mostrarContrasena = ref(false);

const reglas = {
  nombre: [
    v => !!v || "El nombre es obligatorio",
    v => v.length <= 50 || "Máximo 50 caracteres"
  ],

  email: [
    v => !!v || "El correo es obligatorio",
    v => /.+@.+\..+/.test(v) || "Correo no válido"
  ],

  contrasena: [
    v => !!v || "La contraseña es obligatoria",
    v => v.length >= 8 || "Mínimo 8 caracteres",
    v => (/[A-Za-z]/.test(v) && /\d/.test(v)) || "Debe incluir letras y números"
  ]
};

const registrar = async () => {

  const { valid } = await formRef.value.validate();

  if (!valid) return;

  const datos = {
    nombre: nombre.value.trim(),
    email: email.value.trim(),
    contrasena: contrasena.value.trim()
  };

  await userStore.agregarUsuario({
    datos,

    onComplete: () => {
      notify.show(
        "Cuenta creada exitosamente",
        "success"
      );

      router.push("/login");
    },

    onError: (error) => {
      const msg =
        error.response?.data?.detalles?.[0] ||
        error.response?.data?.mensaje ||
        "Ya existe este usuario";

      notify.show(msg, "error");
    }
  });
};
</script>

<style scoped>

.border-powertech {
  border: 4px solid #478D4B !important;
}

:deep(.v-field__outline) {
  --v-field-border-opacity: 0.25;
}

</style>