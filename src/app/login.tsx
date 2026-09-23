import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Wrench } from "lucide-react-native";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { iniciarSesionConGoogle, esErrorDeCancelacion } from "@/lib/googleSignIn";
import {
  LoginRequest,
  LoginResponse,
  LoginGoogleRequest,
  LoginGoogleResponse,
  CompletarRegistroGoogleRequest,
} from "@/types/auth";

// Pantalla pública (fuera del guard de auth, ver app/_layout.tsx). Espejo mobile de
// fixit-web/app/(auth)/login/page.tsx: mismo flujo de 2 pasos para Google (login directo si el
// usuario ya existe, o "elegí tu rol" si es la primera vez), pero con el SDK nativo de Google
// Sign-In en vez del botón de @react-oauth/google de la web.
export default function LoginScreen() {
  const colors = useFixitColors();
  const { guardarSesion } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);

  const [pendienteDeRol, setPendienteDeRol] = useState<{ idToken: string; nombre: string } | null>(null);
  const [rolElegido, setRolElegido] = useState<"cliente" | "prestador">("cliente");

  async function handleSubmit() {
    if (!email.trim() || !password) return;
    setError(null);
    setCargando(true);
    try {
      const body: LoginRequest = { email: email.trim(), password };
      const resultado = await apiFetch<LoginResponse>("/api/Auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      // No hace falta navegar a mano: en cuanto hay usuario guardado, el guard del layout raíz
      // (Stack.Protected) deja de permitir esta pantalla y pasa solo a las pestañas principales.
      await guardarSesion(resultado.token, resultado.usuario);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error inesperado. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setCargandoGoogle(true);
    try {
      const idToken = await iniciarSesionConGoogle();
      const body: LoginGoogleRequest = { idToken };
      const resultado = await apiFetch<LoginGoogleResponse>("/api/Auth/google", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (resultado.requiereRol) {
        setPendienteDeRol({ idToken: resultado.idTokenPendiente!, nombre: resultado.nombrePendiente ?? "" });
        return;
      }

      await guardarSesion(resultado.token!, resultado.usuario!);
    } catch (err) {
      if (!esErrorDeCancelacion(err)) {
        setError(err instanceof ApiError ? err.message : "Error al iniciar sesión con Google");
      }
    } finally {
      setCargandoGoogle(false);
    }
  }

  async function handleCompletarRegistro() {
    if (!pendienteDeRol) return;
    setError(null);
    setCargando(true);
    try {
      const body: CompletarRegistroGoogleRequest = { idToken: pendienteDeRol.idToken, rol: rolElegido };
      const resultado = await apiFetch<LoginResponse>("/api/Auth/google/completar", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await guardarSesion(resultado.token, resultado.usuario);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al completar el registro");
    } finally {
      setCargando(false);
    }
  }

  if (pendienteDeRol) {
    return (
      <View style={[styles.pantalla, { backgroundColor: colors.paper, justifyContent: "center" }]}>
        <View style={styles.contenido}>
          <Text style={[styles.eyebrow, { color: colors.copper }]}>UN PASO MÁS</Text>
          <Text style={[styles.titulo, { color: colors.ink }]}>Hola, {pendienteDeRol.nombre}</Text>
          <Text style={[styles.subtitulo, { color: colors.inkMuted, marginBottom: 24 }]}>
            Contanos qué querés hacer en FixIt.
          </Text>

          {(["cliente", "prestador"] as const).map((rol) => (
            <Pressable
              key={rol}
              onPress={() => setRolElegido(rol)}
              style={[
                styles.opcionRol,
                {
                  borderColor: rolElegido === rol ? colors.copper : colors.border,
                  backgroundColor: rolElegido === rol ? `${colors.copper}15` : colors.surface,
                },
              ]}
            >
              <Text style={{ color: colors.ink, fontWeight: rolElegido === rol ? "700" : "500" }}>
                {rol === "cliente" ? "Quiero contratar servicios" : "Quiero ofrecer servicios"}
              </Text>
            </Pressable>
          ))}

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={handleCompletarRegistro}
            disabled={cargando}
            style={[styles.boton, { backgroundColor: colors.copper, opacity: cargando ? 0.6 : 1 }]}
          >
            {cargando ? <ActivityIndicator color="#FFF8F0" /> : <Text style={styles.botonTexto}>Continuar</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    // Fix (22/09, reportado por el usuario): en Android `behavior: undefined` dependía de que el
    // sistema operativo redimensionara la ventana solo al abrirse el teclado (windowSoftInputMode
    // "adjustResize", el default histórico de RN/Expo) — pero con edge-to-edge obligatorio desde
    // Android 15 (ver el fix de insets más arriba en este mismo archivo del backlog), ese
    // redimensionado automático ya no es confiable, así que la pantalla quedaba tapada por el
    // teclado sin que nada la empujara hacia arriba. "height" hace ese trabajo a mano, igual que ya
    // se necesitaba en el chat (ver conversacion/[id].tsx).
    <KeyboardAvoidingView
      style={[styles.pantalla, { backgroundColor: colors.paper }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.contenido}>
        <View style={styles.marca}>
          <View style={[styles.logoBox, { backgroundColor: colors.nav }]}>
            <Wrench size={22} color={colors.copper} strokeWidth={2.2} />
          </View>
          <Text style={[styles.marcaTexto, { color: colors.ink }]}>FixIt</Text>
        </View>

        <Text style={[styles.subtitulo, { color: colors.inkMuted }]}>
          Conectá con el prestador que necesitás, cerca tuyo.
        </Text>

        <Text style={[styles.titulo, { color: colors.ink }]}>Iniciar sesión</Text>

        <Pressable
          onPress={handleGoogle}
          disabled={cargandoGoogle}
          style={[
            styles.botonGoogle,
            { borderColor: colors.border, backgroundColor: colors.surface, opacity: cargandoGoogle ? 0.6 : 1 },
          ]}
        >
          {cargandoGoogle ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 14 }}>Continuar con Google</Text>
          )}
        </Pressable>

        <View style={styles.separadorFila}>
          <View style={[styles.separadorLinea, { backgroundColor: colors.border }]} />
          <Text style={{ color: colors.inkMuted, fontSize: 11 }}>O CON TU EMAIL</Text>
          <View style={[styles.separadorLinea, { backgroundColor: colors.border }]} />
        </View>

        <Text style={[styles.label, { color: colors.ink }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="tu@email.com"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={[
            styles.input,
            { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink },
          ]}
        />

        <Text style={[styles.label, { color: colors.ink, marginTop: 14 }]}>Contraseña</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.inkMuted}
          secureTextEntry
          autoComplete="password"
          style={[
            styles.input,
            { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink },
          ]}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={handleSubmit}
          disabled={cargando || !email.trim() || !password}
          style={({ pressed }) => [
            styles.boton,
            { backgroundColor: colors.copper, opacity: cargando || !email.trim() || !password ? 0.5 : pressed ? 0.85 : 1 },
          ]}
        >
          {cargando ? (
            <ActivityIndicator color="#FFF8F0" />
          ) : (
            <Text style={styles.botonTexto}>Iniciar sesión</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { flex: 1, justifyContent: "center", paddingHorizontal: 28, gap: 4 },
  marca: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  logoBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  marcaTexto: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: "700", marginBottom: 6 },
  subtitulo: { fontSize: 14, marginBottom: 32, lineHeight: 19 },
  titulo: { fontSize: 26, fontWeight: "700", marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15 },
  error: { color: "#C0392B", fontSize: 13, marginTop: 14 },
  boton: { borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 22 },
  botonTexto: { color: "#FFF8F0", fontSize: 15, fontWeight: "600" },
  botonGoogle: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  separadorFila: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 18 },
  separadorLinea: { flex: 1, height: 1 },
  opcionRol: { borderWidth: 1.5, borderRadius: 12, padding: 14, marginBottom: 10 },
});
