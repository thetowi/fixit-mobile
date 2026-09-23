import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { actualizarConteoDesde } from "@/lib/conteoNoLeidosContext";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { Conversacion } from "@/types/conversaciones";
import { colorCategoria } from "@/lib/coloresCategoria";
import { iconoCategoria } from "@/lib/iconosCategoria";

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function tiempoRelativo(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  const ahora = new Date();
  const diffMin = Math.floor((ahora.getTime() - fecha.getTime()) / 60000);

  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `hace ${diffHoras} h`;
  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias === 1) return "ayer";
  if (diffDias < 7) return `hace ${diffDias} días`;
  return fecha.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

// Espejo mobile de fixit-web/app/mensajes/page.tsx — lista de conversaciones, con navegación al
// chat completo en src/app/conversacion/[id].tsx. Se recarga cada vez que la pestaña vuelve a
// tener foco (useFocusEffect, equivalente RN del refetch-al-volver de la web) para que el badge de
// no leídos y el último mensaje se vean actualizados al volver de un chat.
export default function MensajesScreen() {
  const colors = useFixitColors();
  const router = useRouter();
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      cargar();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  async function cargar() {
    try {
      const data = await apiFetch<Conversacion[]>("/api/conversaciones/mias");
      setConversaciones(data);
      // Misma respuesta que ya usa el circulito de la barra de pestañas (ver
      // conteoNoLeidosContext.tsx) — la reutilizamos acá para no pegarle dos veces al backend.
      actualizarConteoDesde(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar tus mensajes");
    } finally {
      setCargando(false);
    }
  }

  const esCliente = usuario?.rol === "Cliente";

  if (cargando) {
    return (
      <View style={[styles.centro, { backgroundColor: colors.paper }]}>
        <ActivityIndicator color={colors.copper} />
      </View>
    );
  }

  return (
    <View style={[styles.pantalla, { backgroundColor: colors.paper, paddingTop: insets.top + 20 }]}>
      <Text style={[styles.eyebrow, { color: colors.copper }]}>{esCliente ? "CLIENTE" : "PRESTADOR"}</Text>
      <Text style={[styles.h1, { color: colors.ink }]}>Mensajes</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {conversaciones.length === 0 ? (
        <View style={[styles.vacio, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Todavía no tenés conversaciones.</Text>
        </View>
      ) : (
        <FlatList
          data={conversaciones}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
          renderItem={({ item: c }) => {
            const otroNombre = esCliente ? c.prestadorNombreCompleto : c.clienteNombreCompleto;
            const otroFoto = esCliente ? c.prestadorFotoUrl : c.clienteFotoUrl;
            const tieneNoLeidos = c.mensajesNoLeidos > 0;
            // Un mismo prestador puede tener una conversación separada por cada rubro (22/09) — el
            // badge sobre la foto + el nombre del rubro en color debajo del nombre distinguen cuál
            // es cuál de un vistazo, igual que en fixit-web.
            const colorRubro = colorCategoria(c.categoriaNombre);
            const IconoRubro = iconoCategoria(c.categoriaIcono);

            return (
              <Pressable
                onPress={() => router.push(`/conversacion/${c.id}`)}
                style={[styles.fila, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.avatarContenedor}>
                  {otroFoto ? (
                    <Image source={{ uri: otroFoto }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarIniciales, { backgroundColor: `${colors.ink}1A` }]}>
                      <Text style={{ color: colors.ink, fontWeight: "700" }}>{iniciales(otroNombre)}</Text>
                    </View>
                  )}
                  <View style={[styles.badgeRubro, { backgroundColor: colorRubro, borderColor: colors.surface }]}>
                    <IconoRubro size={11} strokeWidth={2.5} color={colors.paper} />
                  </View>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.filaTop}>
                    <Text style={{ color: colors.ink, fontWeight: tieneNoLeidos ? "700" : "600", fontSize: 14, flex: 1 }} numberOfLines={1}>
                      {otroNombre}
                    </Text>
                    {c.ultimoMensajeEn && (
                      <Text style={{ color: colors.inkMuted, fontSize: 10 }}>{tiempoRelativo(c.ultimoMensajeEn)}</Text>
                    )}
                  </View>
                  <Text style={{ color: colorRubro, fontSize: 10.5, fontWeight: "700", marginTop: 1 }} numberOfLines={1}>
                    {c.categoriaNombre}
                  </Text>
                  <View style={styles.filaTop}>
                    <Text style={{ color: tieneNoLeidos ? colors.ink : colors.inkMuted, fontSize: 12, flex: 1 }} numberOfLines={1}>
                      {c.ultimoMensaje ?? `${c.categoriaNombre} · sin mensajes todavía`}
                    </Text>
                    {tieneNoLeidos && (
                      <View style={[styles.badge, { backgroundColor: colors.copper }]}>
                        <Text style={{ color: colors.paper, fontSize: 10, fontWeight: "700" }}>{c.mensajesNoLeidos}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  pantalla: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: "700", marginBottom: 4 },
  h1: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  error: { color: "#C0392B", fontSize: 12, marginBottom: 12 },
  vacio: { borderWidth: 1, borderRadius: 12, padding: 24, alignItems: "center" },
  fila: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  avatarContenedor: { width: 44, height: 44 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarIniciales: { alignItems: "center", justifyContent: "center" },
  badgeRubro: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 19,
    height: 19,
    borderRadius: 9.5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  filaTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
});
