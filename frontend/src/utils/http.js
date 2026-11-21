// Configuración global de axios: agrega el token de sesión a cada petición
// y cierra la sesión si el backend responde 401 (token vencido o inválido).
import axios from "axios";

export function configurarHttp({ userStore, router, notify }) {
  axios.interceptors.request.use((config) => {
    const token = userStore.token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  axios.interceptors.response.use(
    (res) => res,
    (error) => {
      const status = error.response?.status;
      const url = error.config?.url || "";
      const esLogin = url.includes("/user/login");
      if (status === 401 && !esLogin && userStore.usuario) {
        userStore.logout();
        notify?.show("Tu sesión expiró. Inicia sesión de nuevo.", "error");
        router.push({ name: "login" });
      }
      return Promise.reject(error);
    }
  );
}
