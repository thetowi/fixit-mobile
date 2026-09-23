// Mismo backend que ya usa fixit-web (Railway) — no hace falta un backend aparte para la app.
// EXPO_PUBLIC_API_URL (definible en un .env, mismo patrón que NEXT_PUBLIC_* en fixit-web) permite
// apuntar a otra URL sin tocar código, por ejemplo si algún día se corre el backend en local
// durante desarrollo. Sin esa variable, cae a la URL de producción real.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://fixit-api-production-e2dd.up.railway.app";
