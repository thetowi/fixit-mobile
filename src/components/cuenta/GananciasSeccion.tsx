import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { apiFetch, ApiError } from "@/lib/api";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { GananciasResponse, PeriodoGanancias } from "@/types/ganancias";

const PERIODOS: { id: PeriodoGanancias; label: string }[] = [
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "anio", label: "Año" },
];

function formatearMonto(monto: number): string {
  return `$${Math.round(monto).toLocaleString("es-AR")}`;
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function etiquetaRango(datos: GananciasResponse): string {
  const inicio = new Date(datos.inicio);
  const fin = new Date(new Date(datos.fin).getTime() - 1);

  if (datos.periodo === "semana") {
    const mismoMes = inicio.getMonth() === fin.getMonth();
    const mesInicio = inicio.toLocaleDateString("es-AR", { month: "short" });
    const mesFin = fin.toLocaleDateString("es-AR", { month: "short" });
    return mismoMes
      ? `${inicio.getDate()} – ${fin.getDate()} ${mesInicio}`
      : `${inicio.getDate()} ${mesInicio} – ${fin.getDate()} ${mesFin}`;
  }
  if (datos.periodo === "mes") {
    const label = inicio.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return `${inicio.getFullYear()}`;
}

// Espejo mobile de fixit-web/components/GananciasSeccion.tsx (23/09): mismo modelo de datos
// (GET /api/prestador/ganancias?periodo=&offset=), mismo cálculo de "Liberado" vs "Liquidado" —
// acá con componentes nativos en vez de HTML/Tailwind, siguiendo el patrón de CobrosSeccion.tsx.
export default function GananciasSeccion() {
  const colors = useFixitColors();
  const [periodo, setPeriodo] = useState<PeriodoGanancias>("semana");
  const [offset, setOffset] = useState(0);
  const [datos, setDatos] = useState<GananciasResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trabajoAbiertoId, setTrabajoAbiertoId] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    setError(null);
    apiFetch<GananciasResponse>(`/api/prestador/ganancias?periodo=${periodo}&offset=${offset}`)
      .then(setDatos)
      .catch((e) => setError(e instanceof ApiError ? e.message : "No pudimos cargar tus ganancias."))
      .finally(() => setCargando(false));
  }, [periodo, offset]);

  function cambiarPeriodo(nuevo: PeriodoGanancias) {
    setPeriodo(nuevo);
    setOffset(0);
  }

  const maxDesglose = datos ? Math.max(1, ...datos.desglose.map((d) => d.monto)) : 1;

  return (
    <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.titulo, { color: colors.ink }]}>Ganancias</Text>
      <Text style={{ color: colors.inkMuted, fontSize: 12, marginBottom: 14 }}>
        Lo que ganaste con tus trabajos completados, según el modelo de retención de FixIt.
      </Text>

      {/* Selector de período */}
      <View style={[styles.segmentado, { borderColor: colors.border }]}>
        {PERIODOS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => cambiarPeriodo(p.id)}
            style={[styles.segmentoBoton, { backgroundColor: periodo === p.id ? colors.copper : "transparent" }]}
          >
            <Text style={{ color: periodo === p.id ? colors.paper : colors.inkMuted, fontSize: 13, fontWeight: "600" }}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.navegador}>
        <Pressable onPress={() => setOffset((o) => o - 1)} style={[styles.navBoton, { borderColor: colors.border }]}>
          <Text style={{ color: colors.inkMuted, fontSize: 16 }}>‹</Text>
        </Pressable>
        <Text style={[styles.rangoTexto, { color: colors.ink }]}>{datos ? etiquetaRango(datos) : "..."}</Text>
        <Pressable
          onPress={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset === 0}
          style={[styles.navBoton, { borderColor: colors.border, opacity: offset === 0 ? 0.3 : 1 }]}
        >
          <Text style={{ color: colors.inkMuted, fontSize: 16 }}>›</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {cargando && !datos && <ActivityIndicator color={colors.copper} style={{ marginTop: 12 }} />}

      {datos && (
        <View style={{ gap: 16, marginTop: 14 }}>
          {/* Cards resumen */}
          <View style={{ gap: 8 }}>
            <View style={[styles.card, { borderColor: colors.border }]}>
              <Text style={[styles.cardLabel, { color: colors.inkMuted }]}>Total ganado</Text>
              <Text style={[styles.cardMonto, { color: colors.ink }]}>{formatearMonto(datos.totalGanado)}</Text>
              {datos.comparacionPorcentaje !== null && (
                <Text style={{ color: datos.comparacionPorcentaje >= 0 ? colors.stamp : colors.inkMuted, fontSize: 11, marginTop: 3 }}>
                  {datos.comparacionPorcentaje >= 0 ? "▲" : "▼"} {Math.abs(datos.comparacionPorcentaje)}% vs. período anterior
                </Text>
              )}
            </View>
            <View style={styles.filaCards}>
              <View style={[styles.card, styles.cardMitad, { borderColor: colors.border }]}>
                <Text style={[styles.cardLabel, { color: colors.inkMuted }]}>Pendiente</Text>
                <Text style={[styles.cardMonto, { color: colors.safety, fontSize: 16 }]}>{formatearMonto(datos.totalPendiente)}</Text>
              </View>
              <View style={[styles.card, styles.cardMitad, { borderColor: colors.border }]}>
                <Text style={[styles.cardLabel, { color: colors.inkMuted }]}>Transferido</Text>
                <Text style={[styles.cardMonto, { color: colors.stamp, fontSize: 16 }]}>{formatearMonto(datos.totalTransferido)}</Text>
              </View>
            </View>
            <Text style={{ color: colors.inkMuted, fontSize: 11 }}>
              {datos.trabajosCompletados} trabajo{datos.trabajosCompletados === 1 ? "" : "s"} · promedio {formatearMonto(datos.promedioPorTrabajo)}
              {datos.totalPendiente > 0 ? " · pendiente: esperando que un Admin te transfiera" : ""}
            </Text>
          </View>

          {/* Progreso hacia 10 trabajos gratis */}
          {datos.trabajosGratisRestantes > 0 && (
            <View style={[styles.progresoBox, { borderColor: colors.border }]}>
              <View style={styles.filaEntre}>
                <Text style={{ color: colors.inkMuted, fontSize: 12 }}>Trabajos sin comisión</Text>
                <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "600" }}>{datos.trabajosPagadosTotal}/10</Text>
              </View>
              <View style={[styles.barraFondo, { backgroundColor: colors.border }]}>
                <View style={[styles.barraProgreso, { backgroundColor: colors.copper, width: `${Math.min(100, (datos.trabajosPagadosTotal / 10) * 100)}%` }]} />
              </View>
              <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 6 }}>
                Te quedan {datos.trabajosGratisRestantes} trabajo{datos.trabajosGratisRestantes === 1 ? "" : "s"} antes de que empiece a aplicarse la comisión.
              </Text>
            </View>
          )}

          {/* Desglose */}
          {datos.desglose.length > 0 && (
            <View>
              <Text style={{ color: colors.inkMuted, fontSize: 12, marginBottom: 8 }}>
                {datos.periodo === "semana" ? "Por día" : datos.periodo === "mes" ? "Por semana" : "Por mes"}
              </Text>
              <View style={styles.desgloseFila}>
                {datos.desglose.map((item, i) => (
                  <View key={i} style={styles.desgloseItem}>
                    <View style={styles.desgloseBarraFondo}>
                      <View
                        style={[
                          styles.desgloseBarra,
                          {
                            backgroundColor: item.esPeriodoActual ? colors.copper : colors.border,
                            height: `${Math.max(4, (item.monto / maxDesglose) * 100)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{ color: item.esPeriodoActual ? colors.copper : colors.inkMuted, fontSize: 9, marginTop: 4, fontWeight: item.esPeriodoActual ? "700" : "400" }}
                    >
                      {item.etiqueta}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Detalle trabajo por trabajo */}
          <View>
            <Text style={{ color: colors.inkMuted, fontSize: 12, marginBottom: 8 }}>
              Detalle {datos.periodo === "anio" ? "del año" : datos.periodo === "mes" ? "del mes" : "de la semana"}
            </Text>

            {datos.trabajos.length === 0 ? (
              <View style={[styles.vacio, { borderColor: colors.border }]}>
                <Text style={{ color: colors.inkMuted, fontSize: 13 }}>No completaste trabajos en este período.</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {datos.trabajos.map((t) => (
                  <Pressable
                    key={t.ordenId}
                    onPress={() => setTrabajoAbiertoId(trabajoAbiertoId === t.ordenId ? null : t.ordenId)}
                    style={[styles.trabajoCard, { borderColor: colors.border }]}
                  >
                    <View style={styles.filaEntre}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13 }}>
                          {t.categoriaNombre} · {t.clienteNombreCompleto}
                        </Text>
                        <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 2 }}>{formatearFecha(t.completadoEn)}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "600" }}>{formatearMonto(t.neto)}</Text>
                        <Text style={{ color: t.estado === "Liquidado" ? colors.stamp : colors.safety, fontSize: 10, fontWeight: "700", marginTop: 2 }}>
                          {t.estado.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    {trabajoAbiertoId === t.ordenId && (
                      <View style={[styles.detalleExpandido, { borderColor: colors.border }]}>
                        <Text style={{ color: colors.inkMuted, fontSize: 12 }}>{t.descripcion}</Text>
                        <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 3 }}>
                          Monto total: {formatearMonto(t.montoTotal)} · Comisión FixIt: {formatearMonto(t.comisionPlataforma)}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderRadius: 12, padding: 16 },
  titulo: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  segmentado: { flexDirection: "row", borderWidth: 1, borderRadius: 10, padding: 3, gap: 3 },
  segmentoBoton: { flex: 1, borderRadius: 8, paddingVertical: 7, alignItems: "center" },
  navegador: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10 },
  navBoton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  rangoTexto: { fontSize: 13, fontWeight: "600", minWidth: 130, textAlign: "center" },
  error: { color: "#C0392B", fontSize: 12, marginTop: 10 },
  card: { borderWidth: 1, borderRadius: 10, padding: 12 },
  cardMitad: { flex: 1 },
  filaCards: { flexDirection: "row", gap: 8 },
  cardLabel: { fontSize: 11, marginBottom: 3 },
  cardMonto: { fontSize: 20, fontWeight: "700" },
  filaEntre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progresoBox: { borderWidth: 1, borderRadius: 10, padding: 12 },
  barraFondo: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 8 },
  barraProgreso: { height: "100%", borderRadius: 3 },
  desgloseFila: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 90 },
  desgloseItem: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  desgloseBarraFondo: { width: "100%", flex: 1, justifyContent: "flex-end" },
  desgloseBarra: { width: "100%", borderRadius: 3 },
  vacio: { borderWidth: 1, borderStyle: "dashed", borderRadius: 10, padding: 20, alignItems: "center" },
  trabajoCard: { borderWidth: 1, borderRadius: 10, padding: 12 },
  detalleExpandido: { marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
});
