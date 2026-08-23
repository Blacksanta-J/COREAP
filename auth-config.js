/**
 * Configuración de autenticación Google + Firebase (Firestore).
 *
 * GOOGLE (Identity Services):
 * En Google Cloud Console → Credenciales → ID de cliente OAuth (Aplicación web):
 *   - http://localhost:8000
 *   - http://127.0.0.1:8000
 *   - https://blacksanta-j.github.io
 *
 * FIREBASE:
 * 1. Authentication → Sign-in method → Google → Enable
 * 2. Firestore Database → Create
 * 3. Authentication → Settings → Authorized domains → localhost + blacksanta-j.github.io
 * 4. Publicá las reglas de firestore.rules
 * 5. Primer login del admin siembra users-data.js en Firestore
 */
window.PORTAL_AUTH_CONFIG = {
  googleClientId: '396980167437-7h9dp4952g0bvg0dkbtpee4728bmj48e.apps.googleusercontent.com',
  firebase: {
    apiKey: 'AIzaSyDLHYqb9yM_FWFoxsczkKEDpPns9OLUFtA',
    authDomain: 'portal-coreap.firebaseapp.com',
    projectId: 'portal-coreap',
    storageBucket: 'portal-coreap.firebasestorage.app',
    messagingSenderId: '691135057707',
    appId: '1:691135057707:web:3a6cf973e89ada43b1ff6e',
    measurementId: 'G-K6LZMVWMRY'
  }
};
