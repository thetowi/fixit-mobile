import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { Colors } from "@/constants/colors";
import { PerfilPrestador } from "@/types/perfil";
import { Calificacion, CRITERIOS_CALIFICACION } from "@/types/calificaciones";
import { IniciarConversacionRequest, Conversacion } from "@/types/conversaciones";
import Estrellas from "@/components/Estrellas";
import InsigniaVerificado from "@/components/InsigniaVerificado";
import ContadorAnimado from "@/components/ContadorAnimado";

function inicialesCliente(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// Mismo criterio que en /mensajes (tiempoRelativo) — "hace 3 días" en vez de una fecha completa.
function tiempoRelativoReseña(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  const diffDias = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDias < 1) return "hoy";
  if (diffDias === 1) return "ayer";
  if (diffDias < 30) return `hace ${diffDias} días`;
  if (diffDias < 365) return `hace ${Math.floor(diffDias / 30)} meses`;
  return fecha.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

// Rediseño (03/10, a pedido del usuario: "mejorar la visual del perfil del prestador... algo mas
// parecido a lo que tenemos en web") — reemplaza las pestañas Servicios/Reseñas/Acerca de mí por
// el mismo flujo de una sola columna que fixit-web/app/prestador/[id]/page.tsx (rediseño del
// 27-28/09): header oscuro con identidad + tarjeta de contacto, barra de estadísticas, galería de
// trabajos realizados, reseñas con fotos (y repost), y por último servicios/contacto + acerca de mí.
export default function PerfilPrestadorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Pantalla a propósito siempre en modo claro (03/10, a pedido del usuario: "que este en el color
  // blanco que usamos, como en modo claro") — a diferencia del resto de la app, que sigue el modo
  // oscuro/claro del sistema (useFixitColors), este perfil público usa fijo Colors.light desde la
  // barra de estadísticas hacia abajo, igual que el header (que ya era fijo con colors.nav/onNav).
  const colors = Colors.light;
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();

  const [perfil, setPerfil] = useState<PerfilPrestador | null>(null);
  const [calificaciones, setCalificaciones] = useState<Calificacion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [iniciandoChat, setIniciandoChat] = useState<number | null>(null);
  const [soloConFotos, setSoloConFotos] = useState(false);
  const [fotoModalAbierta, setFotoModalAbierta] = useState(false);
  const [solicitandoRepost, setSolicitandoRepost] = useState<string | null>(null);
  const [repostSolicitados, setRepostSolicitados] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch<PerfilPrestador>(`/api/prestadores/${id}`),
      apiFetch<Calificacion[]>(`/api/prestadores/${id}/calificaciones`),
    ])
      .then(([perfilData, calificacionesData]) => {
        setPerfil(perfilData);
        setCalificaciones(calificacionesData);
      })
      .catch((err) => {
        setError(err instanceof ApiError && err.status === 404 ? "No encontramos este prestador." : "Error al cargar el perfil.");
      })
      .finally(() => setCargando(false));
  }, [id]);

  const esClientePropio = usuario?.rol === "Cliente";
  const esDuenioDelPerfil = usuario?.rol === "Prestador" && usuario.id === perfil?.id;

  async function handleContratar(categoriaId: number) {
    if (!usuario) {
      router.push("/login");
      return;
    }

    setIniciandoChat(categoriaId);

    const body: IniciarConversacionRequest = { prestadorId: id, categoriaId };

    try {
      const conversacion = await apiFetch<Conversacion>("/api/conversaciones", {
        method: "POST",
        body: JSON.stringify(body),
      });
      router.push(`/conversacion/${conversacion.id}`);
    } catch (err) {
      Alert.alert("No se pudo iniciar el chat", err instanceof ApiError ? err.message : "Ocurrió un error");
      setIniciandoChat(null);
    }
  }

  async function handlePedirRepost(calificacionFotoId: string) {
    setSolicitandoRepost(calificacionFotoId);
    try {
      await apiFetch(`/api/repostos/${calificacionFotoId}/solicitar`, { method: "POST" });
      setRepostSolicitados((prev) => new Set(prev).add(calificacionFotoId));
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Error al pedir permiso");
    } finally {
      setSolicitandoRepost(null);
    }
  }

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
        <Text style={{ color: "#C0392B", marginTop: 12 }}>{error ?? "No encontramos este prestador."}</Text>
      </View>
    );
  }

  const miembroDesde = new Date(perfil.miembroDesde);
  const miembroDesdeTexto = miembroDesde.toLocaleDateString("es-AR", { year: "numeric", month: "long" });
  const añosEnOficy = Math.max(0, Math.floor((Date.now() - miembroDesde.getTime()) / (1000 * 60 * 60 * 24 * 365)));

  const rubros = Array.from(new Set(perfil.servicios.map((s) => s.categoriaNombre)));
  const cantidadFotosTrabajo = perfil.fotosTrabajo.length;
  const cantidadReseñasConFotos = calificaciones.filter((c) => c.fotos.length > 0).length;
  const calificacionesAMostrar = soloConFotos ? calificaciones.filter((c) => c.fotos.length > 0) : calificaciones;

  return (
    <View style={[styles.pantalla, { backgroundColor: colors.paper, paddingTop: 0, paddingHorizontal: 0 }]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ---- Header oscuro (espejo del mockup PerfilPrestador — ver fixit-web) ---- */}
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
              <Text style={{ color: colors.onNav, fontSize: 24, fontWeight: "700" }}>
                {perfil.nombre[0]}
                {perfil.apellido[0]}
              </Text>
            )}
          </Pressable>

          <View style={styles.filaNombreHeader}>
            <Text style={[styles.nombreHeader, { color: colors.onNav }]} numberOfLines={2}>
              {perfil.nombre} {perfil.apellido}
            </Text>
            {/* Insignia debajo del nombre (03/10, a pedido del usuario) — con el nombre al lado
                sobresalía de la pantalla en nombres largos y no se apreciaba bien. */}
            {perfil.verificado && <InsigniaVerificado size={18} conTexto />}
          </View>

          <View style={[styles.tarjetaContacto, { borderColor: `${colors.onNav}1A`, backgroundColor: `${colors.onNav}0D` }]}>
            <View style={[styles.celda, { borderColor: `${colors.onNav}1A`, width: "50%" }]}>
              <Text style={[styles.celdaLabel, { color: `${colors.onNav}66` }]}>MIEMBRO DESDE</Text>
              <Text style={[styles.celdaValor, { color: colors.onNav }]}>{miembroDesdeTexto}</Text>
            </View>
            <View style={[styles.celda, { borderColor: `${colors.onNav}1A`, width: "50%", borderLeftWidth: 1 }]}>
              <Text style={[styles.celdaLabel, { color: `${colors.onNav}66` }]}>ALCANCE</Text>
              <Text style={[styles.celdaValor, { color: colors.onNav }]}>
                {perfil.radioAlcanceKm != null ? `${perfil.radioAlcanceKm} km` : "—"}
              </Text>
            </View>
            {rubros.length > 0 && (
              <View style={[styles.celda, { borderColor: `${colors.onNav}1A`, width: "100%", borderTopWidth: 1 }]}>
                <Text style={[styles.celdaLabel, { color: `${colors.onNav}66`, marginBottom: 6 }]}>RUBROS</Text>
                <View style={styles.filaChips}>
                  {rubros.map((r) => (
                    <View key={r} style={[styles.chipRubro, { backgroundColor: `${colors.onNav}1A` }]}>
                      <Text style={{ color: colors.onNav, fontSize: 10.5, fontWeight: "600" }}>{r}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {perfil.cantidadCalificaciones > 0 && (
              <View style={[styles.celda, { borderColor: `${colors.onNav}1A`, width: "100%", borderTopWidth: 1 }]}>
                <Text style={[styles.celdaLabel, { color: `${colors.onNav}66` }]}>PROMEDIO GENERAL</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[styles.celdaValor, { color: colors.onNav }]}>{perfil.promedioCalificacion!.toFixed(1)}</Text>
                  <Estrellas valor={perfil.promedioCalificacion!} tamaño={11} />
                  <Text style={{ color: `${colors.onNav}99`, fontSize: 12.5 }}>
                    · {perfil.cantidadCalificaciones} reseña{perfil.cantidadCalificaciones === 1 ? "" : "s"}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ---- Acerca de mí (03/10, a pedido del usuario: moverlo arriba del todo junto con
              el resto de los datos del perfil, pero SIN caja/borde — como estaba antes: label en
              cobre + texto suelto, no encajonado. Mismo cambio que ya se hizo en fixit-web) ---- */}
          <View style={{ width: "100%", maxWidth: 340, marginTop: 16 }}>
            <Text style={[styles.eyebrow, { color: colors.copper }]}>ACERCA DE MÍ</Text>
            {perfil.biografia ? (
              <Text style={{ color: colors.onNav, opacity: 0.8, fontSize: 13, lineHeight: 19 }}>
                {perfil.biografia}
              </Text>
            ) : (
              <Text style={{ color: `${colors.onNav}66`, fontSize: 13 }}>
                Este prestador todavía no agregó una descripción.
              </Text>
            )}
            {añosEnOficy > 0 && (
              <Text style={{ color: `${colors.onNav}99`, fontSize: 13, marginTop: 8 }}>
                <Text style={{ color: colors.copper, fontWeight: "600" }}>{añosEnOficy}</Text>{" "}
                {añosEnOficy === 1 ? "año" : "años"} en Oficy
              </Text>
            )}
          </View>
        </View>

        {/* ---- Barra de estadísticas — números animados (03/10, a pedido del usuario: "lo mismo
            que en fixit-web"), ver ContadorAnimado.tsx ---- */}
        <View style={[styles.statsBar, { borderBottomColor: colors.border }]}>
          <View style={styles.statItem}>
            <ContadorAnimado valor={perfil.cantidadCalificaciones} style={[styles.statNumero, { color: colors.ink }]} />
            <Text style={[styles.statLabel, { color: colors.inkMuted }]}>Trabajos calificados</Text>
          </View>
          <View style={styles.statItem}>
            <ContadorAnimado valor={cantidadReseñasConFotos} style={[styles.statNumero, { color: colors.ink }]} />
            <Text style={[styles.statLabel, { color: colors.inkMuted }]}>Reseñas con fotos</Text>
          </View>
          <View style={styles.statItem}>
            <ContadorAnimado valor={cantidadFotosTrabajo} style={[styles.statNumero, { color: colors.ink }]} />
            <Text style={[styles.statLabel, { color: colors.inkMuted }]}>Fotos de trabajos</Text>
          </View>
        </View>

        <View style={styles.contenido}>
          {error && <Text style={{ color: "#C0392B", fontSize: 13 }}>{error}</Text>}

          {/* ---- Servicios / contacto ---- */}
          <View>
            <Text style={[styles.eyebrow, { color: colors.copper }]}>SERVICIOS</Text>
            {perfil.servicios.length === 0 ? (
              <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Este prestador todavía no cargó servicios.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {perfil.servicios.map((s) => (
                  <View key={s.categoriaId} style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.filaServicio}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 14 }}>{s.categoriaNombre}</Text>
                        {s.descripcion && <Text style={{ color: colors.inkMuted, fontSize: 12, marginTop: 2 }}>{s.descripcion}</Text>}
                        {s.precioReferencia && (
                          <Text style={{ color: colors.ink, fontSize: 13, marginTop: 4 }}>
                            Desde ${s.precioReferencia.toLocaleString("es-AR")} /hora
                          </Text>
                        )}
                      </View>
                      {esClientePropio && (
                        <Pressable
                          onPress={() => handleContratar(s.categoriaId)}
                          disabled={iniciandoChat === s.categoriaId}
                          style={[styles.botonContactar, { backgroundColor: colors.copper, opacity: iniciandoChat === s.categoriaId ? 0.5 : 1 }]}
                        >
                          <Text style={{ color: colors.paper, fontSize: 13, fontWeight: "600" }}>
                            {iniciandoChat === s.categoriaId ? "Abriendo..." : "Contactar"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
            {!usuario && (
              <Text style={{ color: colors.inkMuted, fontSize: 12, marginTop: 8 }}>Iniciá sesión como cliente para poder contratar.</Text>
            )}
          </View>

          {/* ---- Trabajos realizados (galería) ---- */}
          {perfil.fotosTrabajo.length > 0 && (
            <View>
              <Text style={[styles.eyebrow, { color: colors.copper }]}>TRABAJOS REALIZADOS</Text>
              <FlatList
                data={perfil.fotosTrabajo}
                keyExtractor={(f) => f.id}
                numColumns={3}
                columnWrapperStyle={{ gap: 6 }}
                contentContainerStyle={{ gap: 6 }}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.fotoTrabajo, { backgroundColor: `${colors.ink}0D` }]}
                    onPress={() => item.url && Linking.openURL(item.url)}
                  >
                    <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    {item.esDeResenia && (
                      <View style={styles.rotuloFotoTrabajo}>
                        <Text style={{ color: "#fff", fontSize: 8.5 }} numberOfLines={1}>
                          {item.clienteNombre ? `De la reseña de ${item.clienteNombre}` : "De una reseña"}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                )}
              />
            </View>
          )}

          {/* ---- Reseñas de clientes ---- */}
          <View>
            <View style={styles.filaReseñasTitulo}>
              <Text style={[styles.eyebrow, { color: colors.copper, marginBottom: 0 }]}>RESEÑAS DE CLIENTES</Text>
              {cantidadReseñasConFotos > 0 && (
                <View style={[styles.toggleFotos, { backgroundColor: `${colors.ink}0D` }]}>
                  <Pressable
                    onPress={() => setSoloConFotos(false)}
                    style={[styles.toggleBotonChico, !soloConFotos && { backgroundColor: colors.surface }]}
                  >
                    <Text style={{ color: !soloConFotos ? colors.ink : colors.inkMuted, fontSize: 11.5, fontWeight: "600" }}>Recientes</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSoloConFotos(true)}
                    style={[styles.toggleBotonChico, soloConFotos && { backgroundColor: colors.surface }]}
                  >
                    <Text style={{ color: soloConFotos ? colors.ink : colors.inkMuted, fontSize: 11.5, fontWeight: "600" }}>Con fotos</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {calificaciones.length === 0 && (
              <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Este prestador todavía no tiene reseñas.</Text>
            )}
            {calificaciones.length > 0 && calificacionesAMostrar.length === 0 && (
              <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Ninguna reseña tiene fotos todavía.</Text>
            )}

            <View style={{ gap: 10 }}>
              {calificacionesAMostrar.map((c) => (
                <View key={c.id} style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border, padding: 14 }]}>
                  <View style={styles.filaReseñaTop}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      <View style={[styles.avatarChico, { backgroundColor: `${colors.copper}1A` }]}>
                        <Text style={{ color: colors.copper, fontWeight: "700", fontSize: 13 }}>{inicialesCliente(c.clienteNombre)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>{c.clienteNombre}</Text>
                        <Text style={{ color: colors.inkMuted, fontSize: 11 }}>{tiempoRelativoReseña(c.creadoEn)}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Estrellas valor={c.promedio} tamaño={12} />
                      <Text style={{ color: colors.inkMuted, fontSize: 11, fontWeight: "600" }}>{c.promedio.toFixed(1)}</Text>
                    </View>
                  </View>

                  {c.comentario && (
                    <Text style={{ color: colors.ink, opacity: 0.75, fontSize: 13, lineHeight: 18, marginTop: 8 }}>
                      &ldquo;{c.comentario}&rdquo;
                    </Text>
                  )}

                  {c.fotos.length > 0 && (
                    <View style={styles.filaFotosReseña}>
                      {c.fotos.map((foto) => (
                        <View key={foto.id} style={{ alignItems: "center", gap: 3 }}>
                          <View style={[styles.fotoReseña, { backgroundColor: `${colors.ink}0D` }]}>
                            <Image source={{ uri: foto.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                          </View>
                          {esDuenioDelPerfil && (
                            <>
                              {foto.estadoRepost === "SinSolicitar" || foto.estadoRepost === "Rechazado" ? (
                                repostSolicitados.has(foto.id) ? (
                                  <Text style={{ fontSize: 9, color: colors.inkMuted }}>Pedido enviado</Text>
                                ) : (
                                  <Pressable onPress={() => handlePedirRepost(foto.id)} disabled={solicitandoRepost === foto.id}>
                                    <Text style={{ fontSize: 9, color: colors.copper, opacity: solicitandoRepost === foto.id ? 0.5 : 1 }}>
                                      {solicitandoRepost === foto.id ? "Pidiendo..." : "Pedir permiso"}
                                    </Text>
                                  </Pressable>
                                )
                              ) : foto.estadoRepost === "Pendiente" ? (
                                <Text style={{ fontSize: 9, color: colors.inkMuted }}>Esperando respuesta</Text>
                              ) : (
                                <Text style={{ fontSize: 9, color: colors.stamp }}>En tu perfil</Text>
                              )}
                            </>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={[styles.filaCriterios, { borderTopColor: colors.border }]}>
                    {CRITERIOS_CALIFICACION.map((criterio) => (
                      <View key={criterio.key} style={[styles.chipCriterio, { backgroundColor: `${colors.ink}0D` }]}>
                        <Text style={{ color: colors.inkMuted, fontSize: 10 }}>{criterio.label} </Text>
                        <Text style={{ color: colors.copper, fontSize: 10, fontWeight: "700" }}>{c[criterio.key]}★</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ---- Foto de perfil ampliada (mismo patrón que el lightbox del chat / Mi cuenta) ---- */}
      <Modal visible={fotoModalAbierta} transparent animationType="fade" onRequestClose={() => setFotoModalAbierta(false)}>
        <Pressable style={styles.fondoLightbox} onPress={() => setFotoModalAbierta(false)}>
          {perfil.fotoPerfilUrl && (
            <Image source={{ uri: perfil.fotoPerfilUrl }} style={styles.fotoAmpliada} resizeMode="contain" />
          )}
          <Pressable
            onPress={() => setFotoModalAbierta(false)}
            style={[styles.botonCerrarLightbox, { top: insets.top + 12 }]}
            hitSlop={12}
          >
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

  tarjetaContacto: { width: "100%", maxWidth: 340, borderWidth: 1, borderRadius: 16, overflow: "hidden", flexDirection: "row", flexWrap: "wrap" },
  celda: { paddingHorizontal: 14, paddingVertical: 11 },
  celdaLabel: { fontSize: 9, letterSpacing: 0.6, fontWeight: "700", marginBottom: 3 },
  celdaValor: { fontSize: 12.5, fontWeight: "700" },
  filaChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chipRubro: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },

  statsBar: { flexDirection: "row", paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1 },
  statItem: { flex: 1, alignItems: "center" },
  statNumero: { fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 10.5, marginTop: 2, textAlign: "center" },

  contenido: { paddingHorizontal: 24, paddingTop: 24, gap: 30 },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: "700", marginBottom: 10 },

  tarjeta: { borderWidth: 1, borderRadius: 12, padding: 14 },
  filaServicio: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  botonContactar: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },

  fotoTrabajo: { flex: 1, aspectRatio: 1, borderRadius: 10, overflow: "hidden" },
  rotuloFotoTrabajo: { position: "absolute", bottom: 3, left: 3, right: 3, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1.5, alignItems: "center" },

  filaReseñasTitulo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 },
  toggleFotos: { flexDirection: "row", borderRadius: 8, padding: 2, gap: 2 },
  toggleBotonChico: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },

  filaReseñaTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  avatarChico: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  filaFotosReseña: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  fotoReseña: { width: 56, height: 56, borderRadius: 7, overflow: "hidden" },
  filaCriterios: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  chipCriterio: { flexDirection: "row", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },

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
