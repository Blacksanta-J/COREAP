/**
 * Configuración de autenticación Google + Firebase (Firestore).
 *
 * GOOGLE (Identity Services):
 * Usar el cliente OAuth "Web client (auto created by Google Service)" del
 * proyecto Firebase portal-coreap (Google Cloud → Credenciales).
 * Orígenes autorizados de JavaScript:
 *   - http://localhost:8000
 *   - http://127.0.0.1:8000
 *   - https://blacksanta-j.github.io
 *
 * FIREBASE:
 * 1. Authentication → Sign-in method → Google → Enable
 * 2. Firestore Database → Create
 * 3. Authentication → Settings → Authorized domains → localhost + blacksanta-j.github.io
 * 4. Publicá las reglas de firestore.rules
 *
 * CRONOGRAMA (Google Slides):
 * Pegá el link de la presentación (compartida “cualquiera con el enlace” o publicada).
 * Sirve el link /edit, /pub o el de insertar (/embed).
 */
window.PORTAL_AUTH_CONFIG = {
  googleClientId: '691135057707-64u4hv4k93ogmt9mv2hgg0pf656qeld5.apps.googleusercontent.com',
  /** URL de la presentación de Google Slides del cronograma COREAP */
  cronogramaSlidesUrl: 'https://docs.google.com/presentation/d/1v_-sGar57nR3HIXD04-FdxELPJ-ugtK3/edit?usp=sharing',
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
