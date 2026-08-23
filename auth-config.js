/**
 * Configuración de autenticación Google + Firebase (Firestore).
 *
 * GOOGLE (Identity Services):
 * En Google Cloud Console → Credenciales → ID de cliente OAuth (Aplicación web):
 *   - http://localhost:8000
 *   - http://127.0.0.1:8000
 *   - https://blacksanta-j.github.io
 *
 * FIREBASE (usuarios dinámicos, sin subir users-data.js):
 * 1. Creá un proyecto en https://console.firebase.google.com
 * 2. Authentication → Sign-in method → Google → Enable
 * 3. Firestore Database → Create (modo producción)
 * 4. Project settings → Your apps → Web → copiá la config acá abajo
 * 5. Authentication → Settings → Authorized domains → agregá github.io / localhost
 * 6. Publicá las reglas de firestore.rules (Firebase Console → Firestore → Rules
 *    o `firebase deploy --only firestore:rules`)
 * 7. El primer login de jonathanalejandro.perez@bue.edu.ar siembra admin +
 *    usuarios de users-data.js en Firestore.
 *
 * Si `firebase.projectId` está vacío, el portal sigue con users-data.js + localStorage.
 */
window.PORTAL_AUTH_CONFIG = {
  googleClientId: '396980167437-7h9dp4952g0bvg0dkbtpee4728bmj48e.apps.googleusercontent.com',
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  }
};
