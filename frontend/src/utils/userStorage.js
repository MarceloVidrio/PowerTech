// Storage may be unavailable or contain invalid JSON. Neither should prevent login.
// Una sesión válida necesita el id del usuario y el token emitido por el backend;
// las sesiones guardadas antes de usar tokens se descartan (hay que volver a entrar).
export function readStoredUser(storage) {
  try {
    storage = typeof storage === 'function' ? storage() : storage;
    const user = JSON.parse(storage.getItem('powertech_user'));
    return user && typeof user === 'object' && !Array.isArray(user) && user.idUsuario && typeof user.token === 'string' && user.token
      ? user
      : null;
  } catch {
    return null;
  }
}

export function saveStoredUser(storage, user) {
  try {
    storage = typeof storage === 'function' ? storage() : storage;
    if (user) storage.setItem('powertech_user', JSON.stringify(user));
    else storage.removeItem('powertech_user');
  } catch {
    // Keep the current in-memory session usable when storage is blocked or full.
  }
}

// Lee el "exp" del token para saber si ya venció (no valida la firma: eso lo hace el backend).
export function tokenVencido(token, ahora = Date.now()) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !payload.exp || payload.exp * 1000 <= ahora;
  } catch {
    return true;
  }
}
