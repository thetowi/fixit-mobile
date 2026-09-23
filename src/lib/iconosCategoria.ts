import {
  Baby,
  BookOpen,
  Bug,
  Camera,
  Car,
  Drill,
  Droplet,
  Dumbbell,
  Fan,
  Flame,
  Hammer,
  HardHat,
  HeartPulse,
  Home,
  Key,
  Laptop,
  Leaf,
  Lightbulb,
  type LucideIcon,
  Music,
  Package,
  Paintbrush,
  Palette,
  PawPrint,
  Refrigerator,
  Ruler,
  Scissors,
  Shirt,
  Sparkles,
  SprayCan,
  Thermometer,
  Truck,
  Tv,
  WashingMachine,
  Wifi,
  Wind,
  Wrench,
  Zap,
} from "lucide-react-native";

// Espejo de fixit-web/lib/iconosCategoria.ts, mismas claves — vienen de la misma columna
// Categoria.Icono en la base, así que las claves tienen que coincidir exactamente entre los dos
// frontends. lucide-react-native expone los mismos nombres de ícono que lucide-react (misma
// librería, dos paquetes), solo cambia cómo se les pasa color/tamaño (acá son props normales de
// React Native, no className de Tailwind).
const MAPA_ICONOS: Record<string, LucideIcon> = {
  wrench: Wrench,
  droplet: Droplet,
  zap: Zap,
  lightbulb: Lightbulb,
  hammer: Hammer,
  "hard-hat": HardHat,
  drill: Drill,
  ruler: Ruler,
  flame: Flame,
  fan: Fan,
  wind: Wind,
  thermometer: Thermometer,
  paintbrush: Paintbrush,
  palette: Palette,
  "spray-can": SprayCan,
  sparkles: Sparkles,
  bug: Bug,
  leaf: Leaf,
  "paw-print": PawPrint,
  key: Key,
  home: Home,
  car: Car,
  truck: Truck,
  package: Package,
  tv: Tv,
  laptop: Laptop,
  wifi: Wifi,
  camera: Camera,
  refrigerator: Refrigerator,
  "washing-machine": WashingMachine,
  shirt: Shirt,
  scissors: Scissors,
  baby: Baby,
  "heart-pulse": HeartPulse,
  dumbbell: Dumbbell,
  "book-open": BookOpen,
  music: Music,
};

// Alias de claves viejas — mismo motivo que en la web (categorías creadas antes del selector de
// admin, ej. Pintura guardada con "brush").
const ALIAS: Record<string, string> = {
  brush: "paintbrush",
};

export function iconoCategoria(clave: string | null | undefined): LucideIcon {
  if (!clave) return Wrench;
  const normalizada = clave.toLowerCase();
  return MAPA_ICONOS[ALIAS[normalizada] ?? normalizada] ?? Wrench;
}
