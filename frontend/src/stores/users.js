import { defineStore } from "pinia";
import axios from "axios";
import { ref, computed } from "vue";
import { readStoredUser, saveStoredUser, tokenVencido } from "@/utils/userStorage";

export const useUserStore = defineStore("user", () => {
  const API_BASE = "";
  /* Al iniciar, intentamos recuperar la sesión del localStorage (si el token sigue vigente) */
  const guardado = readStoredUser(() => window.localStorage);
  const usuario = ref(guardado && !tokenVencido(guardado.token) ? guardado : null);
  if (guardado && !usuario.value) saveStoredUser(() => window.localStorage, null);

  const loading = ref(false);

  const token = computed(() => usuario.value?.token || null);
  // TITULAR = dueño de la cuenta del hogar (configura todo); FAMILIAR = solo consulta;
  // SUPERADMIN = administrador del sistema
  const esTitular = computed(() => (usuario.value?.rol || "TITULAR") === "TITULAR");
  const esFamiliar = computed(() => usuario.value?.rol === "FAMILIAR");
  const esSuperAdmin = computed(() => usuario.value?.rol === "SUPERADMIN");

  // POST /login → el backend responde { idUsuario, nombre, email, rol, token }
  const login = ({ datos, onComplete, onError }) => {
    loading.value = true;
    axios
      .post(`${API_BASE}/user/login`, datos)
      .then((res) => {
        const userData = res.data.data;
        usuario.value = userData;
        saveStoredUser(() => window.localStorage, userData);
        onComplete(res);
      })
      .catch(onError)
      .finally(() => (loading.value = false));
  };

  // POST /user
  const agregarUsuario = ({ datos, onComplete, onError }) => {
    loading.value = true;
    axios
      .post(`${API_BASE}/user`, datos)
      .then((res) => {
        if (onComplete) onComplete(res);
      })
      .catch(onError)
      .finally(() => (loading.value = false));
  };

  // Familia del hogar (solo el titular)
  const listarFamilia = () => axios.get(`${API_BASE}/user/familia`).then((res) => res.data.data);
  const crearFamiliar = (datos) => axios.post(`${API_BASE}/user/familia`, datos).then((res) => res.data);
  const eliminarFamiliar = (id) => axios.delete(`${API_BASE}/user/familia/${id}`).then((res) => res.data);

  // Cerrar sesión
  const logout = () => {
    usuario.value = null;
    saveStoredUser(() => window.localStorage, null);
  };

  return {
    usuario,
    token,
    esTitular,
    esFamiliar,
    esSuperAdmin,
    loading,
    login,
    listarFamilia,
    crearFamiliar,
    eliminarFamiliar,
    logout,
    agregarUsuario
  };
});
