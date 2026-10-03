import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Target, ArrowRight, Sparkles } from "lucide-react-native";
import { apiFetch, ApiError } from "@/lib/api";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { ObjetivoIngreso } from "@/types/objetivoIngreso";

// "Sueldo pretendido" (29/09) — espejo mobile de fixit-web/components/ObjetivoIngresoCard.tsx.
// Ver claude/aviso-pago-y-sueldo-pretendido-28-09.md y el mockup aprobado
// (https://claude.ai/artifact/P9fv7JsS3icspJp99dasT4). Vive en la pantalla de Inicio del
// prestador (src/app/(tabs)/inicio.tsx).

function formatoMonto(monto: number): string {
  return `$${Math.round(monto).toLocaleString("es-AR")}`;
}

function limpiarMonto(texto: string): number {
  const soloDigitos = texto.replace(/[^\d]/g, "");
  return soloDigitos ? parseInt(soloDigitos, 10) : 0;
}

export default function ObjetivoIngresoCard() {
  const colors = useFixitColors();
  const [objetivo, setObjetivo] = useState<ObjetivoIngreso | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [montoInput, setMontoInput] = useState("");
  const [ticketInput, setTicketInput] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    try {
      const data = await apiFetch<ObjetivoIngreso>("/api/prestador/objetivo-ingreso");
      setObjetivo(data);
    } catch {
      // Best-effort: si falla, la tarjeta simplemente no se muestra esta vez.
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function abrirEdicion() {
    setMontoInput(objetivo?.montoMensual ? Math.round(objetivo.montoMensual).toLocaleString("es-AR") : "");
    setTicketInput(
      objetivo?.ticketEsManual && objetivo.ticketPromedio ? Math.round(objetivo.ticketPromedio).toLocaleString("es-AR") : ""
    );
    setError(null);
    setEditando(true);
  }

  async function guardarObjetivo() {
    const monto = limpiarMonto(montoInput);
    if (monto <= 0) {
      setError("Ingresá un monto mayor a cero.");
      return;
    }
    const ticket = ticketInput.trim() ? limpiarMonto(ticketInput) : null;

    setGuardando(true);
    setError(null);
    try {
      const data = await apiFetch<ObjetivoIngreso>("/api/prestador/objetivo-ingreso", {
        method: "PUT",
        body: JSON.stringify({ montoMensual: monto, ticketPromedioManual: ticket }),
      });
      setObjetivo(data);
      setEditando(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos guardar tu objetivo.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando || !objetivo) return null;

  const mesActual = new Date().toLocaleDateString("es-AR", { month: "long" });

  // Estado: formulario (sin objetivo todavía, o editando uno existente)
  if (!objetivo.tieneObjetivo || editando) {
    return (
      <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: "center" }]}>
        <View style={[styles.iconoTarget, { backgroundColor: colors.copper }]}>
          <Target size={20} color={colors.paper} />
        </View>
        <Text style={[styles.titulo, { color: colors.ink, textAlign: "center", marginTop: 10 }]}>
          ¿Cuánto querés ganar este mes?
        </Text>
        <Text style={{ color: colors.inkMuted, fontSize: 12.5, textAlign: "center", marginTop: 4, lineHeight: 17 }}>
          Contanos tu objetivo y te mostramos el camino: cuántos trabajos más te faltan según tu ticket promedio.
        </Text>

        <View style={{ width: "100%", marginTop: 16 }}>
          <Text style={[styles.label, { color: colors.inkMuted }]}>SUELDO PRETENDIDO ESTE MES</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.ink, backgroundColor: colors.paper }]}
            placeholder="$2.000.000"
            placeholderTextColor={colors.inkMuted}
            keyboardType="numeric"
            value={montoInput}
            onChangeText={setMontoInput}
          />
        </View>

        <View style={{ width: "100%", marginTop: 12 }}>
          <Text style={[styles.label, { color: colors.inkMuted }]}>TU TICKET PROMEDIO (OPCIONAL)</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.ink, backgroundColor: colors.paper }]}
            placeholder={objetivo.ticketDisponible ? formatoMonto(objetivo.ticketPromedio) : "Ej. $100.000"}
            placeholderTextColor={colors.inkMuted}
            keyboardType="numeric"
            value={ticketInput}
            onChangeText={setTicketInput}
          />
          <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 4 }}>
            {objetivo.ticketDisponible
              ? "Si no lo completás, usamos el promedio real de tus trabajos."
              : "Todavía no tenés trabajos completados — sin este dato no podemos calcular el camino."}
          </Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={{ flexDirection: "row", gap: 10, marginTop: 16, width: "100%" }}>
          {editando && objetivo.tieneObjetivo && (
            <Pressable onPress={() => setEditando(false)} style={styles.botonCancelar}>
              <Text style={{ color: colors.inkMuted, fontSize: 13, textAlign: "center" }}>Cancelar</Text>
            </Pressable>
          )}
          <Pressable
            onPress={guardarObjetivo}
            disabled={guardando}
            style={[styles.botonGuardar, { backgroundColor: colors.copper, opacity: guardando ? 0.6 : 1 }]}
          >
            {guardando ? <ActivityIndicator color={colors.paper} /> : <Text style={styles.botonGuardarTexto}>Establecer objetivo</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  // Estado: cumplido
  if (objetivo.cumplido) {
    return (
      <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.filaEntre}>
          <View style={{ gap: 2 }}>
            <View style={styles.filaIconoLabel}>
              <Target size={14} color={colors.stamp} />
              <Text style={[styles.eyebrow, { color: colors.stamp }]}>OBJETIVO DE {mesActual.toUpperCase()} — CUMPLIDO</Text>
            </View>
            <Text style={[styles.montoGrande, { color: colors.ink }]}>{formatoMonto(objetivo.montoMensual ?? 0)}</Text>
          </View>
          <Pressable onPress={abrirEdicion}>
            <Text style={{ color: colors.inkMuted, fontSize: 11.5, fontWeight: "600" }}>Nuevo objetivo</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 14 }}>
          <View style={[styles.filaEntre, { marginBottom: 6 }]}>
            <Text style={{ color: colors.inkMuted, fontSize: 12.5 }}>
              Llevás <Text style={{ color: colors.ink, fontWeight: "700" }}>{formatoMonto(objetivo.gananciaDelMes)}</Text> este mes
            </Text>
            <Text style={{ color: colors.stamp, fontSize: 13, fontWeight: "700" }}>{Math.round(objetivo.porcentajeProgreso)}%</Text>
          </View>
          <View style={[styles.barraFondo, { backgroundColor: colors.border }]}>
            <View style={[styles.barraProgreso, { backgroundColor: colors.stamp, width: "100%" }]} />
          </View>
        </View>

        <View style={[styles.cajaCumplido, { backgroundColor: `${colors.stamp}14`, borderColor: `${colors.stamp}40` }]}>
          <View style={[styles.iconoCumplido, { backgroundColor: colors.stamp }]}>
            <Sparkles size={16} color={colors.paper} />
          </View>
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700", marginTop: 8 }}>¡Llegaste a tu objetivo!</Text>
          <Text style={{ color: colors.inkMuted, fontSize: 12, textAlign: "center", marginTop: 4, lineHeight: 16 }}>
            Completaste {objetivo.trabajosCompletadosDelMes} trabajos este mes. Es un buen momento para pensar tu próxima meta.
          </Text>
        </View>
      </View>
    );
  }

  // Estado: en progreso
  return (
    <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.filaEntre}>
        <View style={{ gap: 2 }}>
          <View style={styles.filaIconoLabel}>
            <Target size={14} color={colors.copper} />
            <Text style={[styles.eyebrow, { color: colors.copper }]}>TU OBJETIVO DE {mesActual.toUpperCase()}</Text>
          </View>
          <Text style={[styles.montoGrande, { color: colors.ink }]}>{formatoMonto(objetivo.montoMensual ?? 0)}</Text>
        </View>
        <Pressable onPress={abrirEdicion}>
          <Text style={{ color: colors.inkMuted, fontSize: 11.5, fontWeight: "600" }}>Cambiar objetivo</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 14 }}>
        <View style={[styles.filaEntre, { marginBottom: 6 }]}>
          <Text style={{ color: colors.inkMuted, fontSize: 12.5 }}>
            Llevás <Text style={{ color: colors.ink, fontWeight: "700" }}>{formatoMonto(objetivo.gananciaDelMes)}</Text> este mes
          </Text>
          <Text style={{ color: colors.copper, fontSize: 13, fontWeight: "700" }}>{Math.round(objetivo.porcentajeProgreso)}%</Text>
        </View>
        <View style={[styles.barraFondo, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.barraProgreso,
              { backgroundColor: colors.copper, width: `${Math.min(100, Math.max(0, objetivo.porcentajeProgreso))}%` },
            ]}
          />
        </View>
      </View>

      {objetivo.ticketDisponible && objetivo.trabajosFaltantes !== null ? (
        <View style={[styles.cajaCamino, { backgroundColor: `${colors.copper}14`, borderColor: `${colors.copper}40` }]}>
          <View style={[styles.iconoCamino, { backgroundColor: colors.copper }]}>
            <ArrowRight size={14} color={colors.paper} />
          </View>
          <Text style={{ color: colors.ink, fontSize: 12.5, flex: 1, lineHeight: 17 }}>
            Con tu ticket promedio de <Text style={{ fontWeight: "700" }}>{formatoMonto(objetivo.ticketPromedio)}</Text>, te faltan{" "}
            <Text style={{ fontWeight: "700" }}>{objetivo.trabajosFaltantes} trabajos más</Text> este mes para llegar a tu objetivo.
          </Text>
        </View>
      ) : (
        <View style={[styles.cajaCamino, { backgroundColor: `${colors.ink}0A`, borderColor: "transparent" }]}>
          <Text style={{ color: colors.inkMuted, fontSize: 12.5, flex: 1, lineHeight: 17 }}>
            Todavía no tenemos suficientes datos para calcular tu camino — completá tu ticket promedio en{" "}
            <Text style={{ color: colors.copper, fontWeight: "700" }} onPress={abrirEdicion}>
              tu objetivo
            </Text>{" "}
            para verlo.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderRadius: 16, padding: 18, marginHorizontal: 20, marginTop: 16 },
  iconoTarget: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  titulo: { fontSize: 16, fontWeight: "700" },
  label: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.4, marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontWeight: "600" },
  error: { color: "#C0392B", fontSize: 12, marginTop: 8 },
  botonCancelar: { flex: 1, justifyContent: "center", paddingVertical: 12 },
  botonGuardar: { flex: 2, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  botonGuardarTexto: { color: "#fff", fontSize: 14, fontWeight: "700" },
  filaEntre: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  filaIconoLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrow: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.4 },
  montoGrande: { fontSize: 22, fontWeight: "800", marginTop: 2 },
  barraFondo: { height: 10, borderRadius: 5, overflow: "hidden" },
  barraProgreso: { height: "100%", borderRadius: 5 },
  cajaCamino: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1, borderRadius: 12, padding: 13, marginTop: 14 },
  iconoCamino: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 1 },
  cajaCumplido: { alignItems: "center", borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 14 },
  iconoCumplido: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
