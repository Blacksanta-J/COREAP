/**
 * Usuarios publicados del portal (fuente compartida).
 * Cualquier alta nueva debe incluirse acá (o exportarse desde Usuarios)
 * y publicarse en el repo para que puedan ingresar desde otra PC/navegador.
 *
 * Campos: email, dni, role (admin|apel|usuarios), active, nombre, apellido,
 * fechaNacimiento (AAAA-MM-DD), reparticion.
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
