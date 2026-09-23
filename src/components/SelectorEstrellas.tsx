import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFixitColors } from "@/hooks/use-fixit-colors";

// Espejo de fixit-web/components/SelectorEstrellas.tsx, con Pressable/Text en vez de <button>.
export default function SelectorEstrellas({
  valor,
  onChange,
  tamaño = 20,
}: {
  valor: number;
  onChange: (valor: number) => void;
  tamaño?: number;
}) {
  const colors = useFixitColors();

  return (
    <View style={styles.fila}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={4}>
          <Text style={{ fontSize: tamaño, color: n <= valor ? colors.copper : colors.inkMuted, lineHeight: tamaño + 2 }}>
            ★
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: "row", gap: 2 },
});
