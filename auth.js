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
    nombre: 'Jonathan Perez'
  };

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

  function ensureSeed() {
    var users = readUsers();
    if (users && users.length) return users;

    users = [{
      id: uid(),
      email: normalizeEmail(SEED_ADMIN.email),
      dni: normalizeDni(SEED_ADMIN.dni),
      role: SEED_ADMIN.role,
      active: true,
      nombre: SEED_ADMIN.nombre,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }];
    writeUsers(users);
    return users;
  }

  function getUsers() {
    return ensureSeed().slice().sort(function (a, b) {
      return a.email.localeCompare(b.email, 'es');
    });
  }

  function findUserByEmail(email) {
    var target = normalizeEmail(email);
    return ensureSeed().find(function (u) {
      return u.email === target;
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
      nombre: extra.nombre || user.nombre || '',
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
      nombre: session.nombre || user.nombre || '',
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

    if (extras.nombre && extras.nombre.trim()) {
      var users = ensureSeed();
      var idx = users.findIndex(function (u) { return u.id === user.id; });
      if (idx !== -1 && (!users[idx].nombre || users[idx].email === normalizeEmail(SEED_ADMIN.email))) {
        users[idx].nombre = extras.nombre.trim();
        users[idx].updatedAt = new Date().toISOString();
        writeUsers(users);
        user = users[idx];
      }
    }

    var session = setSession(user, {
      nombre: extras.nombre || user.nombre,
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
   * Login con ID token de Google (mismo patrón que actopublico.bue.edu.ar).
   * Verifica el token con Google, exige @bue.edu.ar y usuario precargado.
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

    return fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken))
      .then(function (res) {
        if (!res.ok) throw new Error('token_invalid');
        return res.json();
      })
      .then(function (payload) {
        if (payload.aud !== clientId) {
          return { ok: false, error: 'Credencial de Google inválida para esta app.' };
        }
        if (String(payload.email_verified) !== 'true' && payload.email_verified !== true) {
          return { ok: false, error: 'El mail de Google no está verificado.' };
        }
        if (!isBueEmail(payload.email)) {
          return { ok: false, error: 'Solo se permiten cuentas @' + ALLOWED_DOMAIN + '.' };
        }
        if (payload.hd && normalizeEmail(payload.hd) !== ALLOWED_DOMAIN) {
          return { ok: false, error: 'La cuenta no pertenece a @' + ALLOWED_DOMAIN + '.' };
        }

        return acceptPreloadedUser(payload.email, {
          nombre: payload.name || '',
          picture: payload.picture || '',
          provider: 'google'
        });
      })
      .catch(function () {
        return { ok: false, error: 'No se pudo validar la cuenta de Google. Reintentá.' };
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
    var role = payload.role;
    var nombre = String(payload.nombre || '').trim();
    var active = payload.active !== false;

    if (!isBueEmail(email)) {
      return { ok: false, error: 'El mail debe ser @' + ALLOWED_DOMAIN + '.' };
    }
    if (dni.length < 7 || dni.length > 8) {
      return { ok: false, error: 'El DNI debe tener 7 u 8 dígitos.' };
    }
    if (!ROLE_PERMISSIONS[role]) {
      return { ok: false, error: 'Rol inválido.' };
    }

    var users = ensureSeed();
    var existing = users.find(function (u) { return u.email === email; });
    var dniOwner = users.find(function (u) {
      return normalizeDni(u.dni) === dni && (!existing || u.id !== existing.id);
    });
    if (dniOwner) {
      return { ok: false, error: 'Ese DNI ya está asignado a otro usuario.' };
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

      existing.dni = dni;
      existing.role = role;
      existing.nombre = nombre;
      existing.active = active;
      existing.updatedAt = new Date().toISOString();
      writeUsers(users);
      return { ok: true, user: existing, created: false };
    }

    var created = {
      id: uid(),
      email: email,
      dni: dni,
      role: role,
      nombre: nombre,
      active: active,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(created);
    writeUsers(users);
    return { ok: true, user: created, created: true };
  }

  function removeUser(userId, actor) {
    if (!actor || actor.role !== ROLES.admin) {
      return { ok: false, error: 'Solo Admin puede eliminar usuarios.' };
    }
    var users = ensureSeed();
    var target = users.find(function (u) { return u.id === userId; });
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
    users = users.filter(function (u) { return u.id !== userId; });
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
    getGoogleClientId: getGoogleClientId,
    normalizeEmail: normalizeEmail,
    normalizeDni: normalizeDni,
    isBueEmail: isBueEmail,
    getUsers: getUsers,
    findUserByEmail: findUserByEmail,
    currentUser: currentUser,
    login: login,
    loginWithGoogleIdToken: loginWithGoogleIdToken,
    logout: logout,
    requireAuth: requireAuth,
    canAccess: canAccess,
    permissionsFor: permissionsFor,
    upsertUser: upsertUser,
    removeUser: removeUser,
    roleLabel: roleLabel,
    describePermissions: describePermissions,
    ensureSeed: ensureSeed
  };
})(window);
