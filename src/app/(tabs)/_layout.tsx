import { Tabs } from "expo-router";
import { useEffect, useRef, type ReactElement } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { CalendarDays, ClipboardList, Home, MessageCircle, Search, User } from "lucide-react-native";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { useAuth } from "@/lib/authContext";
import { useConteoNoLeidos } from "@/lib/conteoNoLeidosContext";

// Ícono y título de cada pestaña "normal" (todas menos Mensajes, que tiene su propio diseño fijo,
// ver más abajo). Un solo lugar para no repetir el mapeo dentro de BarraDePestañas.
// NOTA (21/09): el ícono/título de "inicio" se reutilizan tal cual para el Cliente — la pantalla
// inicio.tsx ahora rama por rol (ver ese archivo), pero la pestaña en sí es la misma para los dos.
const ICONOS: Record<string, (props: { color: string; size: number }) => ReactElement> = {
  inicio: ({ color, size }) => <Home color={color} size={size} />,
  agenda: ({ color, size }) => <CalendarDays color={color} size={size} />,
  index: ({ color, size }) => <Search color={color} size={size} />,
  ordenes: ({ color, size }) => <ClipboardList color={color} size={size} />,
  cuenta: ({ color, size }) => <User color={color} size={size} />,
};

const TITULOS: Record<string, string> = {
  inicio: "Inicio",
  agenda: "Agenda",
  index: "Explorar",
  ordenes: "Órdenes",
  cuenta: "Cuenta",
};

type Colors = ReturnType<typeof useFixitColors>;

// Botón de Mensajes, con la animación "Resorte" elegida por el usuario a partir de 3 opciones que
// se probaron en un mockup (21/09): al ganar el foco, el círculo se agranda con un rebote elástico
// (spring con overshoot, no una interpolación lineal) y el ícono hace un tirabuzón corto una sola
// vez. Antes este círculo cambiaba de tamaño/color de golpe (sin animación) porque estaba armado
// con estilos condicionales sobre `focused` directamente — acá se separa en su propio componente
// para poder guardar los Animated.Value en un useRef que sobrevive entre renders (si viviera adentro
// del .map de BarraDePestañas, se recrearía de cero en cada render y no se podría animar nada).
function BotonMensajes({
  focused,
  colors,
  noLeidos,
  textoNoLeidos,
  onPress,
  onLongPress,
}: {
  focused: boolean;
  colors: Colors;
  noLeidos: number;
  textoNoLeidos: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  // "foco" maneja todo lo que crece/cambia de color al enfocarse (tamaño, posición, borde, sombra);
  // "tirabuzon" es aparte porque solo se dispara UNA VEZ al ganar el foco, no de ida y vuelta.
  const foco = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const tirabuzon = useRef(new Animated.Value(0)).current;
  const focoAnteriorRef = useRef(focused);

  useEffect(() => {
    // useNativeDriver: false porque acá se interpolan backgroundColor/top/borderWidth/sombra, que
    // el driver nativo no soporta — es un ícono chico en una barra, no hace falta más.
    Animated.spring(foco, {
      toValue: focused ? 1 : 0,
      friction: 5,
      tension: 140,
      useNativeDriver: false,
    }).start();

    if (focused && !focoAnteriorRef.current) {
      tirabuzon.setValue(0);
      Animated.sequence([
        Animated.timing(tirabuzon, { toValue: 1, duration: 130, useNativeDriver: true }),
        Animated.timing(tirabuzon, { toValue: -1, duration: 130, useNativeDriver: true }),
        Animated.timing(tirabuzon, { toValue: 0, duration: 130, useNativeDriver: true }),
      ]).start();
    }
    focoAnteriorRef.current = focused;
  }, [focused, foco, tirabuzon]);

  const escala = foco.interpolate({ inputRange: [0, 1], outputRange: [1, 58 / 54] });
  const top = foco.interpolate({ inputRange: [0, 1], outputRange: [-26, -28], extrapolate: "clamp" });
  const fondo = foco.interpolate({ inputRange: [0, 1], outputRange: [colors.copper, colors.copperDark], extrapolate: "clamp" });
  const anchoBorde = foco.interpolate({ inputRange: [0, 1], outputRange: [4, 3], extrapolate: "clamp" });
  const sombraOpacidad = foco.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.45], extrapolate: "clamp" });
  const sombraRadio = foco.interpolate({ inputRange: [0, 1], outputRange: [10, 12], extrapolate: "clamp" });
  const rotacion = tirabuzon.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-12deg", "0deg", "12deg"] });

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={{ flex: 1, alignItems: "center" }}>
      <View style={{ height: 28 }} />
      <Animated.View
        style={{
          position: "absolute",
          top,
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: fondo,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: anchoBorde,
          borderColor: colors.paper,
          shadowColor: "#000",
          shadowOpacity: sombraOpacidad,
          shadowRadius: sombraRadio,
          shadowOffset: { width: 0, height: 4 },
          elevation: focused ? 8 : 6,
          transform: [{ scale: escala }],
        }}
      >
        <Animated.View style={{ transform: [{ rotate: rotacion }] }}>
          <MessageCircle color="#FFFFFF" size={23} strokeWidth={2.3} />
        </Animated.View>

        {noLeidos > 0 && (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -6,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              paddingHorizontal: 4,
              backgroundColor: "#E5484D",
              borderWidth: 2,
              borderColor: colors.paper,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>{textoNoLeidos}</Text>
          </View>
        )}
      </Animated.View>
      <Text style={{ fontSize: 10.5, fontWeight: "700", color: colors.onNav, marginTop: 2 }}>Mensajes</Text>
    </Pressable>
  );
}

// Barra de pestañas armada a mano, en vez de dejar que @react-navigation/bottom-tabs dibuje cada
// ítem solo a partir de tabBarActiveTintColor/tabBarInactiveTintColor/tabBarIcon por pantalla.
//
// Motivo (bug real encontrado el 20/09, reportado por el usuario con capturas): con la
// implementación anterior (tinte activo/inactivo definido por Tabs.Screen + el círculo de
// Mensajes elevado con marginTop negativo), al pararse en "Órdenes" o en "Cuenta" las DOS quedaban
// pintadas de color activo (naranja) a la vez, no solo la que estaba realmente enfocada; y al
// pararse en "Mensajes", los íconos de Agenda/Órdenes/Cuenta directamente desaparecían de la
// barra. La sospecha es la combinación de: (a) un marginTop negativo en un ítem SÍ participa del
// cálculo de flexbox de toda la fila (no es lo mismo que sacarlo del flujo), y (b) una pestaña
// oculta en el medio del array (Explorar, oculta para el Prestador) — juntas, en algunos
// re-renders el motor de layout (Yoga) parece calcular mal el alto/ancho de los ítems hermanos.
//
// La forma robusta de evitar esto es no depender de esas opciones "mágicas" por pantalla: acá se
// recorre `state.routes` a mano, se calcula el foco de cada pestaña comparando directamente contra
// `state.index` (sin intermediarios), y el círculo de Mensajes se dibuja con `position: absolute`
// dentro de su propio ítem — así queda completamente afuera del flujo normal y nunca puede afectar
// el tamaño calculado de sus hermanos, a diferencia del marginTop negativo de antes.
function BarraDePestañas({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useFixitColors();
  const noLeidos = useConteoNoLeidos();
  // "9+" a partir de 10 (a pedido del usuario, 21/09) — un círculo chico no tiene lugar para números
  // de 3 dígitos sin deformarse, y a esa altura el número exacto importa menos que el "tenés bastante
  // sin leer".
  const textoNoLeidos = noLeidos > 9 ? "9+" : String(noLeidos);
  // Fix visual (22/09, reportado por el usuario con captura): la barra quedaba tapada por la barra
  // de navegación propia del celular (los 3 botones o la barra de gestos de Android) porque el
  // paddingBottom de acá era un número fijo (14) pensado para un celular sin esa barra ocupando
  // espacio propio. `insets.bottom` es 0 en los celulares que no tienen barra de sistema superpuesta
  // (ahí manda el paddingBottom fijo de siempre), y el alto real de esa barra en los que sí la
  // tienen — con Math.max nunca queda MENOS aire del que ya había, solo más cuando hace falta.
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        backgroundColor: colors.nav,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 14),
        paddingHorizontal: 4,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const oculta = (options.tabBarItemStyle as { display?: string } | undefined)?.display === "none";
        if (oculta) return null;

        const focused = state.index === index;

        const onPress = () => {
          const evento = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !evento.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };
        const onLongPress = () => {
          navigation.emit({ type: "tabLongPress", target: route.key });
        };

        if (route.name === "mensajes") {
          // Mensajes queda siempre destacado (círculo naranja elevado por encima de la barra),
          // sin importar si está seleccionado o no — mockup aprobado por el usuario (20/09) en el
          // Artifact de diseño. `position: absolute` en vez de marginTop negativo, ver comentario
          // de arriba sobre el bug que esto reemplaza.
          //
          // Estado "parado acá" (20/09, a pedido del usuario): como el círculo siempre se ve
          // igual de destacado, hacía falta alguna señal extra para notar que ya estás en
          // Mensajes (antes no había ninguna diferencia visual entre estar ahí o no). Al estar
          // enfocado: el círculo se agranda un poco (58px en vez de 54) y pasa a `copperDark` (el
          // tono más oscuro ya definido en la paleta de marca para estados así), con más sombra
          // para reforzar la sensación de "presionado hacia arriba". El anillo del color de fondo
          // se angosta un poco (3px en vez de 4) para que el círculo más grande no se coma tanto
          // espacio del ítem vecino.
          return (
            <BotonMensajes
              key={route.key}
              focused={focused}
              colors={colors}
              noLeidos={noLeidos}
              textoNoLeidos={textoNoLeidos}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        }

        const color = focused ? colors.copper : `${colors.onNav}B3`;
        const Icono = ICONOS[route.name];

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            style={{ flex: 1, alignItems: "center", gap: 3 }}
          >
            {Icono?.({ color, size: 22 })}
            <Text style={{ fontSize: 10.5, fontWeight: focused ? "700" : "600", color }}>
              {TITULOS[route.name] ?? route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Pestañas principales, solo accesibles con sesión iniciada (ver el guard en app/_layout.tsx).
// "Inicio" (21/09: ahora para los DOS roles, ver inicio.tsx) muestra el resumen de trabajos de la
// semana/mes al Prestador, y a un Cliente un atajo para buscar un servicio nuevo + volver a
// contratar a un prestador anterior — por eso ya no se oculta para ningún rol.
// "Agenda" solo tiene sentido para el rol Prestador (espejo de la restricción de
// fixit-web/app/prestador/agenda/page.tsx que redirige a /cuenta si el usuario es Cliente) — acá,
// en vez de redirigir, directamente se oculta la pestaña.
// "Explorar" es al revés: solo tiene sentido para el rol Cliente (un prestador no explora/contrata
// servicios, los ofrece) — mismo espejo de la web, que ya sacó "Explorar" del Navbar del prestador
// (ver backlog, reorganización del 19/09). Se oculta con el mismo patrón que Agenda en vez de
// borrar el archivo, porque el Cliente sigue necesitando esa pantalla.
//
// El orden de declaración de abajo (inicio, agenda, index, mensajes, ordenes, cuenta) da, una vez
// ocultas las que no aplican a cada rol, el orden visual pedido por el usuario (20/09 y 21/09):
// Prestador -> Inicio, Agenda, Mensajes, Órdenes, Cuenta. Cliente -> Inicio, Explorar, Mensajes,
// Órdenes, Cuenta. El orden de la barra sale directo del orden de declaración de abajo, ya que
// BarraDePestañas recorre `state.routes` en ese mismo orden.
//
// initialRouteName (21/09): ahora "inicio" para los DOS roles — ya que src/app/index.tsx redirige
// siempre a "/(tabs)/inicio" con un href explícito, este prop en la práctica solo importa si algún
// día se navega a "/(tabs)" a secas; se deja igual de todos modos por consistencia.
//
// Panel de Admin queda para más adelante (se puede seguir usando la web para eso mientras tanto).
export default function TabsLayout() {
  const { usuario } = useAuth();
  const esPrestador = usuario?.rol === "Prestador";

  return (
    <Tabs
      initialRouteName="inicio"
      tabBar={(props) => <BarraDePestañas {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="inicio" />
      <Tabs.Screen name="agenda" options={esPrestador ? {} : { tabBarItemStyle: { display: "none" } }} />
      <Tabs.Screen name="index" options={esPrestador ? { tabBarItemStyle: { display: "none" } } : {}} />
      <Tabs.Screen name="mensajes" />
      <Tabs.Screen name="ordenes" />
      <Tabs.Screen name="cuenta" />
    </Tabs>
  );
}
