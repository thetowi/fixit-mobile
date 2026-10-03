import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { BloqueDisponibilidad, formatoDistancia, formatoDuracion, OrdenAgenda } from "@/types/agenda";
import { linkGoogleMaps } from "@/lib/mapas";
import { colorCategoria } from "@/lib/coloresCategoria";

const DURACION_POR_DEFECTO = 60; // para turnos viejos que quedaron sin duracionMinutos cargado
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const PASO_MINUTOS = 30;
const RANGO_POR_DEFECTO = { desde: 8 * 60, hasta: 20 * 60 };

function minutosDelString(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutosDelDia(fecha: Date): number {
  return fecha.getHours() * 60 + fecha.getMinutes();
}

function formatoHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fechaHoyEsIgual(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

// Espejo mobile de fixit-web/components/CalendarioSemanal.tsx — pero acá tomamos directamente la
// rama "vista día a día (mobile)" del original como base, ya que en un celular esa es la ÚNICA
// vista que tiene sentido (la grilla semanal de escritorio con columnas de hora no entra en una
// pantalla chica). Selector de día arriba + lista de turnos del día + chips de horarios libres.
export default function CalendarioSemanal({
  inicioSemana,
  bloques,
  ordenes,
  onCeldaDisponibleClick,
  onReprogramar,
  onCancelarVisita,
  cancelandoVisitaId,
}: {
  inicioSemana: Date;
  bloques: BloqueDisponibilidad[];
  ordenes: OrdenAgenda[];
  onCeldaDisponibleClick?: (dia: Date, horaHHMM: string) => void;
  // Reprogramar un turno ya agendado (22/09, a pedido del usuario) — el padre pide confirmación
  // antes de abrir el formulario de "Programar" pre-cargado. Mismo patrón que fixit-web. Solo
  // aplica a Tipo === "Trabajo".
  onReprogramar?: (orden: OrdenAgenda) => void;
  // Cancelar una Visita a domicilio ya agendada (30/09) — ver el comentario equivalente en
  // fixit-web/components/CalendarioSemanal.tsx.
  onCancelarVisita?: (orden: OrdenAgenda) => void;
  cancelandoVisitaId?: string | null;
}) {
  const colors = useFixitColors();
  const hoy = new Date();
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenAgenda | null>(null);
  const [diaIndex, setDiaIndex] = useState(() => {
    const diff = Math.round((hoy.getTime() - inicioSemana.getTime()) / 86400000);
    return diff >= 0 && diff <= 6 ? diff : 0;
  });

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + i);
    return d;
  });

  const { desde: inicioRango, hasta: finRango } = (() => {
    if (bloques.length === 0) return RANGO_POR_DEFECTO;
    const inicios = bloques.map((b) => minutosDelString(b.horaInicio));
    const fines = bloques.map((b) => minutosDelString(b.horaFin));
    const desde = Math.floor(Math.min(...inicios) / 60) * 60;
    const hasta = Math.ceil(Math.max(...fines) / 60) * 60;
    return {
      desde: Math.min(desde, RANGO_POR_DEFECTO.desde),
      hasta: Math.max(hasta, RANGO_POR_DEFECTO.hasta),
    };
  })();

  function estaDisponible(dia: Date, slotInicio: number): boolean {
    return bloques.some(
      (b) => b.diaSemana === dia.getDay() && slotInicio >= minutosDelString(b.horaInicio) && slotInicio < minutosDelString(b.horaFin)
    );
  }

  function rangoDeOrden(o: OrdenAgenda): { inicio: number; fin: number } {
    const inicio = minutosDelDia(new Date(o.fechaHoraProgramada!));
    return { inicio, fin: inicio + (o.duracionMinutos ?? DURACION_POR_DEFECTO) };
  }

  function ordenEnMinuto(dia: Date, minuto: number): OrdenAgenda | undefined {
    return ordenes.find((o) => {
      if (!o.fechaHoraProgramada) return false;
      const fecha = new Date(o.fechaHoraProgramada);
      if (!fechaHoyEsIgual(fecha, dia)) return false;
      const { inicio, fin } = rangoDeOrden(o);
      return minuto >= inicio && minuto < fin;
    });
  }

  function turnosDelDia(dia: Date): OrdenAgenda[] {
    return ordenes
      .filter((o) => o.fechaHoraProgramada && fechaHoyEsIgual(new Date(o.fechaHoraProgramada), dia))
      .sort((a, b) => new Date(a.fechaHoraProgramada!).getTime() - new Date(b.fechaHoraProgramada!).getTime());
  }

  function franjasLibresDelDia(dia: Date): { inicio: number; fin: number }[] {
    const libres: { inicio: number; fin: number }[] = [];
    let actual: { inicio: number; fin: number } | null = null;
    for (let slot = inicioRango; slot < finRango; slot += PASO_MINUTOS) {
      const libre = estaDisponible(dia, slot) && !ordenEnMinuto(dia, slot);
      if (libre) {
        if (actual && actual.fin === slot) actual.fin = slot + PASO_MINUTOS;
        else {
          if (actual) libres.push(actual);
          actual = { inicio: slot, fin: slot + PASO_MINUTOS };
        }
      } else if (actual) {
        libres.push(actual);
        actual = null;
      }
    }
    if (actual) libres.push(actual);
    return libres;
  }

  const diaSel = dias[diaIndex];
  const turnosDia = turnosDelDia(diaSel);
  const libresDia = franjasLibresDelDia(diaSel);

  return (
    <View>
      <View style={styles.filaDias}>
        {dias.map((d, i) => {
          const tieneTrabajos = turnosDelDia(d).length > 0;
          const seleccionado = i === diaIndex;
          const esHoy = fechaHoyEsIgual(d, hoy);
          return (
            <Pressable
              key={i}
              onPress={() => setDiaIndex(i)}
              style={[
                styles.chipDia,
                {
                  borderColor: seleccionado ? colors.copper : esHoy ? `${colors.copper}66` : colors.border,
                  backgroundColor: seleccionado ? colors.copper : "transparent",
                },
              ]}
            >
              <Text style={{ color: seleccionado ? colors.paper : esHoy ? colors.copper : colors.inkMuted, fontSize: 10 }}>
                {DIAS_CORTOS[d.getDay()]}
              </Text>
              <Text style={{ color: seleccionado ? colors.paper : colors.ink, fontSize: 14, fontWeight: "600" }}>{d.getDate()}</Text>
              <View style={[styles.puntito, { backgroundColor: tieneTrabajos ? (seleccionado ? colors.paper : colors.copper) : "transparent" }]} />
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.subtitulo, { color: colors.inkMuted }]}>TURNOS DE HOY</Text>
      {turnosDia.length === 0 ? (
        <Text style={{ color: colors.inkMuted, fontSize: 13, marginBottom: 18 }}>No tenés turnos agendados este día.</Text>
      ) : (
        <View style={{ gap: 8, marginBottom: 18 }}>
          {turnosDia.map((orden, i) => {
            const esVisita = orden.tipo === "Visita";
            // Ver el mismo criterio en fixit-web/components/CalendarioSemanal.tsx (30/09).
            const visitaCancelada = esVisita && orden.estado === "Cancelada";
            const visitaRealizada = esVisita && orden.estado === "Realizada";
            const color = visitaRealizada ? "#16a34a" : esVisita ? colors.copper : colorCategoria(orden.categoriaNombre);
            return (
              <Pressable
                key={`${orden.fechaHoraProgramada}-${i}`}
                onPress={() => setOrdenSeleccionada(orden)}
                style={[
                  styles.tarjetaTurno,
                  { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: color },
                  visitaCancelada ? { opacity: 0.6 } : null,
                ]}
              >
                <Text style={{ color: colors.inkMuted, fontSize: 11 }}>
                  {new Date(orden.fechaHoraProgramada!).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                  {orden.duracionMinutos ? ` · ${formatoDuracion(orden.duracionMinutos)}` : ""} ·{" "}
                  {visitaCancelada ? "Visita cancelada" : visitaRealizada ? "✓ Visita realizada" : esVisita ? "📍 Visita" : orden.categoriaNombre}
                </Text>
                <Text
                  style={{
                    color: colors.ink,
                    fontWeight: "600",
                    marginTop: 2,
                    textDecorationLine: visitaCancelada ? "line-through" : "none",
                  }}
                >
                  {orden.clienteNombreCompleto}
                </Text>
                <Text
                  style={{
                    color: colors.inkMuted,
                    fontSize: 13,
                    textDecorationLine: visitaCancelada ? "line-through" : "none",
                  }}
                >
                  {orden.descripcion || orden.categoriaNombre}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={[styles.subtitulo, { color: colors.inkMuted }]}>HORARIOS LIBRES</Text>
      {libresDia.length === 0 ? (
        <Text style={{ color: colors.inkMuted, fontSize: 13 }}>No hay horarios libres cargados para este día.</Text>
      ) : (
        <View style={styles.filaChipsLibres}>
          {libresDia.map((franja, i) => (
            <Pressable
              key={i}
              disabled={!onCeldaDisponibleClick}
              onPress={onCeldaDisponibleClick ? () => onCeldaDisponibleClick(diaSel, formatoHora(franja.inicio)) : undefined}
              style={[styles.chipLibre, { backgroundColor: `${colors.stamp}18` }]}
            >
              <Text style={{ color: colors.stamp, fontSize: 12 }}>
                {formatoHora(franja.inicio)}–{formatoHora(franja.fin)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {onCeldaDisponibleClick && libresDia.length > 0 && (
        <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 6 }}>Tocá un horario libre para agendar un turno pendiente ahí</Text>
      )}

      <Modal visible={!!ordenSeleccionada} transparent animationType="fade" onRequestClose={() => setOrdenSeleccionada(null)}>
        <Pressable style={styles.fondoModal} onPress={() => setOrdenSeleccionada(null)}>
          <Pressable style={[styles.tarjetaDetalle, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            {ordenSeleccionada && (
              <ScrollView>
                <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700", marginBottom: 10 }}>
                  {ordenSeleccionada.descripcion || ordenSeleccionada.categoriaNombre}
                </Text>
                <DetalleCampo label="Cliente" valor={ordenSeleccionada.clienteNombreCompleto} colors={colors} />
                <DetalleCampo label="Rubro" valor={ordenSeleccionada.categoriaNombre} colors={colors} />
                {ordenSeleccionada.clienteDireccion ? (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ color: colors.inkMuted, fontSize: 10, textTransform: "uppercase" }}>Dirección</Text>
                    <Pressable
                      onPress={() =>
                        Linking.openURL(
                          linkGoogleMaps(ordenSeleccionada.clienteDireccion, ordenSeleccionada.clienteDireccionLat, ordenSeleccionada.clienteDireccionLon)
                        )
                      }
                    >
                      <Text style={{ color: colors.copper, textDecorationLine: "underline" }}>
                        {ordenSeleccionada.clienteDireccion}
                        {ordenSeleccionada.clienteDireccionVerificada ? " ✓" : ""}
                      </Text>
                    </Pressable>
                    {ordenSeleccionada.clienteDistanciaKm != null && (
                      <Text style={{ color: colors.inkMuted, fontSize: 11 }}>{formatoDistancia(ordenSeleccionada.clienteDistanciaKm)}</Text>
                    )}
                  </View>
                ) : (
                  <DetalleCampo label="Dirección" valor="Sin dirección cargada" colors={colors} />
                )}
                <DetalleCampo label="Teléfono" valor={ordenSeleccionada.clienteTelefono || "Sin teléfono cargado"} colors={colors} />
                {ordenSeleccionada.fechaHoraProgramada && (
                  <DetalleCampo
                    label={ordenSeleccionada.tipo === "Visita" ? "Visita" : "Turno"}
                    valor={`${new Date(ordenSeleccionada.fechaHoraProgramada).toLocaleString("es-AR", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}${ordenSeleccionada.duracionMinutos ? ` · ${formatoDuracion(ordenSeleccionada.duracionMinutos)}` : ""}`}
                    colors={colors}
                  />
                )}
                {ordenSeleccionada.tipo === "Visita" && ordenSeleccionada.estado !== "Programada" && (
                  <DetalleCampo
                    label="Estado"
                    valor={ordenSeleccionada.estado === "Realizada" ? "✓ Realizada" : "Cancelada"}
                    colors={colors}
                  />
                )}
                {onReprogramar && ordenSeleccionada.tipo !== "Visita" && (
                  <Pressable
                    onPress={() => {
                      const orden = ordenSeleccionada;
                      setOrdenSeleccionada(null);
                      onReprogramar(orden);
                    }}
                    style={{ marginTop: 10, alignItems: "center" }}
                  >
                    <Text style={{ color: colors.copper, fontSize: 13, fontWeight: "600" }}>Reprogramar este turno</Text>
                  </Pressable>
                )}
                {onCancelarVisita && ordenSeleccionada.tipo === "Visita" && ordenSeleccionada.estado === "Programada" && (
                  <Pressable
                    onPress={() => {
                      const orden = ordenSeleccionada;
                      setOrdenSeleccionada(null);
                      onCancelarVisita(orden);
                    }}
                    disabled={cancelandoVisitaId === ordenSeleccionada.id}
                    style={{ marginTop: 10, alignItems: "center" }}
                  >
                    <Text style={{ color: colors.inkMuted, fontSize: 13, fontWeight: "600" }}>
                      {cancelandoVisitaId === ordenSeleccionada.id ? "Cancelando..." : "Cancelar visita"}
                    </Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setOrdenSeleccionada(null)} style={{ marginTop: 8, alignSelf: "flex-end" }}>
                  <Text style={{ color: colors.copper, fontSize: 13 }}>Cerrar</Text>
                </Pressable>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DetalleCampo({ label, valor, colors }: { label: string; valor: string; colors: ReturnType<typeof useFixitColors> }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: colors.inkMuted, fontSize: 10, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color: colors.ink }}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filaDias: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  chipDia: { alignItems: "center", borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 6, width: 42, gap: 2 },
  puntito: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  subtitulo: { fontSize: 10, letterSpacing: 1, fontWeight: "700", marginBottom: 8 },
  tarjetaTurno: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 10, padding: 10 },
  filaChipsLibres: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipLibre: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  fondoModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  tarjetaDetalle: { borderWidth: 1, borderRadius: 14, padding: 18, maxHeight: "80%", width: "100%" },
});
