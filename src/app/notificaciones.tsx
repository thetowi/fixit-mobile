import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { useRefrescoEnFoco } from "@/lib/useRefrescoEnFoco";
import { actualizarConteoDesde, marcarTodasLeidasLocal } from "@/lib/notificacionesContext";
import { Notificacion } from "@/types/notificaciones";

// Centro de notificaciones (03/10, a pedido del usuario: "algo como Notificaciones donde
// alojemos todas las notificaciones disponibles o no leídas") — espejo de
// fixit-web/app/notificaciones/page.tsx. Lista todo lo que ya se le manda a este usuario por
// PushNotificationService.NotificarAsync (chat, ofertas, repostos, pausar/reanudar un trabajo,
// etc.), ahora con historial persistente (ver backend Notificacion.cs).
function tiempoRelativo(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  const diffMin = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60));

  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `hace ${diffHoras} h`;
  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias < 30) return `hace ${diffDias} día${diffDias === 1 ? "" : "s"}`;
  return fecha.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

export default function NotificacionesScreen() {
  const router = useRouter();
  const colors = useFixitColors();
  const insets = useSafeAreaInsets();

  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  const cargar = useCallback(async (esRefresh = false) => {
    if (esRefresh) setRefrescando(true);
    try {
      const data = await apiFetch<Notificacion[]>("/api/notificaciones");
      setNotificaciones(data);
      actualizarConteoDesde(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar tus notificaciones");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useRefrescoEnFoco(cargar);

  async function abrirNotificacion(n: Notificacion) {
    if (!n.leida) {
      setNotificaciones((prev) => {
        const actualizadas = prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x));
        actualizarConteoDesde(actualizadas);
        return actualizadas;
      });
      apiFetch(`/api/notificaciones/${n.id}/marcar-leida`, { method: "PUT" }).catch(() => {});
    }
    if (n.url && n.url !== "/") {
      router.push(n.url as never);
    }
  }

  async function marcarTodasLeidas() {
    setMarcandoTodas(true);
    try {
      await apiFetch("/api/notificaciones/marcar-todas-leidas", { method: "PUT" });
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
      marcarTodasLeidasLocal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos marcar las notificaciones como leídas");
    } finally {
      setMarcandoTodas(false);
    }
  }

  const hayNoLeidas = notificaciones.some((n) => !n.leida);

  return (
    <View style={[styles.pantalla, { backgroundColor: colors.paper }]}>
      <View style={[styles.header, { backgroundColor: colors.nav, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.volver}>
          <Text style={{ color: colors.copper, fontSize: 24 }}>‹</Text>
        </Pressable>
        <Text style={[styles.tituloHeader, { color: colors.onNav }]}>Notificaciones</Text>
        {hayNoLeidas ? (
          <Pressable onPress={marcarTodasLeidas} disabled={marcandoTodas} hitSlop={10}>
            <Text style={[styles.marcarTodas, { color: colors.copper, opacity: marcandoTodas ? 0.5 : 1 }]}>
              {marcandoTodas ? "..." : "Marcar leídas"}
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 70 }} />
        )}
      </View>

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator color={colors.copper} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={colors.copper} />}
        >
          {error && <Text style={{ color: "#B3261E", fontSize: 13.5, fontWeight: "500" }}>{error}</Text>}

          {notificaciones.length === 0 && !error && (
            <Text style={{ color: colors.inkMuted, fontSize: 13.5, marginTop: 8 }}>Todavía no tenés notificaciones.</Text>
          )}

          {notificaciones.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => abrirNotificacion(n)}
              style={[
                styles.tarjeta,
                { backgroundColor: colors.surface, borderColor: n.leida ? colors.border : `${colors.copper}66` },
              ]}
            >
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                {!n.leida && <View style={[styles.punto, { backgroundColor: colors.copper }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.titulo, { color: colors.ink, fontWeight: n.leida ? "600" : "800" }]}>{n.titulo}</Text>
                  <Text style={[styles.cuerpo, { color: colors.inkMuted }]}>{n.cuerpo}</Text>
                  <Text style={[styles.fecha, { color: colors.inkMuted }]}>{tiempoRelativo(n.creadoEn)}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1 },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  volver: { width: 36, height: 36, alignItems: "flex-start", justifyContent: "center" },
  tituloHeader: { fontSize: 17, fontWeight: "800" },
  marcarTodas: { fontSize: 12.5, fontWeight: "700", width: 70, textAlign: "right" },
  tarjeta: { borderRadius: 14, borderWidth: 1, padding: 14 },
  punto: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  titulo: { fontSize: 14.5 },
  cuerpo: { fontSize: 13, marginTop: 3, fontWeight: "500" },
  fecha: { fontSize: 11.5, marginTop: 6, fontWeight: "500" },
});
