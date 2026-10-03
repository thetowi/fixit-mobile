import { useEffect, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";

// Contador animado (03/10, a pedido del usuario: "lo mismo que en fixit-web" — ver
// fixit-web/components/ContadorAnimado.tsx). Mismo ease-out cúbico de 0 al valor real con
// requestAnimationFrame (RN lo provee global, no hace falta ningún polyfill aparte). La versión
// web arranca con un IntersectionObserver porque la barra puede estar fuera de la vista inicial
// de una página larga; acá no hace falta ese paso — esta pantalla se abre entera de una, así que
// alcanza con arrancar la animación al montar el componente.
export default function ContadorAnimado({
  valor,
  duracionMs = 1500,
  formatear = (n: number) => n.toLocaleString("es-AR"),
  style,
}: {
  valor: number;
  duracionMs?: number;
  formatear?: (n: number) => string;
  style?: StyleProp<TextStyle>;
}) {
  const [mostrado, setMostrado] = useState(0);

  useEffect(() => {
    let cancelado = false;
    const inicio = performance.now();
    const desde = 0;
    const hasta = valor;

    function paso(ahora: number) {
      if (cancelado) return;
      const progreso = Math.min((ahora - inicio) / duracionMs, 1);
      const suavizado = 1 - Math.pow(1 - progreso, 3);
      setMostrado(Math.round(desde + (hasta - desde) * suavizado));
      if (progreso < 1) requestAnimationFrame(paso);
    }

    requestAnimationFrame(paso);
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return <Text style={style}>{formatear(mostrado)}</Text>;
}
