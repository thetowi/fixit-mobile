// Mismos tokens de marca que fixit-web/app/globals.css (:root y .dark) — mismos valores exactos,
// para que la app se sienta como la misma marca. Import: `import { Colors } from "@/constants/colors"`.
export const Colors = {
  light: {
    paper: "#EFEEE6",
    ink: "#1B1B18",
    surface: "#FFFFFF",
    nav: "#1B1B18",
    onNav: "#EFEEE6",
    copper: "#B5651D",
    copperDark: "#8F4F16",
    safety: "#F0A202",
    stamp: "#177762",
    // 26/10: gris sólido que pasa WCAG AA sobre papel (antes rgba .5 daba ~3,4:1). Mismo valor que
    // --ink-muted de fixit-web.
    inkMuted: "#625F57",
    border: "rgba(27,27,24,0.1)",
    // Roles de texto del audit de contraste (26/10, espejo de fixit-web/app/globals.css):
    // copperText = cobre para texto chico sobre papel; copperAccion = fondo de botón con texto claro;
    // safetyText = amarillo para texto de aviso (el --safety puro da 1,8:1 sobre papel);
    // onSafety = texto sobre botones amarillos (siempre oscuro, en los dos modos).
    copperText: "#9A5418",
    copperAccion: "#A05818",
    safetyText: "#855700",
    onSafety: "#1B1B18",
  },
  dark: {
    paper: "#15130F",
    ink: "#EDE7DC",
    surface: "#211D17",
    nav: "#100E0B",
    onNav: "#EFEEE6",
    copper: "#D08A44",
    copperDark: "#E6A868",
    safety: "#F4B22E",
    stamp: "#2DC2A0",
    inkMuted: "#9C9588",
    border: "rgba(237,231,220,0.12)",
    copperText: "#D08A44",
    copperAccion: "#D08A44",
    safetyText: "#F4B22E",
    onSafety: "#1B1B18",
  },
} as const;

export type ThemeColors = typeof Colors.light;
