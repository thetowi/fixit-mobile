import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Orden } from "@/types/ordenes";
import { useFixitColors } from "@/hooks/use-fixit-colors";

// Espejo de fixit-web/components/OrdenTicket.tsx (la tarjeta estilo "ticket" de una orden).
export const ESTADO_LABELS: Record<string, string> = {
  PendientePago: "Pendiente de pago",
  Pagado: "Pagado",
  EnCurso: "En curso",
  Completado: "Completado",
  Cancelado: "Cancelado",
  EnDisputa: "En disputa",
};

function colorEstado(estado: string, colors: ReturnType<typeof useFixitColors>): string {
  switch (estado) {
    case "Pagado":
      return colors.copper;
    case "EnCurso":
      return colors.safety;
    case "Completado":
      return colors.stamp;
    default:
      return colors.inkMuted;
  }
}

function formatearFecha(fechaISO: string): string {
  return new Date(fechaISO).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

export default function OrdenTicket({
  orden,
  nombreContraparte,
  children,
}: {
  orden: Orden;
  nombreContraparte: string;
  children?: ReactNode;
}) {
  const colors = useFixitColors();
  const colorClase = colorEstado(orden.estado, colors);

  return (
    <View style={[styles.tarjeta, { backgroundColor: colors.paper, borderColor: colors.border }]}>
      <View style={[styles.badge, { borderColor: colorClase }]}>
        <Text style={[styles.badgeTexto, { color: colorClase }]}>
          {(ESTADO_LABELS[orden.estado] ?? orden.estado).toUpperCase()}
        </Text>
      </View>

      <Text style={[styles.numero, { color: colors.inkMuted }]}>
        ORDEN #{orden.id.slice(0, 8).toUpperCase()} · {formatearFecha(orden.creadoEn)}
      </Text>
      <Text style={[styles.descripcion, { color: colors.ink }]} numberOfLines={2}>
        {orden.descripcion || orden.categoriaNombre}
      </Text>
      <Text style={[styles.subtitulo, { color: colors.inkMuted }]}>
        {orden.categoriaNombre} · Con {nombreContraparte}
      </Text>

      <View style={styles.filaInferior}>
        <Text style={[styles.monto, { color: colors.ink }]}>${orden.montoTotal.toLocaleString("es-AR")}</Text>
        {/* El chat completo todavía no está construido en mobile (próxima etapa) — cuando lo esté,
            esto navega a /conversaciones/[id] igual que en la web. */}
        <Text style={{ color: colors.inkMuted, fontSize: 11 }}>Chat: pestaña Mensajes</Text>
      </View>

      {children && <View style={[styles.hijos, { borderTopColor: colors.border }]}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderRadius: 12, padding: 14, position: "relative" },
  badge: {
    position: "absolute",
    top: 10,
    right: 12,
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeTexto: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  numero: { fontSize: 10, marginBottom: 4 },
  descripcion: { fontSize: 14, fontWeight: "600", paddingRight: 90 },
  subtitulo: { fontSize: 12, marginTop: 2, marginBottom: 10 },
  filaInferior: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monto: { fontSize: 13, fontWeight: "600" },
  hijos: { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
});
