import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiFetch } from "@/lib/api";

// Notificaciones push nativas (Expo Push) — equivalente mobile del Web Push que ya tiene
// fixit-web (lib/push.ts). Importante: desde el SDK ~53 de Expo, las notificaciones push remotas
// YA NO funcionan en Expo Go en Android (limitación de Expo, no de FixIt — mismo tipo de bloqueo
// que el mapa de Cobertura) — hace falta un "development build" propio (eas build) para probar
// esto de verdad.
//
// Bug real encontrado y arreglado (21/09): antes se importaba "expo-notifications" con un
// `import * as Notifications` normal, arriba del archivo. El problema es que, en la versión
// instalada, el simple hecho de IMPORTAR ese paquete corriendo dentro de Expo Go ya dispara un
// error duro (no un warning) desde uno de sus módulos internos de auto-registro
// (DevicePushTokenAutoRegistration.fx.js) — pasa en el momento de cargar el módulo, antes de que
// se ejecute ninguna línea de código nuestro, así que el try/catch de más abajo no lo puede
// atajar. Como cualquier archivo de la app que importa (directa o indirectamente) este archivo
// termina rompiéndose entero, hacía falta que la app entrara a Expo Go por error (en vez del
// development build) para que esto tirara abajo TODA la pantalla, no solo el push.
// Fix: sacar el import estático de arriba y cargar "expo-notifications" con un require() recién
// adentro de la función, y solo cuando NO estamos corriendo en Expo Go (chequeado con
// Constants.appOwnership === "expo") — así el módulo ni se evalúa si el entorno no lo soporta.
const esExpoGo = Constants.appOwnership === "expo";

// Se llama una vez que hay sesión iniciada (ver src/lib/authContext.tsx) — pide permiso si hace
// falta, obtiene el token de Expo Push de este dispositivo y lo registra contra el backend, para
// que MensajeService/PushNotificationService le pueda mandar un push cuando llegue un mensaje o
// una oferta nueva (mismo endpoint que ya usa el chat para el Web Push, ver backlog).
export async function registrarNotificacionesPush(): Promise<void> {
  if (esExpoGo) {
    // Ni siquiera intentamos requerir el módulo acá — ver el comentario de arriba sobre por qué
    // el simple import ya rompe todo en Expo Go. Nada para hacer hasta correr un development
    // build (npx expo start --dev-client, abriendo la app de FixIt, no "Expo Go").
    return;
  }

  try {
    const Notifications = require("expo-notifications") as typeof import("expo-notifications");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const permisoActual = await Notifications.getPermissionsAsync();
    let estado = permisoActual.status;
    if (estado !== "granted") {
      const solicitado = await Notifications.requestPermissionsAsync();
      estado = solicitado.status;
    }
    if (estado !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      // Todavía no se corrió "eas init" en este proyecto — sin projectId, Expo no puede emitir
      // un token. Nada más para hacer acá hasta que exista (ver nota del backlog).
      return;
    }

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

    await apiFetch("/api/push/expo/registrar", {
      method: "POST",
      body: JSON.stringify({ expoPushToken }),
    });
  } catch {
    // Best-effort: sin permiso, sin dev build, sin conexión, lo que sea — la app tiene que seguir
    // funcionando igual, solo sin push nativo. No se loguea nada acá a propósito (ya se confirmó
    // funcionando de punta a punta el 21/09) — si hace falta diagnosticar un problema puntual en el
    // futuro, agregar logging temporal ahí y sacarlo de nuevo al terminar, en vez de dejarlo fijo.
  }
}
