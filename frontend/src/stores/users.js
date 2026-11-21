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

  const edificiosYSalas = ref([]);
  const loading = ref(false);

  const token = computed(() => usuario.value?.token || null);
  // ADMIN = dueño de la cuenta de una empresa; SUPERADMIN = administrador del sistema
  const esAdmin = computed(() => (usuario.value?.rol || "ADMIN") === "ADMIN");
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

  // GET /user/:id/perfil
  const obtenerDatosRelacionados = ({ id, onComplete, onError }) => {
    loading.value = true;
    axios
      .get(`${API_BASE}/user/${id}/perfil`)
      .then((res) => {
        edificiosYSalas.value = res.data.data;
        if (onComplete) onComplete(res);
      })
      .catch(onError)
      .finally(() => (loading.value = false));
  };

  // Técnicos de la empresa (solo administrador)
  const listarTecnicos = () => axios.get(`${API_BASE}/user/tecnicos`).then((res) => res.data.data);
  const crearTecnico = (datos) => axios.post(`${API_BASE}/user/tecnicos`, datos).then((res) => res.data);
  const eliminarTecnico = (id) => axios.delete(`${API_BASE}/user/tecnicos/${id}`).then((res) => res.data);

  // Cerrar sesión
  const logout = () => {
    usuario.value = null;
    edificiosYSalas.value = [];
    saveStoredUser(() => window.localStorage, null);
  };

  return {
    usuario,
    token,
    esAdmin,
    esSuperAdmin,
    edificiosYSalas,
    loading,
    login,
    obtenerDatosRelacionados,
    listarTecnicos,
    crearTecnico,
    eliminarTecnico,
    logout,
    agregarUsuario
  };
});
