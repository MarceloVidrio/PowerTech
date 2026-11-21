import { createRouter, createWebHistory } from 'vue-router'

import { useUserStore } from "@/stores/users"

// Vistas
const Home = () => import('@/views/Home.vue')
const Login = () => import('@/views/Login.vue')
const Signup = () => import('@/views/Signup.vue')
const Recover = () => import('@/views/Recover.vue')
const Monitoring = () => import('@/views/Monitoring.vue')
const Notifications = () => import('@/views/Notifications.vue')
const Others = () => import('@/views/Others.vue')
const Buildings = () => import('@/views/Buildings.vue')
const Reports = () => import('@/views/Reports.vue')
const Rooms = () => import('@/views/Rooms.vue')
const Devices = () => import('@/views/Devices.vue')
const ReportSelection = () => import('@/views/ReportSelection.vue')
const Sensors = () => import('@/views/Sensors.vue')
const ReciboInfo = () => import('@/views/ReciboInfo.vue')
const ReciboReporte = () => import('@/views/ReciboReporte.vue')
const AllDevices = () => import('@/views/AllDevices.vue')
const Team = () => import('@/views/Team.vue')
const Admin = () => import('@/views/Admin.vue')
const AdminUsuario = () => import('@/views/AdminUsuario.vue')

const routes = [

  // Página principal
  {
    path: '/',
    name: 'home',
    component: Home,
    meta: { requiresAuth: true }
  },

  // Inicio de sesión
  {
    path: '/login',
    name: 'login',
    component: Login
  },

  // Crear cuenta
  {
    path: '/signup',
    name: 'signup',
    component: Signup
  },

  // Recuperar contraseña
  // NO requiere autenticación
  {
    path: '/recover',
    name: 'recover',
    component: Recover
  },

  // Monitoreo
  {
    path: '/monitoring',
    name: 'monitoring',
    component: Monitoring,
    meta: { requiresAuth: true }
  },

  // Todos los dispositivos
  {
    path: '/all-devices',
    name: 'all-devices',
    component: AllDevices,
    meta: { requiresAuth: true }
  },

  // Notificaciones
  {
    path: '/notifications',
    name: 'notifications',
    component: Notifications,
    meta: { requiresAuth: true }
  },

  // Otros
  {
    path: '/others',
    name: 'others',
    component: Others,
    meta: { requiresAuth: true }
  },

  // Técnicos de la empresa (solo administrador)
  {
    path: '/equipo',
    name: 'team',
    component: Team,
    meta: { requiresAuth: true, soloAdmin: true }
  },

  // Panel del administrador del sistema (solo SUPERADMIN)
  {
    path: '/admin',
    name: 'admin',
    component: Admin,
    meta: { requiresAuth: true, soloSuperAdmin: true }
  },
  {
    path: '/admin/usuarios/:id',
    name: 'admin-usuario',
    component: AdminUsuario,
    meta: { requiresAuth: true, soloSuperAdmin: true }
  },

  // Edificios
  {
    path: '/buildings',
    name: 'buildings',
    component: Buildings,
    meta: { requiresAuth: true }
  },

  // Salas
  {
    path: '/rooms/:id',
    name: 'rooms',
    component: Rooms,
    meta: { requiresAuth: true }
  },

  // Dispositivos de una sala
  {
    path: '/devices/:id',
    name: 'devices',
    component: Devices,
    meta: { requiresAuth: true }
  },

  // Sensores
  {
    path: '/sensors',
    name: 'sensors',
    component: Sensors,
    meta: { requiresAuth: true }
  },

  // Selección de reportes
  {
    path: '/reports/selection',
    name: 'report-selection',
    component: ReportSelection,
    meta: { requiresAuth: true }
  },

  // Reportes
  {
    path: '/reports/:buildingId/:roomId',
    name: 'reports',
    component: Reports,
    meta: { requiresAuth: true }
  },

  // Información de recibo
  {
    path: '/reciboInfo',
    name: 'reciboInfo',
    component: ReciboInfo,
    meta: { requiresAuth: true }
  },

  {
  path: '/reciboReporte',
  name: 'reciboReporte',
  component: ReciboReporte,
  meta: { requiresAuth: true }
  }

]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// --- GUARDIÁN DE NAVEGACIÓN ---

router.beforeEach((to, from, next) => {

  const userStore = useUserStore()

  const isAuthenticated = !!userStore.usuario

  // Si la página requiere autenticación
  // y el usuario no ha iniciado sesión,
  // lo mandamos al login.
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'login' })
  } else if (isAuthenticated && userStore.esSuperAdmin && !to.meta.soloSuperAdmin) {
    // El administrador del sistema no tiene edificios propios: siempre va a su panel
    next({ name: 'admin' })
  } else if (to.meta.soloSuperAdmin && !userStore.esSuperAdmin) {
    next({ name: 'home' })
  } else if (to.meta.soloAdmin && !userStore.esAdmin) {
    next({ name: 'home' })
  } else if (isAuthenticated && ['login', 'signup'].includes(to.name)) {
    next({ name: 'home' })
  } else {
    next()
  }

})

export default router