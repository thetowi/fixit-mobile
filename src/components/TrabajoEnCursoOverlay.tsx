import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

function useTimer(iniciadoEn: string | undefined) {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    if (!iniciadoEn) return;
    const inicio = new Date(iniciadoEn).getTime();
    const actualizar = () => setSegundos((Date.now() - inicio) / 1000);
    actualizar();
    const intervalo = setInterval(actualizar, 1000);
    return () => clearInterval(intervalo);
  }, [iniciadoEn]);
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
  const { ordenEnCurso, minimizado, minimizar, expandir, finalizando, errorFinalizar, finalizarTrabajo } =
    useTrabajoEnCurso();
  const parpadeo = useParpadeo();
  const tiempo = useTimer(ordenEnCurso?.iniciadoEn);

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
            <Animated.View style={[styles.puntoVivoOscuro, parpadeo]} />
            <Text style={styles.bannerTitulo}>TRABAJO EN CURSO</Text>
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

  return (
    <View style={styles.pantallaCompleta}>
      <View style={{ flex: 1, paddingTop: insets.top }}>
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
          {esCliente ? (
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
          ) : (
            <View style={styles.esperaBox}>
              <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                <PuntoEspera delayMs={0} />
                <PuntoEspera delayMs={150} />
                <PuntoEspera delayMs={300} />
              </View>
              <Text style={styles.esperaTexto}>Esperando que el cliente confirme la finalización</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pantallaCompleta: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: INK,
    zIndex: 1000,
    elevation: 1000,
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
