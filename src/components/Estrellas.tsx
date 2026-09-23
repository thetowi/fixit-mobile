import { Text, TextStyle } from "react-native";

// Espejo de fixit-web/components/Estrellas.tsx — estrellas de solo lectura (no interactivas, a
// diferencia de SelectorEstrellas que sí se puede tocar). Mismo truco que la web: un string de
// caracteres ★/☆ en vez de armar 5 ícono por separado.
export default function Estrellas({
  valor,
  tamaño = 15,
  style,
}: {
  valor: number;
  tamaño?: number;
  style?: TextStyle;
}) {
  const llenas = Math.round(valor);
  return (
    <Text style={[{ color: "#EAB308", fontSize: tamaño }, style]}>
      {"★".repeat(llenas)}
      {"☆".repeat(5 - llenas)}
    </Text>
  );
}
