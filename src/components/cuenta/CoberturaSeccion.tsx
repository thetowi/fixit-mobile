import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { apiFetch, ApiError } from "@/lib/api";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { PerfilPropio } from "@/types/perfilPropio";
import MapaCobertura from "@/components/MapaCobertura";

// Espejo de la sección "Cobertura" de fixit-web/app/cuenta/page.tsx — mismo mapa (acá con
// react-native-maps en vez de Leaflet) + slider de radio en km.
export default function CoberturaSeccion({ perfil }: { perfil: PerfilPropio }) {
  const colors = useFixitColors();
  const [lat, setLat] = useState<number | null>(perfil.latitud);
  const [lng, setLng] = useState<number | null>(perfil.longitud);
  const [radioKm, setRadioKm] = useState(perfil.radioAlcanceKm ?? 10);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);

  useEffect(() => {
    // Si todavía no tiene ubicación cargada, le pedimos el GPS del celular para centrar el mapa
    // ahí directamente (puede ajustar el pin después tocando o arrastrando).
    if (perfil.latitud === null && perfil.longitud === null) {
      obtenerUbicacionActual(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function obtenerUbicacionActual(silencioso = false) {
    setBuscandoUbicacion(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (!silencioso) setError("Necesitamos permiso de ubicación para hacer esto automáticamente.");
        return;
      }
      const posicion = await Location.getCurrentPositionAsync({});
      setLat(posicion.coords.latitude);
      setLng(posicion.coords.longitude);
    } catch {
      if (!silencioso) setError("No pudimos acceder a tu ubicación. Marcá el punto directamente en el mapa.");
    } finally {
      setBuscandoUbicacion(false);
    }
  }

  async function handleGuardar() {
    setError(null);
    setExito(null);
    if (lat === null || lng === null) {
      setError("Marcá tu ubicación en el mapa antes de guardar.");
      return;
    }
    setGuardando(true);
    try {
      await apiFetch("/api/usuarios/ubicacion", {
        method: "PUT",
        body: JSON.stringify({ latitud: lat, longitud: lng, radioAlcanceKm: radioKm }),
      });
      setExito("Tu cobertura quedó actualizada.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar tu cobertura");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.titulo, { color: colors.ink }]}>Cobertura</Text>
      <Text style={{ color: colors.inkMuted, fontSize: 12, marginBottom: 12 }}>
        Marcá desde dónde vas a prestar tus servicios y hasta qué distancia estás dispuesto a moverte.
      </Text>

      <MapaCobertura latitud={lat} longitud={lng} radioKm={radioKm} onCambiarUbicacion={(la, lo) => { setLat(la); setLng(lo); }} />

      <View style={styles.filaAyuda}>
        <Text style={{ color: colors.inkMuted, fontSize: 11, flex: 1 }}>
          {lat !== null && lng !== null ? "Tocá el mapa o arrastrá el pin para ajustar." : "Todavía no marcaste tu ubicación."}
        </Text>
        <Pressable onPress={() => obtenerUbicacionActual(false)} disabled={buscandoUbicacion}>
          <Text style={{ color: colors.copper, fontSize: 11 }}>{buscandoUbicacion ? "Buscando..." : "Usar mi ubicación actual"}</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 14 }}>
        <View style={styles.filaRadio}>
          <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Radio de cobertura</Text>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "600" }}>{radioKm} km</Text>
        </View>
        <Slider
          minimumValue={1}
          maximumValue={100}
          step={1}
          value={radioKm}
          onValueChange={setRadioKm}
          minimumTrackTintColor={colors.copper}
          thumbTintColor={colors.copper}
        />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {exito && <Text style={{ color: colors.stamp, fontSize: 12, marginTop: 8 }}>{exito}</Text>}

      <Pressable onPress={handleGuardar} disabled={guardando} style={[styles.boton, { backgroundColor: colors.copper, opacity: guardando ? 0.6 : 1 }]}>
        {guardando ? <ActivityIndicator color={colors.paper} /> : <Text style={{ color: colors.paper, fontWeight: "600" }}>Guardar cobertura</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderRadius: 12, padding: 16 },
  titulo: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  filaAyuda: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 8 },
  filaRadio: { flexDirection: "row", justifyContent: "space-between" },
  error: { color: "#C0392B", fontSize: 12, marginTop: 10 },
  boton: { marginTop: 14, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
});
