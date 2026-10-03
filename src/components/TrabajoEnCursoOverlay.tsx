import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useAuth } from "@/lib/authContext";
import { useTrabajoEnCurso } from "@/lib/trabajoEnCursoContext";
import { iconoCategoria } from "@/lib/iconosCategoria";

// Mockup de referencia: Artifact "Trabajo en curso — FixIt" (Cliente / Prestador / banner
// minimizado). Reproduce esas 3 vistas con componentes nativos de verdad en vez del HTML del
// mockup — colores y proporciones iguales a propósito para que se vea igual que lo que ya
// aprobamos.
const INK = "#12151b";
const PAPER = "#F4F1EA";
const COPPER = "#A85F35";
const COPPER_LIGHT = "#D2824F";
const SAFETY = "#F5C242";

function formatearTiempo(segundosTotales: number): string {
  const s = Math.max(0, Math.floor(segundosTotales));
  const horas = Math.floor(s / 3600);
  const minutos = Math.floor((s % 3600) / 60);
  const segundos = s % 60;
  if (horas > 0) {
    return `${horas.toString().padStart(2, "0")}:${minutos.toString().padStart(2, "0")}:${segundos
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutos.toString().padStart(2, "0")}:${segundos.toString().padStart(2, "0")}`;
}

// Pausar trabajo en curso (03/10): con pausadoEn seteado, el timer se congela en el momento de
// la pausa en vez de seguir sumando — no hace falta un intervalo, un solo cálculo alcanza.
function useTimer(iniciadoEn: string | undefined, pausadoEn: string | null | undefined) {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    if (!iniciadoEn) return;
    const inicio = new Date(iniciadoEn).getTime();

    if (pausadoEn) {
      setSegundos((new Date(pausadoEn).getTime() - inicio) / 1000);
      return;
    }

    const actualizar = () => setSegundos((Date.now() - inicio) / 1000);
    actualizar();
    const intervalo = setInterval(actualizar, 1000);
    return () => clearInterval(intervalo);
  }, [iniciadoEn, pausadoEn]);
  return formatearTiempo(segundos);
}

function usePulso(delayMs: number) {
  const progreso = useSharedValue(0);
  useEffect(() => {
    progreso.value = withDelay(
      delayMs,
      withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false)
    );
  }, [progreso, delayMs]);
  return useAnimatedStyle(() => ({
    transform: [{ scale: 0.82 + progreso.value * 0.63 }],
    opacity: (1 - progreso.value) * 0.55,
  }));
}

function useRock() {
  const angulo = useSharedValue(-14);
  useEffect(() => {
    angulo.value = withRepeat(
      withSequence(
        withTiming(14, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(-14, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [angulo]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${angulo.value}deg` }] }));
}

function useParpadeo() {
  const opacidad = useSharedValue(1);
  useEffect(() => {
    opacidad.value = withRepeat(
      withSequence(withTiming(0.25, { duration: 800 }), withTiming(1, { duration: 800 })),
      -1,
      false
    );
  }, [opacidad]);
  return useAnimatedStyle(() => ({ opacity: opacidad.value }));
}

function IconoHerramienta({
  Icono,
  size = 96,
  iconSize = 48,
}: {
  Icono: LucideIcon;
  size?: number;
  iconSize?: number;
}) {
  const anillo1 = usePulso(0);
  const anillo2 = usePulso(1300);
  const rotacion = useRock();
  const tamañoAnillo = size * 1.58;

  return (
    <View style={{ width: tamañoAnillo, height: tamañoAnillo, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          styles.anillo,
          anillo1,
          { width: tamañoAnillo, height: tamañoAnillo, borderRadius: tamañoAnillo / 2 },
        ]}
      />
      <Animated.View
        style={[
          styles.anillo,
          anillo2,
          { width: tamañoAnillo, height: tamañoAnillo, borderRadius: tamañoAnillo / 2 },
        ]}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COPPER_LIGHT,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.View style={rotacion}>
          <Icono color={INK} size={iconSize} strokeWidth={1.8} />
        </Animated.View>
      </View>
    </View>
  );
}

function PuntoEspera({ delayMs }: { delayMs: number }) {
  const desplazamiento = useSharedValue(0);
  useEffect(() => {
    desplazamiento.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) }),
          withTiming(0, { duration: 400 })
        ),
        -1,
        false
      )
    );
  }, [desplazamiento, delayMs]);
  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 * desplazamiento.value }],
    opacity: 0.4 + desplazamiento.value * 0.6,
  }));
  return <Animated.View style={[styles.puntoEspera, estilo]} />;
}

export default function TrabajoEnCursoOverlay() {
  const insets = useSafeAreaInsets();
  const { usuario } = useAuth();
  const {
    ordenEnCurso,
    minimizado,
    minimizar,
    expandir,
    finalizando,
    errorFinalizar,
    finalizarTrabajo,
    pausando,
    reanudando,
    errorPausa,
    pausarTrabajo,
    reanudarTrabajo,
  } = useTrabajoEnCurso();
  const parpadeo = useParpadeo();
  const tiempo = useTimer(ordenEnCurso?.iniciadoEn, ordenEnCurso?.pausadoEn);
  const [mostrarFormPausa, setMostrarFormPausa] = useState(false);
  const [notaPausa, setNotaPausa] = useState("");

  if (!ordenEnCurso || !usuario) return null;

  const Icono = iconoCategoria(ordenEnCurso.categoriaIcono);
  const esCliente = usuario.rol === "Cliente";
  const otraParte = esCliente ? ordenEnCurso.prestadorNombreCompleto : ordenEnCurso.clienteNombreCompleto;

  if (minimizado) {
    return (
      <Pressable
        onPress={expandir}
        style={[styles.banner, { paddingTop: insets.top + 10 }]}
        accessibilityRole="button"
        accessibilityLabel="Ver el trabajo en curso"
      >
        <View style={styles.bannerIcono}>
          <Icono color={INK} size={16} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {!ordenEnCurso.pausadoEn && <Animated.View style={[styles.puntoVivoOscuro, parpadeo]} />}
            <Text style={styles.bannerTitulo}>{ordenEnCurso.pausadoEn ? "PAUSADO" : "TRABAJO EN CURSO"}</Text>
          </View>
          <Text style={styles.bannerSubtitulo} numberOfLines={1}>
            {ordenEnCurso.categoriaNombre} · con {otraParte}
          </Text>
        </View>
        <Text style={styles.bannerTiempo}>{tiempo}</Text>
        <ChevronRight color={INK} size={16} style={{ opacity: 0.65 }} />
      </Pressable>
    );
  }

  // Fix (29/09, reportado por el usuario: "se pone la herramienta en la parte de abajo, se ve
  // roto"): este overlay se monta como hermano de <NavegacionSegunSesion/> en _layout.tsx, es
  // decir, al lado del Stack Navigator — pero el Stack (react-navigation, sobre react-native-screens)
  // en Android maneja cada pantalla como su propia superficie nativa (Fragment), y eso puede
  // ignorar el z-index/elevation de una simple View absoluta hermana suya: el resultado es
  // exactamente lo que se reportó, contenido que se ve recortado/mal ubicado en vez de tapar toda
  // la pantalla. La solución robusta (y ya usada en el resto de la app: ver el modal de oferta y
  // el de aviso de pago en conversacion/[id].tsx) es un <Modal> nativo de verdad — tiene su propia
  // ventana del sistema operativo, así que queda garantizado por encima de cualquier pantalla del
  // Stack sin depender de z-index. El banner minimizado NO se movió a Modal a propósito: como
  // Modal captura los toques de toda la pantalla en Android (aun con fondo transparente), eso
  // rompería poder seguir usando el resto de la app con el banner flotando arriba.
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.pantallaCompleta}>
        {/* Teclado tapando el formulario de pausa (03/10, reportado por el usuario — mismo
            problema que ya se había arreglado en login.tsx): el textarea de la nota vive abajo
            del todo de esta pantalla, y sin esto el teclado se la comía entera al abrirse. Mismo
            fix que login.tsx: KeyboardAvoidingView con "padding" en iOS / "height" en Android. */}
        <KeyboardAvoidingView
          style={{ flex: 1, paddingTop: insets.top }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <View style={styles.encabezado}>
          <View style={styles.pillEnVivo}>
            <Animated.View style={[styles.puntoVivo, parpadeo]} />
            <Text style={styles.textoEnVivo}>EN VIVO</Text>
          </View>
          <Pressable
            onPress={minimizar}
            style={styles.botonMinimizar}
            accessibilityRole="button"
            accessibilityLabel="Minimizar"
          >
            <ChevronDown color={PAPER} size={18} />
          </Pressable>
        </View>

        <View style={styles.centro}>
          <IconoHerramienta Icono={Icono} />

          <View style={{ alignItems: "center", gap: 6 }}>
            <Text style={styles.titulo}>Trabajo en curso</Text>
            <Text style={styles.subtitulo}>
              {ordenEnCurso.categoriaNombre} · con {otraParte}
            </Text>
          </View>

          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={styles.timer}>{tiempo}</Text>
            <Text style={styles.timerCaption}>TIEMPO TRANSCURRIDO</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24, gap: 12 }}>
          {errorFinalizar && <Text style={styles.error}>{errorFinalizar}</Text>}
          {errorPausa && <Text style={styles.error}>{errorPausa}</Text>}

          {esCliente ? (
            ordenEnCurso.pausadoEn ? (
              <View style={styles.esperaBox}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.esperaTexto, { fontWeight: "700" }]}>El prestador pausó el trabajo</Text>
                  <Text style={styles.esperaTexto}>
                    {ordenEnCurso.notaPausa || "Lo van a continuar más adelante."}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Pressable
                  onPress={finalizarTrabajo}
                  disabled={finalizando}
                  style={[styles.botonFinalizar, finalizando && { opacity: 0.6 }]}
                >
                  <Text style={styles.botonFinalizarTexto}>
                    {finalizando ? "Finalizando..." : "Finalizar trabajo"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    // El flujo completo de reclamos/disputas todavía no está construido (queda para
                    // más adelante, junto con Mercado Pago) — por ahora dejamos la salida visible
                    // pero avisando que está en camino, en vez de fingir que ya hace algo.
                    alert("Pronto vas a poder reportar un problema desde acá. Mientras tanto, contactanos por el chat.")
                  }
                >
                  <Text style={styles.botonReportar}>Reportar un problema</Text>
                </Pressable>
              </>
            )
          ) : ordenEnCurso.pausadoEn ? (
            <>
              <View style={styles.esperaBox}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.esperaTexto, { fontWeight: "700" }]}>Pausado</Text>
                  {!!ordenEnCurso.notaPausa && <Text style={styles.esperaTexto}>{ordenEnCurso.notaPausa}</Text>}
                </View>
              </View>
              <Pressable
                onPress={reanudarTrabajo}
                disabled={reanudando}
                style={[styles.botonFinalizar, reanudando && { opacity: 0.6 }]}
              >
                <Text style={styles.botonFinalizarTexto}>{reanudando ? "Reanudando..." : "Reanudar trabajo"}</Text>
              </Pressable>
            </>
          ) : mostrarFormPausa ? (
            <View style={styles.formPausa}>
              <TextInput
                placeholder="Nota para el cliente (opcional) — ej. «Seguimos mañana a la misma hora»"
                placeholderTextColor="rgba(244,241,234,0.4)"
                value={notaPausa}
                onChangeText={setNotaPausa}
                style={styles.inputNotaPausa}
                multiline
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => {
                    setMostrarFormPausa(false);
                    setNotaPausa("");
                  }}
                  style={styles.botonCancelarPausa}
                >
                  <Text style={{ color: PAPER, fontSize: 13, opacity: 0.8, textAlign: "center" }}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    await pausarTrabajo(notaPausa);
                    setMostrarFormPausa(false);
                    setNotaPausa("");
                  }}
                  disabled={pausando}
                  style={[styles.botonConfirmarPausa, pausando && { opacity: 0.6 }]}
                >
                  <Text style={{ color: PAPER, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    {pausando ? "Pausando..." : "Confirmar pausa"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Pressable onPress={() => setMostrarFormPausa(true)} style={styles.botonPausar}>
                <Text style={styles.botonPausarTexto}>Pausar trabajo</Text>
              </Pressable>
              <View style={styles.esperaBox}>
                <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                  <PuntoEspera delayMs={0} />
                  <PuntoEspera delayMs={150} />
                  <PuntoEspera delayMs={300} />
                </View>
                <Text style={styles.esperaTexto}>Esperando que el cliente confirme la finalización</Text>
              </View>
            </>
          )}
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Ya no necesita absoluteFillObject/zIndex/elevation (29/09): ahora este View vive adentro de
  // un <Modal>, que tiene su propia ventana nativa y siempre se dibuja completa, sin depender de
  // ganarle el z-index a nada.
  pantallaCompleta: {
    flex: 1,
    backgroundColor: INK,
  },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  pillEnVivo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  puntoVivo: { width: 7, height: 7, borderRadius: 999, backgroundColor: "#6EE7A0" },
  puntoVivoOscuro: { width: 6, height: 6, borderRadius: 999, backgroundColor: INK },
  textoEnVivo: { fontSize: 11, letterSpacing: 1, fontWeight: "600", color: PAPER, opacity: 0.85 },
  botonMinimizar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 26, paddingHorizontal: 28 },
  anillo: { position: "absolute", borderWidth: 2, borderColor: "#C9703F" },
  titulo: { fontSize: 26, fontWeight: "700", color: PAPER, textAlign: "center" },
  subtitulo: { fontSize: 14, color: PAPER, opacity: 0.65, textAlign: "center" },
  timer: { fontSize: 48, fontWeight: "600", color: PAPER, letterSpacing: 1, fontVariant: ["tabular-nums"] },
  timerCaption: { fontSize: 11, letterSpacing: 1, color: PAPER, opacity: 0.5 },
  botonFinalizar: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    backgroundColor: SAFETY,
    alignItems: "center",
    justifyContent: "center",
  },
  botonFinalizarTexto: { fontSize: 16, fontWeight: "700", color: INK },
  botonReportar: { fontSize: 13, color: PAPER, opacity: 0.55, textAlign: "center" },
  esperaBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 14,
  },
  puntoEspera: { width: 6, height: 6, borderRadius: 999, backgroundColor: PAPER },
  esperaTexto: { flex: 1, fontSize: 13, color: PAPER, opacity: 0.75, lineHeight: 18 },
  error: { color: "#F87171", fontSize: 13, textAlign: "center" },
  botonPausar: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  botonPausarTexto: { fontSize: 16, fontWeight: "700", color: PAPER },
  formPausa: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  inputNotaPausa: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 10,
    color: PAPER,
    fontSize: 13,
    minHeight: 54,
    textAlignVertical: "top",
  },
  botonCancelarPausa: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  botonConfirmarPausa: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: COPPER,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COPPER,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 1000,
    elevation: 1000,
  },
  bannerIcono: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(18,21,27,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitulo: { fontSize: 12, fontWeight: "700", color: INK, letterSpacing: 0.6 },
  bannerSubtitulo: { fontSize: 12, color: "rgba(18,21,27,0.7)", marginTop: 1 },
  bannerTiempo: { fontSize: 16, fontWeight: "600", color: INK, fontVariant: ["tabular-nums"] },
});
