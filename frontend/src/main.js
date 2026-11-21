import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import { createPinia } from 'pinia';
import '@mdi/font/css/materialdesignicons.css'

import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import { configurarHttp } from './utils/http'
import { useUserStore } from './stores/users'
import { useNotifyStore } from './stores/notify'

const pinia = createPinia();

const vuetify = createVuetify({
  components,
  directives,
})

const app = createApp(App)
  .use(pinia)
  .use(router)
  .use(vuetify)

// Token en cada petición y cierre de sesión automático si expira
configurarHttp({ userStore: useUserStore(pinia), router, notify: useNotifyStore(pinia) })

app.mount('#app')
