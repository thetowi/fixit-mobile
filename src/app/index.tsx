import { Redirect } from "expo-router";
import { useAuth } from "@/lib/authContext";

// Esto reemplaza el archivo que dejó el template de Expo por defecto (el que mostraba "Welcome to
// Expo"). Sin este archivo expo-router no tiene una pantalla clara para la ruta raíz "/", así que
// aunque _layout.tsx arme la navegación protegida con Stack.Protected, el router seguía resolviendo
// "/" contra este index.tsx suelto en vez de pasar por la lógica de sesión. Ahora simplemente
// redirige a /login o a las tabs según haya sesión guardada, usando el mismo estado de auth que ya
// lee _layout.tsx.
//
// Bug real encontrado y arreglado (21/09): redirigir con href="/(tabs)" a secas SIEMPRE lleva a la
// pantalla llamada "index" adentro de ese grupo (Explorar) — expo-router resuelve la ruta del
// grupo contra el archivo literal "index.tsx", sin importar el `initialRouteName` que le pasamos a
// <Tabs> en (tabs)/_layout.tsx (ese prop solo aplica cuando el navegador se monta solo, no cuando
// se navega a la ruta del grupo con un href explícito como este). Por eso un Prestador terminaba
// en "Explorar" (oculta para su rol, pero igual quedaba "parado" ahí) en vez de en "Inicio". Fix:
// apuntar al href completo de la pantalla que corresponda según el rol.
//
// 21/09: desde que el Cliente también tiene pestaña "Inicio" (ver (tabs)/_layout.tsx e
// (tabs)/inicio.tsx), los DOS roles aterrizan ahí al iniciar sesión — antes el Cliente entraba
// directo a "Explorar". Por el mismo motivo del bug de arriba, hay que apuntar al href completo
// ("/(tabs)/inicio") para los dos roles, no alcanza con cambiar initialRouteName en el layout.
//
// 29/09: sin sesión ya no manda directo a /login — primero pasa por /bienvenida (pantalla previa
// al login, a pedido del usuario: "si abrís la app te manda directo al login... no te informa
// nada, no dice nada"). Esa pantalla tiene sus propios botones que llevan a /login cuando
// corresponde. Ver bienvenida.tsx y el grupo público en _layout.tsx.
export default function Index() {
  const { usuario, cargando } = useAuth();

  if (cargando) return null;

  if (!usuario) return <Redirect href="/bienvenida" />;

  return <Redirect href="/(tabs)/inicio" />;
}
