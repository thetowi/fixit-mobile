import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as signalR from "@microsoft/signalr";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";
import { Paperclip, Mic, Check, X, Send, BanknoteArrowUp, Pause, Play } from "lucide-react-native";
import { apiFetch, ApiError } from "@/lib/api";
import { apiUpload, ArchivoParaSubir } from "@/lib/apiUpload";
import { crearConexionChat } from "@/lib/chatConnection";
import { refrescarConteoNoLeidos } from "@/lib/conteoNoLeidosContext";
import { useAuth } from "@/lib/authContext";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { Mensaje } from "@/types/mensajes";
import { Conversacion } from "@/types/conversaciones";
import { formatoDuracion } from "@/types/agenda";
import { colorCategoria } from "@/lib/coloresCategoria";
import { iconoCategoria } from "@/lib/iconosCategoria";

const MAX_SEGUNDOS_AUDIO = 120;

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatoTiempo(segundos: number): string {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${min}:${seg.toString().padStart(2, "0")}`;
}

function textoVencimiento(ofertaExpiraEn: string | null): string | null {
  if (!ofertaExpiraEn) return null;
  const minutosRestantes = (new Date(ofertaExpiraEn).getTime() - Date.now()) / (1000 * 60);
  if (minutosRestantes <= 0) return "Venció";
  if (minutosRestantes < 1) return "Vence en instantes";
  if (minutosRestantes < 60) return `Vence en ${Math.round(minutosRestantes)} min`;
  if (minutosRestantes < 60 * 24) return `Vence en ${Math.round(minutosRestantes / 60)} hs`;
  return `Vence en ${Math.round(minutosRestantes / (60 * 24))} días`;
}

type Colors = ReturnType<typeof useFixitColors>;

// Espejo mobile de fixit-web/app/conversaciones/[id]/page.tsx — el chat completo: texto en tiempo
// real vía SignalR, ofertas de trabajo con pago, y adjuntos de foto/video/audio. Diferencias
// impuestas por React Native, todas ya ancladas en el resto de fixit-mobile:
// - El checkout de Mercado Pago se abre con expo-web-browser (no hay `window.location.href` en
//   RN), mismo patrón que CobrosSeccion en Mi cuenta.
// - Fotos/video: expo-image-picker, con un menú chico (Alert) para elegir cámara o galería — en la
//   web un solo <input type="file"> ya deja elegir cualquiera de las dos desde el selector nativo
//   del sistema operativo, así que acá hace falta un paso extra explícito.
// - Audio y video: grabación/reproducción nativa con expo-audio/expo-video (no expo-av — Expo Go
//   ya no trae ese módulo nativo desde hace varias versiones de SDK, así que expo-av tira "Cannot
//   find native module 'ExponentAV'" ahí; expo-audio/expo-video sí vienen incluidos en Expo Go).
//   Implementación nueva de punta a punta, no hereda (pero tampoco resuelve sola) el historial de
//   bugs de audio que tuvo la versión web.
export default function ConversacionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversacionId = id!;
  const router = useRouter();
  const colors = useFixitColors();
  const { usuario } = useAuth();
  // Esta pantalla vive fuera del grupo de pestañas (ver src/app/_layout.tsx), así que no hereda
  // ningún padding de la tab bar — hay que dejarle lugar a mano a la barra de navegación del
  // sistema (los 3 botones o la barra de gestos de Android), o si no la barra de escribir/enviar
  // queda tapada por ella. Con `edges: ["bottom"]` en el layout raíz no alcanzaba porque este
  // Stack.Screen no usa SafeAreaView, así que se toma el inset a mano acá.
  const insets = useSafeAreaInsets();

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [conversacion, setConversacion] = useState<Conversacion | null>(null);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [conectado, setConectado] = useState(false);

  const [mostrandoOferta, setMostrandoOferta] = useState(false);
  const [descripcionOferta, setDescripcionOferta] = useState("");
  const [montoOferta, setMontoOferta] = useState("");
  const [enviandoOferta, setEnviandoOferta] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [cancelandoOfertaId, setCancelandoOfertaId] = useState<string | null>(null);

  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [segundosGrabados, setSegundosGrabados] = useState(0);
  const [imagenAmpliada, setImagenAmpliada] = useState<string | null>(null);

  const conexionRef = useRef<signalR.HubConnection | null>(null);
  const listaRef = useRef<FlatList<Mensaje>>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerGrabacionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segundosGrabadosRef = useRef(0);
  const descartarGrabacionRef = useRef(false);
  const grabandoRef = useRef(false);

  function marcarLeidoYAvisar() {
    apiFetch(`/api/conversaciones/${conversacionId}/mensajes/leido`, { method: "PUT" })
      .then(refrescarConteoNoLeidos)
      .catch(() => {
        // silencioso: si falla, el badge simplemente no se actualiza al toque
      });
  }

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        const [historial, datosConversacion] = await Promise.all([
          apiFetch<Mensaje[]>(`/api/conversaciones/${conversacionId}/mensajes`),
          apiFetch<Conversacion>(`/api/conversaciones/${conversacionId}`),
        ]);
        if (!activo) return;
        setMensajes(historial);
        setConversacion(datosConversacion);
        setCargando(false);
        marcarLeidoYAvisar();

        const conexion = await crearConexionChat();
        conexionRef.current = conexion;

        conexion.on("RecibirMensaje", (mensaje: Mensaje) => {
          setMensajes((prev) => {
            if (prev.some((m) => m.id === mensaje.id)) return prev;
            let actualizados = mensaje.tipo === "Oferta" ? prev.map((m) => (m.tipo === "Oferta" ? { ...m, ofertaVigente: false } : m)) : prev;
            if (mensaje.tipo === "Turno") {
              actualizados = actualizados.map((m) => (m.tipo === "Turno" ? { ...m, turnoVigente: false } : m));
            }
            return [...actualizados, mensaje];
          });
          if (mensaje.emisorId !== usuario?.id) marcarLeidoYAvisar();
        });

        conexion.on("OfertaActualizada", (mensaje: Mensaje) => {
          setMensajes((prev) => prev.map((m) => (m.id === mensaje.id ? mensaje : m)));
        });

        conexion.onreconnected(() => {
          conexion.invoke("UnirseAConversacion", conversacionId).catch(() => {
            setError("Se reconectó el chat pero no pudimos volver a unirte a la conversación. Volvé a entrar.");
          });
        });

        await conexion.start();
        await conexion.invoke("UnirseAConversacion", conversacionId);
        if (activo) setConectado(true);
      } catch (err) {
        setCargando(false);
        if (err instanceof ApiError && err.status === 403) setError("No tenés acceso a esta conversación.");
        else setError("No pudimos conectar el chat. Volvé a entrar.");
      }
    }

    iniciar();

    return () => {
      activo = false;
      conexionRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversacionId]);

  // Refresca el contador de vencimiento de la oferta cada 30s, igual que la web.
  const [, forzarRefresco] = useState(0);
  useEffect(() => {
    const intervalId = setInterval(() => forzarRefresco((t) => t + 1), 30000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (mensajes.length > 0) requestAnimationFrame(() => listaRef.current?.scrollToEnd({ animated: true }));
  }, [mensajes.length]);

  useEffect(() => {
    grabandoRef.current = grabando;
  }, [grabando]);

  useEffect(() => {
    return () => {
      if (timerGrabacionRef.current) clearInterval(timerGrabacionRef.current);
      // Por si el componente se desmonta (se navega afuera) con el micrófono todavía abierto.
      if (grabandoRef.current) audioRecorder.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEnviar() {
    if (!nuevoMensaje.trim() || !conexionRef.current) return;
    const texto = nuevoMensaje.trim();
    setNuevoMensaje("");
    try {
      await conexionRef.current.invoke("EnviarMensaje", conversacionId, texto);
    } catch {
      setError("No se pudo enviar el mensaje.");
    }
  }

  async function subirArchivo(archivo: ArchivoParaSubir, tipo: "Imagen" | "Audio" | "Video", duracionSegundos?: number) {
    setError(null);
    setSubiendoArchivo(true);
    try {
      const campos: Record<string, ArchivoParaSubir | string> = { tipo, archivo };
      if (duracionSegundos !== undefined) campos.duracionSegundos = String(duracionSegundos);
      const mensaje = await apiUpload<Mensaje>(`/api/conversaciones/${conversacionId}/mensajes/archivo`, campos);
      setMensajes((prev) => (prev.some((m) => m.id === mensaje.id) ? prev : [...prev, mensaje]));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar el archivo");
    } finally {
      setSubiendoArchivo(false);
    }
  }

  async function elegirDeGaleria() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError("Necesitamos permiso para acceder a tus fotos y videos.");
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
    });
    if (resultado.canceled || !resultado.assets[0]) return;
    const asset = resultado.assets[0];
    const esVideo = asset.type === "video";
    subirArchivo(
      { uri: asset.uri, name: esVideo ? "video.mp4" : "foto.jpg", type: esVideo ? "video/mp4" : "image/jpeg" },
      esVideo ? "Video" : "Imagen"
    );
  }

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setError("Necesitamos permiso para usar la cámara.");
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (resultado.canceled || !resultado.assets[0]) return;
    const asset = resultado.assets[0];
    subirArchivo({ uri: asset.uri, name: "foto.jpg", type: "image/jpeg" }, "Imagen");
  }

  function abrirMenuAdjunto() {
    Alert.alert("Adjuntar", undefined, [
      { text: "Tomar foto", onPress: tomarFoto },
      { text: "Elegir foto o video", onPress: elegirDeGaleria },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  async function iniciarGrabacion() {
    setError(null);
    try {
      const permiso = await requestRecordingPermissionsAsync();
      if (!permiso.granted) {
        setError("El micrófono está bloqueado. Habilitalo desde los permisos de la app en el sistema.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      descartarGrabacionRef.current = false;

      setGrabando(true);
      setSegundosGrabados(0);
      segundosGrabadosRef.current = 0;
      timerGrabacionRef.current = setInterval(() => {
        segundosGrabadosRef.current += 1;
        setSegundosGrabados(segundosGrabadosRef.current);
        if (segundosGrabadosRef.current >= MAX_SEGUNDOS_AUDIO) detenerGrabacion(true);
      }, 1000);
    } catch {
      setError("No pudimos empezar a grabar. Probá de nuevo.");
    }
  }

  async function detenerGrabacion(enviar: boolean) {
    descartarGrabacionRef.current = !enviar;
    if (timerGrabacionRef.current) {
      clearInterval(timerGrabacionRef.current);
      timerGrabacionRef.current = null;
    }
    const duracion = segundosGrabadosRef.current;
    setGrabando(false);
    setSegundosGrabados(0);

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (enviar && uri) {
        // El formato real del contenedor depende de la plataforma con este preset (m4a en la
        // gran mayoría de los casos, tanto Android como iOS) — si algún dispositivo graba en otro
        // formato, el Content-Type real del archivo ya viaja aparte y el backend lo valida.
        subirArchivo({ uri, name: "audio.m4a", type: "audio/m4a" }, "Audio", duracion);
      }
    } catch {
      if (enviar) setError("No se pudo procesar el audio grabado.");
    }
  }

  async function handleEnviarOferta() {
    if (enviandoOferta) return;
    const monto = Number(montoOferta);
    if (!descripcionOferta.trim()) {
      setError('Contá brevemente qué trabajo es (ej. "Arreglo farola").');
      return;
    }
    if (!monto || monto <= 0) {
      setError("Ingresá un monto válido.");
      return;
    }
    setEnviandoOferta(true);
    try {
      const mensaje = await apiFetch<Mensaje>(`/api/conversaciones/${conversacionId}/ofertas`, {
        method: "POST",
        body: JSON.stringify({ monto, descripcion: descripcionOferta.trim() }),
      });
      setMensajes((prev) =>
        prev.some((m) => m.id === mensaje.id)
          ? prev
          : [...prev.map((m) => (m.tipo === "Oferta" ? { ...m, ofertaVigente: false } : m)), mensaje]
      );
      setMostrandoOferta(false);
      setDescripcionOferta("");
      setMontoOferta("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al enviar la oferta");
    } finally {
      setEnviandoOferta(false);
    }
  }

  async function handlePagar(mensajeId: string) {
    setPagando(true);
    setError(null);
    try {
      const resultado = await apiFetch<{ initPoint: string }>(`/api/conversaciones/ofertas/${mensajeId}/pagar`, { method: "POST" });
      await WebBrowser.openBrowserAsync(resultado.initPoint);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al iniciar el pago");
    } finally {
      setPagando(false);
    }
  }

  async function handleCancelarOferta(mensajeId: string) {
    setCancelandoOfertaId(mensajeId);
    setError(null);
    try {
      const mensaje = await apiFetch<Mensaje>(`/api/conversaciones/${conversacionId}/ofertas/${mensajeId}/cancelar`, { method: "POST" });
      setMensajes((prev) => prev.map((m) => (m.id === mensaje.id ? mensaje : m)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cancelar la oferta");
    } finally {
      setCancelandoOfertaId(null);
    }
  }

  if (cargando) {
    return (
      <View style={[styles.centro, { backgroundColor: colors.paper }]}>
        <ActivityIndicator color={colors.copper} />
      </View>
    );
  }

  if (error && mensajes.length === 0 && !conversacion) {
    return (
      <View style={[styles.centro, { backgroundColor: colors.paper, padding: 24 }]}>
        <Text style={{ color: "#C0392B", textAlign: "center" }}>{error}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.copper }}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const esPrestador = usuario?.rol === "Prestador";
  const esCliente = usuario?.rol === "Cliente";
  const otroNombre = conversacion ? (esCliente ? conversacion.prestadorNombreCompleto : conversacion.clienteNombreCompleto) : null;
  const otroFoto = conversacion ? (esCliente ? conversacion.prestadorFotoUrl : conversacion.clienteFotoUrl) : null;
  // Un mismo prestador puede tener una conversación separada por cada rubro (22/09) — la etiqueta
  // con ícono debajo del nombre y el tinte de fondo del chat distinguen de qué rubro es ESTA
  // conversación, igual que en fixit-web.
  const colorRubro = conversacion ? colorCategoria(conversacion.categoriaNombre) : null;
  const IconoRubro = conversacion ? iconoCategoria(conversacion.categoriaIcono) : null;

  return (
    // Fix (22/09, reportado por el usuario): "height" en vez de undefined para Android — ver el
    // comentario igual en login.tsx sobre por qué `undefined` (que dependía del auto-resize de la
    // ventana) dejó de alcanzar con edge-to-edge obligatorio.
    <KeyboardAvoidingView
      style={[styles.pantalla, { backgroundColor: colors.paper, paddingTop: insets.top + 10 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <Text style={{ color: colors.copper, fontSize: 20 }}>‹</Text>
        </Pressable>
        {/* El nombre/foto del prestador es clickeable y lleva a su perfil público (mismo
            comportamiento que fixit-web/app/conversaciones/[id]/page.tsx) — solo cuando quien mira
            es el Cliente, porque /prestador/[id] es el perfil PÚBLICO de un prestador; no existe un
            equivalente para clientes, así que un Prestador mirando su chat sigue viendo el nombre
            del cliente como texto plano, sin link. */}
        <Pressable
          onPress={() => esCliente && conversacion && router.push(`/prestador/${conversacion.prestadorId}`)}
          disabled={!esCliente}
          style={styles.headerInfo}
        >
          {otroFoto ? (
            <Image source={{ uri: otroFoto }} style={styles.avatar} />
          ) : (
            otroNombre && (
              <View style={[styles.avatar, styles.avatarIniciales, { backgroundColor: `${colors.ink}1A` }]}>
                <Text style={{ color: colors.ink, fontWeight: "700", fontSize: 12 }}>{iniciales(otroNombre)}</Text>
              </View>
            )
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            {otroNombre && (
              <Text style={{ color: colors.ink, fontWeight: "700", fontSize: 15 }} numberOfLines={1}>
                {otroNombre}
              </Text>
            )}
            {conversacion && colorRubro && IconoRubro && (
              <View style={[styles.pillRubro, { backgroundColor: `${colorRubro}1F` }]}>
                <IconoRubro size={11} strokeWidth={2.5} color={colorRubro} />
                <Text style={{ color: colorRubro, fontSize: 11, fontWeight: "700" }} numberOfLines={1}>
                  {conversacion.categoriaNombre}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>

      <View style={[styles.areaMensajes, { backgroundColor: colorRubro ? `${colorRubro}0D` : "transparent" }]}>
        {colorRubro && IconoRubro && (
          <View style={styles.marcaAguaRubro} pointerEvents="none">
            <IconoRubro size={190} strokeWidth={1} color={colorRubro} />
          </View>
        )}
        <FlatList
          ref={listaRef}
          data={mensajes}
          keyExtractor={(m) => m.id}
          style={{ backgroundColor: "transparent" }}
          contentContainerStyle={{ padding: 14, gap: 8 }}
          onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: m }) => (
            <BurbujaMensaje
              mensaje={m}
              esMio={m.emisorId === usuario?.id}
              esCliente={esCliente}
              colors={colors}
              pagando={pagando}
              cancelando={cancelandoOfertaId === m.id}
              onPagar={() => handlePagar(m.id)}
              onCancelar={() => handleCancelarOferta(m.id)}
              onVerImagen={() => setImagenAmpliada(m.archivoUrl)}
            />
          )}
        />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {subiendoArchivo && <Text style={{ color: colors.inkMuted, fontSize: 11, paddingHorizontal: 14 }}>Enviando...</Text>}

      <View style={[styles.barraInferior, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
        {grabando ? (
          <View style={[styles.filaGrabando, { borderColor: colors.border }]}>
            <View style={styles.puntoRojo} />
            <Text style={{ color: colors.ink, flex: 1, fontSize: 13 }}>Grabando... {formatoTiempo(segundosGrabados)}</Text>
            <Pressable onPress={() => detenerGrabacion(false)} style={{ padding: 6 }}>
              <X size={18} color={colors.inkMuted} />
            </Pressable>
            <Pressable onPress={() => detenerGrabacion(true)} style={[styles.botonRedondo, { backgroundColor: colors.ink }]}>
              <Check size={16} color={colors.paper} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.filaInput}>
            <Pressable onPress={abrirMenuAdjunto} disabled={!conectado || subiendoArchivo} style={styles.botonIcono}>
              <Paperclip size={20} color={colors.inkMuted} />
            </Pressable>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.ink, backgroundColor: colors.surface }]}
              placeholder={conectado ? "Escribí un mensaje..." : "Conectando..."}
              placeholderTextColor={colors.inkMuted}
              editable={conectado}
              value={nuevoMensaje}
              onChangeText={setNuevoMensaje}
              multiline
            />
            {!nuevoMensaje.trim() && (
              <Pressable onPress={iniciarGrabacion} disabled={!conectado || subiendoArchivo} style={styles.botonIcono}>
                <Mic size={20} color={colors.inkMuted} />
              </Pressable>
            )}
            {esPrestador && (
              <Pressable
                onPress={() => {
                  setError(null);
                  setMostrandoOferta(true);
                }}
                style={[styles.botonOfertar, { borderColor: colors.copper }]}
              >
                <BanknoteArrowUp size={18} color={colors.copper} />
              </Pressable>
            )}
            <Pressable
              onPress={handleEnviar}
              disabled={!conectado || !nuevoMensaje.trim()}
              style={[styles.botonEnviar, { backgroundColor: colors.ink, opacity: !conectado || !nuevoMensaje.trim() ? 0.4 : 1 }]}
            >
              <Send size={18} color={colors.paper} />
            </Pressable>
          </View>
        )}
      </View>

      <Modal visible={!!imagenAmpliada} transparent animationType="fade" onRequestClose={() => setImagenAmpliada(null)}>
        <Pressable style={styles.fondoLightbox} onPress={() => setImagenAmpliada(null)}>
          {imagenAmpliada && <Image source={{ uri: imagenAmpliada }} style={styles.imagenAmpliada} resizeMode="contain" />}
        </Pressable>
      </Modal>

      <Modal visible={mostrandoOferta} transparent animationType="fade" onRequestClose={() => setMostrandoOferta(false)}>
        {/* Fix (22/09, reportado por el usuario): un <Modal> de React Native se monta en su propia
            ventana nativa, así que el KeyboardAvoidingView de la pantalla de arriba NO lo alcanza —
            sin este KeyboardAvoidingView propio, el teclado tapaba el campo de Precio (el segundo
            input) sin dejar forma de verlo mientras se escribe. */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={styles.fondoModal}
            onPress={() => {
              if (enviandoOferta) return;
              setError(null);
              setMostrandoOferta(false);
              setDescripcionOferta("");
              setMontoOferta("");
            }}
          >
            <Pressable style={[styles.modalOferta, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.eyebrow, { color: colors.copper }]}>NUEVA OFERTA</Text>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700", marginBottom: 12 }}>
              {otroNombre ? `Ofertale un trabajo a ${otroNombre}` : "Ofertale un trabajo a tu cliente"}
            </Text>

            <Text style={{ color: colors.inkMuted, fontSize: 12, marginBottom: 4 }}>Título</Text>
            <TextInput
              style={[styles.inputModal, { borderColor: colors.border, color: colors.ink, backgroundColor: colors.paper }]}
              placeholder="¿Qué trabajo es? (ej. Arreglo farola)"
              placeholderTextColor={colors.inkMuted}
              value={descripcionOferta}
              onChangeText={setDescripcionOferta}
            />

            <Text style={{ color: colors.inkMuted, fontSize: 12, marginTop: 10, marginBottom: 4 }}>Precio</Text>
            <TextInput
              style={[styles.inputModal, { borderColor: colors.border, color: colors.ink, backgroundColor: colors.paper }]}
              placeholder="$0"
              placeholderTextColor={colors.inkMuted}
              keyboardType="numeric"
              value={montoOferta}
              onChangeText={setMontoOferta}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <Pressable
                disabled={enviandoOferta}
                onPress={() => {
                  setError(null);
                  setMostrandoOferta(false);
                  setDescripcionOferta("");
                  setMontoOferta("");
                }}
                style={[styles.botonCancelar, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.ink }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleEnviarOferta}
                disabled={enviandoOferta || !descripcionOferta.trim() || !montoOferta || Number(montoOferta) <= 0}
                style={[
                  styles.botonConfirmar,
                  { backgroundColor: colors.copper, opacity: enviandoOferta || !descripcionOferta.trim() || !montoOferta ? 0.5 : 1 },
                ]}
              >
                {enviandoOferta ? <ActivityIndicator color={colors.paper} /> : <Text style={{ color: colors.paper, fontWeight: "700" }}>Ofertar</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function BurbujaMensaje({
  mensaje: m,
  esMio,
  esCliente,
  colors,
  pagando,
  cancelando,
  onPagar,
  onCancelar,
  onVerImagen,
}: {
  mensaje: Mensaje;
  esMio: boolean;
  esCliente: boolean;
  colors: Colors;
  pagando: boolean;
  cancelando: boolean;
  onPagar: () => void;
  onCancelar: () => void;
  onVerImagen: () => void;
}) {
  if (m.tipo === "Oferta") {
    const colorBorde = m.ofertaPagada ? "#059669" : m.ofertaVigente ? colors.copper : colors.border;
    const colorHeader = m.ofertaPagada ? "#059669" : m.ofertaVigente ? colors.copper : `${colors.ink}1A`;
    const colorTextoHeader = m.ofertaPagada || m.ofertaVigente ? colors.paper : colors.inkMuted;

    return (
      <View style={[styles.tarjetaOferta, { borderColor: colorBorde, alignSelf: esMio ? "flex-end" : "flex-start" }]}>
        <View style={[styles.headerOferta, { backgroundColor: colorHeader }]}>
          <Text style={{ color: colorTextoHeader, fontSize: 10, fontWeight: "700", flex: 1 }} numberOfLines={1}>
            {esMio ? "ENVIASTE UNA OFERTA" : `${m.emisorNombre.toUpperCase()} TE ENVIÓ UNA OFERTA`}
          </Text>
          {(m.ofertaPagada || m.ofertaVigente) && (
            <Text style={{ color: colorTextoHeader, fontSize: 9, fontWeight: "700" }}>{m.ofertaPagada ? "PAGADA" : "VIGENTE"}</Text>
          )}
        </View>
        <View style={[styles.cuerpoOferta, { backgroundColor: colors.surface }]}>
          {m.descripcionOferta && <Text style={{ color: colors.inkMuted, fontSize: 13, marginBottom: 4 }}>{m.descripcionOferta}</Text>}
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "700" }}>${m.montoOferta!.toLocaleString("es-AR")}</Text>

          {m.ofertaPagada ? (
            <>
              <Text style={{ color: "#059669", fontSize: 12, marginTop: 10, fontWeight: "600" }}>✓ Esta oferta ya fue pagada</Text>
              {m.ofertaAgendadaEn && (
                <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 4 }}>
                  Agendada el{" "}
                  {new Date(m.ofertaAgendadaEn).toLocaleDateString("es-AR", { day: "numeric", month: "short" })} a las{" "}
                  {new Date(m.ofertaAgendadaEn).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              )}
            </>
          ) : (
            <>
              {!m.ofertaVigente && (
                <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 6 }}>
                  {m.ofertaExpiraEn && new Date(m.ofertaExpiraEn).getTime() <= Date.now() ? "Esta oferta venció" : "Superada por una oferta más reciente"}
                </Text>
              )}
              {m.ofertaVigente && esCliente && !esMio && (
                <Pressable onPress={onPagar} disabled={pagando} style={[styles.botonPagar, { opacity: pagando ? 0.6 : 1 }]}>
                  {pagando ? <ActivityIndicator color={colors.ink} /> : <Text style={{ color: colors.ink, fontWeight: "700", fontSize: 13 }}>Pagar con Mercado Pago</Text>}
                </Pressable>
              )}
              {m.ofertaVigente && esMio && (
                <>
                  <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 10 }}>Esperando que el cliente pague...</Text>
                  <Pressable onPress={onCancelar} disabled={cancelando} style={[styles.botonCancelarOferta, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.inkMuted, fontSize: 11 }}>{cancelando ? "Cancelando..." : "Cancelar oferta"}</Text>
                  </Pressable>
                </>
              )}
              {m.ofertaVigente && textoVencimiento(m.ofertaExpiraEn) && (
                <Text style={{ color: colors.inkMuted, fontSize: 10, marginTop: 6 }}>{textoVencimiento(m.ofertaExpiraEn)}</Text>
              )}
            </>
          )}
        </View>
      </View>
    );
  }

  if (m.tipo === "Turno") {
    // Turno agendado enviado al chat (22/09) — misma tarjeta visual que la Oferta (reusa sus
    // estilos), tachada (TurnoVigente=false) cuando el prestador reprograma y manda una nueva.
    const fecha = m.turnoFechaHora ? new Date(m.turnoFechaHora) : null;
    const fechaTexto = fecha
      ? fecha.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
      : "";
    const horaTexto = fecha ? fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "";
    const colorBorde = m.turnoVigente ? colors.copper : colors.border;
    const colorHeader = m.turnoVigente ? colors.copper : `${colors.ink}1A`;
    const colorTextoHeader = m.turnoVigente ? colors.paper : colors.inkMuted;

    return (
      <View style={[styles.tarjetaOferta, { borderColor: colorBorde, alignSelf: esMio ? "flex-end" : "flex-start" }]}>
        <View style={[styles.headerOferta, { backgroundColor: colorHeader }]}>
          <Text style={{ color: colorTextoHeader, fontSize: 10, fontWeight: "700", flex: 1 }} numberOfLines={1}>
            {esMio ? "AGENDASTE UN TURNO" : `${m.emisorNombre.toUpperCase()} AGENDÓ UN TURNO`}
          </Text>
          {!m.turnoVigente && <Text style={{ color: colorTextoHeader, fontSize: 9, fontWeight: "700" }}>REPROGRAMADO</Text>}
        </View>
        <View style={[styles.cuerpoOferta, { backgroundColor: colors.surface }]}>
          <Text
            style={{
              color: colors.ink,
              fontSize: 16,
              fontWeight: "700",
              textDecorationLine: m.turnoVigente ? "none" : "line-through",
            }}
          >
            {fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)}
          </Text>
          <Text
            style={{
              color: colors.inkMuted,
              fontSize: 14,
              marginTop: 2,
              textDecorationLine: m.turnoVigente ? "none" : "line-through",
            }}
          >
            {horaTexto}
            {m.turnoDuracionMinutos ? ` · ${formatoDuracion(m.turnoDuracionMinutos)}` : ""}
          </Text>
          {!m.turnoVigente && (
            <Text style={{ color: colors.inkMuted, fontSize: 11, marginTop: 8 }}>Este turno se reprogramó — ver el mensaje más reciente</Text>
          )}
        </View>
      </View>
    );
  }

  if (m.tipo === "Imagen") {
    return (
      <View style={{ alignSelf: esMio ? "flex-end" : "flex-start", maxWidth: "70%" }}>
        {!esMio && <Text style={{ color: colors.copper, fontSize: 11, marginBottom: 2 }}>{m.emisorNombre}</Text>}
        <Pressable onPress={onVerImagen}>
          <Image source={{ uri: m.archivoUrl ?? "" }} style={styles.imagenChat} resizeMode="cover" />
        </Pressable>
      </View>
    );
  }

  if (m.tipo === "Video") {
    return <BurbujaVideo uri={m.archivoUrl ?? ""} emisorNombre={m.emisorNombre} esMio={esMio} colorAcento={colors.copper} />;
  }

  if (m.tipo === "Audio") {
    return (
      <View
        style={[
          styles.burbujaAudio,
          { backgroundColor: esMio ? colors.ink : colors.surface, borderColor: colors.border, borderWidth: esMio ? 0 : 1, alignSelf: esMio ? "flex-end" : "flex-start" },
        ]}
      >
        {!esMio && <Text style={{ color: colors.copper, fontSize: 11, marginBottom: 4 }}>{m.emisorNombre}</Text>}
        <ReproductorAudio uri={m.archivoUrl ?? ""} duracionSegundos={m.duracionSegundos} colorTexto={esMio ? colors.paper : colors.ink} colorAcento={esMio ? colors.paper : colors.copper} />
      </View>
    );
  }

  return (
    <View style={[styles.burbujaTexto, { backgroundColor: esMio ? colors.ink : colors.surface, borderColor: colors.border, borderWidth: esMio ? 0 : 1, alignSelf: esMio ? "flex-end" : "flex-start" }]}>
      {!esMio && <Text style={{ color: colors.copper, fontSize: 11, marginBottom: 2 }}>{m.emisorNombre}</Text>}
      <Text style={{ color: esMio ? colors.paper : colors.ink, fontSize: 14 }}>{m.contenido}</Text>
    </View>
  );
}

// Reproductor de audio chico y autocontenido, con expo-audio: useAudioPlayer crea el player para
// esta URL (una nota de voz corta, no un stream largo, así que no hace falta cargarlo "recién al
// tocar play" como se haría con un archivo pesado) y useAudioPlayerStatus reactiona a play/pause
// y a cuándo termina, para poder reiniciar la posición y que un segundo toque no arranque a mitad
// de la nota de voz.
function ReproductorAudio({
  uri,
  duracionSegundos,
  colorTexto,
  colorAcento,
}: {
  uri: string;
  duracionSegundos: number | null;
  colorTexto: string;
  colorAcento: string;
}) {
  const [error, setError] = useState(false);
  const player = useAudioPlayer(uri);
  const estado = useAudioPlayerStatus(player);

  function alternar() {
    try {
      if (estado.playing) {
        player.pause();
      } else {
        if (estado.didJustFinish) player.seekTo(0);
        player.play();
      }
    } catch {
      setError(true);
    }
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, width: 190 }}>
      <Pressable onPress={alternar} style={[styles.botonRedondo, { backgroundColor: colorAcento }]}>
        {estado.playing ? <Pause size={14} color="#fff" /> : <Play size={14} color="#fff" />}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colorTexto, fontSize: 11 }}>{error ? "No se pudo reproducir" : "Nota de voz"}</Text>
        {duracionSegundos != null && <Text style={{ color: colorTexto, fontSize: 10, opacity: 0.6 }}>{formatoTiempo(duracionSegundos)}</Text>}
      </View>
    </View>
  );
}

// Burbuja de video, en su propio componente porque el hook useVideoPlayer se tiene que llamar
// siempre en el mismo lugar en cada render (regla de los Hooks de React) — no se puede llamar
// solo "adentro" de la rama `if (m.tipo === "Video")` de BurbujaMensaje.
function BurbujaVideo({
  uri,
  emisorNombre,
  esMio,
  colorAcento,
}: {
  uri: string;
  emisorNombre: string;
  esMio: boolean;
  colorAcento: string;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  return (
    <View style={{ alignSelf: esMio ? "flex-end" : "flex-start", maxWidth: "75%" }}>
      {!esMio && <Text style={{ color: colorAcento, fontSize: 11, marginBottom: 2 }}>{emisorNombre}</Text>}
      <VideoView player={player} style={styles.videoChat} nativeControls />
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  pantalla: { flex: 1, paddingTop: 50 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1 },
  headerInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarIniciales: { alignItems: "center", justifyContent: "center" },
  pillRubro: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  areaMensajes: { flex: 1, position: "relative", overflow: "hidden" },
  marcaAguaRubro: { position: "absolute", top: "50%", left: "50%", marginLeft: -95, marginTop: -95, opacity: 0.07 },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, fontWeight: "700", marginBottom: 4 },
  error: { color: "#C0392B", fontSize: 12, paddingHorizontal: 14, marginTop: 4 },
  barraInferior: { borderTopWidth: 1, padding: 10 },
  filaInput: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  botonIcono: { padding: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 100, fontSize: 14 },
  botonOfertar: { borderWidth: 1.5, borderRadius: 10, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  botonEnviar: { borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  filaGrabando: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  puntoRojo: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: "#DC2626" },
  botonRedondo: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  fondoLightbox: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" },
  imagenAmpliada: { width: "100%", height: "100%" },
  fondoModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalOferta: { borderWidth: 1, borderRadius: 14, padding: 18, width: "100%" },
  inputModal: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  botonCancelar: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  botonConfirmar: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  tarjetaOferta: { width: 260, borderRadius: 12, borderWidth: 2, overflow: "hidden" },
  headerOferta: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  cuerpoOferta: { padding: 14 },
  botonPagar: { marginTop: 10, backgroundColor: "#F0C419", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  botonCancelarOferta: { marginTop: 8, borderWidth: 1, borderRadius: 8, paddingVertical: 6, alignItems: "center" },
  imagenChat: { width: 220, height: 220, borderRadius: 10 },
  videoChat: { width: 240, height: 180, borderRadius: 10, backgroundColor: "#000" },
  burbujaAudio: { borderRadius: 12, padding: 10, maxWidth: "80%" },
  burbujaTexto: { borderRadius: 12, padding: 10, maxWidth: "78%" },
});
