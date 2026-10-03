import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { apiFetch, ApiError } from "@/lib/api";
import { useRefrescoEnFoco } from "@/lib/useRefrescoEnFoco";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { BloqueDisponibilidad, DURACIONES_PREDEFINIDAS_MINUTOS, formatoDistancia, formatoDuracion, OrdenAgenda } from "@/types/agenda";
import { colorCategoria } from "@/lib/coloresCategoria";
import { linkGoogleMaps } from "@/lib/mapas";
import CalendarioSemanal from "@/components/agenda/CalendarioSemanal";
import CalendarioMensual from "@/components/agenda/CalendarioMensual";
import SelectorModal, { BotonSelector } from "@/components/SelectorModal";

type Vista = "semana" | "mes";

function inicioDeSemana(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getDay();
  d.setDate(d.getDate() - dia);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mesBaseDesdeOffset(offsetMes: number): Date {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offsetMes);
  base.setHours(0, 0, 0, 0);
  return base;
}

function rangoVisibleDelMes(mesBase: Date): { desde: Date; hasta: Date } {
  const primerDia = new Date(mesBase.getFullYear(), mesBase.getMonth(), 1);
  const ultimoDia = new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 0);
  const desde = new Date(primerDia);
  desde.setDate(desde.getDate() - desde.getDay());
  const hasta = new Date(ultimoDia);
  hasta.setDate(hasta.getDate() + (6 - hasta.getDay()));
  hasta.setHours(23, 59, 59, 999);
  return { desde, hasta };
}

function fechaAInputDate(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

// Espejo mobile de fixit-web/app/prestador/agenda/page.tsx. El guard de rol/sesión ya lo hace el
// layout raíz + el tab bar (el tab "Agenda" ni se muestra si el usuario no es Prestador), así que
// acá vamos directo al contenido.
export default function AgendaScreen() {
  const colors = useFixitColors();
  const insets = useSafeAreaInsets();

  const [bloques, setBloques] = useState<BloqueDisponibilidad[]>([]);
  const [sinProgramar, setSinProgramar] = useState<OrdenAgenda[]>([]);
  const [programadas, setProgramadas] = useState<OrdenAgenda[]>([]);
  const [vista, setVista] = useState<Vista>("semana");
  const [offsetSemana, setOffsetSemana] = useState(0);
  const [offsetMes, setOffsetMes] = useState(0);

  const [ordenAProgramar, setOrdenAProgramar] = useState<OrdenAgenda | null>(null);
  const [fechaTurno, setFechaTurno] = useState<Date | null>(null);
  const [horaTurno, setHoraTurno] = useState(new Date(2000, 0, 1, 9, 0));
  const [duracionTurno, setDuracionTurno] = useState(60);
  const [mostrarPickerFecha, setMostrarPickerFecha] = useState(false);
  const [mostrarPickerHora, setMostrarPickerHora] = useState(false);
  const [modalDuracionAbierto, setModalDuracionAbierto] = useState(false);
  const [modalSinProgramarAbierto, setModalSinProgramarAbierto] = useState(false);
  const [programando, setProgramando] = useState(false);
  const [esReprogramacion, setEsReprogramacion] = useState(false);
  // Turno ya agendado que se quiere reprogramar, esperando la confirmación del usuario antes de
  // abrir el formulario (22/09, a pedido explícito: "que consulte si está seguro").
  const [turnoAConfirmarReprogramacion, setTurnoAConfirmarReprogramacion] = useState<OrdenAgenda | null>(null);

  const [error, setError] = useState<string | null>(null);
  // Aviso no bloqueante (30/09): a diferencia de `error`, esto NO impidió que el turno se agende —
  // solo informa que quedó fuera del horario laboral declarado (ver AgendaService.ProgramarTurnoAsync).
  const [avisoHorario, setAvisoHorario] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoRango, setCargandoRango] = useState(false);
  // Cancelar una Visita a domicilio ya agendada (30/09) — ver VisitaService.CancelarAsync.
  const [cancelandoVisitaId, setCancelandoVisitaId] = useState<string | null>(null);

  const inicioSemana = (() => {
    const base = new Date();
    base.setDate(base.getDate() + offsetSemana * 7);
    return inicioDeSemana(base);
  })();
  const mesBase = mesBaseDesdeOffset(offsetMes);

  useEffect(() => {
    cargarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fix (22/09, reportado por el usuario): "Pendientes de programar" y los turnos ya agendados se
  // traían solo una vez al montar la pantalla — si una orden pasaba a "Pagado" mientras el
  // prestador ya tenía la pestaña Agenda abierta desde antes (ej. el cliente pagó y un Admin la
  // marcó pagada a mano desde otro dispositivo), no aparecía hasta forzar un reload completo de la
  // app. Ampliado el mismo día: el usuario reportó que ni siquiera volviendo a la pestaña se veía
  // (probablemente porque se quedaba en la pestaña mientras pasaba el evento, sin volver a
  // enfocarla) — `useRefrescoEnFoco` suma un polling silencioso cada 20s mientras la pestaña está
  // enfocada + un refresco al volver la app a primer plano, mismo criterio que ya usa el badge de
  // mensajes (conteoNoLeidosContext.tsx). `saltarPrimerFoco` evita pedir los mismos datos dos veces
  // apenas se monta la pantalla (ya los trae `cargarBase` de arriba).
  useRefrescoEnFoco(refrescarTodo, { saltarPrimerFoco: true });

  useEffect(() => {
    if (cargando) return;
    cargarRango();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, offsetSemana, offsetMes]);

  async function cargarBase() {
    try {
      const [bloquesData, sinProgramarData] = await Promise.all([
        apiFetch<BloqueDisponibilidad[]>("/api/prestador/disponibilidad"),
        apiFetch<OrdenAgenda[]>("/api/prestador/agenda/sin-programar"),
      ]);
      setBloques(bloquesData);
      setSinProgramar(sinProgramarData);
      await cargarRango();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar la agenda");
    } finally {
      setCargando(false);
    }
  }

  async function cargarRango() {
    setCargandoRango(true);
    try {
      let desde: Date;
      let hasta: Date;
      if (vista === "semana") {
        const base = new Date();
        base.setDate(base.getDate() + offsetSemana * 7);
        desde = inicioDeSemana(base);
        hasta = new Date(desde);
        hasta.setDate(hasta.getDate() + 6);
        hasta.setHours(23, 59, 59, 999);
      } else {
        ({ desde, hasta } = rangoVisibleDelMes(mesBaseDesdeOffset(offsetMes)));
      }
      const data = await apiFetch<OrdenAgenda[]>(`/api/prestador/agenda?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`);
      setProgramadas(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar la agenda");
    } finally {
      setCargandoRango(false);
    }
  }

  async function refrescarTodo() {
    const [bloquesData, sinProgramarData] = await Promise.all([
      apiFetch<BloqueDisponibilidad[]>("/api/prestador/disponibilidad"),
      apiFetch<OrdenAgenda[]>("/api/prestador/agenda/sin-programar"),
    ]);
    setBloques(bloquesData);
    setSinProgramar(sinProgramarData);
    await cargarRango();
  }

  async function handleCancelarVisita(orden: OrdenAgenda) {
    setCancelandoVisitaId(orden.id);
    setError(null);
    try {
      await apiFetch(`/api/visitas/${orden.id}/cancelar`, { method: "PUT" });
      await refrescarTodo();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cancelar la visita");
    } finally {
      setCancelandoVisitaId(null);
    }
  }

  function abrirProgramar(orden: OrdenAgenda, fechaPre?: Date, horaPre?: string) {
    setEsReprogramacion(false);
    setOrdenAProgramar(orden);
    setFechaTurno(fechaPre ?? null);
    if (horaPre) {
      const [h, m] = horaPre.split(":").map(Number);
      setHoraTurno(new Date(2000, 0, 1, h, m));
    } else {
      setHoraTurno(new Date(2000, 0, 1, 9, 0));
    }
    setDuracionTurno(60);
    setError(null);
  }

  // Paso 1: el usuario tocó "Reprogramar" en el detalle de un turno ya agendado — pedimos
  // confirmación antes de abrir el formulario (22/09, a pedido explícito del usuario).
  function pedirConfirmacionReprogramar(orden: OrdenAgenda) {
    setTurnoAConfirmarReprogramacion(orden);
  }

  // Paso 2: confirmado — abrimos el mismo formulario de "Programar", pre-cargado con la
  // fecha/hora/duración actuales del turno.
  function confirmarReprogramar() {
    const orden = turnoAConfirmarReprogramacion;
    setTurnoAConfirmarReprogramacion(null);
    if (!orden) return;

    setEsReprogramacion(true);
    setOrdenAProgramar(orden);
    if (orden.fechaHoraProgramada) {
      const fecha = new Date(orden.fechaHoraProgramada);
      setFechaTurno(fecha);
      setHoraTurno(new Date(2000, 0, 1, fecha.getHours(), fecha.getMinutes()));
    } else {
      setFechaTurno(null);
      setHoraTurno(new Date(2000, 0, 1, 9, 0));
    }
    setDuracionTurno(orden.duracionMinutos ?? 60);
    setError(null);
  }

  function handleCeldaDisponibleClick(dia: Date, horaHHMM: string) {
    if (sinProgramar.length === 0) {
      setError("No tenés trabajos pendientes de agendar — primero necesitás una orden pagada sin programar.");
      return;
    }
    if (sinProgramar.length === 1) {
      abrirProgramar(sinProgramar[0], dia, horaHHMM);
      return;
    }
    setError('Tenés más de un trabajo pendiente: elegí cuál desde "Pendientes de programar" y después tocá el horario.');
    setModalSinProgramarAbierto(true);
  }

  function handleSeleccionarDiaMes(dia: Date) {
    const inicioSemanaDeHoy = inicioDeSemana(new Date());
    const inicioSemanaDelDia = inicioDeSemana(dia);
    const diffSemanas = Math.round((inicioSemanaDelDia.getTime() - inicioSemanaDeHoy.getTime()) / (7 * 86400000));
    setOffsetSemana(diffSemanas);
    setVista("semana");
  }

  async function handleProgramar() {
    if (!ordenAProgramar || !fechaTurno) {
      setError("Elegí una fecha.");
      return;
    }
    const horaTexto = `${String(horaTurno.getHours()).padStart(2, "0")}:${String(horaTurno.getMinutes()).padStart(2, "0")}`;
    const fechaHora = new Date(`${fechaAInputDate(fechaTurno)}T${horaTexto}:00`);

    setProgramando(true);
    setError(null);
    try {
      const resultado = await apiFetch<{ advertenciaFueraDeHorario?: string | null }>(
        `/api/ordenes/${ordenAProgramar.id}/programar`,
        {
          method: "PUT",
          body: JSON.stringify({ fechaHora: fechaHora.toISOString(), duracionMinutos: duracionTurno }),
        }
      );
      setOrdenAProgramar(null);
      setAvisoHorario(resultado?.advertenciaFueraDeHorario ?? null);
      await refrescarTodo();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al programar el turno");
    } finally {
      setProgramando(false);
    }
  }

  if (cargando) {
    return (
      <View style={[styles.centro, { backgroundColor: colors.paper }]}>
        <ActivityIndicator color={colors.copper} />
      </View>
    );
  }

  const finSemana = new Date(inicioSemana);
  finSemana.setDate(finSemana.getDate() + 6);
  const rangoSemanaLabel = `${inicioSemana.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} — ${finSemana.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  })}`;
  const mesLabel = mesBase.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const mesLabelCapitalizado = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);
  const enHoy = vista === "semana" ? offsetSemana === 0 : offsetMes === 0;

  function irAHoy() {
    if (vista === "semana") setOffsetSemana(0);
    else setOffsetMes(0);
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={[styles.contenido, { paddingTop: insets.top + 20 }]}
    >
      <Text style={[styles.eyebrow, { color: colors.copper }]}>PRESTADOR</Text>
      <View style={styles.filaTitulo}>
        <Text style={[styles.h1, { color: colors.ink }]}>Mi agenda</Text>
        <View style={[styles.toggleVista, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable onPress={() => setVista("semana")} style={[styles.toggleBoton, vista === "semana" && { backgroundColor: colors.copper }]}>
            <Text style={{ color: vista === "semana" ? colors.paper : colors.inkMuted, fontSize: 12, fontWeight: "600" }}>Semana</Text>
          </Pressable>
          <Pressable onPress={() => setVista("mes")} style={[styles.toggleBoton, vista === "mes" && { backgroundColor: colors.copper }]}>
            <Text style={{ color: vista === "mes" ? colors.paper : colors.inkMuted, fontSize: 12, fontWeight: "600" }}>Mes</Text>
          </Pressable>
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {avisoHorario && (
        <View style={[styles.avisoSinHorarios, { backgroundColor: "#FEF3C7", borderColor: "#D97706", flexDirection: "row", alignItems: "center" }]}>
          <Text style={{ color: "#92400E", fontSize: 12, flex: 1 }}>{avisoHorario}</Text>
          <Pressable onPress={() => setAvisoHorario(null)}>
            <Text style={{ color: "#92400E", fontSize: 11, fontWeight: "600", marginLeft: 8 }}>Cerrar</Text>
          </Pressable>
        </View>
      )}

      {bloques.length === 0 && (
        <View style={[styles.avisoSinHorarios, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.inkMuted, fontSize: 12, flex: 1 }}>Todavía no cargaste los horarios en los que trabajás.</Text>
        </View>
      )}

      <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.ink, fontWeight: "700", marginBottom: 10 }}>
          Pendientes de programar {sinProgramar.length > 0 && <Text style={{ color: colors.inkMuted, fontWeight: "400" }}>({sinProgramar.length})</Text>}
        </Text>
        {sinProgramar.length === 0 ? (
          <Text style={{ color: colors.inkMuted, fontSize: 13 }}>No tenés trabajos pendientes de agendar.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {sinProgramar.map((o) => (
              <View key={o.id} style={[styles.filaPendiente, { backgroundColor: colors.paper, borderLeftColor: colorCategoria(o.categoriaNombre) }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.ink, fontWeight: "600" }} numberOfLines={1}>
                    {o.descripcion || o.categoriaNombre} · {o.clienteNombreCompleto}
                  </Text>
                  <Text style={{ color: colors.inkMuted, fontSize: 11 }} numberOfLines={1}>
                    {o.categoriaNombre}
                    {o.clienteTelefono ? ` · ${o.clienteTelefono}` : ""}
                  </Text>
                  {o.clienteDireccion && (
                    <Pressable onPress={() => Linking.openURL(linkGoogleMaps(o.clienteDireccion, o.clienteDireccionLat, o.clienteDireccionLon))}>
                      <Text style={{ color: colors.copper, fontSize: 11, textDecorationLine: "underline" }} numberOfLines={1}>
                        📍 {o.clienteDireccion}
                        {o.clienteDireccionVerificada ? " ✓" : ""}
                      </Text>
                    </Pressable>
                  )}
                  {o.clienteDistanciaKm != null && <Text style={{ color: colors.inkMuted, fontSize: 10 }}>{formatoDistancia(o.clienteDistanciaKm)}</Text>}
                </View>
                <Pressable onPress={() => abrirProgramar(o)} style={[styles.botonProgramar, { backgroundColor: colors.copper }]}>
                  <Text style={{ color: colors.paper, fontWeight: "600", fontSize: 12 }}>Programar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.filaEncabezadoCalendario, { borderBottomColor: colors.border }]}>
          <Text style={{ color: colors.ink, fontWeight: "700" }}>{vista === "semana" ? rangoSemanaLabel : mesLabelCapitalizado}</Text>
          <View style={styles.filaNav}>
            <Pressable onPress={() => (vista === "semana" ? setOffsetSemana((s) => s - 1) : setOffsetMes((m) => m - 1))}>
              <Text style={{ color: colors.inkMuted, fontSize: 16, paddingHorizontal: 4 }}>←</Text>
            </Pressable>
            {!enHoy && (
              <Pressable onPress={irAHoy}>
                <Text style={{ color: colors.copper, fontSize: 11 }}>Hoy</Text>
              </Pressable>
            )}
            <Pressable onPress={() => (vista === "semana" ? setOffsetSemana((s) => s + 1) : setOffsetMes((m) => m + 1))}>
              <Text style={{ color: colors.inkMuted, fontSize: 16, paddingHorizontal: 4 }}>→</Text>
            </Pressable>
          </View>
        </View>

        {cargandoRango ? (
          <ActivityIndicator color={colors.copper} style={{ marginVertical: 20 }} />
        ) : vista === "semana" ? (
          <CalendarioSemanal
            inicioSemana={inicioSemana}
            bloques={bloques}
            ordenes={programadas}
            onCeldaDisponibleClick={handleCeldaDisponibleClick}
            onReprogramar={pedirConfirmacionReprogramar}
            onCancelarVisita={handleCancelarVisita}
            cancelandoVisitaId={cancelandoVisitaId}
          />
        ) : (
          <CalendarioMensual
            mesBase={mesBase}
            ordenes={programadas}
            onSeleccionarDia={handleSeleccionarDiaMes}
            onReprogramar={pedirConfirmacionReprogramar}
            onCancelarVisita={handleCancelarVisita}
            cancelandoVisitaId={cancelandoVisitaId}
          />
        )}
      </View>

      {/* Elegir cuál orden programar cuando hay más de una pendiente y se tocó un horario libre */}
      <SelectorModal
        visible={modalSinProgramarAbierto}
        titulo="Elegí el trabajo a programar"
        valorActual=""
        opciones={sinProgramar.map((o) => ({ value: o.id, label: `${o.descripcion || o.categoriaNombre} · ${o.clienteNombreCompleto}` }))}
        onSeleccionar={(id) => {
          const orden = sinProgramar.find((o) => o.id === id);
          if (orden) abrirProgramar(orden);
        }}
        onCerrar={() => setModalSinProgramarAbierto(false)}
      />

      <Modal visible={!!ordenAProgramar} transparent animationType="fade" onRequestClose={() => setOrdenAProgramar(null)}>
        <Pressable style={styles.fondoModal} onPress={() => setOrdenAProgramar(null)}>
          <Pressable style={[styles.modalProgramar, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            {ordenAProgramar && (
              <>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "700", marginBottom: 4 }}>
                  {esReprogramacion ? "Reprogramar" : "Programar"}: {ordenAProgramar.descripcion || ordenAProgramar.categoriaNombre}
                </Text>
                <Text style={{ color: colors.inkMuted, fontSize: 12, marginBottom: 4 }}>{ordenAProgramar.clienteNombreCompleto}</Text>
                {ordenAProgramar.clienteDireccion && (
                  <Pressable
                    onPress={() =>
                      Linking.openURL(linkGoogleMaps(ordenAProgramar.clienteDireccion, ordenAProgramar.clienteDireccionLat, ordenAProgramar.clienteDireccionLon))
                    }
                  >
                    <Text style={{ color: colors.copper, fontSize: 12, textDecorationLine: "underline", marginBottom: 4 }}>
                      📍 {ordenAProgramar.clienteDireccion}
                      {ordenAProgramar.clienteDireccionVerificada ? " ✓" : ""}
                    </Text>
                  </Pressable>
                )}
                {ordenAProgramar.clienteDistanciaKm != null && (
                  <Text style={{ color: colors.inkMuted, fontSize: 11, marginBottom: 8 }}>{formatoDistancia(ordenAProgramar.clienteDistanciaKm)}</Text>
                )}

                <Text style={{ color: colors.inkMuted, fontSize: 12, marginTop: 8, marginBottom: 4 }}>Fecha</Text>
                <BotonSelector
                  label={fechaTurno ? fechaTurno.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "Elegir fecha"}
                  onPress={() => setMostrarPickerFecha(true)}
                />

                <Text style={{ color: colors.inkMuted, fontSize: 12, marginTop: 10, marginBottom: 4 }}>Hora de inicio</Text>
                <BotonSelector
                  label={`${String(horaTurno.getHours()).padStart(2, "0")}:${String(horaTurno.getMinutes()).padStart(2, "0")}`}
                  onPress={() => setMostrarPickerHora(true)}
                />

                <Text style={{ color: colors.inkMuted, fontSize: 12, marginTop: 10, marginBottom: 4 }}>Duración del trabajo</Text>
                <BotonSelector label={formatoDuracion(duracionTurno)} onPress={() => setModalDuracionAbierto(true)} />

                {mostrarPickerFecha && (
                  <DateTimePicker
                    value={fechaTurno ?? new Date()}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={(_, fecha) => {
                      setMostrarPickerFecha(false);
                      if (fecha) setFechaTurno(fecha);
                    }}
                  />
                )}
                {mostrarPickerHora && (
                  <DateTimePicker
                    value={horaTurno}
                    mode="time"
                    is24Hour
                    onChange={(_, fecha) => {
                      setMostrarPickerHora(false);
                      if (fecha) setHoraTurno(fecha);
                    }}
                  />
                )}
                <SelectorModal
                  visible={modalDuracionAbierto}
                  titulo="Duración del trabajo"
                  valorActual={String(duracionTurno)}
                  opciones={DURACIONES_PREDEFINIDAS_MINUTOS.map((min) => ({ value: String(min), label: formatoDuracion(min) }))}
                  onSeleccionar={(v) => setDuracionTurno(Number(v))}
                  onCerrar={() => setModalDuracionAbierto(false)}
                />

                {esReprogramacion && (
                  <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 8 }}>
                    Se va a avisar del nuevo horario en el chat, tanto a vos como al cliente.
                  </Text>
                )}

                {error && <Text style={styles.error}>{error}</Text>}

                <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                  <Pressable onPress={() => setOrdenAProgramar(null)} style={[styles.botonCancelar, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.ink }}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleProgramar}
                    disabled={programando}
                    style={[styles.botonConfirmar, { backgroundColor: colors.copper, opacity: programando ? 0.6 : 1 }]}
                  >
                    {programando ? (
                      <ActivityIndicator color={colors.paper} />
                    ) : (
                      <Text style={{ color: colors.paper, fontWeight: "700" }}>{esReprogramacion ? "Confirmar reprogramación" : "Confirmar"}</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirmación antes de abrir el formulario de reprogramación (22/09, a pedido del usuario) */}
      <Modal
        visible={!!turnoAConfirmarReprogramacion}
        transparent
        animationType="fade"
        onRequestClose={() => setTurnoAConfirmarReprogramacion(null)}
      >
        <Pressable style={styles.fondoModal} onPress={() => setTurnoAConfirmarReprogramacion(null)}>
          <Pressable style={[styles.modalProgramar, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            {turnoAConfirmarReprogramacion && (
              <>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "700", marginBottom: 8 }}>¿Reprogramar este turno?</Text>
                <Text style={{ color: colors.inkMuted, fontSize: 13, marginBottom: 16 }}>
                  Vas a poder elegir una nueva fecha y hora para{" "}
                  <Text style={{ color: colors.ink, fontWeight: "600" }}>
                    {turnoAConfirmarReprogramacion.descripcion || turnoAConfirmarReprogramacion.categoriaNombre}
                  </Text>{" "}
                  con {turnoAConfirmarReprogramacion.clienteNombreCompleto}. El turno anterior va a quedar marcado como reprogramado en el
                  chat y se le va a avisar el nuevo horario.
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => setTurnoAConfirmarReprogramacion(null)}
                    style={[styles.botonCancelar, { borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.ink }}>Cancelar</Text>
                  </Pressable>
                  <Pressable onPress={confirmarReprogramar} style={[styles.botonConfirmar, { backgroundColor: colors.copper }]}>
                    <Text style={{ color: colors.paper, fontWeight: "700" }}>Sí, reprogramar</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  contenido: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: "700", marginBottom: 4 },
  filaTitulo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 },
  h1: { fontSize: 22, fontWeight: "700" },
  toggleVista: { flexDirection: "row", borderWidth: 1, borderRadius: 20, padding: 2, gap: 2 },
  toggleBoton: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6 },
  error: { color: "#C0392B", fontSize: 12, marginBottom: 10 },
  avisoSinHorarios: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 14 },
  tarjeta: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16 },
  filaPendiente: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderLeftWidth: 3, padding: 10 },
  botonProgramar: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  filaEncabezadoCalendario: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, paddingBottom: 10, marginBottom: 12 },
  filaNav: { flexDirection: "row", alignItems: "center", gap: 10 },
  fondoModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalProgramar: { borderWidth: 1, borderRadius: 14, padding: 18, width: "100%" },
  botonCancelar: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  botonConfirmar: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
});
