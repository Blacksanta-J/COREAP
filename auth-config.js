/**
 * Configuración de autenticación Google (@bue.edu.ar).
 *
 * Para activar el botón "Ingresá con tu cuenta @bue.edu.ar":
 * 1. Creá un proyecto en Google Cloud Console
 * 2. APIs y servicios → Credenciales → Crear credencial → ID de cliente OAuth
 * 3. Tipo: Aplicación web
 * 4. Orígenes JavaScript autorizados: la URL donde está el portal
 *    (ej. http://localhost:8000 y https://tu-dominio...)
 * 5. Pegá el Client ID abajo
 *
 * El flujo es el mismo patrón que actopublico.bue.edu.ar (Google + dominio bue.edu.ar).
 */
window.PORTAL_AUTH_CONFIG = {
  googleClientId: ''
};
