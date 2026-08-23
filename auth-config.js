/**
 * Configuración de autenticación Google (@bue.edu.ar).
 *
 * En Google Cloud Console → Credenciales → tu ID de cliente OAuth (Aplicación web):
 * agregá exactamente estos orígenes (según cómo abras el portal):
 *   - http://localhost:8000
 *   - http://127.0.0.1:8000
 *   - https://TU-DOMINIO-DE-PRODUCCION
 *
 * Si el origen no coincide, Google bloquea el botón y parece que “no funciona”.
 */
window.PORTAL_AUTH_CONFIG = {
  googleClientId: '396980167437-7h9dp4952g0bvg0dkbtpee4728bmj48e.apps.googleusercontent.com'
};
