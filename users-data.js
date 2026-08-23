/**
 * Semilla / respaldo de usuarios.
 * Con Firebase configurado: el primer login del admin semilla carga estos
 * usuarios en Firestore. Después las altas viven en la nube.
 * Sin Firebase: se usan junto a localStorage (comportamiento anterior).
 */
window.PORTAL_USERS = [
  {
    email: 'jonathanalejandro.perez@bue.edu.ar',
    dni: '00000000',
    role: 'admin',
    active: true,
    nombre: 'Jonathan',
    apellido: 'Perez',
    fechaNacimiento: '',
    reparticion: 'Sistemas'
  },
  {
    email: 'vacantes.ap@bue.edu.ar',
    dni: '00000001',
    role: 'apel',
    active: true,
    nombre: 'Vacantes',
    apellido: 'AP',
    fechaNacimiento: '',
    reparticion: 'APEL'
  }
];
