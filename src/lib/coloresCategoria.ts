// Espejo exacto de fixit-web/lib/coloresCategoria.ts: color estable por rubro para los
// chips/franjas de la agenda (mismo rubro => siempre el mismo color, sin guardar un color por
// categoría en la base). Pura lógica, no depende de nada de React Native.
const PALETA = ["#B5651D", "#177762", "#F0A202"];

export function colorCategoria(nombreCategoria: string): string {
  let hash = 0;
  for (let i = 0; i < nombreCategoria.length; i++) {
    hash = (hash * 31 + nombreCategoria.charCodeAt(i)) >>> 0;
  }
  return PALETA[hash % PALETA.length];
}
