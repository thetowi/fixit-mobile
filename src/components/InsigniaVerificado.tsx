import { Image, StyleSheet, Text, View } from "react-native";
import { useFixitColors } from "@/hooks/use-fixit-colors";

// Espejo de fixit-web/components/InsigniaVerificado.tsx — misma imagen real (el logo que mandó el
// usuario, un engranaje con un check) en vez de un ícono de lucide genérico, para que la insignia
// se vea idéntica entre mobile y web. Un solo componente para que un cambio de diseño futuro se
// haga en un solo lugar, igual que en la web.
export default function InsigniaVerificado({
  size = 16,
  conTexto = false,
}: {
  size?: number;
  conTexto?: boolean;
}) {
  const colors = useFixitColors();

  return (
    <View style={styles.contenedor}>
      <Image
        source={require("@/assets/images/insignia-verificado.png")}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      {conTexto && <Text style={[styles.texto, { color: colors.stamp }]}>Verificado</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flexDirection: "row", alignItems: "center", gap: 4 },
  texto: { fontSize: 13, fontWeight: "600" },
});
