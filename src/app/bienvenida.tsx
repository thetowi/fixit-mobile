import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wrench, Zap, Flame, Hammer, Leaf, ShieldCheck, MessageCircle, BadgeCheck } from "lucide-react-native";
import { useFixitColors } from "@/hooks/use-fixit-colors";

// Pantalla de bienvenida, previo al login (29/09, a pedido del usuario: "si abrís la app te manda
// directo al login... no te informa nada, no dice nada"). Es la primera pantalla que ve alguien sin
// sesión guardada — ver app/index.tsx, que redirige acá en vez de a /login directo, y
// app/_layout.tsx, que la agrega al mismo grupo público (sin sesión) que login.
//
// Segunda vuelta (29/09, mockup "G — Bienvenida oscuro editorial"): el usuario pidió la estética
// oscura de la opción B del mockup (banda oscura arriba con la marca, el eyebrow y el título; una
// "hoja" clara abajo con el resto) en vez de la pantalla toda clara de la primera versión, y que el
// ícono del logo fuera el badge animado "Disolver" (uno de los 3 mockups de transformación entre
// íconos de rubro) en vez de la llave inglesa fija.
//
// Se mantiene todo lo demás de la primera versión:
// - El eyebrow de rubros tipea letra por letra en loop (igual que TypewriterRubros.tsx en
//   fixit-web: 75ms por letra al escribir, 35ms al borrar, 1.3s de pausa con la palabra completa),
//   centrado en el ancho de la pantalla.
// - Los "3 pasos" rotan solos cada 3s con un fundido, con los puntitos de progreso centrados.
// - El botón principal tiene el brillo sutil recorriéndolo — la única animación "de reposo" del
//   botón (a pedido explícito, sin fade de entrada ni pulso de glow).
//
// Nota técnica: todo con la Animated API del núcleo de React Native, sin dependencias nuevas — no
// hace falta build de EAS para esta pantalla. El "glow" cobre del mockup (radial-gradient) se
// aproxima acá con un círculo semitransparente lisa, porque RN no tiene radial-gradient nativo y no
// queremos sumar una librería nueva (expo-linear-gradient) solo para este detalle.

const RUBROS = ["Plomería", "Electricidad", "Gas", "Jardinería", "y más"];
const VELOCIDAD_ESCRITURA = 75;
const VELOCIDAD_BORRADO = 35;
const PAUSA_PALABRA_COMPLETA = 1300;
const PAUSA_ENTRE_PALABRAS = 350;

const PASOS = [
  {
    Icono: Wrench,
    etiqueta: "Paso 1",
    texto: "Pedís el trabajo y elegís entre prestadores verificados",
  },
  {
    Icono: MessageCircle,
    etiqueta: "Paso 2",
    texto: "Coordinás día y hora por chat, directo con el profesional",
  },
  {
    Icono: ShieldCheck,
    etiqueta: "Paso 3",
    texto: "Pagás recién cuando el trabajo esté terminado",
  },
];

// Mismos 5 rubros que la exploración "Variante B — Disolver" del mockup de transformación de
// íconos, aplicados acá al badge del logo. ORDEN ALINEADO 1 a 1 con RUBROS (ver
// useRubroCicloSincronizado más abajo) — Plomería→llave, Electricidad→rayo, Gas→llama,
// Jardinería→hoja, "y más"→martillo (genérico). Antes este array estaba desalineado con RUBROS
// (Jardinería mostraba el martillo y "y más" mostraba la hoja) y además el ícono cambiaba con su
// propio intervalo de 1.8s, totalmente desincronizado del typewriter — resultaba en dos animaciones
// corriendo en paralelo sin relación entre sí (reportado 02/10 como "sobrecarga visual").
const ICONOS_LOGO = [Wrench, Zap, Flame, Leaf, Hammer];

// Typewriter + ícono unificados en un solo ciclo (02/10): antes `useTypewriter` y el intervalo de
// `LogoAnimado` corrían por separado, cada uno con su propio timing, así que el ícono cambiaba en
// cualquier momento sin relación con la palabra que se estaba tipeando en ese instante. Ahora un
// solo loop maneja el texto letra por letra Y expone el índice de la palabra actual — el ícono se
// sincroniza con ese mismo índice (ver LogoAnimado), así que el cambio de ícono ocurre siempre en
// el mismo punto del ciclo: justo cuando termina de borrarse una palabra y arranca a tipearse la
// siguiente (Plomería + llave, se borra, Electricidad + rayo, se borra, Gas + llama, etc.).
function useRubroCicloSincronizado(palabras: string[]) {
  const [texto, setTexto] = useState("");
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    let idx = 0;
    let actual = "";
    let borrando = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      const palabraActual = palabras[idx % palabras.length];
      let espera: number;

      if (!borrando && actual.length < palabraActual.length) {
        actual = palabraActual.slice(0, actual.length + 1);
        espera = VELOCIDAD_ESCRITURA;
      } else if (!borrando && actual.length === palabraActual.length) {
        espera = PAUSA_PALABRA_COMPLETA;
        borrando = true;
      } else if (borrando && actual.length > 0) {
        actual = palabraActual.slice(0, actual.length - 1);
        espera = VELOCIDAD_BORRADO;
      } else {
        borrando = false;
        idx = (idx + 1) % palabras.length;
        setIndice(idx); // punto de sincronización: acá cambia también el ícono del logo
        espera = PAUSA_ENTRE_PALABRAS;
      }

      setTexto(actual);
      timeoutId = setTimeout(tick, espera);
    }

    tick();
    return () => clearTimeout(timeoutId);
  }, [palabras]);

  return { texto, indice };
}

function CursorTitilante({ color }: { color: string }) {
  const opacidad = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacidad, { toValue: 0, duration: 450, useNativeDriver: true }),
        Animated.timing(opacidad, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacidad]);

  return <Animated.View style={[styles.cursor, { backgroundColor: color, opacity: opacidad }]} />;
}

// Badge del logo animado — técnica "Disolver": el ícono actual se agranda/gira y se desvanece
// mientras el siguiente entra desde el mismo estado. (RN no tiene filter: blur animable sin una
// librería nativa nueva, así que la versión mobile usa solo escala + rotación + opacidad — el
// mismo espíritu del mockup, sin el desenfoque.)
//
// 02/10: ya no maneja su propio índice/intervalo — recibe `indice` desde
// useRubroCicloSincronizado (el mismo que maneja el typewriter), así que el ícono cambia exactamente
// cuando cambia la palabra, no en un timer aparte sin relación.
function LogoAnimado({ color, indice }: { color: string; indice: number }) {
  const [iconoIndice, setIconoIndice] = useState(indice);
  const progreso = useRef(new Animated.Value(1)).current;
  const esPrimerRender = useRef(true);

  useEffect(() => {
    if (esPrimerRender.current) {
      esPrimerRender.current = false;
      return;
    }
    Animated.timing(progreso, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setIconoIndice(indice);
      Animated.timing(progreso, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  }, [indice, progreso]);

  const Icono = ICONOS_LOGO[iconoIndice % ICONOS_LOGO.length];
  const scale = progreso.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });
  const rotate = progreso.interpolate({ inputRange: [0, 1], outputRange: ["-16deg", "0deg"] });

  return (
    <Animated.View style={{ opacity: progreso, transform: [{ scale }, { rotate }] }}>
      <Icono size={18} color={color} strokeWidth={2} />
    </Animated.View>
  );
}

function PasosCarrusel({ colors }: { colors: ReturnType<typeof useFixitColors> }) {
  const [indice, setIndice] = useState(0);
  const opacidad = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const intervalId = setInterval(() => {
      Animated.timing(opacidad, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setIndice((i) => (i + 1) % PASOS.length);
        Animated.timing(opacidad, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }, 3000);
    return () => clearInterval(intervalId);
  }, [opacidad]);

  const paso = PASOS[indice];
  const Icono = paso.Icono;

  return (
    <View style={styles.pasosContenedor}>
      <Animated.View style={[styles.paso, { opacity: opacidad }]}>
        <View style={[styles.pasoIcono, { backgroundColor: colors.nav }]}>
          <Icono size={22} color={colors.copper} strokeWidth={1.8} />
        </View>
        <View style={styles.pasoTexto}>
          <Text style={[styles.pasoEtiqueta, { color: colors.copper }]}>{paso.etiqueta}</Text>
          <Text style={[styles.pasoDescripcion, { color: colors.ink }]}>{paso.texto}</Text>
        </View>
      </Animated.View>
      <View style={styles.puntosFila}>
        {PASOS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.punto,
              { backgroundColor: i === indice ? colors.copper : colors.border, width: i === indice ? 22 : 6 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function BotonPrincipal({
  texto,
  onPress,
  colors,
}: {
  texto: string;
  onPress: () => void;
  colors: ReturnType<typeof useFixitColors>;
}) {
  const brillo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(brillo, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(brillo, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(1200),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [brillo]);

  const translateX = brillo.interpolate({ inputRange: [0, 1], outputRange: [-180, 180] });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.botonPrincipal, { backgroundColor: colors.copper, opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={styles.botonRecorte} pointerEvents="none">
        <Animated.View style={[styles.brillo, { transform: [{ translateX }, { skewX: "-15deg" }] }]} />
      </View>
      <Text style={styles.botonPrincipalTexto}>{texto}</Text>
    </Pressable>
  );
}

export default function BienvenidaScreen() {
  const colors = useFixitColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { texto: textoEyebrow, indice: indiceRubro } = useRubroCicloSincronizado(RUBROS);

  return (
    <View style={[styles.pantalla, { backgroundColor: colors.paper, paddingBottom: insets.bottom }]}>
      {/* Banda oscura: marca (con el logo animado), eyebrow con typewriter y título */}
      <View style={[styles.bandaOscura, { backgroundColor: colors.nav, paddingTop: insets.top + 26 }]}>
        <View style={styles.marca}>
          <View style={[styles.logoBox, { backgroundColor: "rgba(239,238,230,0.1)" }]}>
            <LogoAnimado color={colors.copper} indice={indiceRubro} />
          </View>
          <Text style={[styles.marcaTexto, { color: colors.onNav }]}>Oficy</Text>
        </View>

        <View style={styles.eyebrowFila}>
          <Text style={[styles.eyebrow, { color: colors.copper }]}>{textoEyebrow.toUpperCase()}</Text>
          <CursorTitilante color={colors.copper} />
        </View>

        <Text style={[styles.titulo, { color: colors.onNav }]}>
          El oficio que necesitás, a la vuelta de la esquina
        </Text>
      </View>

      {/* Hoja clara: los 3 pasos, insignias y CTAs */}
      <View style={[styles.hojaClara, { backgroundColor: colors.paper }]}>
        <View style={styles.espacioPasos}>
          <PasosCarrusel colors={colors} />
        </View>

        <View style={[styles.insignias, { borderTopColor: colors.border }]}>
          <View style={styles.insigniaFila}>
            <ShieldCheck size={17} color={colors.stamp} strokeWidth={2.2} />
            <Text style={[styles.insigniaTexto, { color: colors.ink }]}>Pago protegido hasta terminar el trabajo</Text>
          </View>
          <View style={styles.insigniaFila}>
            <BadgeCheck size={17} color={colors.stamp} strokeWidth={2.2} />
            <Text style={[styles.insigniaTexto, { color: colors.ink }]}>Prestadores verificados</Text>
          </View>
        </View>

        <BotonPrincipal texto="Crear cuenta gratis" onPress={() => router.push("/login")} colors={colors} />

        <Pressable
          onPress={() => router.push("/login")}
          style={[styles.botonSecundario, { borderColor: colors.border }]}
        >
          <Text style={[styles.botonSecundarioTexto, { color: colors.ink }]}>Ver rubros disponibles</Text>
        </Pressable>

        <Pressable onPress={() => router.push("/login")} hitSlop={8}>
          <Text style={[styles.linkLogin, { color: colors.inkMuted }]}>
            ¿Ya tenés cuenta? <Text style={{ color: colors.copper, fontWeight: "700" }}>Iniciar sesión</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1 },

  bandaOscura: { position: "relative", overflow: "hidden", paddingHorizontal: 28, paddingBottom: 30 },

  marca: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 26 },
  logoBox: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  marcaTexto: { fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },

  eyebrowFila: { flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 18, marginBottom: 12 },
  eyebrow: { fontSize: 11, letterSpacing: 1.4, fontWeight: "700" },
  cursor: { width: 1.5, height: 12, marginLeft: 2 },

  titulo: { fontSize: 26, lineHeight: 32, fontWeight: "700", letterSpacing: -0.4, textAlign: "center" },

  hojaClara: {
    flex: 1,
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 8,
    flexDirection: "column",
  },

  espacioPasos: { flex: 1, justifyContent: "center" },
  pasosContenedor: { minHeight: 92 },
  paso: { flexDirection: "row", alignItems: "center", gap: 14 },
  pasoIcono: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  pasoTexto: { flex: 1 },
  pasoEtiqueta: { fontSize: 10.5, letterSpacing: 1, fontWeight: "700", marginBottom: 4, textTransform: "uppercase" },
  pasoDescripcion: { fontSize: 14.5, fontWeight: "600", lineHeight: 19 },
  puntosFila: { flexDirection: "row", justifyContent: "center", gap: 7, marginTop: 16 },
  punto: { height: 6, borderRadius: 3 },

  insignias: { gap: 12, paddingVertical: 16, borderTopWidth: 1, marginBottom: 16 },
  insigniaFila: { flexDirection: "row", alignItems: "center", gap: 10 },
  insigniaTexto: { fontSize: 13, fontWeight: "500" },

  botonPrincipal: { borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: 10, overflow: "hidden" },
  botonRecorte: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  brillo: { position: "absolute", top: 0, bottom: 0, width: 70, backgroundColor: "rgba(255,255,255,0.28)" },
  botonPrincipalTexto: { color: "#FFF8F0", fontSize: 15, fontWeight: "600" },

  botonSecundario: { borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1.5, marginBottom: 14 },
  botonSecundarioTexto: { fontSize: 14, fontWeight: "600" },

  linkLogin: { textAlign: "center", fontSize: 12.5 },
});
