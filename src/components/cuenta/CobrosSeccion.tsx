import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch, ApiError } from "@/lib/api";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { ActualizarDatosCobroRequest, PerfilPropio } from "@/types/perfilPropio";

type Props = {
  perfil: PerfilPropio;
  onPerfilActualizado: (perfil: PerfilPropio) => void;
};

// Reemplaza la vieja conexión OAuth de Mercado Pago (split payments) por la carga manual de
// CBU/alias: con el modelo de retención, el dinero del cliente queda en la cuenta de Mercado
// Pago de FixIt, y cuando el cliente marca el trabajo como completado un Admin le transfiere
// manualmente al prestador su parte por transferencia bancaria a este CBU/alias.
export default function CobrosSeccion({ perfil, onPerfilActualizado }: Props) {
  const colors = useFixitColors();
  const [cbuOAlias, setCbuOAlias] = useState(perfil.cbuOAlias ?? "");
  const [titular, setTitular] = useState(perfil.titularCuentaCobro ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function handleGuardar() {
    setError(null);
    setGuardado(false);

    if (!cbuOAlias.trim() || !titular.trim()) {
      setError("Completá el CBU/alias y el titular de la cuenta.");
      return;
    }

    setGuardando(true);
    try {
      const cuerpo: ActualizarDatosCobroRequest = { cbuOAlias: cbuOAlias.trim(), titularCuentaCobro: titular.trim() };
      const data = await apiFetch<PerfilPropio>("/api/usuarios/datos-cobro", {
        method: "PUT",
        body: JSON.stringify(cuerpo),
      });
      onPerfilActualizado(data);
      setGuardado(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar tus datos de cobro");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.titulo, { color: colors.ink }]}>Cobros</Text>
      <Text style={{ color: colors.inkMuted, fontSize: 12, marginBottom: 14 }}>
        Cargá el CBU o alias donde querés que te transfiramos tu parte de cada trabajo, una vez que
        el cliente lo marca como completado. La transferencia la hace un Admin de Oficy a mano.
      </Text>

      <View style={{ gap: 12 }}>
        <View>
          <Text style={[styles.label, { color: colors.inkMuted }]}>CBU o alias</Text>
          <TextInput
            value={cbuOAlias}
            onChangeText={setCbuOAlias}
            placeholder="Ej: mi.alias.mp"
            placeholderTextColor={colors.inkMuted}
            style={[styles.input, { borderColor: colors.border, color: colors.ink }]}
            autoCapitalize="none"
          />
        </View>

        <View>
          <Text style={[styles.label, { color: colors.inkMuted }]}>Titular de la cuenta</Text>
          <TextInput
            value={titular}
            onChangeText={setTitular}
            placeholder="Nombre y apellido tal como figura en el banco"
            placeholderTextColor={colors.inkMuted}
            style={[styles.input, { borderColor: colors.border, color: colors.ink }]}
          />
        </View>

        <Pressable
          onPress={handleGuardar}
          disabled={guardando}
          style={[styles.boton, { backgroundColor: colors.copper, opacity: guardando ? 0.6 : 1, alignSelf: "flex-start", paddingHorizontal: 18 }]}
        >
          {guardando ? <ActivityIndicator color={colors.paper} /> : <Text style={{ color: colors.paper, fontWeight: "600" }}>Guardar</Text>}
        </Pressable>

        {guardado && <Text style={{ color: colors.stamp, fontSize: 12 }}>✓ Datos de cobro guardados.</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderRadius: 12, padding: 16 },
  titulo: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  error: { color: "#C0392B", fontSize: 12, marginTop: 2 },
  boton: { borderRadius: 8, paddingVertical: 11, alignItems: "center" },
});
