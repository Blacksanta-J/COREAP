/**
 * Semilla / respaldo de usuarios.
 * Con Firebase: el primer login del admin limpia extras y deja solo este usuario.
 * Después las altas viven en Firestore.
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
  }
];
