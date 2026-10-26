import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { apiFetch, ApiError } from "@/lib/api";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { nombrePeriodo, pesos } from "@/lib/cobros";
import { ESTADO_RESUMEN_LABEL, EstadoResumen, MiPlan } from "@/types/cobros";

// "Mi plan" del prestador (26/10, nuevo sistema de cobros, fase 5 mobile). Espejo de
// fixit-web/app/mi-plan/page.tsx: el cliente le paga directo al profesional y Oficy le cobra al
// profesional un monto fijo por trabajo confirmado, con tope mensual. Acá ve cuánto lleva en el
// mes, si es fundador, sus resúmenes mensuales, y los paga con Mercado Pago.
//
// El pago se abre en el navegador del sistema (WebBrowser). La vuelta de Mercado Pago apunta a la
// web (/mi-plan?pago=...), así que al cerrar el navegador recargamos un par de veces para que el
// resumen aparezca pagado apenas llegue el webhook.

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

const ROJO = "#C0392B";

export default function MiPlanSeccion() {
  const colors = useFixitColors();
  const router = useRouter();
  const [plan, setPlan] = useState<MiPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagandoId, setPagandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setPlan(await apiFetch<MiPlan>("/api/cobros/mi-plan"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos cargar tu plan");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function pagar(resumenId: string) {
    setPagandoId(resumenId);
    setError(null);
    try {
      const { initPoint } = await apiFetch<{ initPoint: string }>(`/api/cobros/resumenes/${resumenId}/pagar`, {
        method: "POST",
      });
      await WebBrowser.openBrowserAsync(initPoint);
      // Volvió del navegador: el webhook puede tardar unos segundos en marcar el resumen pagado.
      await cargar();
      setTimeout(cargar, 4000);
      setTimeout(cargar, 10000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos generar el link de pago");
    } finally {
      setPagandoId(null);
    }
  }

  function colorEstado(estado: EstadoResumen): string {
    switch (estado) {
      case "Pendiente":
        return colors.safetyText;
      case "Pagado":
        return colors.stamp;
      case "Vencido":
        return ROJO;
      case "Bonificado":
        return colors.copperText;
      default:
        return colors.inkMuted;
    }
  }

  if (!plan) {
    return (
      <View style={{ paddingVertical: 20, alignItems: "center" }}>
        {error ? <Text style={{ color: ROJO, fontSize: 13 }}>{error}</Text> : <ActivityIndicator color={colors.copper} />}
      </View>
    );
  }

  const tarifa = plan.tarifa;
  const porcentajeTope =
    tarifa && tarifa.topeMensual > 0 ? Math.min(100, (plan.cargoMesActual / tarifa.topeMensual) * 100) : 0;
  const pendientes = plan.resumenes.filter((r) => r.estado === "Pendiente" || r.estado === "Vencido");

  return (
    <View style={{ gap: 14 }}>
      {error && <Text style={{ color: ROJO, fontSize: 13 }}>{error}</Text>}

      {plan.suspendido && (
        <View style={[styles.caja, { borderColor: `${ROJO}66`, backgroundColor: `${ROJO}0D` }]}>
          <Text style={{ color: ROJO, fontWeight: "700", fontSize: 14 }}>Tu cuenta está suspendida</Text>
          <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
            Tenés un resumen vencido sin pagar. Mientras tanto no aparecés en las búsquedas y no podés chatear con
            clientes nuevos. Apenas lo pagás, se reactiva todo.
          </Text>
        </View>
      )}

      {plan.esFundador && plan.fundadorHasta && (
        <View style={[styles.caja, { borderWidth: 2, borderColor: colors.copper, backgroundColor: `${colors.copper}0D` }]}>
          <Text style={[styles.eyebrow, { color: colors.copperText }]}>PROFESIONAL FUNDADOR</Text>
          <Text style={{ color: colors.ink, fontSize: 13.5, lineHeight: 19, marginTop: 4 }}>
            No pagás nada hasta el <Text style={{ fontWeight: "700" }}>{fecha(plan.fundadorHasta)}</Text>. Gracias por
            ayudarnos a construir Oficy.
          </Text>
          {plan.ahorroFundadorTotal > 0 && (
            <Text style={{ color: colors.inkMuted, fontSize: 12, marginTop: 4 }}>
              Hasta ahora te ahorraste {pesos(plan.ahorroFundadorTotal)}.
            </Text>
          )}
        </View>
      )}

      {/* Mes en curso */}
      <View style={[styles.caja, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.filaEntre}>
          <Text style={{ color: colors.inkMuted, fontSize: 13 }}>{nombrePeriodo(plan.periodoActual)}</Text>
          <Text style={{ color: colors.inkMuted, fontSize: 11 }}>
            {plan.trabajosMesActual} {plan.trabajosMesActual === 1 ? "trabajo confirmado" : "trabajos confirmados"}
          </Text>
        </View>
        <Text style={{ color: colors.ink, fontSize: 30, fontWeight: "800", marginTop: 2 }}>{pesos(plan.cargoMesActual)}</Text>
        <Text style={{ color: colors.inkMuted, fontSize: 11.5 }}>
          {plan.esFundador ? "Bonificado: no se te cobra." : "Acumulado este mes. Se factura el día 1 del mes que viene."}
        </Text>
        {tarifa && tarifa.topeMensual > 0 && !plan.esFundador && (
          <View style={{ marginTop: 10 }}>
            <View style={[styles.barraFondo, { backgroundColor: colors.border }]}>
              <View style={[styles.barra, { backgroundColor: colors.copperAccion, width: `${porcentajeTope}%` }]} />
            </View>
            <Text style={{ color: colors.inkMuted, fontSize: 11.5, marginTop: 6, lineHeight: 16 }}>
              {plan.topeAlcanzado
                ? `Llegaste al tope de ${pesos(tarifa.topeMensual)}: el resto de los trabajos del mes no te cuestan nada.`
                : `Tope del mes: ${pesos(tarifa.topeMensual)}. Pasado ese monto, los trabajos del mes no te cuestan nada.`}
            </Text>
          </View>
        )}
      </View>

      {/* Deuda */}
      {pendientes.length > 0 && (
        <View style={[styles.caja, { borderColor: `${colors.safety}66`, backgroundColor: `${colors.safety}0D`, gap: 12 }]}>
          <Text style={{ color: colors.ink, fontSize: 13.5, lineHeight: 19 }}>
            Tenés {pendientes.length === 1 ? "un resumen" : `${pendientes.length} resúmenes`} para pagar por un total de{" "}
            <Text style={{ fontWeight: "700" }}>{pesos(plan.deudaTotal)}</Text>.
          </Text>
          {pendientes.map((r) => (
            <View key={r.id} style={{ gap: 8 }}>
              <View>
                <Text style={{ color: colors.ink, fontSize: 13 }}>{nombrePeriodo(r.periodo)}</Text>
                <Text style={{ color: r.estado === "Vencido" ? ROJO : colors.inkMuted, fontSize: 11.5 }}>
                  {r.estado === "Vencido" ? "Venció" : "Vence"} el {fecha(r.venceEn)}
                </Text>
              </View>
              <Pressable
                onPress={() => pagar(r.id)}
                disabled={pagandoId !== null}
                style={[styles.botonPagar, { backgroundColor: colors.safety, opacity: pagandoId !== null ? 0.5 : 1 }]}
              >
                {pagandoId === r.id ? (
                  <ActivityIndicator color={colors.onSafety} />
                ) : (
                  <Text style={{ color: colors.onSafety, fontWeight: "700", fontSize: 14 }}>Pagar {pesos(r.total)}</Text>
                )}
              </Pressable>
            </View>
          ))}
          <Text style={{ color: colors.inkMuted, fontSize: 11, lineHeight: 15 }}>
            Se paga con Mercado Pago. Si preferís transferencia, escribinos y lo registramos a mano.
          </Text>
        </View>
      )}

      {/* Historial */}
      <View>
        <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "700", marginBottom: 8 }}>Resúmenes</Text>
        {plan.resumenes.length === 0 ? (
          <Text style={{ color: colors.inkMuted, fontSize: 13 }}>
            Todavía no tenés resúmenes. El primero se genera el día 1 del mes que viene.
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {plan.resumenes.map((r) => (
              <View key={r.id} style={[styles.filaResumen, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontSize: 13 }}>{nombrePeriodo(r.periodo)}</Text>
                  <Text style={{ color: colors.inkMuted, fontSize: 11.5, marginTop: 2 }}>
                    {r.cantidadTrabajos} {r.cantidadTrabajos === 1 ? "trabajo" : "trabajos"}
                    {r.trabajosBonificados > 0 ? ` · ${r.trabajosBonificados} bonificados` : ""}
                    {r.ahorro > 0 ? ` · ahorraste ${pesos(r.ahorro)}` : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "600" }}>{pesos(r.total)}</Text>
                  <View style={[styles.badge, { borderColor: colorEstado(r.estado) }]}>
                    <Text style={{ color: colorEstado(r.estado), fontSize: 9.5, fontWeight: "700", letterSpacing: 0.4 }}>
                      {ESTADO_RESUMEN_LABEL[r.estado].toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Cómo funciona */}
      {tarifa && (
        <View style={[styles.comoFunciona, { borderTopColor: colors.border }]}>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "600" }}>Cómo funciona</Text>
          <Text style={[styles.parrafo, { color: colors.inkMuted }]}>
            El cliente te paga directo a vos, como prefieran (efectivo, transferencia, Mercado Pago). Cobrás el total.
          </Text>
          <Text style={[styles.parrafo, { color: colors.inkMuted }]}>
            Oficy te cobra {pesos(tarifa.montoPorTrabajo)} por cada trabajo confirmado en la app, con un tope de{" "}
            {pesos(tarifa.topeMensual)} por mes.
          </Text>
          <Text style={[styles.parrafo, { color: colors.inkMuted }]}>
            Un trabajo se confirma cuando el cliente lo confirma, cuando cargás su código de cierre o, si marcaste
            «Terminé», a las 72 horas sin respuesta.
          </Text>
          <Text style={[styles.parrafo, { color: colors.inkMuted }]}>
            El resumen del mes se genera el día 1 y vence el día 10. Si a los 5 días sigue sin pagar, la cuenta se
            suspende hasta que se pague.
          </Text>
          <Pressable onPress={() => router.push("/ordenes")} style={{ marginTop: 4 }}>
            <Text style={{ color: colors.copperText, fontSize: 13, fontWeight: "600" }}>Ver mis órdenes →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { borderWidth: 1, borderRadius: 12, padding: 14 },
  eyebrow: { fontSize: 10.5, letterSpacing: 1.2, fontWeight: "700" },
  filaEntre: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  barraFondo: { height: 8, borderRadius: 4, overflow: "hidden" },
  barra: { height: "100%", borderRadius: 4 },
  botonPagar: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  filaResumen: { borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  badge: { borderWidth: 1.5, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, marginTop: 4 },
  comoFunciona: { borderTopWidth: 1, paddingTop: 14, gap: 6 },
  parrafo: { fontSize: 12.5, lineHeight: 18 },
});
