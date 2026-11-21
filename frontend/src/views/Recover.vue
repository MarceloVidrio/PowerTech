<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">

        <v-card
          class="pa-6 border-multicolor"
          elevation="3"
          rounded="lg"
        >

          <!-- Logo -->
          <div class="d-flex justify-center mb-4">
            <v-img
              src="/logo.png"
              alt="PowerTech"
              max-width="180"
              contain
            />
          </div>

          <!-- Título -->
          <h2 class="text-center mb-2">
            Recuperar contraseña
          </h2>

          <!-- PASO 1 -->
          <template v-if="paso === 1">

            <p class="text-center text-grey-darken-1 mb-6">
              Ingresa tu correo electrónico y te enviaremos un código de recuperación.
            </p>

            <v-form @submit.prevent="solicitarCodigo">

              <v-text-field
                v-model="email"
                label="Correo electrónico"
                type="email"
                variant="outlined"
                prepend-inner-icon="mdi-email"
                class="mb-4"
                required
              />

              <v-btn
                type="submit"
                block
                size="large"
                color="#478D4B"
                :loading="loading"
              >
                Enviar código
              </v-btn>

            </v-form>

          </template>

          <!-- PASO 2 -->
          <template v-else-if="paso === 2">

            <p class="text-center text-grey-darken-1 mb-6">
              Ingresa el código de 6 dígitos que enviamos a tu correo.
            </p>

            <v-form @submit.prevent="verificarCodigo">

              <v-text-field
                v-model="codigo"
                label="Código de verificación"
                variant="outlined"
                prepend-inner-icon="mdi-shield-key"
                maxlength="6"
                class="mb-4"
                required
              />

              <v-btn
                type="submit"
                block
                size="large"
                color="#478D4B"
                :loading="loading"
              >
                Verificar código
              </v-btn>

            </v-form>

            <div class="text-center mt-4">
              <button
                type="button"
                class="volver-link"
                @click="paso = 1"
              >
                ← Cambiar correo
              </button>
            </div>

          </template>

          <!-- PASO 3 -->
          <template v-else>

            <p class="text-center text-grey-darken-1 mb-6">
              Crea una nueva contraseña para tu cuenta.
            </p>

            <v-form @submit.prevent="cambiarContrasena">

              <!-- Nueva contraseña -->
              <v-text-field
                v-model="nuevaContrasena"
                label="Nueva contraseña"
                :type="mostrarContrasena ? 'text' : 'password'"
                variant="outlined"
                prepend-inner-icon="mdi-lock"
                :append-inner-icon="
                  mostrarContrasena
                    ? 'mdi-eye-off'
                    : 'mdi-eye'
                "
                @click:append-inner="
                  mostrarContrasena = !mostrarContrasena
                "
                class="mb-2"
                required
              />

              <!-- Confirmar contraseña -->
              <v-text-field
                v-model="confirmarContrasena"
                label="Confirmar nueva contraseña"
                :type="
                  mostrarConfirmacion
                    ? 'text'
                    : 'password'
                "
                variant="outlined"
                prepend-inner-icon="mdi-lock-check"
                :append-inner-icon="
                  mostrarConfirmacion
                    ? 'mdi-eye-off'
                    : 'mdi-eye'
                "
                @click:append-inner="
                  mostrarConfirmacion = !mostrarConfirmacion
                "
                class="mb-4"
                required
              />

              <v-btn
                type="submit"
                block
                size="large"
                color="#478D4B"
                :loading="loading"
              >
                Cambiar contraseña
              </v-btn>

            </v-form>

          </template>

          <!-- Regresar -->
          <div class="text-center mt-5">
            <router-link
              to="/login"
              class="login-link"
            >
              ← Regresar al inicio de sesión
            </router-link>
          </div>

        </v-card>

      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";

const router = useRouter();

const paso = ref(1);

const email = ref("");
const codigo = ref("");

const nuevaContrasena = ref("");
const confirmarContrasena = ref("");

const mostrarContrasena = ref(false);
const mostrarConfirmacion = ref(false);

const loading = ref(false);


// ==========================================
// PASO 1
// SOLICITAR CÓDIGO
// ==========================================

const solicitarCodigo = async () => {

  if (!email.value.trim()) {
    alert("Ingresa tu correo electrónico.");
    return;
  }

  try {

    loading.value = true;

    const respuesta = await axios.post(
      "/user/recover",
      {
        email: email.value.trim()
      }
    );

    if (!respuesta.data.error) {

      alert(
        respuesta.data.mensaje ||
        "Si el correo está registrado, recibirás un código de verificación."
      );

      paso.value = 2;

    }

  } catch (error) {

    if (error.response?.data?.mensaje) {

      alert(error.response.data.detalles?.[0] || error.response.data.mensaje);

    } else {

      alert(
        "Ocurrió un error al solicitar el código."
      );

    }

  } finally {

    loading.value = false;

  }
};


// ==========================================
// PASO 2
// VERIFICAR CÓDIGO
// ==========================================

const verificarCodigo = async () => {

  if (!codigo.value.trim()) {
    alert("Ingresa el código de verificación.");
    return;
  }

  if (codigo.value.trim().length !== 6) {
    alert("El código debe tener 6 dígitos.");
    return;
  }

  try {

    loading.value = true;

    const respuesta = await axios.post(
      "/user/verify-code",
      {
        email: email.value.trim(),
        codigo: codigo.value.trim()
      }
    );

    if (!respuesta.data.error) {

      alert(
        "Código verificado correctamente."
      );

      paso.value = 3;

    }

  } catch (error) {

    if (error.response?.data?.mensaje) {

      alert(error.response.data.detalles?.[0] || error.response.data.mensaje);

    } else {

      alert(
        "Ocurrió un error al verificar el código."
      );

    }

  } finally {

    loading.value = false;

  }
};


// ==========================================
// PASO 3
// CAMBIAR CONTRASEÑA
// ==========================================

const cambiarContrasena = async () => {

  if (!nuevaContrasena.value.trim()) {
    alert("Ingresa una nueva contraseña.");
    return;
  }

  if (nuevaContrasena.value.length < 8) {
    alert(
      "La nueva contraseña debe tener mínimo 8 caracteres."
    );
    return;
  }

  if (!/[A-Za-z]/.test(nuevaContrasena.value) || !/\d/.test(nuevaContrasena.value)) {
    alert("La nueva contraseña debe incluir letras y números.");
    return;
  }

  if (
    nuevaContrasena.value !==
    confirmarContrasena.value
  ) {
    alert("Las contraseñas no coinciden.");
    return;
  }

  try {

    loading.value = true;

    const respuesta = await axios.post(
      "/user/reset-password",
      {
        email: email.value.trim(),
        codigo: codigo.value.trim(),
        nuevaContrasena:
          nuevaContrasena.value.trim()
      }
    );

    if (!respuesta.data.error) {

      alert(
        "Contraseña actualizada correctamente."
      );

      router.push("/login");

    }

  } catch (error) {

    if (error.response?.data?.mensaje) {

      alert(error.response.data.detalles?.[0] || error.response.data.mensaje);

    } else {

      alert(
        "Ocurrió un error al cambiar la contraseña."
      );

    }

  } finally {

    loading.value = false;

  }
};
</script>

<style scoped>

.border-multicolor {
  border: 4px solid #478D4B !important;
}

.login-link {
  color: #478D4B;
  text-decoration: none;
  font-weight: 500;
}

.login-link:hover {
  text-decoration: underline;
}

.volver-link {
  background: none;
  border: none;
  color: #478D4B;
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;
}

.volver-link:hover {
  text-decoration: underline;
}

</style>