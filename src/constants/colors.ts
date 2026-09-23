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
    inkMuted: "rgba(27,27,24,0.5)",
    border: "rgba(27,27,24,0.1)",
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
    inkMuted: "rgba(237,231,220,0.5)",
    border: "rgba(237,231,220,0.12)",
  },
} as const;

export type ThemeColors = typeof Colors.light;
