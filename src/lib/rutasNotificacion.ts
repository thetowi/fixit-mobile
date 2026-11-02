// 02/11 (prueba en Android): el backend manda en cada notificación la URL de la WEB
// (ej. "/conversaciones/{id}"), pero en la app algunas rutas se llaman distinto
// (ej. "/conversacion/[id]"). Usar la URL tal cual daba "Unmatched Route". Esta función la
// traduce a una ruta que existe en la app; si no la reconoce, devuelve null y no se navega.
export function rutaAppDesdeUrlWeb(url: string | null | undefined): string | null {
  if (!url || url === "/") return null;
  const limpia = url.split("?")[0].replace(/\/+$/, "");

  const conversacion = limpia.match(/^\/conversaciones\/([^/]+)$/);
  if (conversacion) return `/conversacion/${conversacion[1]}`;

  if (limpia === "/ordenes") return "/ordenes";
  if (limpia === "/mensajes" || limpia === "/conversaciones") return "/mensajes";
  if (limpia === "/notificaciones") return "/notificaciones";
  if (limpia === "/mi-plan") return "/cuenta?seccion=plan";
  if (limpia === "/cuenta") return "/cuenta";
  if (limpia === "/prestador/agenda") return "/agenda";

  return null;
}
