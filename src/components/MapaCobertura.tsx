import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Circle, Marker, MapPressEvent } from "react-native-maps";
import { useFixitColors } from "@/hooks/use-fixit-colors";

// Equivalente nativo de fixit-web/components/MapaCobertura.tsx (que usa Leaflet, una librería
// web). Acá usamos react-native-maps, que sí anda dentro de Expo Go en Android. Mismo
// comportamiento: tocar el mapa mueve el pin, arrastrarlo también, y se ve el círculo de
// cobertura en vivo mientras se ajusta el radio.
const BUENOS_AIRES = { latitude: -34.6037, longitude: -58.3816 };

export default function MapaCobertura({
  latitud,
  longitud,
  radioKm,
  onCambiarUbicacion,
}: {
  latitud: number | null;
  longitud: number | null;
  radioKm: number;
  onCambiarUbicacion: (lat: number, lng: number) => void;
}) {
  const colors = useFixitColors();
  const mapRef = useRef<MapView>(null);

  const centro = latitud !== null && longitud !== null ? { latitude: latitud, longitude: longitud } : BUENOS_AIRES;
  const delta = latitud !== null ? 0.15 : 8;

  function handlePress(e: MapPressEvent) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    onCambiarUbicacion(latitude, longitude);
  }

  return (
    <View style={[styles.contenedor, { borderColor: colors.border }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: centro.latitude,
          longitude: centro.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
        onPress={handlePress}
      >
        {latitud !== null && longitud !== null && (
          <>
            <Marker
              coordinate={{ latitude: latitud, longitude: longitud }}
              draggable
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                onCambiarUbicacion(latitude, longitude);
              }}
              pinColor={colors.copper}
            />
            <Circle
              center={{ latitude: latitud, longitude: longitud }}
              radius={radioKm * 1000}
              strokeColor={colors.copper}
              fillColor={`${colors.copper}22`}
            />
          </>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { height: 280, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
});
