// Autocompletado/geocodificación de direcciones usando Nominatim (OpenStreetMap) — mismo
// proveedor y misma lógica que fixit-web/lib/geocodificacion.ts. Es 100% `fetch`, sin ninguna
// API del navegador, así que se porta a React Native tal cual.

export interface SugerenciaDireccion {
  calle: string;
  localidad: string; // puede venir vacío si Nominatim no nos dio ese dato para este resultado
  lat: number;
  lon: number;
}

interface DireccionNominatim {
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  state?: string;
}

function extraerCalleYLocalidad(
  address: DireccionNominatim,
  displayNameFallback: string
): { calle: string; localidad: string } {
  const localidad = address.city || address.town || address.village || address.municipality || address.suburb || "";
  const calle = address.road || displayNameFallback.split(",")[0]?.trim() || displayNameFallback;
  return { calle, localidad };
}

export async function buscarDirecciones(consulta: string): Promise<SugerenciaDireccion[]> {
  if (consulta.trim().length < 4) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", consulta);
  url.searchParams.set("countrycodes", "ar");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  try {
    const respuesta = await fetch(url.toString(), {
      headers: { "Accept-Language": "es" },
    });
    if (!respuesta.ok) return [];

    const datos: { display_name: string; lat: string; lon: string; address?: DireccionNominatim }[] =
      await respuesta.json();

    return datos.map((d) => {
      const { calle, localidad } = extraerCalleYLocalidad(d.address ?? {}, d.display_name);
      return { calle, localidad, lat: parseFloat(d.lat), lon: parseFloat(d.lon) };
    });
  } catch {
    return [];
  }
}
