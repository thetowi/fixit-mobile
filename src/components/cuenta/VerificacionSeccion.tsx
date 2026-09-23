import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { apiFetch, ApiError } from "@/lib/api";
import { apiUpload, ArchivoParaSubir } from "@/lib/apiUpload";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { VerificacionEstado } from "@/types/verificacion";

// Espejo de la sección "Verificación" de fixit-web/app/cuenta/page.tsx. Usa expo-document-picker
// (en vez de expo-image-picker) para los documentos porque la web acepta imagen O PDF para
// cada uno — document-picker cubre ambos tipos con el mismo selector nativo.
function CampoDocumento({
  label,
  archivo,
  onElegir,
}: {
  label: string;
  archivo: ArchivoParaSubir | null;
  onElegir: () => void;
}) {
  const colors = useFixitColors();
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: colors.inkMuted, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <View style={[styles.campoDoc, { borderColor: colors.border }]}>
        <Text style={{ color: archivo ? colors.ink : colors.inkMuted, fontSize: 12, flex: 1 }} numberOfLines={1}>
          {archivo ? archivo.name : "Ningún archivo seleccionado"}
        </Text>
        <Pressable onPress={onElegir}>
          <Text style={{ color: colors.copper, fontSize: 12 }}>{archivo ? "Cambiar" : "Elegir archivo"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

async function elegirDocumento(): Promise<ArchivoParaSubir | null> {
  const resultado = await DocumentPicker.getDocumentAsync({
    type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    copyToCacheDirectory: true,
  });
  if (resultado.canceled) return null;
  const asset = resultado.assets[0];
  return { uri: asset.uri, name: asset.name, type: asset.mimeType ?? "application/octet-stream" };
}

// Estado + colores del badge de una fila de matrícula (mismo criterio que la web).
function estiloEstado(estado: string, colors: ReturnType<typeof useFixitColors>) {
  if (estado === "Aprobado") return { bg: `${colors.stamp}26`, fg: colors.stamp };
  if (estado === "Pendiente") return { bg: `${colors.safety}33`, fg: colors.ink };
  if (estado === "Rechazado") return { bg: "#C0392B26", fg: "#C0392B" };
  return { bg: `${colors.ink}1A`, fg: colors.inkMuted };
}

export default function VerificacionSeccion() {
  const colors = useFixitColors();
  const [estado, setEstado] = useState<VerificacionEstado | null>(null);
  const [dniNumero, setDniNumero] = useState("");
  const [dniFoto, setDniFoto] = useState<ArchivoParaSubir | null>(null);
  const [antecedentes, setAntecedentes] = useState<ArchivoParaSubir | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Matrícula por rubro (22/09) — un archivo elegido y un "enviando" por cada PrestadorCategoria.
  const [archivosMatricula, setArchivosMatricula] = useState<Record<number, ArchivoParaSubir | null>>({});
  const [enviandoMatricula, setEnviandoMatricula] = useState<number | null>(null);
  const [errorMatricula, setErrorMatricula] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    try {
      const data = await apiFetch<VerificacionEstado>("/api/verificacion/mi-estado");
      setEstado(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar tu verificación");
    }
  }

  async function handleEnviar() {
    setError(null);
    if (!dniNumero.trim() || !dniFoto || !antecedentes) {
      setError("Completá el número de DNI y subí los dos documentos.");
      return;
    }
    setEnviando(true);
    try {
      await apiUpload("/api/verificacion", {
        dniNumero,
        dniFoto,
        antecedentes,
      });
      setDniFoto(null);
      setAntecedentes(null);
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al enviar la verificación");
    } finally {
      setEnviando(false);
    }
  }

  async function handleEnviarMatricula(prestadorCategoriaId: number) {
    setErrorMatricula(null);
    const matricula = archivosMatricula[prestadorCategoriaId];
    if (!matricula) {
      setErrorMatricula("Elegí el archivo de la matrícula antes de enviar.");
      return;
    }
    setEnviandoMatricula(prestadorCategoriaId);
    try {
      await apiUpload(`/api/verificacion/categoria/${prestadorCategoriaId}`, { matricula });
      setArchivosMatricula((prev) => ({ ...prev, [prestadorCategoriaId]: null }));
      await cargar();
    } catch (err) {
      setErrorMatricula(err instanceof ApiError ? err.message : "Error al enviar la matrícula");
    } finally {
      setEnviandoMatricula(null);
    }
  }

  if (!estado) {
    return (
      <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: "center" }]}>
        <ActivityIndicator color={colors.copper} />
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.titulo, { color: colors.ink }]}>Verificación de identidad</Text>
        <Text style={{ color: colors.inkMuted, fontSize: 12, marginBottom: 12 }}>
          Verificar tu identidad le muestra a los clientes que presentaste tu DNI y un certificado de
          antecedentes penales. Un admin revisa los documentos antes de aprobarlos. La matrícula se pide por
          separado, una vez por cada rubro que ofrezcas — ver más abajo.
        </Text>

        {estado.estado === "Aprobado" && (
          <View style={[styles.aviso, { borderColor: colors.stamp, backgroundColor: `${colors.stamp}15` }]}>
            <Text style={{ color: colors.ink, fontSize: 13 }}>✓ Tu identidad está verificada.</Text>
          </View>
        )}

        {estado.estado === "Pendiente" && (
          <View style={[styles.aviso, { borderColor: colors.copper, backgroundColor: `${colors.copper}15` }]}>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "600" }}>Verificación en revisión</Text>
            <Text style={{ color: colors.inkMuted, fontSize: 12, marginTop: 2 }}>
              Te avisamos apenas revisemos tus documentos.
            </Text>
          </View>
        )}

        {(estado.estado === "SinEnviar" || estado.estado === "Rechazado") && (
          <>
            {estado.estado === "Rechazado" && (
              <View style={[styles.aviso, { borderColor: "#C0392B", backgroundColor: "#C0392B15" }]}>
                <Text style={{ color: "#C0392B", fontSize: 13, fontWeight: "600" }}>Verificación rechazada</Text>
                {estado.motivoRechazo && <Text style={{ color: "#C0392B", fontSize: 12, marginTop: 2 }}>{estado.motivoRechazo}</Text>}
              </View>
            )}

            <Text style={{ color: colors.inkMuted, fontSize: 12, marginBottom: 4 }}>Número de DNI</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.ink }]}
              value={dniNumero}
              onChangeText={setDniNumero}
              keyboardType="numeric"
            />

            <CampoDocumento label="Foto del DNI (frente)" archivo={dniFoto} onElegir={async () => setDniFoto(await elegirDocumento())} />
            <CampoDocumento label="Certificado de antecedentes penales" archivo={antecedentes} onElegir={async () => setAntecedentes(await elegirDocumento())} />

            <Text style={{ color: colors.inkMuted, fontSize: 10 }}>Imagen o PDF, hasta 8 MB cada uno.</Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable onPress={handleEnviar} disabled={enviando} style={[styles.boton, { backgroundColor: colors.copper, opacity: enviando ? 0.6 : 1 }]}>
              {enviando ? <ActivityIndicator color={colors.paper} /> : <Text style={{ color: colors.paper, fontWeight: "600" }}>Enviar para revisión</Text>}
            </Pressable>
          </>
        )}
      </View>

      {/* Matrícula por rubro (22/09) — un envío independiente por cada PrestadorCategoria. */}
      <View style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.titulo, { color: colors.ink }]}>Matrícula por rubro</Text>
        <Text style={{ color: colors.inkMuted, fontSize: 12, marginBottom: 12 }}>
          Cada rubro que ofrecés necesita su propia matrícula (o comprobante equivalente) aprobada para
          aparecer en las búsquedas de esa categoría.
        </Text>

        {errorMatricula && <Text style={[styles.error, { marginBottom: 8 }]}>{errorMatricula}</Text>}

        {estado.categorias.length === 0 ? (
          <Text style={{ color: colors.inkMuted, fontSize: 13 }}>
            Todavía no cargaste ningún servicio — agregá uno en la pestaña &quot;Mis servicios&quot; para poder
            enviar su matrícula.
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {estado.categorias.map((vc) => {
              const { bg, fg } = estiloEstado(vc.estado, colors);
              const archivo = archivosMatricula[vc.prestadorCategoriaId] ?? null;
              return (
                <View key={vc.prestadorCategoriaId} style={[styles.filaMatricula, { backgroundColor: colors.paper }]}>
                  <View style={styles.filaTopMatricula}>
                    <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 13 }}>{vc.categoriaNombre}</Text>
                    <View style={[styles.badgeEstado, { backgroundColor: bg }]}>
                      <Text style={{ color: fg, fontSize: 10, fontWeight: "700" }}>
                        {vc.estado === "SinEnviar" ? "SIN ENVIAR" : vc.estado.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {vc.estado === "Aprobado" && (
                    <Text style={{ color: colors.inkMuted, fontSize: 12, marginTop: 4 }}>
                      Este rubro ya aparece en las búsquedas.
                    </Text>
                  )}
                  {vc.estado === "Pendiente" && (
                    <Text style={{ color: colors.inkMuted, fontSize: 12, marginTop: 4 }}>
                      Enviaste la matrícula, te avisamos apenas la revisemos.
                    </Text>
                  )}
                  {(vc.estado === "SinEnviar" || vc.estado === "Rechazado") && (
                    <>
                      {vc.estado === "Rechazado" && vc.motivoRechazo && (
                        <Text style={{ color: "#C0392B", fontSize: 12, marginTop: 4 }}>{vc.motivoRechazo}</Text>
                      )}
                      <View style={styles.filaAccionMatricula}>
                        <Pressable onPress={async () => setArchivosMatricula((prev) => ({ ...prev, [vc.prestadorCategoriaId]: await elegirDocumento() }))}>
                          <Text style={{ color: colors.copper, fontSize: 12 }}>{archivo ? "Cambiar archivo" : "Elegir archivo"}</Text>
                        </Pressable>
                        {archivo && (
                          <Text style={{ color: colors.inkMuted, fontSize: 11, flex: 1 }} numberOfLines={1}>
                            {archivo.name}
                          </Text>
                        )}
                        <Pressable
                          onPress={() => handleEnviarMatricula(vc.prestadorCategoriaId)}
                          disabled={enviandoMatricula === vc.prestadorCategoriaId}
                          style={[styles.botonChico, { backgroundColor: colors.copper, opacity: enviandoMatricula === vc.prestadorCategoriaId ? 0.6 : 1 }]}
                        >
                          {enviandoMatricula === vc.prestadorCategoriaId ? (
                            <ActivityIndicator color={colors.paper} size="small" />
                          ) : (
                            <Text style={{ color: colors.paper, fontSize: 12, fontWeight: "600" }}>Enviar</Text>
                          )}
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { borderWidth: 1, borderRadius: 12, padding: 16 },
  titulo: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  aviso: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10 },
  campoDoc: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, borderStyle: "dashed", padding: 10 },
  error: { color: "#C0392B", fontSize: 12, marginTop: 8, marginBottom: 4 },
  boton: { marginTop: 10, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  filaMatricula: { borderRadius: 10, padding: 10 },
  filaTopMatricula: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  badgeEstado: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  filaAccionMatricula: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  botonChico: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginLeft: "auto" },
});
