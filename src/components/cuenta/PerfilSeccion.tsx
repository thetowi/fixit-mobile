import { useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { apiFetch, ApiError } from "@/lib/api";
import { apiUpload } from "@/lib/apiUpload";
import { useAuth } from "@/lib/authContext";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { PerfilPropio, ActualizarPerfilRequest } from "@/types/perfilPropio";
import { buscarDirecciones, SugerenciaDireccion } from "@/lib/geocodificacion";

// Espejo de la sección "Perfil" de fixit-web/app/cuenta/page.tsx: foto, datos básicos y la
// dirección con autocompletado/verificación contra Nominatim (igual lógica que la web: se
// separa en calle+número, y solo queda "verificada" si se elige una sugerencia real).
export default function PerfilSeccion({
  perfil,
  onPerfilActualizado,
}: {
  perfil: PerfilPropio;
  onPerfilActualizado: (p: PerfilPropio) => void;
}) {
  const colors = useFixitColors();
  const insets = useSafeAreaInsets();
  const { usuario, guardarSesion } = useAuth();
  const [fotoAmpliada, setFotoAmpliada] = useState(false);

  const [form, setForm] = useState({ nombre: perfil.nombre, apellido: perfil.apellido, telefono: perfil.telefono });
  const [calle, setCalle] = useState(perfil.direccion ?? "");
  const [numero, setNumero] = useState("");
  const [sinNumero, setSinNumero] = useState(false);
  const [localidad, setLocalidad] = useState("");
  const [coords, setCoords] = useState<{ lat?: number; lon?: number }>({});
  const [sugerencias, setSugerencias] = useState<SugerenciaDireccion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  function handleCambiarCalle(texto: string) {
    setCalle(texto);
    setLocalidad("");
    setCoords({});
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (texto.trim().length < 4) {
      setSugerencias([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      setSugerencias(await buscarDirecciones(texto));
      setBuscando(false);
    }, 500);
  }

  function elegirSugerencia(s: SugerenciaDireccion) {
    setCalle(s.calle);
    setLocalidad(s.localidad);
    setCoords({ lat: s.lat, lon: s.lon });
    setSugerencias([]);
  }

  function armarDireccion(): string {
    if (!calle.trim()) return "";
    const calleYNumero = sinNumero ? `${calle} s/n` : numero.trim() ? `${calle} ${numero.trim()}` : calle;
    return localidad ? `${calleYNumero}, ${localidad}` : calleYNumero;
  }

  async function handleGuardar() {
    setError(null);
    setExito(null);
    setGuardando(true);
    try {
      const cuerpo: ActualizarPerfilRequest = {
        ...form,
        direccion: armarDireccion(),
        direccionLat: coords.lat,
        direccionLon: coords.lon,
      };
      const actualizado = await apiFetch<PerfilPropio>("/api/usuarios/perfil", {
        method: "PUT",
        body: JSON.stringify(cuerpo),
      });
      onPerfilActualizado(actualizado);
      if (usuario) {
        // Mantiene sincronizado el nombre/apellido que se ve en el resto de la app (ej. "Cuenta").
        const token = await SecureStore.getItemAsync("fixit_token");
        if (token) await guardarSesion(token, { ...usuario, nombre: actualizado.nombre, apellido: actualizado.apellido });
      }
      setExito("Datos actualizados correctamente.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar los cambios");
    } finally {
      setGuardando(false);
    }
  }

  async function handleCambiarFoto() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError("Necesitamos permiso para acceder a tus fotos.");
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (resultado.canceled) return;

    const asset = resultado.assets[0];
    setSubiendoFoto(true);
    setError(null);
    try {
      const data = await apiUpload<{ fotoPerfilUrl: string }>("/api/usuarios/foto-perfil", {
        archivo: { uri: asset.uri, name: asset.fileName ?? "foto.jpg", type: asset.mimeType ?? "image/jpeg" },
      });
      onPerfilActualizado({ ...perfil, fotoPerfilUrl: data.fotoPerfilUrl });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al subir la imagen");
    } finally {
      setSubiendoFoto(false);
    }
  }

  return (
    <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.filaAvatar}>
        {perfil.fotoPerfilUrl ? (
          // Espejo del visor de fotos que ya existe en el chat (conversacion/[id].tsx, ver
          // imagenAmpliada) — tocar la propia foto de perfil la muestra grande, con una cruz para
          // volver (22/09, a pedido del usuario).
          <Pressable onPress={() => setFotoAmpliada(true)}>
            <Image source={{ uri: perfil.fotoPerfilUrl }} style={[styles.avatar, { borderColor: colors.copper }]} />
          </Pressable>
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "700" }}>
              {perfil.nombre[0]}
              {perfil.apellido[0]}
            </Text>
          </View>
        )}
        <View>
          <Pressable onPress={handleCambiarFoto} disabled={subiendoFoto}>
            <Text style={{ color: colors.copper, fontSize: 13 }}>{subiendoFoto ? "Subiendo..." : "Cambiar foto"}</Text>
          </Pressable>
          <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 4 }}>
            {perfil.email} · {perfil.rol.toUpperCase()}
            {perfil.verificado ? " · ✓ Verificado" : ""}
          </Text>
        </View>
      </View>

      <Text style={[styles.label, { color: colors.inkMuted }]}>Nombre</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.ink }]}
        value={form.nombre}
        onChangeText={(v) => setForm((f) => ({ ...f, nombre: v }))}
      />

      <Text style={[styles.label, { color: colors.inkMuted }]}>Apellido</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.ink }]}
        value={form.apellido}
        onChangeText={(v) => setForm((f) => ({ ...f, apellido: v }))}
      />

      <Text style={[styles.label, { color: colors.inkMuted }]}>Teléfono</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.ink }]}
        value={form.telefono}
        onChangeText={(v) => setForm((f) => ({ ...f, telefono: v }))}
        keyboardType="phone-pad"
      />

      <Text style={[styles.label, { color: colors.inkMuted }]}>Dirección</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.ink, flex: 1 }]}
          placeholder="Empezá a tipear la calle..."
          placeholderTextColor={colors.inkMuted}
          value={calle}
          onChangeText={handleCambiarCalle}
        />
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.ink, width: 80 }]}
          placeholder="N°"
          placeholderTextColor={colors.inkMuted}
          value={numero}
          onChangeText={setNumero}
          editable={!sinNumero}
          keyboardType="number-pad"
        />
      </View>

      <Pressable style={styles.checkboxFila} onPress={() => setSinNumero((v) => !v)}>
        <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: sinNumero ? colors.copper : "transparent" }]} />
        <Text style={{ color: colors.inkMuted, fontSize: 12 }}>Sin número</Text>
      </Pressable>

      {buscando && <Text style={{ color: colors.inkMuted, fontSize: 11 }}>Buscando...</Text>}
      {!buscando && sugerencias.length > 0 && (
        <View style={[styles.sugerencias, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {sugerencias.map((s, i) => (
            <Pressable key={i} onPress={() => elegirSugerencia(s)} style={[styles.sugerenciaItem, { borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.ink, fontSize: 12 }}>
                {s.calle}
                {s.localidad ? `, ${s.localidad}` : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {perfil.direccion ? (
        perfil.direccionVerificada ? (
          <Text style={{ color: colors.stamp, fontSize: 11, marginTop: 4 }}>✓ Dirección verificada</Text>
        ) : (
          <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 4 }}>
            Sin verificar — elegí una sugerencia de la lista para verificarla.
          </Text>
        )
      ) : null}

      {error && <Text style={styles.error}>{error}</Text>}
      {exito && <Text style={{ color: colors.stamp, fontSize: 12, marginTop: 6 }}>{exito}</Text>}

      <Pressable
        onPress={handleGuardar}
        disabled={guardando}
        style={[styles.botonGuardar, { backgroundColor: colors.copper, opacity: guardando ? 0.6 : 1 }]}
      >
        {guardando ? <ActivityIndicator color={colors.paper} /> : <Text style={{ color: colors.paper, fontWeight: "600" }}>Guardar cambios</Text>}
      </Pressable>

      {/* Visor de foto de perfil ampliada — mismo patrón que el lightbox de fotos del chat
          (conversacion/[id].tsx), pero acá con una cruz explícita para cerrar además de tocar
          afuera, tal como se pidió (22/09). */}
      <Modal visible={fotoAmpliada} transparent animationType="fade" onRequestClose={() => setFotoAmpliada(false)}>
        <Pressable style={styles.fondoLightbox} onPress={() => setFotoAmpliada(false)}>
          {perfil.fotoPerfilUrl && (
            <Image source={{ uri: perfil.fotoPerfilUrl }} style={styles.fotoAmpliada} resizeMode="contain" />
          )}
          <Pressable
            onPress={() => setFotoAmpliada(false)}
            style={[styles.botonCerrarLightbox, { top: insets.top + 12 }]}
            hitSlop={12}
          >
            <X color="#FFFFFF" size={22} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
  filaAvatar: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 10 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2 },
  label: { fontSize: 12, marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  checkboxFila: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  checkbox: { width: 16, height: 16, borderWidth: 1.5, borderRadius: 3 },
  sugerencias: { borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: "hidden" },
  sugerenciaItem: { padding: 10, borderBottomWidth: 1 },
  error: { color: "#C0392B", fontSize: 12, marginTop: 8 },
  botonGuardar: { marginTop: 14, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  fondoLightbox: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" },
  fotoAmpliada: { width: "100%", height: "100%" },
  botonCerrarLightbox: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
