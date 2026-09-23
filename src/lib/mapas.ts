// Espejo de fixit-web/lib/mapas.ts. En mobile este link se abre con Linking.openURL (en vez de
// <a target="_blank">) — la URL "google.com/maps/search/?api=1&query=..." abre la app de Google
// Maps si está instalada, y si no, el navegador del sistema.
export function linkGoogleMaps(direccion: string | null, lat?: number | null, lon?: number | null): string {
  const query = lat != null && lon != null ? `${lat},${lon}` : direccion ?? "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
