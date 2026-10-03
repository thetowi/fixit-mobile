import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View, Text } from "react-native";

// Espejo de fixit-web/components/InsigniaVerificado.tsx (03/10, actualizado — la versión anterior
// de este archivo usaba el logo viejo del engranaje+check y no tenía ninguno de los efectos que ya
// tiene la web desde el 27/09-01/10: la "placa de bronce" con brillo para el modo con texto, y el
// destello diagonal para el ícono solo). Mismo PNG que la web (assets/images/insignia-verificado.png,
// actualizado en este cambio — antes tenía el ícono viejo).
//
// La web logra el degradé y los 3 brillos orbitando con CSS puro (gradients, mix-blend-mode,
// mask-image) — en React Native no hay equivalente directo, así que esto es una adaptación fiel
// al espíritu (placa de bronce + un destello diagonal animado que cruza una vez cada unos segundos)
// en vez de una réplica pixel a pixel.
//
// Primer intento (03/10): el degradé de la placa se armó con react-native-svg (<Svg
// width="100%" height="100%">...) — reportado roto por el usuario: la cápsula se estiraba a todo
// el ancho de la pantalla, tapando el nombre. Causa: un <Svg> con ancho/alto en porcentaje dentro
// de una View cuyo propio ancho depende de su contenido (fila flex, sin ancho fijo) crea una
// dependencia circular de layout que RN no resuelve bien. Se reemplazó por un fondo de color
// sólido (sin medidas en porcentaje), que se dimensiona con normalidad según su contenido.
const LOGO_SRC = require("@/assets/images/insignia-verificado.png");

// Dispara un barrido (de -1 a 1) cada `periodoMs`, con una pausa apagada entre pases — igual
// criterio que el "destello diagonal" de la web: "que solo pase el brillo, que no se quede".
function useDestelloLoop(periodoMs: number, duracionMs: number) {
  const progreso = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    let activo = true;
    function ciclo() {
      if (!activo) return;
      progreso.setValue(-1);
      Animated.sequence([
        Animated.delay(periodoMs),
        Animated.timing(progreso, {
          toValue: 1,
          duration: duracionMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false, // anima `left`, no un transform
        }),
      ]).start(() => ciclo());
    }
    ciclo();
    return () => {
      activo = false;
    };
  }, [periodoMs, duracionMs]);

  return progreso;
}

export default function InsigniaVerificado({ size = 16, conTexto = false }: { size?: number; conTexto?: boolean }) {
  const progreso = useDestelloLoop(4500, 850);

  if (!conTexto) {
    const anchoDestello = size * 0.6;
    const izquierda = progreso.interpolate({
      inputRange: [-1, 1],
      outputRange: [-size * 1.4, size * 1.4],
    });

    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
        <Image source={LOGO_SRC} style={{ width: size, height: size }} resizeMode="contain" />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.destello,
            {
              width: anchoDestello,
              height: size * 2.2,
              top: -size * 0.6,
              left: izquierda,
              transform: [{ rotate: "20deg" }],
            },
          ]}
        />
      </View>
    );
  }

  const alturaCapsula = size + 16;
  const izquierdaCapsula = progreso.interpolate({
    inputRange: [-1, 1],
    outputRange: [-60, 260],
  });

  return (
    <View
      style={[
        styles.capsula,
        { height: alturaCapsula, borderRadius: alturaCapsula / 2, backgroundColor: "#8b4a1f", borderColor: "#572709" },
      ]}
    >
      <View
        style={[
          styles.circuloIcono,
          { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, backgroundColor: "#fff6df" },
        ]}
      >
        <Image source={LOGO_SRC} style={{ width: size, height: size }} resizeMode="contain" />
      </View>

      <Text style={styles.texto}>Verificado</Text>

      <Animated.View pointerEvents="none" style={[styles.destelloCapsula, { left: izquierdaCapsula }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  capsula: {
    flexDirection: "row",
    alignItems: "center",
    // "center" en vez de "flex-start" (03/10) — con el único uso de conTexto ahora en una columna
    // centrada debajo del nombre (/prestador/[id]), "flex-start" la pegaba contra el borde
    // izquierdo en vez de quedar centrada bajo el nombre.
    alignSelf: "center",
    gap: 7,
    paddingLeft: 4,
    paddingRight: 12,
    overflow: "hidden",
    borderWidth: 1,
  },
  circuloIcono: { alignItems: "center", justifyContent: "center", zIndex: 2 },
  texto: {
    color: "#fff6df",
    fontWeight: "800",
    fontSize: 13.5,
    letterSpacing: -0.2,
    zIndex: 2,
    textShadowColor: "rgba(45,13,2,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  destello: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  destelloCapsula: {
    position: "absolute",
    top: -40,
    width: 28,
    height: 140,
    backgroundColor: "rgba(255,246,214,0.5)",
    transform: [{ rotate: "20deg" }],
  },
});
