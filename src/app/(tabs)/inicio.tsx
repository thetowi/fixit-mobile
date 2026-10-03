import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell, CalendarDays, Search } from "lucide-react-native";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { OrdenAgenda } from "@/types/agenda";
import { Orden } from "@/types/ordenes";
import { colorCategoria } from "@/lib/coloresCategoria";
import { useRefrescoEnFoco } from "@/lib/useRefrescoEnFoco";
import { useConteoNotificaciones } from "@/lib/notificacionesContext";
import ObjetivoIngresoCard from "@/components/ObjetivoIngresoCard";

// Landing de "Inicio" — desde el 21/09 existe para los DOS roles (antes solo para Prestador, ver
// backlog), cada uno con su propio contenido:
//
// - Prestador (mockup aprobado 20/09): saludo + cuánto trabajo tiene esta semana y este mes, para
//   que abra la app y sepa de un vistazo cómo viene la semana sin tener que entrar a Agenda.
//   Espejo conceptual del dashboard "Hoy"/"Esta semana" que ya existe en la home de fixit-web (`/`)
//   para ese rol.
// - Cliente (mockup aprobado 21/09): un Cliente no tiene "trabajos" propios que resumir, así que
//   en vez de eso tiene un atajo grande para buscar un servicio nuevo (lleva a Explorar) y una
//   lista de "Volver a contratar" con los últimos prestadores con los que ya trabajó (para
//   recontratarlos directo desde su perfil, sin tener que buscarlos de nuevo).
//
// Este archivo exporta un solo componente que rama por rol, igual que hacen otras pantallas
// compartidas del proyecto (ver ordenes.tsx). El componente de abajo hace de "router" nomás.

function inicioDeSemana(fecha: Date): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function finDeSemana(inicio: Date): Date {
  const d = new Date(inicio);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function inicioDeMes(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function finDeMes(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function esMismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function saludoSegunHora(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Entrada al centro de notificaciones (03/10, a pedido del usuario) — campanita en la esquina del
// header de Inicio, con el mismo badge que ya usa la pestaña "Mensajes" (ver (tabs)/_layout.tsx),
// pero alimentado por notificacionesContext.tsx en vez de conteoNoLeidosContext.tsx.
function BotonNotificaciones({ colors, top }: { colors: ReturnType<typeof useFixitColors>; top: number }) {
  const router = useRouter();
  const noLeidas = useConteoNotificaciones();
  return (
    <Pressable
      onPress={() => router.push("/notificaciones")}
      hitSlop={10}
      style={[styles.botonNotificaciones, { top }]}
    >
      <Bell color={colors.onNav} size={22} strokeWidth={2} />
      {noLeidas > 0 && (
        <View style={[styles.badgeNotificaciones, { borderColor: colors.nav }]}>
          <Text style={styles.badgeNotificacionesTexto}>{noLeidas > 9 ? "9+" : noLeidas}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function InicioScreen() {
  const { usuario } = useAuth();
  return usuario?.rol === "Cliente" ? <InicioCliente /> : <InicioPrestador />;
}

function InicioPrestador() {
  const colors = useFixitColors();
  const router = useRouter();
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();

  const [turnos, setTurnos] = useState<OrdenAgenda[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (esRefresh = false) => {
    if (esRefresh) setRefrescando(true);
    try {
      const hoy = new Date();
      const desde = new Date(Math.min(inicioDeSemana(hoy).getTime(), inicioDeMes(hoy).getTime()));
      const hasta = new Date(Math.max(finDeSemana(inicioDeSemana(hoy)).getTime(), finDeMes(hoy).getTime()));
      const data = await apiFetch<OrdenAgenda[]>(`/api/prestador/agenda?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`);
      setTurnos(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar tu resumen");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  // Se recarga cada vez que la pestaña vuelve a tener foco (mismo patrón que Mensajes), MÁS un
  // polling cada 20s mientras esta pestaña sigue enfocada (22/09, a pedido del usuario: si se
  // quedaba parado en Inicio mientras se programaba/pagaba un trabajo en otro lado, no se enteraba
  // hasta salir de la app) — ver useRefrescoEnFoco.
  useRefrescoEnFoco(cargar);

  const hoy = new Date();
  const inicioSemana = inicioDeSemana(hoy);
  const finSemana = finDeSemana(inicioSemana);
  const inicioMes = inicioDeMes(hoy);
  const finMesActual = finDeMes(hoy);

  const conFecha = turnos.filter((t) => t.fechaHoraProgramada);
  const trabajosSemana = conFecha.filter((t) => {
    const f = new Date(t.fechaHoraProgramada!);
    return f >= inicioSemana && f <= finSemana;
  });
  const trabajosMes = conFecha.filter((t) => {
    const f = new Date(t.fechaHoraProgramada!);
    return f >= inicioMes && f <= finMesActual;
  });
  const trabajosHoy = trabajosSemana
    .filter((t) => esMismoDia(new Date(t.fechaHoraProgramada!), hoy))
    .sort((a, b) => new Date(a.fechaHoraProgramada!).getTime() - new Date(b.fechaHoraProgramada!).getTime());

  // Aviso destacado (24/09, a pedido del usuario: "que destaque mucho más cuando hay un
  // trabajo... visualmente más llamativo, tipo alerta"). Se calcula aparte de trabajosHoy (que
  // sigue alimentando la lista de abajo sin cambios) para no mostrar como "aviso" algo cancelado
  // o que ya se completó, aunque haya sido programado para hoy.
  const trabajosHoyActivos = trabajosHoy.filter((t) => t.estado !== "Cancelado" && t.estado !== "Completado");
  const avisoHoy = trabajosHoyActivos[0] ?? null;
  const masTrabajosHoy = trabajosHoyActivos.length - 1;
  const proximosSemana = trabajosSemana
    .filter((t) => {
      const f = new Date(t.fechaHoraProgramada!);
      return f > hoy && !esMismoDia(f, hoy);
    })
    .sort((a, b) => new Date(a.fechaHoraProgramada!).getTime() - new Date(b.fechaHoraProgramada!).getTime());

  const sinNadaEstaSemana = trabajosHoy.length === 0 && proximosSemana.length === 0;
  const fechaHoyTexto = capitalizar(hoy.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }));

  if (cargando) {
    return (
      <View style={[styles.centrado, { backgroundColor: colors.paper }]}>
        <ActivityIndicator color={colors.copper} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={() => cargar(true)}
          tintColor={colors.copper}
          // progressViewOffset (03/10, reportado por el usuario con captura): sin esto, el spinner
          // nativo de "pull to refresh" se dibuja pegado al borde de arriba de la ScrollView —
          // como esta pantalla no tiene header nativo (headerShown: false) y el encabezado oscuro
          // es contenido JS dentro del scroll, ese spinner quedaba tapado por el notch/isla
          // dinámica en vez de aparecer debajo. Lo empuja para abajo la misma cantidad que ya usa
          // el encabezado (insets.top).
          progressViewOffset={insets.top}
        />
      }
    >
      <View style={[styles.encabezado, { backgroundColor: colors.nav, paddingTop: insets.top + 12 }]}>
        <Text style={[styles.saludoHorario, { color: colors.onNav, opacity: 0.62 }]}>{saludoSegunHora()}</Text>
        <Text style={[styles.saludoNombre, { color: colors.onNav }]}>¡Hola, {usuario?.nombre}!</Text>
        <Text style={[styles.fechaHoy, { color: colors.onNav, opacity: 0.5 }]}>{fechaHoyTexto}</Text>
        <BotonNotificaciones colors={colors} top={insets.top + 14} />
      </View>

      {error ? (
        <Text style={[styles.error, { color: "#B3261E" }]}>{error}</Text>
      ) : (
        <>
          {avisoHoy && (
            <Pressable
              onPress={() => router.push("/agenda")}
              style={[styles.avisoHoy, { backgroundColor: colors.safety }]}
            >
              <View style={styles.avisoIcono}>
                <Bell color={colors.ink} size={22} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.avisoTitulo, { color: colors.ink }]} numberOfLines={1}>
                  Hoy visitas a {avisoHoy.clienteNombreCompleto}
                </Text>
                <Text style={[styles.avisoSubtitulo, { color: colors.ink }]} numberOfLines={1}>
                  {avisoHoy.descripcion || avisoHoy.categoriaNombre} ·{" "}
                  {new Date(avisoHoy.fechaHoraProgramada!).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                  {masTrabajosHoy > 0 ? ` · +${masTrabajosHoy} más hoy` : ""}
                </Text>
              </View>
            </Pressable>
          )}

          <View style={styles.filaStats}>
            <View style={[styles.tarjetaStat, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statNumero, { color: colors.copper }]}>{trabajosSemana.length}</Text>
              <Text style={[styles.statLabel, { color: colors.ink }]}>
                {trabajosSemana.length === 1 ? "trabajo esta semana" : "trabajos esta semana"}
              </Text>
            </View>
            <View style={[styles.tarjetaStat, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statNumero, { color: colors.ink }]}>{trabajosMes.length}</Text>
              <Text style={[styles.statLabel, { color: colors.ink }]}>
                {trabajosMes.length === 1 ? "trabajo este mes" : "trabajos este mes"}
              </Text>
            </View>
          </View>

          {/* "Sueldo pretendido" (29/09) — ver claude/aviso-pago-y-sueldo-pretendido-28-09.md */}
          <ObjetivoIngresoCard />

          {sinNadaEstaSemana ? (
            <View style={[styles.tarjetaVacia, { backgroundColor: colors.surface }]}>
              <CalendarDays color={colors.copper} size={30} strokeWidth={1.8} />
              <Text style={[styles.vaciaTitulo, { color: colors.ink }]}>Sin trabajos esta semana</Text>
              <Text style={[styles.vaciaTexto, { color: colors.inkMuted }]}>
                Cuando un cliente te pague una oferta y programes el turno, vas a ver acá tus próximos trabajos.
              </Text>
              <Pressable
                onPress={() => router.push("/mensajes")}
                style={[styles.botonVacio, { backgroundColor: colors.copper }]}
              >
                <Text style={styles.botonVacioTexto}>Ver mis mensajes</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {trabajosHoy.length > 0 && (
                <View style={styles.seccion}>
                  <View style={styles.seccionHeader}>
                    <Text style={[styles.seccionTitulo, { color: colors.ink }]}>Hoy</Text>
                    <Pressable onPress={() => router.push("/agenda")}>
                      <Text style={[styles.verAgenda, { color: colors.copper }]}>Ver agenda</Text>
                    </Pressable>
                  </View>
                  {trabajosHoy.map((t) => (
                    <View key={t.id} style={[styles.tarjetaTurno, { backgroundColor: colors.surface }]}>
                      <View style={[styles.barraColor, { backgroundColor: colorCategoria(t.categoriaNombre) }]} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.filaTitulo}>
                          <Text style={[styles.tituloTrabajo, { color: colors.ink }]} numberOfLines={1}>
                            {t.descripcion || t.categoriaNombre}
                          </Text>
                          <Text style={[styles.hora, { color: colors.copper }]}>
                            {new Date(t.fechaHoraProgramada!).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        </View>
                        <Text style={[styles.subtitulo, { color: colors.inkMuted }]} numberOfLines={1}>
                          {t.clienteNombreCompleto} · {t.categoriaNombre}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {proximosSemana.length > 0 && (
                <View style={styles.seccion}>
                  <Text style={[styles.seccionTitulo, { color: colors.ink }]}>Próximos esta semana</Text>
                  <View style={[styles.listaProximos, { backgroundColor: colors.surface }]}>
                    {proximosSemana.map((t, i) => {
                      const fecha = new Date(t.fechaHoraProgramada!);
                      return (
                        <View
                          key={t.id}
                          style={[
                            styles.filaProximo,
                            i < proximosSemana.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                          ]}
                        >
                          <View style={[styles.chipFecha, { backgroundColor: colors.copper + "14" }]}>
                            <Text style={[styles.chipDia, { color: colors.copper }]}>
                              {fecha.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "")}
                            </Text>
                            <Text style={[styles.chipNumero, { color: colors.ink }]}>{fecha.getDate()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.tituloProximo, { color: colors.ink }]} numberOfLines={1}>
                              {t.descripcion || t.categoriaNombre}
                            </Text>
                            <Text style={[styles.subtituloProximo, { color: colors.inkMuted }]} numberOfLines={1}>
                              {fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · {t.clienteNombreCompleto}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

// --- Inicio del Cliente ---

const CANTIDAD_RECONTRATAR = 5;

function iniciales(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/);
  const primera = partes[0]?.[0] ?? "";
  const segunda = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primera + segunda).toUpperCase();
}

function tiempoDesde(fechaISO: string): string {
  const dias = Math.floor((Date.now() - new Date(fechaISO).getTime()) / (1000 * 60 * 60 * 24));
  if (dias < 1) return "hoy";
  if (dias < 7) return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
  if (dias < 30) {
    const semanas = Math.floor(dias / 7);
    return semanas === 1 ? "hace 1 semana" : `hace ${semanas} semanas`;
  }
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "hace 1 mes" : `hace ${meses} meses`;
}

function InicioCliente() {
  const colors = useFixitColors();
  const router = useRouter();
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();

  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (esRefresh = false) => {
    if (esRefresh) setRefrescando(true);
    try {
      const data = await apiFetch<Orden[]>("/api/ordenes/mias");
      setOrdenes(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar tu resumen");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  // Ver comentario en InicioPrestador de más arriba sobre por qué se sumó el polling acá también.
  useRefrescoEnFoco(cargar);

  // "Volver a contratar": un prestador por cada trabajo Completado, quedándonos con el más
  // reciente de cada uno (por si ya trabajó más de una vez con la misma persona) — ordenados del
  // más reciente al más viejo. Se calcula acá en el cliente en vez de sumar un endpoint nuevo al
  // backend, reusando /api/ordenes/mias igual que ya hace ordenes.tsx.
  const prestadoresAnteriores = (() => {
    const porPrestador = new Map<string, Orden>();
    for (const o of ordenes) {
      if (o.estado !== "Completado") continue;
      const actual = porPrestador.get(o.prestadorId);
      if (!actual || new Date(o.creadoEn) > new Date(actual.creadoEn)) {
        porPrestador.set(o.prestadorId, o);
      }
    }
    return Array.from(porPrestador.values())
      .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime())
      .slice(0, CANTIDAD_RECONTRATAR);
  })();

  const fechaHoyTexto = capitalizar(new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }));

  // Aviso destacado "Hoy te visita..." (24/09) — mismo criterio que el del Prestador (ver
  // InicioPrestador más arriba), calculado acá a partir de /api/ordenes/mias en vez de la agenda
  // del prestador (esta pantalla es la del Cliente).
  const hoy = new Date();
  const trabajosHoyActivos = ordenes
    .filter(
      (o) =>
        o.fechaHoraProgramada &&
        esMismoDia(new Date(o.fechaHoraProgramada), hoy) &&
        o.estado !== "Cancelado" &&
        o.estado !== "Completado"
    )
    .sort((a, b) => new Date(a.fechaHoraProgramada!).getTime() - new Date(b.fechaHoraProgramada!).getTime());
  const avisoHoy = trabajosHoyActivos[0] ?? null;
  const masTrabajosHoy = trabajosHoyActivos.length - 1;

  if (cargando) {
    return (
      <View style={[styles.centrado, { backgroundColor: colors.paper }]}>
        <ActivityIndicator color={colors.copper} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={() => cargar(true)}
          tintColor={colors.copper}
          // progressViewOffset (03/10, reportado por el usuario con captura): sin esto, el spinner
          // nativo de "pull to refresh" se dibuja pegado al borde de arriba de la ScrollView —
          // como esta pantalla no tiene header nativo (headerShown: false) y el encabezado oscuro
          // es contenido JS dentro del scroll, ese spinner quedaba tapado por el notch/isla
          // dinámica en vez de aparecer debajo. Lo empuja para abajo la misma cantidad que ya usa
          // el encabezado (insets.top).
          progressViewOffset={insets.top}
        />
      }
    >
      <View style={[styles.encabezado, { backgroundColor: colors.nav, paddingTop: insets.top + 12 }]}>
        <Text style={[styles.saludoHorario, { color: colors.onNav, opacity: 0.62 }]}>{saludoSegunHora()}</Text>
        <Text style={[styles.saludoNombre, { color: colors.onNav }]}>¡Hola, {usuario?.nombre}!</Text>
        <Text style={[styles.fechaHoy, { color: colors.onNav, opacity: 0.5 }]}>{fechaHoyTexto}</Text>
        <BotonNotificaciones colors={colors} top={insets.top + 14} />
      </View>

      {error ? (
        <Text style={[styles.error, { color: "#B3261E" }]}>{error}</Text>
      ) : (
        <>
          {avisoHoy && (
            <Pressable
              onPress={() => router.push("/ordenes")}
              style={[styles.avisoHoy, { backgroundColor: colors.safety }]}
            >
              <View style={styles.avisoIcono}>
                <Bell color={colors.ink} size={22} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.avisoTitulo, { color: colors.ink }]} numberOfLines={1}>
                  Hoy te visita {avisoHoy.prestadorNombreCompleto}
                </Text>
                <Text style={[styles.avisoSubtitulo, { color: colors.ink }]} numberOfLines={1}>
                  {avisoHoy.descripcion || avisoHoy.categoriaNombre} ·{" "}
                  {new Date(avisoHoy.fechaHoraProgramada!).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                  {masTrabajosHoy > 0 ? ` · +${masTrabajosHoy} más hoy` : ""}
                </Text>
              </View>
            </Pressable>
          )}

          <Pressable
            onPress={() => router.push("/(tabs)")}
            style={[styles.atajoBuscar, { backgroundColor: colors.copper }]}
          >
            <View style={styles.atajoIcono}>
              <Search color="#FFFFFF" size={24} strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.atajoTitulo}>¿Qué necesitás arreglar?</Text>
              <Text style={styles.atajoSubtitulo}>Buscar un servicio nuevo</Text>
            </View>
          </Pressable>

          {prestadoresAnteriores.length > 0 && (
            <View style={styles.seccion}>
              <View style={styles.seccionHeader}>
                <Text style={[styles.seccionTitulo, { color: colors.ink }]}>Volver a contratar</Text>
                <Pressable onPress={() => router.push("/ordenes")}>
                  <Text style={[styles.verAgenda, { color: colors.copper }]}>Ver todos</Text>
                </Pressable>
              </View>

              {prestadoresAnteriores.map((o) => (
                <Pressable
                  key={o.prestadorId}
                  onPress={() => router.push(`/prestador/${o.prestadorId}`)}
                  style={[styles.tarjetaPrestador, { backgroundColor: colors.surface }]}
                >
                  <View style={[styles.avatar, { backgroundColor: colorCategoria(o.categoriaNombre) + "26" }]}>
                    <Text style={[styles.avatarTexto, { color: colorCategoria(o.categoriaNombre) }]}>
                      {iniciales(o.prestadorNombreCompleto)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.nombrePrestador, { color: colors.ink }]} numberOfLines={1}>
                      {o.prestadorNombreCompleto}
                    </Text>
                    <Text style={[styles.detallePrestador, { color: colors.inkMuted }]} numberOfLines={1}>
                      {o.categoriaNombre} · último trabajo {tiempoDesde(o.creadoEn)}
                    </Text>
                  </View>
                  {/* colors.nav en vez de colors.ink (03/10) — colors.ink se invierte en modo
                      oscuro del sistema (se vuelve claro) y el texto blanco quedaba casi invisible
                      sobre un fondo claro. colors.nav es el mismo token fijo que ya usan el header
                      de "Inicio" más arriba y los perfiles de prestador/cliente: siempre oscuro. */}
                  <View style={[styles.botonRecontratar, { backgroundColor: colors.nav }]}>
                    <Text style={styles.botonRecontratarTexto}>Recontratar</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: "center", justifyContent: "center" },
  encabezado: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 4, position: "relative" },
  botonNotificaciones: { position: "absolute", right: 20, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  badgeNotificaciones: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: "#E5484D",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeNotificacionesTexto: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "700" },
  saludoHorario: { fontSize: 14, fontWeight: "500" },
  saludoNombre: { fontSize: 24, fontWeight: "800", lineHeight: 30 },
  fechaHoy: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  error: { marginHorizontal: 20, marginTop: 16, fontSize: 14, fontWeight: "500" },
  avisoHoy: {
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  avisoIcono: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  avisoTitulo: { fontSize: 15.5, fontWeight: "800" },
  avisoSubtitulo: { fontSize: 12.5, fontWeight: "600", marginTop: 2, opacity: 0.85 },
  filaStats: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 16 },
  tarjetaStat: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  statNumero: { fontSize: 28, fontWeight: "800", lineHeight: 32 },
  statLabel: { fontSize: 13, fontWeight: "600" },
  seccion: { paddingHorizontal: 20, paddingTop: 24, gap: 10 },
  seccionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  seccionTitulo: { fontSize: 17, fontWeight: "700" },
  verAgenda: { fontSize: 13, fontWeight: "600" },
  tarjetaTurno: {
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  barraColor: { width: 4, borderRadius: 4 },
  filaTitulo: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  tituloTrabajo: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
  hora: { fontSize: 13, fontWeight: "700" },
  subtitulo: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  listaProximos: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  filaProximo: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13 },
  chipFecha: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  chipDia: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  chipNumero: { fontSize: 15, fontWeight: "800" },
  tituloProximo: { fontSize: 14, fontWeight: "700" },
  subtituloProximo: { fontSize: 12, fontWeight: "500", marginTop: 1 },
  tarjetaVacia: {
    marginHorizontal: 20,
    marginTop: 28,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  vaciaTitulo: { fontSize: 16, fontWeight: "700" },
  vaciaTexto: { fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 18, maxWidth: 260 },
  botonVacio: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
  botonVacioTexto: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Inicio del Cliente
  atajoBuscar: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  atajoIcono: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  atajoTitulo: { color: "#FFFFFF", fontSize: 15.5, fontWeight: "700" },
  atajoSubtitulo: { color: "rgba(255,255,255,0.85)", fontSize: 12.5, marginTop: 1 },
  tarjetaPrestador: {
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  avatarTexto: { fontSize: 13.5, fontWeight: "700" },
  nombrePrestador: { fontSize: 14, fontWeight: "700" },
  detallePrestador: { fontSize: 12, fontWeight: "500", marginTop: 1 },
  botonRecontratar: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  botonRecontratarTexto: { color: "#fff", fontSize: 11.5, fontWeight: "700" },
});
