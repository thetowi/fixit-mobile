import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { apiFetch, ApiError } from "@/lib/api";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { AgregarBloqueRequest, BloqueDisponibilidad } from "@/types/agenda";
import SelectorModal, { BotonSelector } from "@/components/SelectorModal";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function horaATexto(fecha: Date): string {
  return fecha.toTimeString().slice(0, 5);
}

// Espejo de la sección "Horarios en los que trabajo" de fixit-web/app/cuenta/page.tsx.
export default function HorariosSeccion() {
  const colors = useFixitColors();
  const [bloques, setBloques] = useState<BloqueDisponibilidad[]>([]);
  const [diaNuevo, setDiaNuevo] = useState(1);
  const [horaInicio, setHoraInicio] = useState(new Date(2000, 0, 1, 9, 0));
  const [horaFin, setHoraFin] = useState(new Date(2000, 0, 1, 18, 0));
  const [mostrarPickerInicio, setMostrarPickerInicio] = useState(false);
  const [mostrarPickerFin, setMostrarPickerFin] = useState(false);
  const [modalDiaAbierto, setModalDiaAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    try {
      const data = await apiFetch<BloqueDisponibilidad[]>("/api/prestador/disponibilidad");
      setBloques(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar tus horarios");
    }
  }

  async function handleAgregar() {
    setError(null);
    const body: AgregarBloqueRequest = {
      diaSemana: diaNuevo,
      horaInicio: `${horaATexto(horaInicio)}:00`,
      horaFin: `${horaATexto(horaFin)}:00`,
    };
    try {
      await apiFetch("/api/prestador/disponibilidad", { method: "POST", body: JSON.stringify(body) });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al agregar el bloque");
    }
  }

  async function handleQuitar(id: number) {
    try {
      await apiFetch(`/api/prestador/disponibilidad/${id}`, { method: "DELETE" });
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al quitar el bloque");
    }
  }

  return (
    <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.titulo, { color: colors.ink }]}>Horarios en los que trabajo</Text>
      <Text style={{ color: colors.inkMuted, fontSize: 12, marginBottom: 12 }}>
        Definí los días y horarios en los que estás disponible — esto es lo que usa tu agenda.
      </Text>

      <View style={{ gap: 8, marginBottom: 14 }}>
        {bloques.length === 0 && <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Todavía no cargaste tus horarios.</Text>}
        {bloques.map((b) => (
          <View key={b.id} style={[styles.filaBloque, { backgroundColor: colors.paper }]}>
            <Text style={{ color: colors.ink, fontSize: 13 }}>
              {DIAS[b.diaSemana]} · {b.horaInicio.slice(0, 5)} a {b.horaFin.slice(0, 5)}
            </Text>
            <Pressable onPress={() => handleQuitar(b.id)}>
              <Text style={{ color: "#C0392B", fontSize: 12 }}>Quitar</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.filaForm}>
        <BotonSelector label={DIAS[diaNuevo]} onPress={() => setModalDiaAbierto(true)} />
        <BotonSelector label={`Desde ${horaATexto(horaInicio)}`} onPress={() => setMostrarPickerInicio(true)} />
        <BotonSelector label={`Hasta ${horaATexto(horaFin)}`} onPress={() => setMostrarPickerFin(true)} />
      </View>

      <SelectorModal
        visible={modalDiaAbierto}
        opciones={DIAS.map((d, i) => ({ value: String(i), label: d }))}
        valorActual={String(diaNuevo)}
        onSeleccionar={(v) => setDiaNuevo(Number(v))}
        onCerrar={() => setModalDiaAbierto(false)}
        titulo="Elegí el día"
      />

      {mostrarPickerInicio && (
        <DateTimePicker
          value={horaInicio}
          mode="time"
          is24Hour
          onChange={(_, fecha) => {
            setMostrarPickerInicio(false);
            if (fecha) setHoraInicio(fecha);
          }}
        />
      )}
      {mostrarPickerFin && (
        <DateTimePicker
          value={horaFin}
          mode="time"
          is24Hour
          onChange={(_, fecha) => {
            setMostrarPickerFin(false);
            if (fecha) setHoraFin(fecha);
          }}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable onPress={handleAgregar} style={[styles.boton, { backgroundColor: colors.copper }]}>
        <Text style={{ color: colors.paper, fontWeight: "600" }}>Agregar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderRadius: 12, padding: 16 },
  titulo: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  filaBloque: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 8, padding: 10 },
  filaForm: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  error: { color: "#C0392B", fontSize: 12, marginTop: 10 },
  boton: { marginTop: 12, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
});
