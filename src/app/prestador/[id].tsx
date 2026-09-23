import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { useFixitColors } from "@/hooks/use-fixit-colors";
import { PerfilPrestador } from "@/types/perfil";
import { Calificacion, CRITERIOS_CALIFICACION } from "@/types/calificaciones";
import { IniciarConversacionRequest, Conversacion } from "@/types/conversaciones";
import Estrellas from "@/components/Estrellas";
import InsigniaVerificado from "@/components/InsigniaVerificado";

type Pestaña = "servicios" | "reseñas" | "acerca";

function iniciales(nombre: string, apellido: string): string {
  return `${nombre[0] ?? ""}${apellido[0] ?? ""}`.toUpperCase();
}

// Espejo mobile de fixit-web/app/prestador/[id]/page.tsx — perfil público de un prestador, con las
// mismas 3 pestañas (Servicios / Reseñas / Acerca de mí). Pantalla completa fuera del grupo de
// pestañas (como conversacion/[id]), para que se pueda entrar acá desde el nombre del prestador en
// el chat (o desde otras pantallas más adelante) sin necesitar que tenga su propia tab.
export default function PerfilPrestadorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useFixitColors();
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();

  const [perfil, setPerfil] = useState<PerfilPrestador | null>(null);
  const [calificaciones, setCalificaciones] = useState<Calificacion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [pestaña, setPestaña] = useState<Pestaña>("servicios");
  const [iniciandoChat, setIniciandoChat] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiFetch<PerfilPrestador>(`/api/prestadores/${id}`),
      apiFetch<Calificacion[]>(`/api/prestadores/${id}/calificaciones`),
    ])
      .then(([perfilData, calificacionesData]) => {
        setPerfil(perfilData);
        setCalificaciones(calificacionesData);
      })
      .catch((err) => {
        setError(err instanceof ApiError && err.status === 404 ? "No encontramos este prestador." : "Error al cargar el perfil.");
      })
      .finally(() => setCargando(false));
  }, [id]);

  const esClientePropio = usuario?.rol === "Cliente";

  async function handleContratar(categoriaId: number) {
    if (!usuario) {
      router.push("/login");
      return;
    }

    setIniciandoChat(categoriaId);

    const body: IniciarConversacionRequest = { prestadorId: id, categoriaId };

    try {
      const conversacion = await apiFetch<Conversacion>("/api/conversaciones", {
        method: "POST",
        body: JSON.stringify(body),
      });
      router.push(`/conversacion/${conversacion.id}`);
    } catch (err) {
      Alert.alert("No se pudo iniciar el chat", err instanceof ApiError ? err.message : "Ocurrió un error");
      setIniciandoChat(null);
    }
  }

  if (cargando) {
    return (
      <View style={[styles.centro, { backgroundColor: colors.paper }]}>
        <ActivityIndicator color={colors.copper} />
      </View>
    );
  }

  if (error || !perfil) {
    return (
      <View style={[styles.pantalla, { backgroundColor: colors.paper, paddingTop: insets.top + 20 }]}>
        <Pressable onPress={() => router.back()} style={styles.volver}>
          <Text style={{ color: colors.copper, fontSize: 20 }}>‹</Text>
        </Pressable>
        <Text style={{ color: "#C0392B", marginTop: 12 }}>{error ?? "No encontramos este prestador."}</Text>
      </View>
    );
  }

  const miembroDesde = new Date(perfil.miembroDesde).toLocaleDateString("es-AR", { year: "numeric", month: "long" });

  const tabs: { id: Pestaña; label: string }[] = [
    { id: "servicios", label: "Servicios" },
    { id: "reseñas", label: "Reseñas" },
    { id: "acerca", label: "Acerca" },
  ];

  return (
    <ScrollView
      style={[styles.pantalla, { backgroundColor: colors.paper, paddingTop: insets.top + 20 }]}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Pressable onPress={() => router.back()} style={styles.volver}>
        <Text style={{ color: colors.copper, fontSize: 20 }}>‹</Text>
      </Pressable>

      <View style={styles.encabezado}>
        {perfil.fotoPerfilUrl ? (
          <Image source={{ uri: perfil.fotoPerfilUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarIniciales, { backgroundColor: `${colors.ink}1A` }]}>
            <Text style={{ color: colors.ink, fontWeight: "700", fontSize: 20 }}>{iniciales(perfil.nombre, perfil.apellido)}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.filaNombre}>
            <Text style={[styles.nombre, { color: colors.ink }]} numberOfLines={1}>
              {perfil.nombre} {perfil.apellido}
            </Text>
            {perfil.verificado && <InsigniaVerificado size={16} />}
          </View>
          <Text style={{ color: colors.inkMuted, fontSize: 12 }}>Miembro desde {miembroDesde}</Text>
          {perfil.cantidadCalificaciones > 0 && (
            <View style={styles.filaEstrellas}>
              <Estrellas valor={perfil.promedioCalificacion!} tamaño={14} />
              <Text style={{ color: colors.inkMuted, fontSize: 12 }}>
                {perfil.promedioCalificacion!.toFixed(1)} ({perfil.cantidadCalificaciones})
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.toggleVista, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setPestaña(tab.id)}
            style={[styles.toggleBoton, pestaña === tab.id && { backgroundColor: colors.copper }]}
          >
            <Text style={{ color: pestaña === tab.id ? colors.paper : colors.inkMuted, fontSize: 13, fontWeight: "600" }}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {pestaña === "servicios" && (
        <View style={{ gap: 10 }}>
          {perfil.servicios.length === 0 && (
            <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Este prestador todavía no cargó servicios.</Text>
          )}
          {perfil.servicios.map((s) => (
            <View key={s.categoriaId} style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.filaServicio}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 14 }}>{s.categoriaNombre}</Text>
                  {s.descripcion && <Text style={{ color: colors.inkMuted, fontSize: 12, marginTop: 2 }}>{s.descripcion}</Text>}
                  {s.precioReferencia && (
                    <Text style={{ color: colors.ink, fontSize: 13, marginTop: 4 }}>
                      Desde ${s.precioReferencia.toLocaleString("es-AR")} /hora
                    </Text>
                  )}
                </View>
                {esClientePropio && (
                  <Pressable
                    onPress={() => handleContratar(s.categoriaId)}
                    disabled={iniciandoChat === s.categoriaId}
                    style={[styles.botonContactar, { backgroundColor: colors.copper, opacity: iniciandoChat === s.categoriaId ? 0.5 : 1 }]}
                  >
                    <Text style={{ color: colors.paper, fontSize: 13, fontWeight: "600" }}>
                      {iniciandoChat === s.categoriaId ? "Abriendo..." : "Contactar"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
          {!usuario && (
            <Text style={{ color: colors.inkMuted, fontSize: 12, marginTop: 4 }}>Iniciá sesión como cliente para poder contratar.</Text>
          )}
        </View>
      )}

      {pestaña === "reseñas" && (
        <View style={{ gap: 10 }}>
          {calificaciones.length === 0 && (
            <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Este prestador todavía no tiene reseñas.</Text>
          )}
          {calificaciones.map((c) => (
            <View key={c.id} style={[styles.tarjeta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.filaReseñaTop}>
                <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 13 }}>{c.clienteNombre}</Text>
                <View style={styles.filaEstrellas}>
                  <Estrellas valor={c.promedio} tamaño={12} />
                  <Text style={{ color: colors.inkMuted, fontSize: 11 }}>{c.promedio.toFixed(1)}</Text>
                </View>
              </View>
              {c.comentario && <Text style={{ color: colors.inkMuted, fontSize: 12, marginTop: 6 }}>{c.comentario}</Text>}
              <View style={styles.filaCriterios}>
                {CRITERIOS_CALIFICACION.map((criterio) => (
                  <Text key={criterio.key} style={{ color: colors.inkMuted, fontSize: 10 }}>
                    {criterio.label}: {c[criterio.key]}★
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {pestaña === "acerca" && (
        <View style={{ gap: 18 }}>
          {perfil.biografia ? (
            <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 19 }}>{perfil.biografia}</Text>
          ) : (
            <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Este prestador todavía no agregó una descripción.</Text>
          )}

          {perfil.radioAlcanceKm != null && (
            <Text style={{ color: colors.inkMuted, fontSize: 13 }}>
              <Text style={{ color: colors.copper, fontWeight: "600" }}>{perfil.radioAlcanceKm} km</Text> de alcance para trabajar
            </Text>
          )}

          {perfil.fotosTrabajo.length > 0 && (
            <View>
              <Text style={[styles.eyebrow, { color: colors.copper }]}>TRABAJOS REALIZADOS</Text>
              <FlatList
                data={perfil.fotosTrabajo}
                keyExtractor={(f) => f.id}
                numColumns={3}
                columnWrapperStyle={{ gap: 8 }}
                contentContainerStyle={{ gap: 8 }}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.fotoTrabajo, { backgroundColor: `${colors.ink}0D` }]}
                    onPress={() => item.url && Linking.openURL(item.url)}
                  >
                    <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  </Pressable>
                )}
              />
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  pantalla: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  volver: { padding: 4, marginBottom: 8, alignSelf: "flex-start" },
  encabezado: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarIniciales: { alignItems: "center", justifyContent: "center" },
  filaNombre: { flexDirection: "row", alignItems: "center", gap: 6 },
  nombre: { fontSize: 19, fontWeight: "700" },
  filaEstrellas: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  toggleVista: { flexDirection: "row", borderWidth: 1, borderRadius: 20, padding: 2, gap: 2, alignSelf: "flex-start", marginBottom: 18 },
  toggleBoton: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  tarjeta: { borderWidth: 1, borderRadius: 12, padding: 14 },
  filaServicio: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  botonContactar: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  filaReseñaTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filaCriterios: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: "700", marginBottom: 10 },
  fotoTrabajo: { flex: 1, aspectRatio: 1, borderRadius: 10, overflow: "hidden" },
});
