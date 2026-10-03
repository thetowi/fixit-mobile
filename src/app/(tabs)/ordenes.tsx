import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { apiFetch, ApiError } from "@/lib/api";
import { apiUpload } from "@/lib/apiUpload";
import { useRefrescoEnFoco } from "@/lib/useRefrescoEnFoco";
import { useAuth } from "@/lib/authContext";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { Orden } from "@/types/ordenes";
import { CrearCalificacionRequest, CRITERIOS_CALIFICACION } from "@/types/calificaciones";
import OrdenTicket, { ESTADO_LABELS } from "@/components/OrdenTicket";
import SelectorEstrellas from "@/components/SelectorEstrellas";
import SelectorModal, { BotonSelector, OpcionSelector } from "@/components/SelectorModal";

const ORDEN_ESTADOS = ["PendientePago", "Pagado", "EnCurso", "Completado", "Cancelado", "EnDisputa"];

const CALIFICACION_INICIAL: Omit<CrearCalificacionRequest, "comentario"> = {
  puntualidad: 0,
  calidad: 0,
  precio: 0,
  comunicacion: 0,
  limpieza: 0,
  garantia: 0,
};

// Foto elegida localmente para la reseña, todavía no subida (ver fotosSeleccionadas más abajo).
type FotoSeleccionada = { uri: string; name: string; type: string };

function claveMes(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

function etiquetaMes(clave: string): string {
  const [anio, mes] = clave.split("-").map(Number);
  const texto = new Date(anio, mes - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Pantalla real de "Mis órdenes" — mismo endpoint (/api/ordenes/mias) y misma lógica que
// fixit-web/app/ordenes/page.tsx: filtros por estado/mes, acciones según rol (Prestador puede
// iniciar el trabajo, Cliente confirmarlo terminado y calificarlo con los 6 criterios).
export default function OrdenesScreen() {
  const colors = useFixitColors();
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();

  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtroMes, setFiltroMes] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [modalAbierto, setModalAbierto] = useState<"mes" | "estado" | null>(null);

  const [ordenCalificando, setOrdenCalificando] = useState<string | null>(null);
  const [calificacionForm, setCalificacionForm] = useState(CALIFICACION_INICIAL);
  const [comentario, setComentario] = useState("");
  // Qué criterio tiene la explicación desplegada (03/10, a pedido del usuario: "no tenemos la
  // opción de la (i) para visualizar la explicación") — espejo de fixit-web/app/ordenes/page.tsx
  // (criterioExpandido), pero en vez de un popover posicionado absoluto (que en mobile venía
  // dando problemas de layout, ver la insignia y el botón Recontratar más arriba en este chat) se
  // despliega como un renglón más abajo del criterio, empujando el resto del formulario.
  const [criterioExpandido, setCriterioExpandido] = useState<string | null>(null);

  // Fotos de la reseña (03/10, a pedido del usuario: "en mobile no nos deja cargar una foto a la
  // reseña") — el backend ya tenía el endpoint listo (POST /api/ordenes/{id}/calificacion/fotos,
  // hasta 5 por reseña) pero ninguna pantalla lo usaba, ni en mobile ni en web. Se eligen DENTRO
  // del mismo formulario de calificación (el usuario pidió que esté "en el mismo momento que
  // estás reseñando", no como un paso aparte después de publicar) y recién se suben al tocar
  // "Enviar": primero se crea la calificación y en ese mismo envío se suben las fotos ya
  // elegidas — para la persona es un solo paso, aunque el backend necesite la calificación creada
  // primero (ver CalificacionService.AgregarFotoAsync, que busca la calificación por ordenId).
  const [fotosSeleccionadas, setFotosSeleccionadas] = useState<FotoSeleccionada[]>([]);
  const [subiendoFotos, setSubiendoFotos] = useState(false);

  useEffect(() => {
    cargarOrdenes();
  }, []);

  // Fix (22/09, a pedido del usuario): "Mis órdenes" tampoco se refrescaba sola con eventos (ej.
  // una orden que pasa a "Pagado" desde otro dispositivo) — se agrega el mismo polling silencioso
  // cada 20s mientras la pestaña está enfocada + refresco al volver la app a primer plano que ya se
  // sumó en agenda.tsx/inicio.tsx (ver useRefrescoEnFoco). `saltarPrimerFoco` evita duplicar la
  // carga inicial de arriba.
  useRefrescoEnFoco(cargarOrdenes, { saltarPrimerFoco: true });

  async function cargarOrdenes() {
    try {
      const data = await apiFetch<Orden[]>("/api/ordenes/mias");
      setOrdenes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar tus órdenes");
    } finally {
      setCargando(false);
    }
  }

  async function handleAccion(ordenId: string, accion: "iniciar" | "completar") {
    setError(null);
    try {
      await apiFetch(`/api/ordenes/${ordenId}/${accion}`, { method: "PUT" });
      await cargarOrdenes();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al actualizar la orden");
    }
  }

  async function handleEnviarCalificacion() {
    if (!ordenCalificando) return;

    const faltantes = CRITERIOS_CALIFICACION.filter((c) => calificacionForm[c.key] === 0);
    if (faltantes.length > 0) {
      setError(`Te falta calificar: ${faltantes.map((c) => c.label).join(", ")}.`);
      return;
    }

    const body: CrearCalificacionRequest = { ...calificacionForm, comentario: comentario || undefined };
    const ordenId = ordenCalificando;
    const fotos = fotosSeleccionadas;

    try {
      await apiFetch(`/api/ordenes/${ordenId}/calificacion`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      // La calificación ya quedó creada. Si falla la subida de alguna foto no la deshacemos (ya
      // se guardó bien) — solo avisamos, porque reintentar el "Enviar" ya no tiene sentido (la
      // orden pasa a "yaCalificada").
      if (fotos.length > 0) {
        setSubiendoFotos(true);
        try {
          for (const foto of fotos) {
            await apiUpload(`/api/ordenes/${ordenId}/calificacion/fotos`, { archivo: foto });
          }
        } catch (err) {
          setError(
            err instanceof ApiError
              ? `La calificación se envió, pero: ${err.message}`
              : "La calificación se envió, pero no se pudieron subir todas las fotos."
          );
        } finally {
          setSubiendoFotos(false);
        }
      }

      setOrdenCalificando(null);
      setCalificacionForm(CALIFICACION_INICIAL);
      setComentario("");
      setCriterioExpandido(null);
      setFotosSeleccionadas([]);
      await cargarOrdenes();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al enviar la calificación");
    }
  }

  async function handleSeleccionarFoto() {
    if (fotosSeleccionadas.length >= 5) return;

    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError("Necesitamos permiso para acceder a tus fotos.");
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (resultado.canceled) return;

    const asset = resultado.assets[0];
    setFotosSeleccionadas((prev) => [
      ...prev,
      { uri: asset.uri, name: asset.fileName ?? "resena.jpg", type: asset.mimeType ?? "image/jpeg" },
    ]);
  }

  function handleQuitarFotoSeleccionada(indice: number) {
    setFotosSeleccionadas((prev) => prev.filter((_, i) => i !== indice));
  }

  const esCliente = usuario?.rol === "Cliente";
  const esPrestador = usuario?.rol === "Prestador";

  const mesesDisponibles = useMemo(
    () => Array.from(new Set(ordenes.map((o) => claveMes(o.creadoEn)))).sort().reverse(),
    [ordenes]
  );
  const estadosDisponibles = useMemo(
    () => ORDEN_ESTADOS.filter((e) => ordenes.some((o) => o.estado === e)),
    [ordenes]
  );
  const ordenesFiltradas = ordenes
    .filter((o) => filtroMes === "todos" || claveMes(o.creadoEn) === filtroMes)
    .filter((o) => filtroEstado === "todos" || o.estado === filtroEstado);
  const hayFiltrosActivos = filtroMes !== "todos" || filtroEstado !== "todos";

  const opcionesMes: OpcionSelector[] = [
    { value: "todos", label: "Todos los meses" },
    ...mesesDisponibles.map((m) => ({ value: m, label: etiquetaMes(m) })),
  ];
  const opcionesEstado: OpcionSelector[] = [
    { value: "todos", label: "Todos los estados" },
    ...estadosDisponibles.map((e) => ({ value: e, label: ESTADO_LABELS[e] ?? e })),
  ];

  if (cargando) {
    return (
      <View style={[styles.centro, { backgroundColor: colors.paper }]}>
        <ActivityIndicator color={colors.copper} />
      </View>
    );
  }

  return (
    // Fix (22/09, reportado por el usuario): sin este KeyboardAvoidingView, el teclado tapaba el
    // campo de "Comentario (opcional)" del formulario de calificación sin dejar forma de verlo
    // mientras se escribe — mismo motivo que en login.tsx/conversacion/cuenta.
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={{ backgroundColor: colors.paper }}
        contentContainerStyle={[styles.contenido, { paddingTop: insets.top + 20 }]}
      >
      <Text style={[styles.h1, { color: colors.ink }]}>Mis órdenes</Text>

      <View style={styles.filtros}>
        {estadosDisponibles.length > 0 && (
          <BotonSelector
            label={filtroEstado === "todos" ? "Todos los estados" : ESTADO_LABELS[filtroEstado] ?? filtroEstado}
            onPress={() => setModalAbierto("estado")}
          />
        )}
        {mesesDisponibles.length > 0 && (
          <BotonSelector
            label={filtroMes === "todos" ? "Todos los meses" : etiquetaMes(filtroMes)}
            onPress={() => setModalAbierto("mes")}
          />
        )}
      </View>

      <SelectorModal
        visible={modalAbierto === "estado"}
        opciones={opcionesEstado}
        valorActual={filtroEstado}
        onSeleccionar={setFiltroEstado}
        onCerrar={() => setModalAbierto(null)}
        titulo="Filtrar por estado"
      />
      <SelectorModal
        visible={modalAbierto === "mes"}
        opciones={opcionesMes}
        valorActual={filtroMes}
        onSeleccionar={setFiltroMes}
        onCerrar={() => setModalAbierto(null)}
        titulo="Filtrar por mes"
      />

      {error && <Text style={[styles.error]}>{error}</Text>}

      {ordenes.length === 0 && !error && (
        <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Todavía no tenés órdenes.</Text>
      )}
      {ordenes.length > 0 && ordenesFiltradas.length === 0 && (
        <Text style={{ color: colors.inkMuted, fontSize: 13 }}>
          {hayFiltrosActivos ? "No tenés órdenes con ese filtro." : "No tenés órdenes."}
        </Text>
      )}

      <View style={{ gap: 14 }}>
        {ordenesFiltradas.map((o) => {
          const nombreContraparte = esCliente ? o.prestadorNombreCompleto : o.clienteNombreCompleto;

          return (
            <OrdenTicket key={o.id} orden={o} nombreContraparte={nombreContraparte}>
              <View style={styles.acciones}>
                {esPrestador && o.estado === "Pagado" && (
                  <Pressable
                    onPress={() => handleAccion(o.id, "iniciar")}
                    style={[styles.botonAccion, { backgroundColor: colors.ink }]}
                  >
                    <Text style={{ color: colors.paper, fontSize: 12, fontWeight: "600" }}>Iniciar trabajo</Text>
                  </Pressable>
                )}

                {esCliente && o.estado === "EnCurso" && (
                  <Pressable
                    onPress={() => handleAccion(o.id, "completar")}
                    style={[styles.botonAccion, { backgroundColor: colors.ink }]}
                  >
                    <Text style={{ color: colors.paper, fontSize: 12, fontWeight: "600" }}>Confirmar terminado</Text>
                  </Pressable>
                )}

                {esCliente && o.estado === "Completado" && !o.yaCalificada && (
                  <Pressable
                    onPress={() => {
                      setError(null);
                      setOrdenCalificando(o.id);
                    }}
                    style={[styles.botonAccionOutline, { borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "600" }}>Calificar</Text>
                  </Pressable>
                )}

                {o.yaCalificada && (
                  <Text style={{ color: colors.inkMuted, fontSize: 12 }}>Ya calificaste este trabajo</Text>
                )}
              </View>

              {ordenCalificando === o.id && (
                <View style={[styles.formCalificacion, { borderTopColor: colors.border }]}>
                  <Text style={{ color: colors.inkMuted, fontSize: 11, marginBottom: 6 }}>
                    Calificá cada aspecto del trabajo.
                  </Text>

                  {CRITERIOS_CALIFICACION.map((criterio) => (
                    <View key={criterio.key} style={styles.bloqueCriterio}>
                      <View style={styles.filaCriterio}>
                        <View style={styles.filaLabelConInfo}>
                          <Text style={{ color: colors.ink, fontSize: 12 }}>{criterio.label}</Text>
                          <Pressable
                            onPress={() =>
                              setCriterioExpandido((prev) => (prev === criterio.key ? null : criterio.key))
                            }
                            style={[styles.botonInfo, { borderColor: colors.inkMuted }]}
                            hitSlop={8}
                          >
                            <Text style={{ color: colors.inkMuted, fontSize: 10, fontWeight: "700" }}>i</Text>
                          </Pressable>
                        </View>
                        <SelectorEstrellas
                          valor={calificacionForm[criterio.key]}
                          onChange={(valor) => setCalificacionForm((prev) => ({ ...prev, [criterio.key]: valor }))}
                          tamaño={16}
                        />
                      </View>
                      {criterioExpandido === criterio.key && (
                        <Text style={[styles.descripcionCriterio, { color: colors.inkMuted, backgroundColor: `${colors.ink}0D` }]}>
                          {criterio.descripcion}
                        </Text>
                      )}
                    </View>
                  ))}

                  <TextInput
                    placeholder="Comentario (opcional)"
                    placeholderTextColor={colors.inkMuted}
                    style={[styles.textarea, { borderColor: colors.border, color: colors.ink }]}
                    value={comentario}
                    onChangeText={setComentario}
                    multiline
                  />

                  <View style={styles.bloqueFotos}>
                    <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "600" }}>
                      Fotos (opcional, hasta 5)
                    </Text>
                    {fotosSeleccionadas.length > 0 && (
                      <View style={styles.grillaFotosResena}>
                        {fotosSeleccionadas.map((f, i) => (
                          <View key={f.uri + i} style={styles.fotoResenaWrap}>
                            <Image source={{ uri: f.uri }} style={styles.fotoResena} />
                            <Pressable
                              onPress={() => handleQuitarFotoSeleccionada(i)}
                              style={styles.botonQuitarFotoResena}
                            >
                              <Text style={{ color: "#fff", fontSize: 10 }}>Quitar</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}
                    {fotosSeleccionadas.length < 5 && (
                      <Pressable
                        onPress={handleSeleccionarFoto}
                        style={[
                          styles.botonAccionOutline,
                          { borderColor: colors.border, alignSelf: "flex-start" },
                        ]}
                      >
                        <Text style={{ color: colors.ink, fontSize: 12 }}>+ Agregar foto</Text>
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.filaBotonesForm}>
                    <Pressable
                      onPress={() => {
                        setError(null);
                        setOrdenCalificando(null);
                        setCalificacionForm(CALIFICACION_INICIAL);
                        setCriterioExpandido(null);
                        setFotosSeleccionadas([]);
                      }}
                      style={[styles.botonAccionOutline, { borderColor: colors.border, flex: 1 }]}
                    >
                      <Text style={{ color: colors.ink, fontSize: 12, textAlign: "center" }}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleEnviarCalificacion}
                      disabled={subiendoFotos}
                      style={[styles.botonAccion, { backgroundColor: colors.copper, flex: 1, opacity: subiendoFotos ? 0.6 : 1 }]}
                    >
                      <Text style={{ color: colors.paper, fontSize: 12, fontWeight: "600", textAlign: "center" }}>
                        {subiendoFotos ? "Enviando..." : "Enviar"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </OrdenTicket>
          );
        })}
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  contenido: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  filtros: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  error: { color: "#C0392B", fontSize: 13, marginBottom: 10 },
  acciones: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  botonAccion: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  botonAccionOutline: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  formCalificacion: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, gap: 8 },
  bloqueCriterio: { gap: 6 },
  filaCriterio: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filaLabelConInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
  botonInfo: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  descripcionCriterio: { fontSize: 11, lineHeight: 15, borderRadius: 6, padding: 8 },
  textarea: { borderWidth: 1, borderRadius: 8, padding: 8, minHeight: 60, fontSize: 13, textAlignVertical: "top" },
  filaBotonesForm: { flexDirection: "row", gap: 8, marginTop: 4 },
  bloqueFotos: { gap: 8 },
  grillaFotosResena: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fotoResenaWrap: { width: 64, height: 64, borderRadius: 8, overflow: "hidden", position: "relative" },
  fotoResena: { width: "100%", height: "100%" },
  botonQuitarFotoResena: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
});
