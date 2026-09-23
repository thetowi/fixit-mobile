import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/lib/api";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { iconoCategoria } from "@/lib/iconosCategoria";
import { Categoria } from "@/types/categorias";

// Primera pantalla real conectada al backend (más allá del login): trae las categorías/rubros
// reales de FixIt, mismo endpoint que ya usa /explorar en la web (GET /api/Categorias). Tocar una
// categoría lleva a explorar/[categoriaId].tsx, el listado de prestadores de ese rubro (espejo de
// fixit-web/app/explorar/[categoriaId]/page.tsx) — antes esta grilla no llevaba a ningún lado.

// Ancho fijo de cada tarjeta en vez de flex:1 (bug real reportado 21/09, con capturas): con
// flex:1, cuando la última fila de la grilla queda incompleta (ej. 8 categorías en 3 columnas
// deja una fila final de solo 2), FlatList igual reparte TODO el ancho disponible entre los ítems
// de esa fila — cada tarjeta de la fila incompleta terminaba más ancha (y por el aspectRatio:1,
// también más alta) que las de las filas completas. Calculando el ancho a mano a partir del ancho
// de pantalla, cada tarjeta mide siempre lo mismo sin importar cuántos ítems tenga su fila.
const COLUMNAS = 3;
const PADDING_HORIZONTAL = 20;
const GAP = 10;
const ANCHO_TARJETA =
  (Dimensions.get("window").width - PADDING_HORIZONTAL * 2 - GAP * (COLUMNAS - 1)) / COLUMNAS;
export default function ExplorarScreen() {
  const colors = useFixitColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Categoria[]>("/api/Categorias")
      .then(setCategorias)
      .catch(() => setError("No pudimos cargar los rubros. Deslizá para reintentar."))
      .finally(() => setCargando(false));
  }, []);

  return (
    <View style={[styles.pantalla, { backgroundColor: colors.paper, paddingTop: insets.top + 20 }]}>
      {/* Sin saludo acá (21/09): el saludo con el nombre ya lo muestra la pestaña Inicio del
          Cliente — repetirlo acá quedaba redundante apenas volvés de ahí. Esta pantalla solo
          pregunta qué necesita arreglar y muestra los rubros. */}
      <Text style={[styles.pregunta, { color: colors.ink }]}>¿Qué necesitás arreglar?</Text>

      {cargando ? (
        <ActivityIndicator color={colors.copper} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={[styles.error]}>{error}</Text>
      ) : (
        <FlatList
          data={categorias}
          keyExtractor={(c) => String(c.id)}
          numColumns={COLUMNAS}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const Icono = iconoCategoria(item.icono);
            return (
              <Pressable
                style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() =>
                  router.push({ pathname: "/explorar/[categoriaId]", params: { categoriaId: String(item.id), nombre: item.nombre } })
                }
              >
                <Icono size={24} color={colors.copper} strokeWidth={1.75} />
                <Text style={[styles.tarjetaTexto, { color: colors.ink }]} numberOfLines={2}>
                  {item.nombre}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  pregunta: { fontSize: 20, fontWeight: "700", marginBottom: 16 },
  tarjeta: {
    width: ANCHO_TARJETA,
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 8,
  },
  tarjetaTexto: { fontSize: 12, fontWeight: "500", textAlign: "center" },
  error: { color: "#C0392B", marginTop: 20 },
});
