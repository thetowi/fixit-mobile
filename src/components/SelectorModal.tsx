import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useFixitColors } from "@/hooks/use-fixit-colors";

// Reemplazo mínimo del <select> nativo del navegador (no existe un equivalente directo en RN):
// un botón que abre un modal con la lista de opciones. Se usa tanto para los filtros de
// "Mis órdenes" como para elegir categoría/día en Mi cuenta.
export interface OpcionSelector {
  value: string;
  label: string;
}

export default function SelectorModal({
  visible,
  opciones,
  valorActual,
  onSeleccionar,
  onCerrar,
  titulo,
}: {
  visible: boolean;
  opciones: OpcionSelector[];
  valorActual: string;
  onSeleccionar: (value: string) => void;
  onCerrar: () => void;
  titulo: string;
}) {
  const colors = useFixitColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={styles.fondo} onPress={onCerrar}>
        <Pressable style={[styles.hoja, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.titulo, { color: colors.ink }]}>{titulo}</Text>
          <FlatList
            data={opciones}
            keyExtractor={(o) => o.value}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSeleccionar(item.value);
                  onCerrar();
                }}
                style={[styles.opcion, { borderBottomColor: colors.border }]}
              >
                <Text style={{ color: item.value === valorActual ? colors.copper : colors.ink, fontWeight: item.value === valorActual ? "700" : "400" }}>
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function BotonSelector({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const colors = useFixitColors();
  return (
    <Pressable onPress={onPress} style={[styles.boton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={{ color: colors.ink, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  hoja: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 32 },
  titulo: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  opcion: { paddingVertical: 12, borderBottomWidth: 1 },
  boton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
});
