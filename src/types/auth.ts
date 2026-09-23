// Espejo de fixit-web/types/auth.ts — mismo contrato, mismo backend. Si algo cambia de un lado
// (por ejemplo un campo nuevo en Usuario), hay que replicarlo acá también a mano: no hay un
// paquete compartido entre fixit-web y fixit-mobile todavía.

export type Rol = "Cliente" | "Prestador" | "Admin";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: Rol;
  tutorialVisto: boolean;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export interface LoginGoogleRequest {
  idToken: string;
}

export interface LoginGoogleResponse {
  // Si el usuario ya existía, viene esto completo:
  token?: string;
  usuario?: Usuario;

  // Si es un usuario NUEVO, viene esto en su lugar:
  requiereRol: boolean;
  emailPendiente?: string;
  nombrePendiente?: string;
  idTokenPendiente?: string; // se lo reenviamos al backend en el paso 2
}

export interface CompletarRegistroGoogleRequest {
  idToken: string;
  rol: "cliente" | "prestador";
}
