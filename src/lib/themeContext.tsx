import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";

// Toggle manual de tema (03/10, a pedido del usuario: "quiero que este en Cuenta ese toggle") —
// espejo del comportamiento de fixit-web/lib/theme.ts + ThemeToggle.tsx, adaptado: la web guarda
// la elección en localStorage, aquí se guarda en SecureStore (ya se usa para el token de sesión,
// ver lib/api.ts) para no agregar una dependencia nueva solo para esto.
//
// Hasta ahora toda la app seguía el modo claro/oscuro del sistema operativo directo (useColorScheme
// en useFixitColors, sin paso intermedio) — no había manera de elegirlo DENTRO de la app. Este
// contexto agrega esa capa: mientras el usuario no haya tocado el toggle, se sigue reflejando el
// tema del sistema en vivo (igual que antes); apenas lo toca una vez, esa elección queda guardada y
// manda por sobre el sistema en los próximos inicios, hasta que lo vuelva a cambiar.
export type Tema = "claro" | "oscuro";

const CLAVE_TEMA = "fixit_tema_manual";

interface ThemeContextValue {
  tema: Tema;
  alternarTema: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const temaSistema = useColorScheme();
  // null = todavía sigue al sistema (ninguna elección manual guardada o cargada aún).
  const [eleccionManual, setEleccionManual] = useState<Tema | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(CLAVE_TEMA).then((guardado) => {
      if (guardado === "claro" || guardado === "oscuro") setEleccionManual(guardado);
    });
  }, []);

  const tema: Tema = eleccionManual ?? (temaSistema === "dark" ? "oscuro" : "claro");

  function alternarTema() {
    const nuevo: Tema = tema === "oscuro" ? "claro" : "oscuro";
    setEleccionManual(nuevo);
    SecureStore.setItemAsync(CLAVE_TEMA, nuevo);
  }

  return <ThemeContext.Provider value={{ tema, alternarTema }}>{children}</ThemeContext.Provider>;
}

export function useTema(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTema debe usarse dentro de <ThemeProvider>");
  return ctx;
}
