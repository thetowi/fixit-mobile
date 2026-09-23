import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogOut } from "lucide-react-native";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { PerfilPropio } from "@/types/perfilPropio";
import PerfilSeccion from "@/components/cuenta/PerfilSeccion";
import ServiciosSeccion from "@/components/cuenta/ServiciosSeccion";
import AcercaSeccion from "@/components/cuenta/AcercaSeccion";
import CoberturaSeccion from "@/components/cuenta/CoberturaSeccion";
import HorariosSeccion from "@/components/cuenta/HorariosSeccion";
import VerificacionSeccion from "@/components/cuenta/VerificacionSeccion";
import CobrosSeccion from "@/components/cuenta/CobrosSeccion";
import GananciasSeccion from "@/components/cuenta/GananciasSeccion";

type Seccion = "perfil" | "servicios" | "acerca" | "cobertura" | "horarios" | "verificacion" | "cobros" | "ganancias";

const SECCIONES: { id: Seccion; label: string }[] = [
  { id: "perfil", label: "Perfil" },
  { id: "servicios", label: "Mis servicios" },
  { id: "acerca", label: "Acerca de mí" },
  { id: "cobertura", label: "Cobertura" },
  { id: "horarios", label: "Horarios" },
  { id: "verificacion", label: "Verificación" },
  { id: "cobros", label: "Cobros" },
  { id: "ganancias", label: "Ganancias" },
];

// Espejo mobile de fixit-web/app/cuenta/page.tsx: perfil siempre visible arriba, y para el
// Prestador las 6 secciones extra por pestañas (acá una fila de chips scrolleable en vez del
// toggle horizontal de la web). Cada sección se maneja como componente propio con su propio
// fetch — igual que hace el switch de `seccion` en la versión web, solo que separado en archivos
// para no terminar con un solo archivo de 50KB como el original.
export default function CuentaScreen() {
  const colors = useFixitColors();
  const { cerrarSesion } = useAuth();
  const insets = useSafeAreaInsets();
  const [perfil, setPerfil] = useState<PerfilPropio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seccion, setSeccion] = useState<Seccion>("perfil");

  useEffect(() => {
    cargarPerfil();
  }, []);

  async function cargarPerfil() {
    try {
      const data = await apiFetch<PerfilPropio>("/api/usuarios/perfil");
      setPerfil(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar tu perfil");
    }
  }

  if (!perfil) {
    return (
      <View style={[styles.centro, { backgroundColor: colors.paper }]}>
        {error ? <Text style={{ color: "#C0392B" }}>{error}</Text> : <ActivityIndicator color={colors.copper} />}
      </View>
    );
  }

  const esPrestador = perfil.rol === "Prestador";

  return (
    // Fix (22/09, reportado por el usuario): sin este KeyboardAvoidingView, el teclado tapaba los
    // campos de texto de las secciones (Perfil, Mis servicios, Acerca de mí, Cobros, Verificación)
    // sin dejar forma de verlos mientras se escribe — mismo motivo que en login.tsx/conversacion.
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={{ backgroundColor: colors.paper }}
        contentContainerStyle={[styles.contenido, { paddingTop: insets.top + 20 }]}
      >
      <Text style={[styles.eyebrow, { color: colors.copper }]}>MI CUENTA</Text>
      <Text style={[styles.h1, { color: colors.ink }]}>
        {perfil.nombre} {perfil.apellido}
      </Text>

      {esPrestador && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={{ gap: 8 }}>
          {SECCIONES.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setSeccion(s.id)}
              style={[
                styles.tabChip,
                {
                  borderColor: seccion === s.id ? colors.copper : colors.border,
                  backgroundColor: seccion === s.id ? colors.copper : "transparent",
                },
              ]}
            >
              <Text style={{ color: seccion === s.id ? colors.paper : colors.inkMuted, fontSize: 12 }}>{s.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Aviso de verificación pendiente (22/09) — mismo aviso que fixit-web, ver el bloqueo real
          del lado del backend en BusquedaService/CategoriaService. No se muestra si ya está
          verificado, ni parado en la pestaña Verificación. */}
      {esPrestador && !perfil.verificado && seccion !== "verificacion" && (
        <View style={[styles.avisoVerificacion, { backgroundColor: colors.safety + "1A", borderColor: colors.safety + "4D" }]}>
          <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 18 }}>
            <Text style={{ fontWeight: "700" }}>Todavía no estás verificado.</Text> Para aparecer en las búsquedas y que los clientes puedan contratarte, tenés que verificar tu cuenta.
          </Text>
          <Pressable onPress={() => setSeccion("verificacion")} style={{ marginTop: 6 }}>
            <Text style={{ color: colors.copper, fontSize: 13, fontWeight: "600" }}>Verificar ahora →</Text>
          </Pressable>
        </View>
      )}

      <View style={{ marginTop: 16, marginBottom: 16 }}>
        {(!esPrestador || seccion === "perfil") && <PerfilSeccion perfil={perfil} onPerfilActualizado={setPerfil} />}
        {esPrestador && seccion === "servicios" && <ServiciosSeccion onIrAVerificacion={() => setSeccion("verificacion")} />}
        {esPrestador && seccion === "acerca" && <AcercaSeccion />}
        {esPrestador && seccion === "cobertura" && <CoberturaSeccion perfil={perfil} />}
        {esPrestador && seccion === "horarios" && <HorariosSeccion />}
        {esPrestador && seccion === "verificacion" && <VerificacionSeccion />}
        {esPrestador && seccion === "cobros" && <CobrosSeccion perfil={perfil} onPerfilActualizado={setPerfil} />}
        {esPrestador && seccion === "ganancias" && <GananciasSeccion />}
      </View>

      <Pressable onPress={cerrarSesion} style={[styles.botonSalir, { borderColor: colors.border }]}>
        <LogOut size={16} color={colors.ink} />
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "600" }}>Cerrar sesión</Text>
      </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  contenido: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: "700", marginBottom: 4 },
  h1: { fontSize: 22, fontWeight: "700", marginBottom: 14 },
  tabsScroll: { marginBottom: 4 },
  avisoVerificacion: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 12 },
  tabChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  botonSalir: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
});
