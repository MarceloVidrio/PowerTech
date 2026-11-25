import { createRouter, createWebHistory } from 'vue-router'

import { useUserStore } from "@/stores/users"

// Vistas
const Home = () => import('@/views/Home.vue')
const Login = () => import('@/views/Login.vue')
const Signup = () => import('@/views/Signup.vue')
const Recover = () => import('@/views/Recover.vue')
const Consumo = () => import('@/views/Consumo.vue')
const Notifications = () => import('@/views/Notifications.vue')
const Others = () => import('@/views/Others.vue')
const Aparatos = () => import('@/views/Aparatos.vue')
const Recibo = () => import('@/views/Recibo.vue')
const MiHogar = () => import('@/views/MiHogar.vue')
const Familia = () => import('@/views/Familia.vue')
const Admin = () => import('@/views/Admin.vue')
const AdminUsuario = () => import('@/views/AdminUsuario.vue')

// Nota: las rutas de las páginas no deben coincidir con las de la API
// (/api, /user, /alarm, /lecturas, /events), que Vite envía al backend.
const routes = [
  { path: '/', name: 'home', component: Home, meta: { requiresAuth: true } },
  { path: '/login', name: 'login', component: Login },
  { path: '/signup', name: 'signup', component: Signup },
  { path: '/recover', name: 'recover', component: Recover },

  // Hogar
  { path: '/consumo', name: 'consumo', component: Consumo, meta: { requiresAuth: true } },
  { path: '/aparatos', name: 'aparatos', component: Aparatos, meta: { requiresAuth: true } },
  { path: '/recibo', name: 'recibo', component: Recibo, meta: { requiresAuth: true } },
  { path: '/avisos', name: 'notifications', component: Notifications, meta: { requiresAuth: true } },
  { path: '/hogar', name: 'mi-hogar', component: MiHogar, meta: { requiresAuth: true } },
  { path: '/familia', name: 'familia', component: Familia, meta: { requiresAuth: true, soloTitular: true } },
  { path: '/mas', name: 'others', component: Others, meta: { requiresAuth: true } },

  // Panel del administrador del sistema (solo SUPERADMIN)
  { path: '/admin', name: 'admin', component: Admin, meta: { requiresAuth: true, soloSuperAdmin: true } },
  { path: '/admin/usuarios/:id', name: 'admin-usuario', component: AdminUsuario, meta: { requiresAuth: true, soloSuperAdmin: true } },

  // Cualquier otra ruta va al inicio
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// --- GUARDIÁN DE NAVEGACIÓN ---
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  const isAuthenticated = !!userStore.usuario

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'login' })
  } else if (isAuthenticated && userStore.esSuperAdmin && !to.meta.soloSuperAdmin) {
    // El administrador del sistema no tiene hogar: siempre va a su panel
    next({ name: 'admin' })
  } else if (to.meta.soloSuperAdmin && !userStore.esSuperAdmin) {
    next({ name: 'home' })
  } else if (to.meta.soloTitular && !userStore.esTitular) {
    next({ name: 'home' })
  } else if (isAuthenticated && ['login', 'signup'].includes(to.name)) {
    next({ name: 'home' })
  } else {
    next()
  }
})

export default router
