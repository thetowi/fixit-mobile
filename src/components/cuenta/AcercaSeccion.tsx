import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { apiFetch, ApiError } from "@/lib/api";
import { apiUpload } from "@/lib/apiUpload";
import { useAuth } from "@/lib/authContext";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { FotoTrabajo, PerfilPrestador } from "@/types/perfil";

// Espejo de la sección "Acerca de mí" de fixit-web/app/cuenta/page.tsx.
export default function AcercaSeccion() {
  const colors = useFixitColors();
  const { usuario } = useAuth();
  const [biografia, setBiografia] = useState("");
  const [fotos, setFotos] = useState<FotoTrabajo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    if (!usuario) return;
    try {
      const data = await apiFetch<PerfilPrestador>(`/api/prestadores/${usuario.id}`);
      setBiografia(data.biografia ?? "");
      setFotos(data.fotosTrabajo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar tu perfil de prestador");
    }
  }

  async function handleGuardar() {
    setError(null);
    setExito(null);
    setGuardando(true);
    try {
      await apiFetch("/api/prestador/acerca-de-mi", { method: "PUT", body: JSON.stringify({ biografia: biografia || null }) });
      setExito("Datos actualizados correctamente.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar los cambios");
    } finally {
      setGuardando(false);
    }
  }

  async function handleAgregarFoto() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError("Necesitamos permiso para acceder a tus fotos.");
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (resultado.canceled) return;

    const asset = resultado.assets[0];
    setSubiendo(true);
    setError(null);
    try {
      const nueva = await apiUpload<FotoTrabajo>("/api/prestador/fotos-trabajo", {
        archivo: { uri: asset.uri, name: asset.fileName ?? "trabajo.jpg", type: asset.mimeType ?? "image/jpeg" },
      });
      setFotos((prev) => [nueva, ...prev]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al subir la imagen");
    } finally {
      setSubiendo(false);
    }
  }

  async function handleEliminarFoto(id: string) {
    try {
      await apiFetch(`/api/prestador/fotos-trabajo/${id}`, { method: "DELETE" });
      setFotos((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al eliminar la foto");
    }
  }

  return (
    <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.titulo, { color: colors.ink }]}>Acerca de mí</Text>

      <TextInput
        placeholder="Edad, años de experiencia, a qué te dedicás dentro del oficio..."
        placeholderTextColor={colors.inkMuted}
        style={[styles.textarea, { borderColor: colors.border, color: colors.ink }]}
        value={biografia}
        onChangeText={setBiografia}
        multiline
        numberOfLines={4}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {exito && <Text style={{ color: colors.stamp, fontSize: 12, marginTop: 6 }}>{exito}</Text>}

      <Pressable onPress={handleGuardar} disabled={guardando} style={[styles.boton, { backgroundColor: colors.copper, opacity: guardando ? 0.6 : 1 }]}>
        {guardando ? <ActivityIndicator color={colors.paper} /> : <Text style={{ color: colors.paper, fontWeight: "600" }}>Guardar cambios</Text>}
      </Pressable>

      <View style={[styles.separador, { borderTopColor: colors.border }]}>
        <View style={styles.filaTitulo}>
          <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 13 }}>Fotos de trabajos</Text>
          <Pressable onPress={handleAgregarFoto} disabled={subiendo}>
            <Text style={{ color: colors.copper, fontSize: 13 }}>{subiendo ? "Subiendo..." : "+ Agregar foto"}</Text>
          </Pressable>
        </View>

        {fotos.length === 0 ? (
          <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Todavía no subiste fotos de trabajos.</Text>
        ) : (
          <View style={styles.grilla}>
            {fotos.map((f) => (
              <View key={f.id} style={styles.fotoWrap}>
                <Image source={{ uri: f.url }} style={styles.foto} />
                <Pressable onPress={() => handleEliminarFoto(f.id)} style={styles.botonQuitarFoto}>
                  <Text style={{ color: "#fff", fontSize: 10 }}>Quitar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderRadius: 12, padding: 16 },
  titulo: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  textarea: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, minHeight: 90, textAlignVertical: "top" },
  error: { color: "#C0392B", fontSize: 12, marginTop: 8 },
  boton: { marginTop: 12, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  separador: { borderTopWidth: 1, marginTop: 16, paddingTop: 12 },
  filaTitulo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  grilla: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fotoWrap: { width: "31%", aspectRatio: 1, borderRadius: 8, overflow: "hidden", position: "relative" },
  foto: { width: "100%", height: "100%" },
  botonQuitarFoto: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
});
