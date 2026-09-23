import * as signalR from "@microsoft/signalr";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "@/lib/config";

const TOKEN_KEY = "fixit_token";

// Espejo de fixit-web/lib/chatConnection.ts, con dos diferencias impuestas por React Native:
// 1) el token sale de SecureStore (async), así que esta función es async — a diferencia de la
//    web, que lo lee de forma síncrona con localStorage.
// 2) se fuerza el transporte a WebSockets. SignalR intenta por default varios transportes
//    (WebSockets, Server-Sent Events, Long Polling) y elige el mejor disponible: pero
//    "EventSource" (que usa el transporte de Server-Sent Events) no existe en el entorno de React
//    Native, así que dejar que SignalR lo intente puede fallar en algunos dispositivos. Forzando
//    WebSockets nos aseguramos de usar el mismo transporte, más liviano y confiable, en todos los
//    celulares — el backend (SignalR de ASP.NET Core) ya lo soporta sin ningún cambio.
export async function crearConexionChat(): Promise<signalR.HubConnection> {
  const token = (await SecureStore.getItemAsync(TOKEN_KEY)) ?? "";

  return new signalR.HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/chat`, {
      accessTokenFactory: () => token,
      transport: signalR.HttpTransportType.WebSockets,
    })
    .withAutomaticReconnect()
    .build();
}
