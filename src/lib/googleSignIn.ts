import { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";

// Client ID de tipo "Web application" — el MISMO que ya usa fixit-web (fixit-web/.env.local,
// NEXT_PUBLIC_GOOGLE_CLIENT_ID). No hace falta un Client ID nuevo para esto: el Client ID de
// tipo "Android" que se creó en Google Cloud (con el SHA-1 del keystore de EAS) solo sirve para
// que Google reconozca la firma de esta app — nunca se referencia acá en el código. Pasándole
// este Client ID Web como `webClientId`, el idToken que devuelve el login nativo tiene como
// audiencia este mismo Client ID, así que el backend (Google__ClientId en Railway) no necesita
// ningún cambio para aceptarlo.
const WEB_CLIENT_ID = "255386234536-n11ndtorgbr3t3f6aqad17u7q6pnl8hc.apps.googleusercontent.com";

let configurado = false;

function asegurarConfigurado() {
  if (configurado) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, offlineAccess: false });
  configurado = true;
}

export class GoogleSignInCancelado extends Error {}

// Dispara el flujo nativo de Google Sign-In y devuelve el idToken (para mandarlo tal cual a
// POST /api/Auth/google, igual que hace fixit-web con el credential de @react-oauth/google).
export async function iniciarSesionConGoogle(): Promise<string> {
  asegurarConfigurado();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const respuesta = await GoogleSignin.signIn();

  if (!isSuccessResponse(respuesta)) {
    throw new GoogleSignInCancelado();
  }

  const idToken = respuesta.data.idToken;
  if (!idToken) {
    throw new Error("Google no devolvió un idToken.");
  }

  return idToken;
}

export function esErrorDeCancelacion(err: unknown): boolean {
  if (err instanceof GoogleSignInCancelado) return true;
  if (isErrorWithCode(err)) {
    return err.code === statusCodes.SIGN_IN_CANCELLED;
  }
  return false;
}
