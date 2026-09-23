import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { formatoDistancia, formatoDuracion, OrdenAgenda } from "@/types/agenda";
import { colorCategoria } from "@/lib/coloresCategoria";
import { linkGoogleMaps } from "@/lib/mapas";

const DIAS_CORTOS = ["D", "L", "M", "M", "J", "V", "S"];
const MAX_PUNTOS_POR_DIA = 3;

function fechaHoyEsIgual(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

interface CeldaMes {
  fecha: Date;
  numero: number;
  esOtroMes: boolean;
  esHoy: boolean;
  turnos: OrdenAgenda[];
}

// Espejo mobile de fixit-web/components/CalendarioMensual.tsx. En vez de chips con nombre dentro
// de cada celda (no entra el texto en una celda de ~40px de ancho en celular), cada día muestra
// puntos de color por rubro; tocar un día con turnos abre el detalle completo en un modal, igual
// que la web.
export default function CalendarioMensual({
  mesBase,
  ordenes,
  onSeleccionarDia,
  onReprogramar,
}: {
  mesBase: Date;
  ordenes: OrdenAgenda[];
  onSeleccionarDia?: (dia: Date) => void;
  // Reprogramar un turno ya agendado (22/09, a pedido del usuario) — mismo callback que
  // CalendarioSemanal, el padre pide confirmación antes de abrir el formulario.
  onReprogramar?: (orden: OrdenAgenda) => void;
}) {
  const colors = useFixitColors();
  const hoy = new Date();
  const anio = mesBase.getFullYear();
  const mes = mesBase.getMonth();
  const [diaDetalle, setDiaDetalle] = useState<Date | null>(null);

  const primerDiaMes = new Date(anio, mes, 1);
  const ultimoDiaMes = new Date(anio, mes + 1, 0);
  const inicioGrilla = new Date(primerDiaMes);
  inicioGrilla.setDate(inicioGrilla.getDate() - inicioGrilla.getDay());
  const finGrilla = new Date(ultimoDiaMes);
  finGrilla.setDate(finGrilla.getDate() + (6 - finGrilla.getDay()));

  function turnosDelDia(dia: Date): OrdenAgenda[] {
    return ordenes
      .filter((o) => o.fechaHoraProgramada && fechaHoyEsIgual(new Date(o.fechaHoraProgramada), dia))
      .sort((a, b) => new Date(a.fechaHoraProgramada!).getTime() - new Date(b.fechaHoraProgramada!).getTime());
  }

  const celdas: CeldaMes[] = [];
  for (let d = new Date(inicioGrilla); d <= finGrilla; d.setDate(d.getDate() + 1)) {
    const fecha = new Date(d);
    celdas.push({
      fecha,
      numero: fecha.getDate(),
      esOtroMes: fecha.getMonth() !== mes,
      esHoy: fechaHoyEsIgual(fecha, hoy),
      turnos: turnosDelDia(fecha),
    });
  }

  function manejarClickCelda(celda: CeldaMes) {
    if (celda.turnos.length > 0) setDiaDetalle(celda.fecha);
    else if (onSeleccionarDia) onSeleccionarDia(celda.fecha);
  }

  const turnosDelDiaDetalle = diaDetalle ? turnosDelDia(diaDetalle) : [];

  return (
    <View>
      <View style={styles.filaEncabezado}>
        {DIAS_CORTOS.map((d, i) => (
          <Text key={i} style={[styles.encabezadoDia, { color: colors.inkMuted }]}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grilla}>
        {celdas.map((celda, i) => {
          const clickeable = celda.turnos.length > 0 || !!onSeleccionarDia;
          return (
            <Pressable
              key={i}
              disabled={!clickeable}
              onPress={() => manejarClickCelda(celda)}
              style={[styles.celda, { borderColor: colors.border, opacity: celda.esOtroMes ? 0.35 : 1 }]}
            >
              <View style={[styles.numeroDia, celda.esHoy ? { backgroundColor: colors.copper } : undefined]}>
                <Text style={{ color: celda.esHoy ? colors.paper : colors.ink, fontSize: 12, fontWeight: "600" }}>{celda.numero}</Text>
              </View>
              <View style={styles.filaPuntos}>
                {celda.turnos.slice(0, MAX_PUNTOS_POR_DIA).map((t) => (
                  <View key={t.id} style={[styles.punto, { backgroundColor: colorCategoria(t.categoriaNombre) }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      {onSeleccionarDia && (
        <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 10 }}>
          Tocá un día para ver sus trabajos, o para programar uno nuevo si está libre.
        </Text>
      )}

      <Modal visible={!!diaDetalle} transparent animationType="fade" onRequestClose={() => setDiaDetalle(null)}>
        <Pressable style={styles.fondoModal} onPress={() => setDiaDetalle(null)}>
          <Pressable style={[styles.tarjetaDetalle, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            {diaDetalle && (
              <>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "700", marginBottom: 12, textTransform: "capitalize" }}>
                  {diaDetalle.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                </Text>
                <ScrollView style={{ gap: 10 }}>
                  {turnosDelDiaDetalle.map((orden) => {
                    const color = colorCategoria(orden.categoriaNombre);
                    return (
                      <View key={orden.id} style={[styles.tarjetaTurno, { backgroundColor: colors.paper, borderLeftColor: color, marginBottom: 8 }]}>
                        <Text style={{ color: colors.inkMuted, fontSize: 11 }}>
                          {new Date(orden.fechaHoraProgramada!).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                          {orden.duracionMinutos ? ` · ${formatoDuracion(orden.duracionMinutos)}` : ""} · {orden.categoriaNombre}
                        </Text>
                        <Text style={{ color: colors.ink, fontWeight: "600" }}>{orden.clienteNombreCompleto}</Text>
                        <Text style={{ color: colors.inkMuted, fontSize: 13 }}>{orden.descripcion || orden.categoriaNombre}</Text>
                        {orden.clienteDireccion && (
                          <Pressable
                            onPress={() => Linking.openURL(linkGoogleMaps(orden.clienteDireccion, orden.clienteDireccionLat, orden.clienteDireccionLon))}
                          >
                            <Text style={{ color: colors.copper, fontSize: 12, textDecorationLine: "underline", marginTop: 2 }}>
                              📍 {orden.clienteDireccion}
                              {orden.clienteDireccionVerificada ? " ✓" : ""}
                            </Text>
                          </Pressable>
                        )}
                        {orden.clienteDistanciaKm != null && (
                          <Text style={{ color: colors.inkMuted, fontSize: 11 }}>{formatoDistancia(orden.clienteDistanciaKm)}</Text>
                        )}
                        {orden.clienteTelefono && <Text style={{ color: colors.inkMuted, fontSize: 11 }}>{orden.clienteTelefono}</Text>}
                        {onReprogramar && (
                          <Pressable
                            onPress={() => {
                              setDiaDetalle(null);
                              onReprogramar(orden);
                            }}
                            style={{ marginTop: 6 }}
                          >
                            <Text style={{ color: colors.copper, fontSize: 12, fontWeight: "600" }}>Reprogramar</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
                {onSeleccionarDia && (
                  <Pressable
                    onPress={() => {
                      const dia = diaDetalle;
                      setDiaDetalle(null);
                      onSeleccionarDia(dia);
                    }}
                    style={{ marginTop: 10, alignItems: "center" }}
                  >
                    <Text style={{ color: colors.copper, fontSize: 13 }}>Ver este día en la agenda semanal →</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setDiaDetalle(null)} style={{ marginTop: 6, alignItems: "center" }}>
                  <Text style={{ color: colors.inkMuted, fontSize: 12 }}>Cerrar</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  filaEncabezado: { flexDirection: "row" },
  encabezadoDia: { flex: 1, textAlign: "center", fontSize: 10, fontWeight: "700", paddingBottom: 6 },
  grilla: { flexDirection: "row", flexWrap: "wrap" },
  celda: { width: `${100 / 7}%`, aspectRatio: 1, borderWidth: 0.5, alignItems: "center", paddingTop: 4, gap: 3 },
  numeroDia: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  filaPuntos: { flexDirection: "row", gap: 2 },
  punto: { width: 5, height: 5, borderRadius: 2.5 },
  fondoModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  tarjetaDetalle: { borderWidth: 1, borderRadius: 14, padding: 18, maxHeight: "80%", width: "100%" },
  tarjetaTurno: { borderLeftWidth: 4, borderRadius: 10, padding: 10 },
});
