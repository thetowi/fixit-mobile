import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch, ApiError } from "@/lib/api";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { AgregarCategoriaRequest, Categoria, PrestadorCategoria } from "@/types/categorias";
import SelectorModal, { BotonSelector } from "@/components/SelectorModal";

// Badge de verificación por rubro (22/09) — mientras un servicio no esté Aprobado, no aparece en
// /buscar ni /explorar aunque esté cargado acá. Mismo criterio que fixit-web/app/cuenta/page.tsx.
function BadgeEstadoServicio({
  estado,
  onPress,
}: {
  estado: PrestadorCategoria["estadoVerificacion"];
  onPress: () => void;
}) {
  const colors = useFixitColors();

  if (estado === "Aprobado") {
    return (
      <View style={[styles.badge, { backgroundColor: `${colors.stamp}26` }]}>
        <Text style={{ color: colors.stamp, fontSize: 9.5, fontWeight: "700" }}>✓ VERIFICADO</Text>
      </View>
    );
  }
  if (estado === "Pendiente") {
    return (
      <View style={[styles.badge, { backgroundColor: `${colors.safety}33` }]}>
        <Text style={{ color: colors.ink, fontSize: 9.5, fontWeight: "700" }}>EN REVISIÓN</Text>
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} style={[styles.badge, { backgroundColor: "#C0392B26" }]}>
      <Text style={{ color: "#C0392B", fontSize: 9.5, fontWeight: "700" }}>
        {estado === "Rechazado" ? "RECHAZADA" : "FALTA MATRÍCULA"}
      </Text>
    </Pressable>
  );
}

// Espejo de la sección "Mis servicios" de fixit-web/app/cuenta/page.tsx.
export default function ServiciosSeccion({ onIrAVerificacion }: { onIrAVerificacion: () => void }) {
  const colors = useFixitColors();
  const [disponibles, setDisponibles] = useState<Categoria[]>([]);
  const [mias, setMias] = useState<PrestadorCategoria[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    try {
      const [d, m] = await Promise.all([
        apiFetch<Categoria[]>("/api/Categorias"),
        apiFetch<PrestadorCategoria[]>("/api/prestador/categorias"),
      ]);
      setDisponibles(d);
      setMias(m);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar tus servicios");
    }
  }

  async function handleAgregar() {
    setError(null);
    if (!categoriaId) {
      setError("Elegí una categoría.");
      return;
    }
    const body: AgregarCategoriaRequest = {
      categoriaId,
      descripcion: descripcion || undefined,
      precioReferencia: precio ? Number(precio) : undefined,
    };
    try {
      await apiFetch("/api/prestador/categorias", { method: "POST", body: JSON.stringify(body) });
      setCategoriaId(null);
      setDescripcion("");
      setPrecio("");
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al agregar la categoría");
    }
  }

  async function handleQuitar(id: number) {
    try {
      await apiFetch(`/api/prestador/categorias/${id}`, { method: "DELETE" });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al quitar la categoría");
    }
  }

  const paraAgregar = disponibles.filter((c) => !mias.some((m) => m.categoriaId === c.id));
  const categoriaSeleccionada = disponibles.find((c) => c.id === categoriaId);

  return (
    <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.titulo, { color: colors.ink }]}>Mis servicios</Text>

      <BotonSelector
        label={categoriaSeleccionada ? categoriaSeleccionada.nombre : "Elegí una categoría"}
        onPress={() => setModalAbierto(true)}
      />
      <SelectorModal
        visible={modalAbierto}
        opciones={paraAgregar.map((c) => ({ value: String(c.id), label: c.nombre }))}
        valorActual={categoriaId ? String(categoriaId) : ""}
        onSeleccionar={(v) => setCategoriaId(Number(v))}
        onCerrar={() => setModalAbierto(false)}
        titulo="Elegí una categoría"
      />

      <TextInput
        placeholder="Descripción (ej: 10 años de experiencia, atiendo urgencias)"
        placeholderTextColor={colors.inkMuted}
        style={[styles.input, { borderColor: colors.border, color: colors.ink, marginTop: 8 }]}
        value={descripcion}
        onChangeText={setDescripcion}
        multiline
      />
      <TextInput
        placeholder="Precio por hora (opcional)"
        placeholderTextColor={colors.inkMuted}
        style={[styles.input, { borderColor: colors.border, color: colors.ink }]}
        value={precio}
        onChangeText={setPrecio}
        keyboardType="numeric"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable onPress={handleAgregar} style={[styles.botonAgregar, { backgroundColor: colors.copper }]}>
        <Text style={{ color: colors.paper, fontWeight: "600" }}>Agregar</Text>
      </Pressable>

      <View style={{ marginTop: 16, gap: 8 }}>
        {mias.length === 0 ? (
          <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Todavía no agregaste ningún servicio.</Text>
        ) : (
          mias.map((mc) => (
            <View key={mc.id} style={[styles.filaServicio, { backgroundColor: colors.paper }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 13 }}>{mc.categoriaNombre}</Text>
                  <BadgeEstadoServicio estado={mc.estadoVerificacion} onPress={onIrAVerificacion} />
                </View>
                {mc.descripcion && <Text style={{ color: colors.inkMuted, fontSize: 12 }}>{mc.descripcion}</Text>}
                {mc.precioReferencia && (
                  <Text style={{ color: colors.ink, fontSize: 12, marginTop: 2 }}>
                    Desde ${mc.precioReferencia.toLocaleString("es-AR")} /hora
                  </Text>
                )}
              </View>
              <Pressable onPress={() => handleQuitar(mc.id)}>
                <Text style={{ color: "#C0392B", fontSize: 12 }}>Quitar</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderRadius: 12, padding: 16 },
  titulo: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, marginTop: 8 },
  error: { color: "#C0392B", fontSize: 12, marginTop: 8 },
  botonAgregar: { marginTop: 12, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  filaServicio: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderRadius: 8, padding: 10, gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1.5 },
});
