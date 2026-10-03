import { Colors, ThemeColors } from "@/constants/colors";
import { useTema } from "@/lib/themeContext";

// Toggle manual agregado (03/10, ver lib/themeContext.tsx) — antes seguía useColorScheme() del
// sistema de forma directa. Ahora delega en el ThemeProvider: sigue al sistema en vivo hasta que
// el usuario elige algo manualmente en Mi cuenta, y a partir de ahí esa elección manda.
export function useFixitColors(): ThemeColors {
  const { tema } = useTema();
  return tema === "oscuro" ? Colors.dark : Colors.light;
}
