import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { PrestadorEncontrado } from "@/types/busqueda";
import Estrellas from "@/components/Estrellas";
import InsigniaVerificado from "@/components/InsigniaVerificado";

// Espejo de fixit-web/app/explorar/[categoriaId]/page.tsx — a esta pantalla se llega tocando una
// categoría en "Explorar" (ver src/app/(tabs)/index.tsx). Vive fuera del grupo de pestañas, mismo
// patrón que prestador/[id].tsx y conversacion/[id].tsx (registrada en el Stack.Protected de
// src/app/_layout.tsx), para que se muestre a pantalla completa sin la tab bar.
export default function ExplorarCategoriaScreen() {
  const colors = useFixitColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categoriaId, nombre } = useLocalSearchParams<{ categoriaId: string; nombre?: string }>();

  const [resultados, setResultados] = useState<PrestadorEncontrado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PrestadorEncontrado[]>(`/api/prestadores/buscar?categoriaId=${categoriaId}`)
      .then(setResultados)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Error al cargar"))
      .finally(() => setCargando(false));
  }, [categoriaId]);

  return (
    <View style={[styles.pantalla, { backgroundColor: colors.paper, paddingTop: insets.top + 20 }]}>
      <Text style={[styles.titulo, { color: colors.ink }]}>{nombre ?? "Prestadores disponibles"}</Text>

      {cargando ? (
        <ActivityIndicator color={colors.copper} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : resultados.length === 0 ? (
        <Text style={[styles.vacio, { color: colors.inkMuted }]}>
          Todavía no hay prestadores en esta categoría.
        </Text>
      ) : (
        <FlatList
          data={resultados}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item: p }) => (
            <Pressable
              style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(`/prestador/${p.id}`)}
            >
              <View style={styles.avatar}>
                <Text style={[styles.avatarTexto, { color: colors.ink }]}>
                  {p.nombre[0]}
                  {p.apellido[0]}
                </Text>
              </View>

              <View style={styles.info}>
                <View style={styles.nombreFila}>
                  <Text style={[styles.nombre, { color: colors.ink }]} numberOfLines={1}>
                    {p.nombre} {p.apellido}
                  </Text>
                  {p.verificado && <InsigniaVerificado size={14} />}
                </View>
                {p.descripcion && (
                  <Text style={[styles.descripcion, { color: colors.inkMuted }]} numberOfLines={2}>
                    {p.descripcion}
                  </Text>
                )}
                {p.precioReferencia != null && (
                  <Text style={[styles.precio, { color: colors.ink }]}>
                    Desde ${p.precioReferencia.toLocaleString("es-AR")} /hora
                  </Text>
                )}
              </View>

              {p.cantidadCalificaciones > 0 ? (
                <View style={styles.calificacion}>
                  <Estrellas valor={p.promedioCalificacion!} tamaño={12} />
                  <Text style={[styles.calificacionCantidad, { color: colors.inkMuted }]}>
                    ({p.cantidadCalificaciones})
                  </Text>
                </View>
              ) : (
                <Text style={[styles.sinResenas, { color: colors.inkMuted }]}>Sin reseñas</Text>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  titulo: { fontSize: 20, fontWeight: "700", marginBottom: 16 },
  error: { color: "#C0392B", marginTop: 20 },
  vacio: { fontSize: 14, marginTop: 8 },
  tarjeta: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(120,120,120,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { fontSize: 12, fontWeight: "700" },
  info: { flex: 1, gap: 2 },
  nombreFila: { flexDirection: "row", alignItems: "center", gap: 6 },
  nombre: { fontSize: 15, fontWeight: "600" },
  descripcion: { fontSize: 13 },
  precio: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  calificacion: { alignItems: "flex-end", gap: 2 },
  calificacionCantidad: { fontSize: 11 },
  sinResenas: { fontSize: 11 },
});
