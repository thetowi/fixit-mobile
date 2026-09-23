import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { apiFetch, ApiError } from "@/lib/api";
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

    try {
      await apiFetch(`/api/ordenes/${ordenCalificando}/calificacion`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setOrdenCalificando(null);
      setCalificacionForm(CALIFICACION_INICIAL);
      setComentario("");
      await cargarOrdenes();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al enviar la calificación");
    }
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
                    <View key={criterio.key} style={styles.filaCriterio}>
                      <Text style={{ color: colors.ink, fontSize: 12, flex: 1 }}>{criterio.label}</Text>
                      <SelectorEstrellas
                        valor={calificacionForm[criterio.key]}
                        onChange={(valor) => setCalificacionForm((prev) => ({ ...prev, [criterio.key]: valor }))}
                        tamaño={16}
                      />
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

                  <View style={styles.filaBotonesForm}>
                    <Pressable
                      onPress={() => {
                        setError(null);
                        setOrdenCalificando(null);
                        setCalificacionForm(CALIFICACION_INICIAL);
                      }}
                      style={[styles.botonAccionOutline, { borderColor: colors.border, flex: 1 }]}
                    >
                      <Text style={{ color: colors.ink, fontSize: 12, textAlign: "center" }}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleEnviarCalificacion}
                      style={[styles.botonAccion, { backgroundColor: colors.copper, flex: 1 }]}
                    >
                      <Text style={{ color: colors.paper, fontSize: 12, fontWeight: "600", textAlign: "center" }}>
                        Enviar
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
  filaCriterio: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  textarea: { borderWidth: 1, borderRadius: 8, padding: 8, minHeight: 60, fontSize: 13, textAlignVertical: "top" },
  filaBotonesForm: { flexDirection: "row", gap: 8, marginTop: 4 },
});
