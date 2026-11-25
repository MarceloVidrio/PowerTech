<template>
  <div class="copilot-container">
    <v-navigation-drawer
      v-model="isOpen"
      location="right"
      width="420"
      temporary
      elevation="8"
      class="powerbot-drawer border-s"
    >
      <div class="d-flex flex-column h-100 bg-surface">

        <!-- ===================================================== -->
        <!-- CABECERA -->
        <!-- ===================================================== -->

        <div class="bot-header pa-4 text-white elevation-2">

          <div class="d-flex align-center justify-space-between mb-3">

            <div class="d-flex align-center">

              <v-avatar
                size="44"
                class="bg-white elevation-2 mr-3"
              >
                <v-icon
                  color="green-darken-3"
                  size="28"
                >
                  mdi-lightning-bolt
                </v-icon>
              </v-avatar>

              <div>

                <h2 class="text-h6 font-weight-bold mb-0 leading-tight">
                  PowerBot
                </h2>

                <span
                  class="text-caption text-green-lighten-4 d-flex align-center"
                >
                  <v-icon
                    size="12"
                    color="green-lighten-2"
                    class="mr-1"
                  >
                    mdi-circle
                  </v-icon>

                  Análisis energético en línea
                </span>

              </div>

            </div>

            <v-btn
              icon="mdi-close"
              variant="text"
              color="white"
              aria-label="Cerrar PowerBot" @click="isOpen = false"
              size="small"
            />

          </div>


          <!-- SUGERENCIAS -->

          <v-slide-group
            show-arrows
            class="mt-2"
            v-if="mensajes.length === 1"
          >

            <v-slide-group-item
              v-for="sug in sugerenciasRapidas"
              :key="sug"
            >

              <v-chip
                size="small"
                class="mr-2 bg-green-darken-1 text-white action-chip"
                @click="usarSugerencia(sug)"
              >
                {{ sug }}
              </v-chip>

            </v-slide-group-item>

          </v-slide-group>

        </div>


        <!-- ===================================================== -->
        <!-- CONVERSACIÓN -->
        <!-- ===================================================== -->

        <v-card-text
          ref="chatContainer"
          class="chat-body flex-grow-1 overflow-y-auto pa-4 bg-grey-lighten-4"
        >

          <div
            v-for="msg in mensajes"
            :key="msg.id"
            :class="[
              'd-flex mb-5',
              msg.esBot ? 'justify-start bot-row' : 'justify-end user-row'
            ]"
          >

            <!-- ICONO DEL BOT -->

            <v-avatar
              v-if="msg.esBot"
              size="32"
              color="green-lighten-5"
              class="mr-3 mt-1 border bot-avatar"
            >
              <v-icon
                size="20"
                color="green-darken-3"
              >
                mdi-robot-outline
              </v-icon>
            </v-avatar>


            <!-- MENSAJE -->

            <div
              :class="[
                'message-bubble pa-4 text-body-2',
                msg.esBot
                  ? 'bot-message rounded-te-xl rounded-b-xl'
                  : 'user-message rounded-ts-xl rounded-b-xl'
              ]"
            >

              <!-- RESPUESTA DEL BOT -->

              <div
                v-if="msg.esBot"
                v-html="renderMarkdown(msg.texto)"
                class="markdown-content"
              ></div>


              <!-- MENSAJE DEL USUARIO -->

              <div
                v-else
                class="text-white user-text"
              >
                {{ msg.texto }}
              </div>

            </div>

          </div>


          <!-- ================================================= -->
          <!-- INDICADOR DE ESCRITURA -->
          <!-- ================================================= -->

          <div
            v-if="cargando"
            class="d-flex align-center mb-4 pl-2"
          >

            <v-avatar
              size="32"
              color="transparent"
              class="mr-3"
            >

              <v-progress-circular
                indeterminate
                color="green-darken-2"
                size="20"
                width="2"
              />

            </v-avatar>

            <span
              class="text-caption text-grey-darken-1 font-italic"
            >
              Revisando el consumo de tu casa...
            </span>

          </div>

        </v-card-text>


        <v-divider />


        <!-- ===================================================== -->
        <!-- INPUT -->
        <!-- ===================================================== -->

        <div class="pa-4 bg-white">

          <v-text-field
            v-model="nuevoMensaje"
            placeholder="Pregunta sobre consumos, tarifas o anomalías..."
            variant="outlined"
            color="green-darken-2"
            density="comfortable"
            rounded="xl"
            hide-details
            bg-color="grey-lighten-5"
            @keyup.enter="enviarMensaje"
          >

            <template v-slot:append-inner>

              <v-scale-transition>

                <v-btn
                  v-if="nuevoMensaje"
                  icon="mdi-arrow-up"
                  color="green-darken-3"
                  size="small"
                  variant="flat"
                  class="ml-2"
                  :loading="cargando"
                  @click="enviarMensaje"
                />

              </v-scale-transition>

            </template>

          </v-text-field>


          <div class="text-center mt-2">

            <span class="text-micro text-grey">
              PowerBot puede cometer errores. Verifica las lecturas.
            </span>

          </div>

        </div>

      </div>

    </v-navigation-drawer>


    <!-- ===================================================== -->
    <!-- BOTÓN FLOTANTE -->
    <!-- ===================================================== -->

    <v-fab-transition>

      <v-btn
        v-if="!isOpen"
        color="green-darken-3"
        icon="mdi-robot-outline"
        size="x-large"
        class="floating-trigger energy-pulse"
        aria-label="Abrir PowerBot" @click="isOpen = true"
      />

    </v-fab-transition>

  </div>
</template>


<script setup>

import { ref, nextTick } from 'vue';
import axios from 'axios';
import MarkdownIt from 'markdown-it';


// ============================================================
// MARKDOWN
// ============================================================

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true
});


// ============================================================
// ESTADO
// ============================================================

const isOpen = ref(false);

const nuevoMensaje = ref('');

const cargando = ref(false);

const chatContainer = ref(null);


// ============================================================
// SUGERENCIAS
// ============================================================

const sugerenciasRapidas = [

  "¿Cuánto voy a pagar este bimestre?",

  "¿Qué aparato gasta más en mi casa?",

  "Dame 3 consejos para bajar mi recibo"

];


// ============================================================
// MENSAJES
// ============================================================

const mensajes = ref([

  {
    id: 1,

    texto:
      '¡Hola! Soy **PowerBot**. Conozco el consumo de tu casa y tu tarifa de CFE. ¿En qué te ayudo?',

    esBot: true
  }

]);


// ============================================================
// RENDER MARKDOWN
// ============================================================

const renderMarkdown = (texto) => {

  if (!texto) return '';

  return md.render(texto);

};


// ============================================================
// USAR SUGERENCIA
// ============================================================

const usarSugerencia = (texto) => {

  nuevoMensaje.value = texto;

  enviarMensaje();

};


// ============================================================
// ENVIAR MENSAJE
// ============================================================

const enviarMensaje = async () => {

  if (
    !nuevoMensaje.value.trim() ||
    cargando.value
  ) {
    return;
  }


  const userText = nuevoMensaje.value;


  // Agregar mensaje del usuario

  mensajes.value.push({

    id: Date.now(),

    texto: userText,

    esBot: false

  });


  nuevoMensaje.value = '';

  cargando.value = true;


  await scrollToBottom();


  try {

    const res = await axios.post(
      '/api/ai/consejo',
      {
        datos: {
          consulta: userText
        }
      }
    );


    mensajes.value.push({

      id: Date.now() + 1,

      texto: res.data.mensaje,

      esBot: true

    });


  } catch (e) {

    console.error(
      'Error PowerBot:',
      e
    );


    mensajes.value.push({

      id: Date.now() + 1,

      texto:
        '⚠️ ' + (e.response?.data?.mensaje || 'No pude procesar la consulta en este momento. Intenta nuevamente.'),

      esBot: true

    });


  } finally {

    cargando.value = false;

    await scrollToBottom();

  }

};


// ============================================================
// SCROLL AUTOMÁTICO
// ============================================================

const scrollToBottom = async () => {

  await nextTick();


  if (chatContainer.value) {

    const el =
      chatContainer.value.$el ||
      chatContainer.value;


    el.scrollTo({

      top: el.scrollHeight,

      behavior: 'smooth'

    });

  }

};

</script>


<style scoped>

/* ============================================================
   CONTENEDOR
   ============================================================ */

.copilot-container {

  z-index: 1000;

}


/* ============================================================
   BOTÓN FLOTANTE
   ============================================================ */

.floating-trigger {

  position: fixed;

  bottom: 100px;

  right: 30px;

  z-index: 999;

}


@keyframes glowing-energy {

  0% {

    box-shadow:
      0 0 0 0
      rgba(46, 125, 50, 0.6);

  }

  70% {

    box-shadow:
      0 0 0 15px
      rgba(46, 125, 50, 0);

  }

  100% {

    box-shadow:
      0 0 0 0
      rgba(46, 125, 50, 0);

  }

}


.energy-pulse {

  animation:
    glowing-energy
    2s infinite;

  border:
    2px solid #a5d6a7;

}


/* ============================================================
   DRAWER
   ============================================================ */

.powerbot-drawer {

  border-left:
    1px solid rgba(0, 0, 0, 0.08);

}


/* ============================================================
   HEADER
   ============================================================ */

.bot-header {

  background:
    linear-gradient(
      -45deg,
      #1b5e20,
      #2e7d32,
      #43a047,
      #1b5e20
    );

  background-size: 400% 400%;

  animation:
    gradientFlow
    8s ease infinite;

  border-bottom:
    2px solid rgba(255, 255, 255, 0.2);

}


@keyframes gradientFlow {

  0% {

    background-position:
      0% 50%;

  }

  50% {

    background-position:
      100% 50%;

  }

  100% {

    background-position:
      0% 50%;

  }

}


/* ============================================================
   CHAT
   ============================================================ */

.chat-body {

  min-width: 0;

  overflow-x: hidden;

}


/* ============================================================
   FILAS
   ============================================================ */

.bot-row {

  width: 100%;

  min-width: 0;

}


.user-row {

  width: 100%;

}


/* ============================================================
   BURBUJAS
   ============================================================ */

.message-bubble {

  min-width: 0;

  max-width: calc(100% - 44px);

  line-height: 1.55;

  overflow-wrap: break-word;

  word-break: normal;

}


.bot-message {

  background-color:
    #ffffff;

  color:
    #374151;

  border:
    none !important;

  border-left:
    4px solid #43a047 !important;

  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;

  width: 100%;

  max-width: calc(100% - 44px);

  overflow: hidden;

}


.user-message {

  background:
    linear-gradient(
      135deg,
      #43a047 0%,
      #2e7d32 100%
    );

  box-shadow:
    0 4px 6px -1px rgba(46, 125, 50, 0.4) !important;

  max-width: 82%;

}


/* ============================================================
   TEXTO DEL USUARIO
   ============================================================ */

.user-text {

  white-space: pre-wrap;

  overflow-wrap: break-word;

}


/* ============================================================
   MARKDOWN GENERAL
   ============================================================ */

.markdown-content {

  width: 100%;

  max-width: 100%;

  min-width: 0;

  overflow-wrap: break-word;

  word-break: normal;

}


.markdown-content :deep(p) {

  margin-top: 0;

  margin-bottom: 10px;

  line-height: 1.55;

}


.markdown-content :deep(p:last-child) {

  margin-bottom: 0;

}


/* ============================================================
   TÍTULOS
   ============================================================ */

.markdown-content :deep(h1) {

  font-size: 1.25rem;

  line-height: 1.3;

  margin-top: 0;

  margin-bottom: 12px;

  color: #1b5e20;

}


.markdown-content :deep(h2) {

  font-size: 1.12rem;

  line-height: 1.3;

  margin-top: 0;

  margin-bottom: 10px;

  color: #1b5e20;

}


.markdown-content :deep(h3) {

  font-size: 1rem;

  line-height: 1.3;

  margin-top: 0;

  margin-bottom: 9px;

  color: #1b5e20;

}


/* ============================================================
   NEGRITAS
   ============================================================ */

.markdown-content :deep(strong) {

  color:
    #1b5e20;

  font-weight:
    700;

}


/* ============================================================
   LISTAS
   ============================================================ */

.markdown-content :deep(ul),
.markdown-content :deep(ol) {

  padding-left: 20px;

  margin-top: 6px;

  margin-bottom: 12px;

}


.markdown-content :deep(li) {

  margin-bottom: 5px;

  padding-left: 2px;

  line-height: 1.5;

}


/* ============================================================
   TABLAS
   ============================================================ */

.markdown-content :deep(table) {

  width: 100% !important;

  max-width: 100% !important;

  table-layout: fixed !important;

  border-collapse: separate;

  border-spacing: 0;

  margin: 10px 0 14px 0;

  font-size: 11px;

  overflow: hidden;

  border:
    1px solid #e5e7eb;

  border-radius:
    10px;

}


/* ENCABEZADOS */

.markdown-content :deep(thead) {

  background:
    #f1f8f2;

}


.markdown-content :deep(th) {

  color:
    #1b5e20;

  font-weight:
    700;

  text-align:
    left;

  padding:
    7px 5px;

  border-bottom:
    1px solid #d7e8d9;

  line-height:
    1.25;

  white-space:
    normal;

  overflow-wrap:
    normal;

  word-break:
    normal;

}


/* CELDAS */

.markdown-content :deep(td) {

  padding:
    7px 5px;

  border-bottom:
    1px solid #eeeeee;

  line-height:
    1.3;

  vertical-align:
    middle;

  white-space:
    normal;

  overflow-wrap:
    normal;

  word-break:
    normal;

}


/* ÚLTIMA FILA */

.markdown-content :deep(tbody tr:last-child td) {

  border-bottom:
    none;

}


/* COLUMNAS */

.markdown-content :deep(th:first-child),
.markdown-content :deep(td:first-child) {

  width:
    7%;

}


.markdown-content :deep(th:nth-child(2)),
.markdown-content :deep(td:nth-child(2)) {

  width:
    22%;

}


.markdown-content :deep(th:nth-child(3)),
.markdown-content :deep(td:nth-child(3)) {

  width:
    27%;

}


.markdown-content :deep(th:nth-child(4)),
.markdown-content :deep(td:nth-child(4)) {

  width:
    22%;

}


.markdown-content :deep(th:nth-child(5)),
.markdown-content :deep(td:nth-child(5)) {

  width:
    22%;

}


/* ============================================================
   CÓDIGO
   ============================================================ */

.markdown-content :deep(code) {

  background:
    #f1f5f3;

  color:
    #1b5e20;

  padding:
    2px 5px;

  border-radius:
    5px;

  font-size:
    0.85em;

}


.markdown-content :deep(pre) {

  background:
    #f5f7f6;

  border:
    1px solid #e2e8e4;

  border-radius:
    8px;

  padding:
    10px;

  overflow-x:
    auto;

  margin:
    10px 0;

}


/* ============================================================
   SEPARADORES
   ============================================================ */

.markdown-content :deep(hr) {

  border:
    none;

  border-top:
    1px solid #e5e7eb;

  margin:
    12px 0;

}


/* ============================================================
   ENLACES
   ============================================================ */

.markdown-content :deep(a) {

  color:
    #2e7d32;

  font-weight:
    600;

  text-decoration:
    none;

}


.markdown-content :deep(a:hover) {

  text-decoration:
    underline;

}


/* ============================================================
   SUGERENCIAS
   ============================================================ */

.action-chip {

  cursor:
    pointer;

  transition:
    all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  border:
    1px solid rgba(255, 255, 255, 0.3) !important;

}


.action-chip:hover {

  background-color:
    #ffffff !important;

  color:
    #1b5e20 !important;

  transform:
    translateY(-2px);

  box-shadow:
    0 4px 12px
    rgba(255, 255, 255, 0.4);

}


/* ============================================================
   TEXTO INFERIOR
   ============================================================ */

.text-micro {

  font-size:
    0.65rem;

}

</style>