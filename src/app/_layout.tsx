import { Stack } from "expo-router";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/authContext";
import { ConteoNoLeidosProvider } from "@/lib/conteoNoLeidosContext";
import { ActividadOrdenesProvider } from "@/lib/actividadOrdenesContext";
import { TrabajoEnCursoProvider } from "@/lib/trabajoEnCursoContext";
import { NotificacionesProvider } from "@/lib/notificacionesContext";
import { ThemeProvider } from "@/lib/themeContext";

SplashScreen.preventAutoHideAsync();

// Layout raíz: decide, según si hay sesión guardada o no, si la app arranca en /login o en las
// pestañas principales — con Stack.Protected (la forma recomendada hoy por Expo Router para rutas
// protegidas por auth). OJO: esto es una guardia del lado del cliente nomás, para la experiencia
// de navegación — la seguridad real la sigue haciendo el backend con el JWT en cada request, esto
// no reemplaza eso.
function NavegacionSegunSesion() {
  const { usuario, cargando } = useAuth();

  useEffect(() => {
    if (!cargando) SplashScreen.hideAsync();
  }, [cargando]);

  // Mientras se lee la sesión guardada de SecureStore, el splash nativo se queda en pantalla
  // (no se llamó a hideAsync todavía) — evita un parpadeo mostrando /login antes de saber si en
  // realidad ya había una sesión.
  if (cargando) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!usuario}>
        <Stack.Screen name="bienvenida" />
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={!!usuario}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="conversacion/[id]" />
        <Stack.Screen name="prestador/[id]" />
        {/* Agregada 03/10 junto con la pantalla — se había quedado afuera del Stack al crearla. */}
        <Stack.Screen name="cliente/[id]" />
        <Stack.Screen name="explorar/[categoriaId]" />
        {/* Centro de notificaciones (03/10, a pedido del usuario) — ver app/notificaciones.tsx */}
        <Stack.Screen name="notificaciones" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // SafeAreaProvider (22/09): faltaba en la raíz de la app — sin esto, useSafeAreaInsets() en
  // cualquier pantalla puede devolver un valor inicial en 0 (o directamente no actualizarse bien
  // con rotaciones/reinicios), que es la causa real del problema visual reportado por el usuario
  // (el encabezado de Inicio se veía cortado arriba, y la barra de pestañas quedaba tapada por la
  // barra de navegación propia del celular abajo). Envolviendo toda la app acá, cada pantalla que
  // ya usa o pase a usar useSafeAreaInsets() (ver (tabs)/_layout.tsx e (tabs)/inicio.tsx, entre
  // otras) recibe el valor real y actualizado de los insets del dispositivo.
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ConteoNoLeidosProvider>
            <ActividadOrdenesProvider>
              <TrabajoEnCursoProvider>
                <NotificacionesProvider>
                  <NavegacionSegunSesion />
                </NotificacionesProvider>
              </TrabajoEnCursoProvider>
            </ActividadOrdenesProvider>
          </ConteoNoLeidosProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
