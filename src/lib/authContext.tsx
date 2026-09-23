import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { Usuario } from "@/types/auth";
import { registrarNotificacionesPush } from "@/lib/pushNotifications";

// Espejo de fixit-web/lib/auth.ts, pero como Context de React en vez de funciones sueltas: acá
// hace falta reaccionar a cambios de sesión en toda la app (mostrar/ocultar pantallas protegidas),
// mientras que en la web cada página simplemente relee localStorage cuando la necesita.
const TOKEN_KEY = "fixit_token";
const USUARIO_KEY = "fixit_usuario";

interface AuthContextValue {
  usuario: Usuario | null;
  // true mientras se lee SecureStore al arrancar la app — evita que el layout raíz decida
  // "no hay sesión" por una fracción de segundo y mande a /login a alguien que sí estaba logueado.
  cargando: boolean;
  guardarSesion: (token: string, usuario: Usuario) => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(USUARIO_KEY);
        setUsuario(raw ? JSON.parse(raw) : null);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // Se dispara tanto al restaurar una sesión guardada al abrir la app como al loguearse recién
  // (los dos casos hacen que "usuario" pase de null a un objeto real) — un solo lugar para
  // registrar el push nativo en vez de duplicarlo en login.tsx y acá.
  useEffect(() => {
    if (usuario) {
      registrarNotificacionesPush();
    }
  }, [usuario]);

  const guardarSesion = useCallback(async (token: string, usuarioNuevo: Usuario) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USUARIO_KEY, JSON.stringify(usuarioNuevo));
    setUsuario(usuarioNuevo);
  }, []);

  const cerrarSesion = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USUARIO_KEY);
    setUsuario(null);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, cargando, guardarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth se tiene que usar adentro de <AuthProvider>");
  return ctx;
}
