import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { apiFetch, ApiError } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { PerfilCliente } from "@/types/clientes";
import { ESTADO_LABELS } from "@/components/OrdenTicket";
import { colorCategoria } from "@/lib/coloresCategoria";
import Estrellas from "@/components/Estrellas";

const ESTADO_ESTILO: Record<string, string> = {
  Completado: "stamp",
  Cancelado: "inkMuted",
  EnDisputa: "roja",
};

function formatoMesAno(fechaISO: string): string {
  return new Date(fechaISO).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function formatoFechaCorta(fechaISO: string): string {
  return new Date(fechaISO).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

// Mismo criterio que en /prestador/[id] (tiempoRelativoReseña) — "hace 3 días" en vez de una
// fecha completa para los comentarios de "Lo que dicen otros prestadores".
function tiempoRelativo(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  const diffDias = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDias < 1) return "hoy";
  if (diffDias === 1) return "ayer";
  if (diffDias < 30) return `hace ${diffDias} días`;
  if (diffDias < 365) return `hace ${Math.floor(diffDias / 30)} meses`;
  return fecha.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

// Pantalla nueva en mobile (03/10, a pedido del usuario) — espejo de
// fixit-web/app/prestador/clientes/[id]/page.tsx: perfil del cliente visto por el prestador con el
// que tuvo alguna orden. No existía ninguna versión mobile de esta pantalla todavía; usa el mismo
// patrón visual que el rediseño de /prestador/[id] (header oscuro + tarjeta de contacto + barra de
// estadísticas) para que ambos perfiles se sientan parte del mismo sistema.
export default function PerfilClienteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Pantalla a propósito siempre en modo claro (03/10, a pedido del usuario, mismo criterio que
  // /prestador/[id]) — a diferencia del resto de la app, que sigue el modo oscuro/claro del
  // sistema (useFixitColors), este perfil usa fijo Colors.light desde la barra de estadísticas
  // hacia abajo, igual que el header (que ya era fijo con colors.nav/onNav).
  const colors = Colors.light;
  const insets = useSafeAreaInsets();

  const [perfil, setPerfil] = useState<PerfilCliente | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fotoModalAbierta, setFotoModalAbierta] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiFetch<PerfilCliente>(`/api/prestador/clientes/${id}/perfil`)
      .then(setPerfil)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo cargar el perfil del cliente."))
      .finally(() => setCargando(false));
  }, [id]);

  if (cargando) {
    return (
      <View style={[styles.centro, { backgroundColor: colors.paper }]}>
        <ActivityIndicator color={colors.copper} />
      </View>
    );
  }

  if (error || !perfil) {
    return (
      <View style={[styles.pantalla, { backgroundColor: colors.paper, paddingTop: insets.top + 20 }]}>
        <Pressable onPress={() => router.back()} style={styles.volver}>
          <Text style={{ color: colors.copper, fontSize: 20 }}>‹</Text>
        </Pressable>
        <Text style={{ color: "#C0392B", marginTop: 12 }}>{error ?? "No encontramos ese cliente."}</Text>
      </View>
    );
  }

  const iniciales = `${perfil.nombre[0] ?? ""}${perfil.apellido[0] ?? ""}`.toUpperCase();

  return (
    <View style={[styles.pantalla, { backgroundColor: colors.paper, paddingTop: 0, paddingHorizontal: 0 }]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ---- Header oscuro (mismo patrón que /prestador/[id]) ---- */}
        <View style={[styles.header, { backgroundColor: colors.nav, paddingTop: insets.top + 16 }]}>
          <Pressable onPress={() => router.back()} style={[styles.volverHeader, { top: insets.top + 8 }]} hitSlop={10}>
            <Text style={{ color: colors.copper, fontSize: 22 }}>‹</Text>
          </Pressable>

          <Pressable
            onPress={() => perfil.fotoPerfilUrl && setFotoModalAbierta(true)}
            style={[styles.avatarGrande, { borderColor: `${colors.copper}80`, backgroundColor: `${colors.onNav}1A` }]}
          >
            {perfil.fotoPerfilUrl ? (
              <Image source={{ uri: perfil.fotoPerfilUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Text style={{ color: colors.onNav, fontSize: 24, fontWeight: "700" }}>{iniciales}</Text>
            )}
          </Pressable>

          <View style={styles.filaNombreHeader}>
            <Text style={[styles.nombreHeader, { color: colors.onNav }]} numberOfLines={2}>
              {perfil.nombre} {perfil.apellido}
            </Text>
            {/* Insignia debajo del nombre (03/10) — mismo criterio que /prestador/[id]. */}
            {perfil.verificado && (
              <View style={[styles.badgeVerificado, { backgroundColor: `${colors.copper}33`, borderColor: `${colors.copper}66` }]}>
                <Text style={{ color: colors.onNav, fontSize: 11, fontWeight: "700" }}>✓ Identidad verificada</Text>
              </View>
            )}
          </View>

          <View style={[styles.tarjetaContacto, { borderColor: `${colors.onNav}1A`, backgroundColor: `${colors.onNav}0D` }]}>
            <View style={[styles.celda, { borderColor: `${colors.onNav}1A`, width: "50%" }]}>
              <Text style={[styles.celdaLabel, { color: `${colors.onNav}66` }]}>CLIENTE DESDE</Text>
              <Text style={[styles.celdaValor, { color: colors.onNav }]}>{formatoMesAno(perfil.clienteDesde)}</Text>
            </View>
            <View style={[styles.celda, { borderColor: `${colors.onNav}1A`, width: "50%", borderLeftWidth: 1 }]}>
              <Text style={[styles.celdaLabel, { color: `${colors.onNav}66` }]}>TELÉFONO</Text>
              <Text style={[styles.celdaValor, { color: colors.onNav }]}>{perfil.telefono || "—"}</Text>
            </View>
            <View style={[styles.celda, { borderColor: `${colors.onNav}1A`, width: "100%", borderTopWidth: 1 }]}>
              <Text style={[styles.celdaLabel, { color: `${colors.onNav}66` }]}>DIRECCIÓN</Text>
              {perfil.mostrarDireccion ? (
                perfil.direccion ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.celdaValor, { color: colors.onNav }]}>{perfil.direccion}</Text>
                    {perfil.direccionVerificada && <Text style={{ color: colors.stamp, fontSize: 12 }}>✓</Text>}
                  </View>
                ) : (
                  <Text style={[styles.celdaValor, { color: `${colors.onNav}80` }]}>No cargada</Text>
                )
              ) : (
                <Text style={{ color: `${colors.onNav}66`, fontSize: 11, fontStyle: "italic" }}>
                  Se muestra una vez que pague o agende un turno con vos.
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* ---- Barra de estadísticas: siempre las 4, con 0 cuando no hay datos todavía ---- */}
        <View style={[styles.statsBar, { borderBottomColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumero, { color: colors.ink }]}>{perfil.trabajosCompletadosConEstePrestador}</Text>
            <Text style={[styles.statLabel, { color: colors.inkMuted }]}>Trabajos con vos</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumero, { color: colors.ink }]}>{perfil.trabajosCompletadosEnLaPlataforma}</Text>
            <Text style={[styles.statLabel, { color: colors.inkMuted }]}>Trabajos en la plataforma</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumero, { color: colors.ink }]}>
              {perfil.calificacionComoClientePromedio.toFixed(1)} <Text style={{ color: colors.copper }}>★</Text>
            </Text>
            <Text style={[styles.statLabel, { color: colors.inkMuted }]}>
              Calificación como cliente ({perfil.calificacionComoClienteCantidad})
            </Text>
          </View>
          <View style={styles.statItem}>
            {/* Verde cuando nunca dejó a un prestador sin trabajar (0), rojo si tiene alguna registrada. */}
            <Text style={[styles.statNumero, { color: perfil.inasistenciasUltimos3Meses > 0 ? "#C0392B" : colors.stamp }]}>
              {perfil.inasistenciasUltimos3Meses}
            </Text>
            <Text style={[styles.statLabel, { color: perfil.inasistenciasUltimos3Meses > 0 ? "#C0392Bb3" : `${colors.stamp}b3` }]}>
              Inasistencia{perfil.inasistenciasUltimos3Meses === 1 ? "" : "s"} registrada
              {perfil.inasistenciasUltimos3Meses === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        <View style={styles.contenido}>
          {/* Inasistencias: reportadas por algún prestador, no necesariamente confirmadas. */}
          {perfil.inasistenciasUltimos3Meses > 0 && (
            <View style={styles.avisoInasistencia}>
              <Text style={{ color: "#C0392B", fontSize: 13 }}>⚠</Text>
              <Text style={{ color: colors.ink, opacity: 0.75, fontSize: 13, lineHeight: 18, flex: 1 }}>
                Registra {perfil.inasistenciasUltimos3Meses} inasistencia{perfil.inasistenciasUltimos3Meses > 1 ? "s" : ""} en los
                últimos 3 meses
                {perfil.ultimaInasistenciaFecha && <> (la más reciente, del {formatoFechaCorta(perfil.ultimaInasistenciaFecha)})</>}.
                Son reportes de otros prestadores, todavía sin una forma de confirmarlos del todo — tenelo en cuenta al coordinar el
                horario.
              </Text>
            </View>
          )}

          {/* ---- "Lo que dicen otros prestadores" ---- */}
          {perfil.comentariosDeOtrosPrestadores.length > 0 && (
            <View>
              <Text style={[styles.eyebrow, { color: colors.copper }]}>
                LO QUE DICEN OTROS PRESTADORES · {perfil.calificacionComoClientePromedio.toFixed(1)} ★ ·{" "}
                {perfil.calificacionComoClienteCantidad} calificacion{perfil.calificacionComoClienteCantidad === 1 ? "" : "es"}
              </Text>
              <View style={{ gap: 10 }}>
                {perfil.comentariosDeOtrosPrestadores.map((c, i) => (
                  <View key={i} style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.filaReseñaTop}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                        <View style={[styles.avatarChico, { backgroundColor: `${colors.copper}1A` }]}>
                          <Text style={{ color: colors.copper, fontWeight: "700", fontSize: 13 }}>
                            {c.prestadorNombreCompleto
                              .split(" ")
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((p) => p[0])
                              .join("")
                              .toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
                            {c.prestadorNombreCompleto}
                          </Text>
                          <Text style={{ color: colors.inkMuted, fontSize: 11 }}>{tiempoRelativo(c.creadoEn)}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Estrellas valor={c.promedio} tamaño={12} />
                        <Text style={{ color: colors.inkMuted, fontSize: 11, fontWeight: "600" }}>{c.promedio.toFixed(1)}</Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.ink, opacity: 0.75, fontSize: 13, lineHeight: 18, marginTop: 6 }}>
                      &ldquo;{c.comentario}&rdquo;
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ---- Historial con vos ---- */}
          <View>
            <Text style={[styles.eyebrow, { color: colors.copper }]}>HISTORIAL CON VOS</Text>
            {perfil.historialConEstePrestador.length === 0 ? (
              <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Todavía no tuviste ninguna orden con este cliente.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {perfil.historialConEstePrestador.map((o) => {
                  const colorRubro = colorCategoria(o.categoriaNombre);
                  const colorEstadoKey = ESTADO_ESTILO[o.estado] ?? "inkMuted";
                  const colorEstado = o.inasistenciaReportada
                    ? "#C0392B"
                    : colorEstadoKey === "stamp"
                      ? colors.stamp
                      : colorEstadoKey === "roja"
                        ? colors.ink
                        : colors.inkMuted;

                  return (
                    <View key={o.ordenId} style={[styles.filaHistorial, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Text style={{ fontSize: 11, color: colors.inkMuted, width: 44 }}>
                          {o.fecha ? formatoFechaCorta(o.fecha) : "—"}
                        </Text>
                        <View style={[styles.chipRubroHistorial, { backgroundColor: `${colorRubro}1F` }]}>
                          <Text style={{ color: colorRubro, fontSize: 9.5, fontWeight: "700" }} numberOfLines={1}>
                            {o.categoriaNombre}
                          </Text>
                        </View>
                        <Text style={{ color: colors.ink, fontSize: 13, flex: 1 }} numberOfLines={1}>
                          {o.descripcion || o.categoriaNombre}
                        </Text>
                        <View style={[styles.chipEstadoHistorial, { backgroundColor: `${colorEstado}1A` }]}>
                          <Text style={{ color: colorEstado, fontSize: 9.5, fontWeight: "700" }} numberOfLines={1}>
                            {o.inasistenciaReportada ? "No se presentó" : ESTADO_LABELS[o.estado] ?? o.estado}
                          </Text>
                        </View>
                      </View>

                      {o.resenaComentario && o.resenaPromedio != null && (
                        <View style={[styles.filaResenaHistorial, { borderTopColor: colors.border }]}>
                          <Estrellas valor={o.resenaPromedio} tamaño={11} />
                          <Text style={{ color: colors.ink, opacity: 0.7, fontSize: 13, lineHeight: 17, flex: 1 }}>
                            &ldquo;{o.resenaComentario}&rdquo;
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <Pressable onPress={() => router.push("/mensajes")}>
            <Text style={{ color: colors.inkMuted, fontSize: 12, textAlign: "center" }}>
              ¿Algo no coincide? <Text style={{ color: colors.copper }}>Volver a tus mensajes</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ---- Foto de perfil ampliada (mismo patrón que /prestador/[id]) ---- */}
      <Modal visible={fotoModalAbierta} transparent animationType="fade" onRequestClose={() => setFotoModalAbierta(false)}>
        <Pressable style={styles.fondoLightbox} onPress={() => setFotoModalAbierta(false)}>
          {perfil.fotoPerfilUrl && <Image source={{ uri: perfil.fotoPerfilUrl }} style={styles.fotoAmpliada} resizeMode="contain" />}
          <Pressable onPress={() => setFotoModalAbierta(false)} style={[styles.botonCerrarLightbox, { top: insets.top + 12 }]} hitSlop={12}>
            <X color="#FFFFFF" size={22} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  pantalla: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  volver: { padding: 4, marginBottom: 8, alignSelf: "flex-start" },

  header: { alignItems: "center", paddingHorizontal: 24, paddingBottom: 26, gap: 14 },
  volverHeader: { position: "absolute", left: 10, padding: 6, zIndex: 2 },
  avatarGrande: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  filaNombreHeader: { alignItems: "center", gap: 8 },
  nombreHeader: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  badgeVerificado: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },

  tarjetaContacto: { width: "100%", maxWidth: 340, borderWidth: 1, borderRadius: 16, overflow: "hidden", flexDirection: "row", flexWrap: "wrap" },
  celda: { paddingHorizontal: 14, paddingVertical: 11 },
  celdaLabel: { fontSize: 9, letterSpacing: 0.6, fontWeight: "700", marginBottom: 3 },
  celdaValor: { fontSize: 12.5, fontWeight: "700" },

  statsBar: { flexDirection: "row", flexWrap: "wrap", paddingVertical: 18, paddingHorizontal: 20, borderBottomWidth: 1 },
  statItem: { width: "50%", alignItems: "center", marginBottom: 10 },
  statNumero: { fontSize: 19, fontWeight: "700", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 10, marginTop: 2, textAlign: "center", paddingHorizontal: 4 },

  contenido: { paddingHorizontal: 24, paddingTop: 24, gap: 28 },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: "700", marginBottom: 10 },

  avisoInasistencia: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "rgba(192,57,43,0.06)",
    borderWidth: 1,
    borderColor: "rgba(192,57,43,0.2)",
    borderRadius: 12,
    padding: 12,
  },

  tarjeta: { borderWidth: 1, borderRadius: 12, padding: 14 },
  filaReseñaTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  avatarChico: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },

  filaHistorial: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  chipRubroHistorial: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3, maxWidth: 90 },
  chipEstadoHistorial: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, maxWidth: 110 },
  filaResenaHistorial: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 8, paddingTop: 8, borderTopWidth: 1 },

  fondoLightbox: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" },
  fotoAmpliada: { width: "100%", height: "100%" },
  botonCerrarLightbox: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
