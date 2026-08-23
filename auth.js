/**
 * Portal COREAP — autenticación y permisos (cliente).
 * Login Google con cuentas @bue.edu.ar + usuarios precargados (mail + DNI).
 * Roles: admin | apel | usuarios
 */
(function (global) {
  'use strict';

  var STORAGE_USERS = 'portal-users-v1';
  var STORAGE_SESSION = 'portal-session-v1';
  var ALLOWED_DOMAIN = 'bue.edu.ar';

  var ROLES = {
    admin: 'admin',
    apel: 'apel',
    usuarios: 'usuarios'
  };

  var ROLE_LABELS = {
    admin: 'Admin',
    apel: 'APEL',
    usuarios: 'Usuarios'
  };

  var MODULES = {
    acto_publico: 'acto_publico',
    clasificacion: 'clasificacion',
    estatuto: 'estatuto',
    eleves_acto: 'eleves_acto',
    eleves_concursos: 'eleves_concursos',
    admin_usuarios: 'admin_usuarios'
  };

  var MANUALES = [
    MODULES.acto_publico,
    MODULES.clasificacion,
    MODULES.estatuto
  ];

  var ROLE_PERMISSIONS = {
    admin: [
      MODULES.acto_publico,
      MODULES.clasificacion,
      MODULES.estatuto,
      MODULES.eleves_acto,
      MODULES.eleves_concursos,
      MODULES.admin_usuarios
    ],
    apel: MANUALES.concat([MODULES.eleves_acto]),
    usuarios: MANUALES.slice()
  };

  var SEED_ADMIN = {
    email: 'jonathanalejandro.perez@bue.edu.ar',
    dni: '00000000',
    role: ROLES.admin,
    active: true,
    nombre: 'Jonathan',
    apellido: 'Perez',
    fechaNacimiento: '',
    reparticion: ''
  };

  var REPARTICIONES = [
    'Sistemas',
    'Administracion',
    'RRHH',
    'Listados',
    'APEL',
    'JUNTA'
  ];

  function normalizeReparticion(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    var found = REPARTICIONES.find(function (r) {
      return r.toLowerCase() === raw.toLowerCase();
    });
    return found || '';
  }

  function getGoogleClientId() {
    var cfg = global.PORTAL_AUTH_CONFIG || {};
    return String(cfg.googleClientId || '').trim();
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function normalizeDni(dni) {
    return String(dni || '').replace(/\D/g, '');
  }

  function normalizeBirthDate(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    // YYYY-MM-DD (input date)
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    // DD/MM/YYYY or DD-MM-YYYY
    var m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
      var d = m[1].padStart(2, '0');
      var mo = m[2].padStart(2, '0');
      return m[3] + '-' + mo + '-' + d;
    }
    return '';
  }

  function formatBirthDateDisplay(iso) {
    var v = normalizeBirthDate(iso);
    if (!v) return '—';
    var parts = v.split('-');
    if (parts.length !== 3) return v;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function displayName(user) {
    if (!user) return '';
    var full = [user.nombre, user.apellido].filter(Boolean).join(' ').trim();
    if (full) return full;
    return user.nombre || user.email || '';
  }

  function migrateUserShape(u) {
    if (!u || typeof u !== 'object') return u;
    if (!u.id) u.id = uid();
    if (u.dni !== undefined && u.dni !== null) {
      u.dni = normalizeDni(u.dni);
    }
    if (u.apellido === undefined || (u.apellido === '' && String(u.nombre || '').trim().indexOf(' ') !== -1)) {
      var parts = String(u.nombre || '').trim().split(/\s+/).filter(Boolean);
      if (parts.length > 1 && !u.apellido) {
        u.nombre = parts[0];
        u.apellido = parts.slice(1).join(' ');
      } else if (u.apellido === undefined) {
        u.apellido = '';
      }
    }
    if (u.fechaNacimiento === undefined) u.fechaNacimiento = '';
    else u.fechaNacimiento = normalizeBirthDate(u.fechaNacimiento);
    if (u.reparticion === undefined) u.reparticion = '';
    else {
      // Conservar vacío; si hay valor libre viejo, intentar mapear a la lista fija
      var mapped = normalizeReparticion(u.reparticion);
      if (mapped) u.reparticion = mapped;
    }
    return u;
  }

  function isBueEmail(email) {
    var e = normalizeEmail(email);
    return e.endsWith('@' + ALLOWED_DOMAIN);
  }

  function uid() {
    return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function readUsers() {
    try {
      var raw = localStorage.getItem(STORAGE_USERS);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeUsers(users) {
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
  }

  function hydratePublishedUser(raw) {
    var email = normalizeEmail(raw && raw.email);
    if (!email) return null;
    var role = String((raw && raw.role) || ROLES.usuarios).trim().toLowerCase();
    if (role === 'usuario') role = ROLES.usuarios;
    if (role === 'administrador') role = ROLES.admin;
    if (!ROLE_PERMISSIONS[role]) role = ROLES.usuarios;
    var active = true;
    if (raw && typeof raw.active === 'boolean') active = raw.active;
    return {
      id: (raw && raw.id) || uid(),
      email: email,
      dni: normalizeDni((raw && raw.dni) || ''),
      role: role,
      active: active,
      nombre: String((raw && raw.nombre) || '').trim(),
      apellido: String((raw && raw.apellido) || '').trim(),
      fechaNacimiento: normalizeBirthDate((raw && raw.fechaNacimiento) || ''),
      reparticion: normalizeReparticion((raw && raw.reparticion) || '') || String((raw && raw.reparticion) || '').trim(),
      createdAt: (raw && raw.createdAt) || new Date().toISOString(),
      updatedAt: (raw && raw.updatedAt) || new Date().toISOString(),
      published: true
    };
  }

  /** Lista publicada en users-data.js (compartida en el sitio). */
  function getPublishedUsers() {
    var list = global.PORTAL_USERS;
    if (!Array.isArray(list) || !list.length) {
      return [hydratePublishedUser(SEED_ADMIN)].filter(Boolean);
    }
    return list.map(hydratePublishedUser).filter(Boolean);
  }

  /**
   * Une usuarios publicados (users-data.js) con los locales (localStorage).
   * - Todo mail publicado se agrega si no existe (así pueden loguear desde otra PC).
   * - Los usuarios solo-locales se conservan (altas pendientes de publicar).
   * - Si el mail ya existe en local, no se pisa con la publicada (edición local manda).
   */
  function ensureSeed() {
    var users = readUsers();
    if (!users) users = [];
    var changed = false;
    var byEmail = {};

    users.forEach(function (u) {
      migrateUserShape(u);
      var norm = normalizeEmail(u.email);
      if (u.email !== norm) {
        u.email = norm;
        changed = true;
      }
      if (norm) byEmail[norm] = u;
    });

    getPublishedUsers().forEach(function (pub) {
      var email = normalizeEmail(pub.email);
      if (!email) return;
      if (!byEmail[email]) {
        byEmail[email] = pub;
        changed = true;
      }
    });

    // Garantizar admin semilla
    var seedEmail = normalizeEmail(SEED_ADMIN.email);
    if (!byEmail[seedEmail]) {
      byEmail[seedEmail] = hydratePublishedUser(SEED_ADMIN);
      changed = true;
    }

    users = Object.keys(byEmail).map(function (k) { return byEmail[k]; });
    users.forEach(function (u) {
      var before = JSON.stringify(u);
      migrateUserShape(u);
      if (JSON.stringify(u) !== before) changed = true;
    });

    if (!users.length) {
      users = [hydratePublishedUser(SEED_ADMIN)];
      changed = true;
    }

    if (changed) writeUsers(users);
    return users;
  }

  /** Genera el contenido de users-data.js a partir de la base actual. */
  function exportUsersDataJs(usersList) {
    var list = (usersList || ensureSeed()).map(function (u) {
      return {
        email: normalizeEmail(u.email),
        dni: normalizeDni(u.dni),
        role: u.role,
        active: !!u.active,
        nombre: u.nombre || '',
        apellido: u.apellido || '',
        fechaNacimiento: normalizeBirthDate(u.fechaNacimiento || ''),
        reparticion: u.reparticion || ''
      };
    }).sort(function (a, b) {
      return a.email.localeCompare(b.email, 'es');
    });

    return [
      '/**',
      ' * Usuarios publicados del portal (fuente compartida).',
      ' * Generado desde Gestión de usuarios. Subí este archivo al repo para que',
      ' * las altas/ediciones apliquen en todos los navegadores.',
      ' */',
      'window.PORTAL_USERS = ' + JSON.stringify(list, null, 2) + ';',
      ''
    ].join('\n');
  }

  function getUsers() {
    return ensureSeed().slice().sort(function (a, b) {
      return a.email.localeCompare(b.email, 'es');
    });
  }

  function findUserByEmail(email) {
    var target = normalizeEmail(email);
    return ensureSeed().find(function (u) {
      return normalizeEmail(u.email) === target;
    }) || null;
  }

  function getSession() {
    try {
      var raw = sessionStorage.getItem(STORAGE_SESSION);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setSession(user, extra) {
    extra = extra || {};
    var session = {
      id: user.id,
      email: user.email,
      role: user.role,
      nombre: extra.nombre || displayName(user),
      picture: extra.picture || '',
      provider: extra.provider || 'local',
      at: new Date().toISOString()
    };
    sessionStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
    return session;
  }

  function clearSession() {
    sessionStorage.removeItem(STORAGE_SESSION);
  }

  function currentUser() {
    var session = getSession();
    if (!session) return null;
    var user = findUserByEmail(session.email);
    if (!user || !user.active) {
      clearSession();
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      nombre: session.nombre || displayName(user),
      apellido: user.apellido || '',
      fechaNacimiento: user.fechaNacimiento || '',
      reparticion: user.reparticion || '',
      dni: user.dni,
      picture: session.picture || '',
      provider: session.provider || 'local'
    };
  }

  function permissionsFor(role) {
    return (ROLE_PERMISSIONS[role] || []).slice();
  }

  function canAccess(moduleKey, user) {
    var u = user || currentUser();
    if (!u) return false;
    return permissionsFor(u.role).indexOf(moduleKey) !== -1;
  }

  function acceptPreloadedUser(email, extras) {
    extras = extras || {};
    var cleanEmail = normalizeEmail(email);

    if (!isBueEmail(cleanEmail)) {
      return { ok: false, error: 'Solo se permiten cuentas @' + ALLOWED_DOMAIN + '.' };
    }

    var user = findUserByEmail(cleanEmail);
    if (!user) {
      return { ok: false, error: 'Tu cuenta @bue no está precargada. Pedile al admin que te dé de alta.' };
    }
    if (!user.active) {
      return { ok: false, error: 'Usuario desactivado. Contactá al administrador.' };
    }

    // Actualizar nombre desde Google si viene y el local está vacío
    if (extras.nombre && extras.nombre.trim()) {
      var users = ensureSeed();
      var idx = users.findIndex(function (u) { return u.id === user.id; });
      if (idx !== -1 && (!users[idx].nombre || !users[idx].apellido)) {
        var parts = extras.nombre.trim().split(/\s+/);
        if (!users[idx].nombre) users[idx].nombre = parts[0] || '';
        if (!users[idx].apellido && parts.length > 1) users[idx].apellido = parts.slice(1).join(' ');
        users[idx].updatedAt = new Date().toISOString();
        writeUsers(users);
        user = users[idx];
      }
    }

    var session = setSession(user, {
      nombre: extras.nombre || displayName(user),
      picture: extras.picture || '',
      provider: extras.provider || 'google'
    });
    return { ok: true, session: session, user: user };
  }

  /** Login legacy mail + DNI (respaldo interno). */
  function login(email, dni) {
    var cleanEmail = normalizeEmail(email);
    var cleanDni = normalizeDni(dni);

    if (!cleanEmail || !cleanDni) {
      return { ok: false, error: 'Completá mail y DNI.' };
    }
    if (cleanDni.length < 7 || cleanDni.length > 8) {
      return { ok: false, error: 'El DNI debe tener 7 u 8 dígitos.' };
    }

    var user = findUserByEmail(cleanEmail);
    if (!user) {
      return { ok: false, error: 'Usuario no precargado. Pedile al admin que te dé de alta.' };
    }
    if (!user.active) {
      return { ok: false, error: 'Usuario desactivado. Contactá al administrador.' };
    }
    if (normalizeDni(user.dni) !== cleanDni) {
      return { ok: false, error: 'DNI o mail incorrectos.' };
    }

    return acceptPreloadedUser(cleanEmail, {
      nombre: user.nombre,
      provider: 'local'
    });
  }

  /**
   * Decodifica el payload de un JWT (sin verificar firma; el token
   * llega por GIS desde Google). Evita depender de tokeninfo (CORS).
   */
  function parseJwtPayload(idToken) {
    try {
      var parts = String(idToken || '').split('.');
      if (parts.length < 2) return null;
      var base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      var json = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  /**
   * Login con ID token de Google (mismo patrón que actopublico.bue.edu.ar).
   * Exige @bue.edu.ar y usuario precargado.
   */
  function loginWithGoogleIdToken(idToken) {
    var clientId = getGoogleClientId();
    if (!clientId) {
      return Promise.resolve({
        ok: false,
        error: 'Falta configurar el Google Client ID en auth-config.js'
      });
    }
    if (!idToken) {
      return Promise.resolve({ ok: false, error: 'No se recibió credencial de Google.' });
    }

    var payload = parseJwtPayload(idToken);
    if (!payload) {
      return Promise.resolve({ ok: false, error: 'No se pudo leer la credencial de Google.' });
    }

    var now = Math.floor(Date.now() / 1000);
    if (payload.exp && Number(payload.exp) < now) {
      return Promise.resolve({ ok: false, error: 'La sesión de Google expiró. Reintentá.' });
    }
    if (payload.aud !== clientId) {
      return Promise.resolve({ ok: false, error: 'Credencial de Google inválida para esta app.' });
    }
    var iss = String(payload.iss || '');
    if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
      return Promise.resolve({ ok: false, error: 'Emisor de credencial no válido.' });
    }
    if (String(payload.email_verified) !== 'true' && payload.email_verified !== true) {
      return Promise.resolve({ ok: false, error: 'El mail de Google no está verificado.' });
    }
    if (!isBueEmail(payload.email)) {
      return Promise.resolve({ ok: false, error: 'Solo se permiten cuentas @' + ALLOWED_DOMAIN + '.' });
    }
    if (payload.hd && normalizeEmail(payload.hd) !== ALLOWED_DOMAIN) {
      return Promise.resolve({ ok: false, error: 'La cuenta no pertenece a @' + ALLOWED_DOMAIN + '.' });
    }

    return Promise.resolve(acceptPreloadedUser(payload.email, {
      nombre: payload.name || '',
      picture: payload.picture || '',
      provider: 'google'
    }));
  }

  /**
   * Login con perfil obtenido vía OAuth access token (userinfo).
   */
  function loginWithGoogleProfile(profile) {
    profile = profile || {};
    if (!profile.email) {
      return { ok: false, error: 'Google no devolvió el mail de la cuenta.' };
    }
    if (profile.email_verified === false) {
      return { ok: false, error: 'El mail de Google no está verificado.' };
    }
    return acceptPreloadedUser(profile.email, {
      nombre: profile.name || '',
      picture: profile.picture || '',
      provider: 'google'
    });
  }

  function logout() {
    clearSession();
  }

  function requireAuth(options) {
    options = options || {};
    var user = currentUser();
    var loginUrl = options.loginUrl || 'login.html';
    if (!user) {
      var next = encodeURIComponent(location.pathname.split('/').pop() || 'index.html');
      location.replace(loginUrl + '?next=' + next);
      return null;
    }
    if (options.module && !canAccess(options.module, user)) {
      location.replace('index.html?denied=1');
      return null;
    }
    return user;
  }

  function upsertUser(payload, actor) {
    if (!actor || actor.role !== ROLES.admin) {
      return { ok: false, error: 'Solo Admin puede gestionar usuarios.' };
    }

    var email = normalizeEmail(payload.email);
    var dni = normalizeDni(payload.dni);
    var role = payload.role || ROLES.usuarios;
    var nombre = String(payload.nombre || '').trim();
    var apellido = String(payload.apellido || '').trim();
    var fechaNacimiento = normalizeBirthDate(payload.fechaNacimiento);
    var reparticion = normalizeReparticion(payload.reparticion);
    var active = true;
    if (typeof payload.active === 'boolean') {
      active = payload.active;
    } else if (payload.active !== undefined && payload.active !== null && String(payload.active).trim() !== '') {
      var activeStr = String(payload.active).trim().toLowerCase();
      active = !(activeStr === '0' || activeStr === 'false' || activeStr === 'no' || activeStr === 'inactivo');
    }

    if (!nombre) {
      return { ok: false, error: 'El nombre es obligatorio.' };
    }
    if (!apellido) {
      return { ok: false, error: 'El apellido es obligatorio.' };
    }
    if (!isBueEmail(email)) {
      return { ok: false, error: 'El mail debe ser @' + ALLOWED_DOMAIN + '.' };
    }
    if (dni.length < 7 || dni.length > 8) {
      return { ok: false, error: 'El DNI debe tener 7 u 8 dígitos.' };
    }
    if (payload.fechaNacimiento && !fechaNacimiento) {
      return { ok: false, error: 'Fecha de nacimiento inválida. Usá DD/MM/AAAA o AAAA-MM-DD.' };
    }
    if (payload.reparticion && String(payload.reparticion).trim() && !reparticion) {
      return { ok: false, error: 'Repartición inválida. Opciones: ' + REPARTICIONES.join(', ') + '.' };
    }
    if (!ROLE_PERMISSIONS[role]) {
      return { ok: false, error: 'Rol inválido.' };
    }

    var users = ensureSeed();
    var existing = null;
    var payloadId = payload.id != null && String(payload.id).trim() !== '' ? String(payload.id) : '';
    if (payloadId) {
      existing = users.find(function (u) { return String(u.id) === payloadId; }) || null;
    }
    if (!existing) {
      existing = users.find(function (u) { return normalizeEmail(u.email) === email; }) || null;
    }

    var dniOwner = users.find(function (u) {
      return normalizeDni(u.dni) === dni && (!existing || u.id !== existing.id);
    });
    if (dniOwner) {
      return { ok: false, error: 'Ese DNI ya está asignado a otro usuario.' };
    }

    // Si estamos editando y cambiaron el mail a uno ya usado por otro
    if (existing && normalizeEmail(existing.email) !== email) {
      var emailOwner = users.find(function (u) {
        return normalizeEmail(u.email) === email && u.id !== existing.id;
      });
      if (emailOwner) {
        return { ok: false, error: 'Ese mail ya está asignado a otro usuario.' };
      }
    }

    if (existing) {
      if (existing.role === ROLES.admin && role !== ROLES.admin) {
        var otherAdmins = users.filter(function (u) {
          return u.id !== existing.id && u.role === ROLES.admin && u.active;
        });
        if (!otherAdmins.length) {
          return { ok: false, error: 'Debe quedar al menos un Admin activo.' };
        }
      }
      if (existing.role === ROLES.admin && active === false) {
        var otherAdmins2 = users.filter(function (u) {
          return u.id !== existing.id && u.role === ROLES.admin && u.active;
        });
        if (!otherAdmins2.length) {
          return { ok: false, error: 'No podés desactivar el único Admin.' };
        }
      }

      existing.email = email;
      existing.dni = dni;
      existing.role = role;
      existing.nombre = nombre;
      existing.apellido = apellido;
      existing.fechaNacimiento = fechaNacimiento;
      existing.reparticion = reparticion;
      existing.active = active;
      existing.updatedAt = new Date().toISOString();
      writeUsers(users);
      return { ok: true, user: Object.assign({}, existing), created: false };
    }

    var created = {
      id: uid(),
      email: email,
      dni: dni,
      role: role,
      nombre: nombre,
      apellido: apellido,
      fechaNacimiento: fechaNacimiento,
      reparticion: reparticion,
      active: active,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(created);
    writeUsers(users);
    return { ok: true, user: Object.assign({}, created), created: true };
  }

  /**
   * Importa usuarios en lote. Cada fila: email, dni, nombre, apellido,
   * fechaNacimiento (opcional), reparticion (opcional), role (opcional), active (opcional).
   * Por defecto no sobrescribe existentes salvo overwrite=true.
   */
  function importUsers(rows, actor, options) {
    options = options || {};
    if (!actor || actor.role !== ROLES.admin) {
      return { ok: false, error: 'Solo Admin puede importar usuarios.' };
    }
    if (!Array.isArray(rows) || !rows.length) {
      return { ok: false, error: 'No hay filas para importar.' };
    }

    var created = 0;
    var updated = 0;
    var skipped = 0;
    var errors = [];

    rows.forEach(function (row, index) {
      var line = index + 2; // + header
      var email = normalizeEmail(row.email || row.mail || row.correo);
      if (!email) {
        errors.push('Fila ' + line + ': falta mail.');
        return;
      }

      var existing = findUserByEmail(email);
      if (existing && !options.overwrite) {
        skipped += 1;
        return;
      }

      var roleRaw = String(row.role || row.rol || 'usuarios').trim().toLowerCase();
      if (roleRaw === 'usuario') roleRaw = 'usuarios';
      if (roleRaw === 'administrador') roleRaw = 'admin';

      var activeRaw = row.active !== undefined ? row.active : row.activo;
      var active = true;
      if (activeRaw !== undefined && activeRaw !== null && String(activeRaw).trim() !== '') {
        var s = String(activeRaw).trim().toLowerCase();
        active = !(s === '0' || s === 'false' || s === 'no' || s === 'inactivo');
      }

      var result = upsertUser({
        email: email,
        dni: row.dni || row.documento,
        nombre: row.nombre || row.name || row.firstname,
        apellido: row.apellido || row.lastname || row.surname,
        fechaNacimiento: row.fechaNacimiento || row.fecha_nacimiento || row.nacimiento || row.birthdate,
        reparticion: row.reparticion || row.repartición || row.area || row.dependencia,
        role: roleRaw,
        active: active
      }, actor);

      if (!result.ok) {
        errors.push('Fila ' + line + ' (' + email + '): ' + result.error);
        return;
      }
      if (result.created) created += 1;
      else updated += 1;
    });

    return {
      ok: errors.length === 0 || created + updated > 0,
      created: created,
      updated: updated,
      skipped: skipped,
      errors: errors
    };
  }

  function removeUser(userId, actor) {
    if (!actor || actor.role !== ROLES.admin) {
      return { ok: false, error: 'Solo Admin puede eliminar usuarios.' };
    }
    var users = ensureSeed();
    var targetId = String(userId || '');
    var target = users.find(function (u) { return String(u.id) === targetId; });
    if (!target) return { ok: false, error: 'Usuario no encontrado.' };
    if (target.email === normalizeEmail(SEED_ADMIN.email)) {
      return { ok: false, error: 'No se puede eliminar el Admin inicial.' };
    }
    if (target.role === ROLES.admin) {
      var otherAdmins = users.filter(function (u) {
        return u.id !== target.id && u.role === ROLES.admin && u.active;
      });
      if (!otherAdmins.length) {
        return { ok: false, error: 'Debe quedar al menos un Admin activo.' };
      }
    }
    users = users.filter(function (u) { return String(u.id) !== targetId; });
    writeUsers(users);
    return { ok: true };
  }

  function roleLabel(role) {
    return ROLE_LABELS[role] || role;
  }

  function describePermissions(role) {
    var map = {
      acto_publico: 'Acto Público',
      clasificacion: 'Clasificación',
      estatuto: 'Estatuto',
      eleves_acto: 'Eleves Acto Público',
      eleves_concursos: 'Eleves Concursos',
      admin_usuarios: 'Gestión de usuarios'
    };
    return permissionsFor(role).map(function (k) { return map[k] || k; });
  }

  global.PortalAuth = {
    ALLOWED_DOMAIN: ALLOWED_DOMAIN,
    ROLES: ROLES,
    ROLE_LABELS: ROLE_LABELS,
    MODULES: MODULES,
    MANUALES: MANUALES,
    SEED_ADMIN_EMAIL: SEED_ADMIN.email,
    SEED_ADMIN_DNI: SEED_ADMIN.dni,
    REPARTICIONES: REPARTICIONES,
    getGoogleClientId: getGoogleClientId,
    normalizeEmail: normalizeEmail,
    normalizeDni: normalizeDni,
    normalizeBirthDate: normalizeBirthDate,
    normalizeReparticion: normalizeReparticion,
    formatBirthDateDisplay: formatBirthDateDisplay,
    displayName: displayName,
    isBueEmail: isBueEmail,
    getUsers: getUsers,
    getPublishedUsers: getPublishedUsers,
    exportUsersDataJs: exportUsersDataJs,
    findUserByEmail: findUserByEmail,
    currentUser: currentUser,
    login: login,
    loginWithGoogleIdToken: loginWithGoogleIdToken,
    loginWithGoogleProfile: loginWithGoogleProfile,
    logout: logout,
    requireAuth: requireAuth,
    canAccess: canAccess,
    permissionsFor: permissionsFor,
    upsertUser: upsertUser,
    importUsers: importUsers,
    removeUser: removeUser,
    roleLabel: roleLabel,
    describePermissions: describePermissions,
    ensureSeed: ensureSeed
  };
})(window);
