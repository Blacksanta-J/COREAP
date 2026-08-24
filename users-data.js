/**
 * Semilla / respaldo de usuarios.
 * Con Firebase: el primer login del admin limpia extras y deja solo este usuario.
 * Después las altas viven en Firestore.
 */
window.PORTAL_USERS = [
  {
    email: 'jonathanalejandro.perez@bue.edu.ar',
    dni: '36729167',
    role: 'admin',
    roles: ['admin'],
    active: true,
    nombre: 'Jonathan',
    apellido: 'Perez',
    fechaNacimiento: '1992-03-19',
    reparticion: 'Sistemas'
  }
];
