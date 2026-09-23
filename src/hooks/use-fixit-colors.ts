import { useColorScheme } from "react-native";
import { Colors, ThemeColors } from "@/constants/colors";

// Sigue el modo oscuro/claro del sistema operativo del celular directamente (no hay un toggle
// manual como en la web todavía) — es lo estándar en apps nativas: el usuario ya eligió su
// preferencia una vez, a nivel del teléfono entero.
export function useFixitColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? Colors.dark : Colors.light;
}
