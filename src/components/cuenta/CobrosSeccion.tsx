import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch, ApiError } from "@/lib/api";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { ActualizarDatosCobroRequest, PerfilPropio } from "@/types/perfilPropio";
import SelectorModal, { BotonSelector } from "@/components/SelectorModal";

type Props = {
  perfil: PerfilPropio;
  onPerfilActualizado: (perfil: PerfilPropio) => void;
};

// 0 = Domingo ... 6 = Sábado, mismo orden que usa el backend (DayOfWeek de .NET).
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Reemplaza la vieja conexión OAuth de Mercado Pago (split payments) por la carga manual de
// CBU/alias: con el modelo de retención, el dinero del cliente queda en la cuenta de Mercado
// Pago de FixIt, y cuando el cliente marca el trabajo como completado un Admin le transfiere
// manualmente al prestador su parte por transferencia bancaria a este CBU/alias (que puede ser
// tranquilamente un alias de Mercado Pago, funciona igual que uno bancario).
export default function CobrosSeccion({ perfil, onPerfilActualizado }: Props) {
  const colors = useFixitColors();
  const [cbuOAlias, setCbuOAlias] = useState(perfil.cbuOAlias ?? "");
  const [titular, setTitular] = useState(perfil.titularCuentaCobro ?? "");
  // 29/09: día de la semana en el que el prestador prefiere recibir la transferencia — solo
  // informativo para que Oficy organice cuándo transferirle, no cambia cuándo se libera el pago.
  const [diaPreferido, setDiaPreferido] = useState<number | null>(perfil.diaPreferidoDeCobro ?? null);
  const [modalDiaAbierto, setModalDiaAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const etiquetaDia = diaPreferido === null ? "Sin preferencia" : DIAS[diaPreferido];

  async function handleGuardar() {
    setError(null);
    setGuardado(false);

    if (!cbuOAlias.trim() || !titular.trim()) {
      setError("Completá el CBU/alias y el titular de la cuenta.");
      return;
    }

    setGuardando(true);
    try {
      const cuerpo: ActualizarDatosCobroRequest = {
        cbuOAlias: cbuOAlias.trim(),
        titularCuentaCobro: titular.trim(),
        diaPreferidoDeCobro: diaPreferido,
      };
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

        <View>
          <Text style={[styles.label, { color: colors.inkMuted }]}>Día preferido para cobrar</Text>
          <BotonSelector label={etiquetaDia} onPress={() => setModalDiaAbierto(true)} />
          <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 4 }}>
            Es solo una referencia para que Oficy organice las transferencias — no cambia cuándo se
            libera tu pago.
          </Text>
        </View>

        <SelectorModal
          visible={modalDiaAbierto}
          opciones={[{ value: "sin-preferencia", label: "Sin preferencia" }, ...DIAS.map((d, i) => ({ value: String(i), label: d }))]}
          valorActual={diaPreferido === null ? "sin-preferencia" : String(diaPreferido)}
          onSeleccionar={(v) => setDiaPreferido(v === "sin-preferencia" ? null : Number(v))}
          onCerrar={() => setModalDiaAbierto(false)}
          titulo="Día preferido para cobrar"
        />

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
