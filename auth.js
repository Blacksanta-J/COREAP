/**
 * Portal COREAP — autenticación y permisos (cliente).
 * Login Google con cuentas @bue.edu.ar + usuarios precargados (mail + DNI).
 * Roles: admin | apel | concursos | listados | usuarios (un usuario puede tener varios).
 */
(function (global) {
  'use strict';

  var STORAGE_USERS = 'portal-users-v2';
  var STORAGE_SESSION = 'portal-session-v1';
  var ALLOWED_DOMAIN = 'bue.edu.ar';

  var _firebaseAppReady = false;
  var _firestore = null;
  var _firebaseAuth = null;
  var _usersCache = null;
  var _readyPromise = null;
  var _persistencePromise = null;

  var ROLES = {
    admin: 'admin',
    apel: 'apel',
    concursos: 'concursos',
    listados: 'listados',
    usuarios: 'usuarios'
  };

  var ROLE_LABELS = {
    admin: 'Admin',
    apel: 'APEL',
    concursos: 'Concursos',
    listados: 'Listados',
    usuarios: 'Usuarios'
  };

  /** Orden de prioridad para el rol “principal” (legacy `role`). */
  var ROLE_PRIORITY = [ROLES.admin, ROLES.apel, ROLES.concursos, ROLES.listados, ROLES.usuarios];

  var MODULES = {
    acto_publico: 'acto_publico',
    clasificacion: 'clasificacion',
    estatuto: 'estatuto',
    cronograma: 'cronograma',
    eleves_acto: 'eleves_acto',
    eleves_concursos: 'eleves_concursos',
    control_pof: 'control_pof',
    vacantes_provisorias: 'vacantes_provisorias',
    admin_usuarios: 'admin_usuarios',
    admin_logs: 'admin_logs'
  };

  var MANUALES = [
    MODULES.acto_publico,
    MODULES.clasificacion,
    MODULES.estatuto,
    MODULES.cronograma
  ];

  var ROLE_PERMISSIONS = {
    admin: [
      MODULES.acto_publico,
      MODULES.clasificacion,
      MODULES.estatuto,
      MODULES.cronograma,
      MODULES.eleves_acto,
      MODULES.eleves_concursos,
      MODULES.control_pof,
      MODULES.vacantes_provisorias,
      MODULES.admin_usuarios,
      MODULES.admin_logs
    ],
    apel: MANUALES.concat([MODULES.eleves_acto]),
    concursos: MANUALES.concat([MODULES.eleves_concursos, MODULES.vacantes_provisorias]),
    listados: MANUALES.concat([MODULES.control_pof, MODULES.vacantes_provisorias]),
    usuarios: MANUALES.slice()
  };

  var SEED_ADMIN = {
    email: 'jonathanalejandro.perez@bue.edu.ar',
    dni: '36729167',
    role: ROLES.admin,
    roles: [ROLES.admin],
    active: true,
    nombre: 'Jonathan',
    apellido: 'Perez',
    fechaNacimiento: '1992-03-19',
    reparticion: 'Sistemas'
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

  function normalizeRoleToken(raw) {
    var role = String(raw || '').trim().toLowerCase();
    if (role === 'usuario') role = ROLES.usuarios;
    if (role === 'administrador') role = ROLES.admin;
    if (role === 'concurso') role = ROLES.concursos;
    if (role === 'listado') role = ROLES.listados;
    if (!ROLE_PERMISSIONS[role]) return '';
    return role;
  }

  /** Acepta string, lista o CSV ("admin,apel") → roles válidos únicos ordenados. */
  function normalizeRoles(input) {
    var list = [];
    if (Array.isArray(input)) {
      list = input;
    } else if (input != null && String(input).trim() !== '') {
      list = String(input).split(/[,|;/]+/);
    }
    var out = [];
    var seen = {};
    list.forEach(function (item) {
      var role = normalizeRoleToken(item);
      if (role && !seen[role]) {
        seen[role] = true;
        out.push(role);
      }
    });
    if (!out.length) out = [ROLES.usuarios];
    out.sort(function (a, b) {
      return ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b);
    });
    return out;
  }

  function userRoles(user) {
    if (!user) return [ROLES.usuarios];
    if (Array.isArray(user.roles) && user.roles.length) {
      return normalizeRoles(user.roles);
    }
    if (user.role) return normalizeRoles(user.role);
    return [ROLES.usuarios];
  }

  function primaryRole(userOrRoles) {
    if (Array.isArray(userOrRoles)) return normalizeRoles(userOrRoles)[0] || ROLES.usuarios;
    return userRoles(userOrRoles)[0] || ROLES.usuarios;
  }

  function applyRolesToUser(u, rolesInput) {
    if (!u) return u;
    var roles = normalizeRoles(rolesInput);
    u.roles = roles;
    u.role = roles[0];
    return u;
  }

  function userHasRole(user, role) {
    return userRoles(user).indexOf(role) !== -1;
  }

  function isAdminUser(user) {
    return userHasRole(user, ROLES.admin);
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
      var mapped = normalizeReparticion(u.reparticion);
      if (mapped) u.reparticion = mapped;
    }
    applyRolesToUser(u, (Array.isArray(u.roles) && u.roles.length) ? u.roles : u.role);
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
    _usersCache = users;
  }

  function getFirebaseConfig() {
    var cfg = global.PORTAL_AUTH_CONFIG || {};
    var fb = cfg.firebase || null;
    if (!fb || !String(fb.apiKey || '').trim() || !String(fb.projectId || '').trim()) {
      return null;
    }
    return fb;
  }

  function isFirebaseEnabled() {
    return !!(getFirebaseConfig() && global.firebase);
  }

  function initFirebase() {
    if (!isFirebaseEnabled()) return false;
    if (_firebaseAppReady) return true;
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(getFirebaseConfig());
      }
      _firestore = firebase.firestore();
      _firebaseAuth = firebase.auth();
      _firebaseAppReady = true;
      return true;
    } catch (e) {
      console.error('Firebase init error', e);
      return false;
    }
  }

  var STORAGE_GOOGLE_TOKEN = 'portal-google-id-token-v1';

  function saveGoogleIdToken(idToken) {
    try {
      if (idToken) {
        localStorage.setItem(STORAGE_GOOGLE_TOKEN, String(idToken));
        sessionStorage.setItem(STORAGE_GOOGLE_TOKEN, String(idToken));
      }
    } catch (e) {}
  }

  function clearGoogleIdToken() {
    try { localStorage.removeItem(STORAGE_GOOGLE_TOKEN); } catch (e) {}
    try { sessionStorage.removeItem(STORAGE_GOOGLE_TOKEN); } catch (e) {}
  }

  function readGoogleIdToken() {
    try {
      return localStorage.getItem(STORAGE_GOOGLE_TOKEN)
        || sessionStorage.getItem(STORAGE_GOOGLE_TOKEN)
        || '';
    } catch (e) {
      return '';
    }
  }

  /** LOCAL → SESSION → NONE si el navegador bloquea IndexedDB / storage. */
  function ensureAuthPersistence() {
    if (!initFirebase()) return Promise.resolve(false);
    if (_persistencePromise) return _persistencePromise;
    var persist = firebase.auth.Auth.Persistence;
    _persistencePromise = _firebaseAuth.setPersistence(persist.LOCAL)
      .catch(function () {
        return _firebaseAuth.setPersistence(persist.SESSION);
      })
      .catch(function () {
        return _firebaseAuth.setPersistence(persist.NONE);
      })
      .then(function () { return true; })
      .catch(function () { return true; });
    return _persistencePromise;
  }

  function isPermissionDenied(err) {
    if (!err) return false;
    var code = String(err.code || '');
    if (code === 'permission-denied' || code.indexOf('permission-denied') !== -1) return true;
    return /insufficient permissions/i.test(String(err.message || ''));
  }

  /** Espera a que Firebase Auth restaure la sesión persistida. */
  function waitForFirebaseAuth(timeoutMs) {
    timeoutMs = timeoutMs == null ? 2500 : timeoutMs;
    if (!initFirebase()) return Promise.resolve(null);
    return ensureAuthPersistence().then(function () {
      if (_firebaseAuth.currentUser) return _firebaseAuth.currentUser;
      return new Promise(function (resolve) {
        var settled = false;
        var unsub = function () {};
        var nullTimer = null;

        function finish(user) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (nullTimer) clearTimeout(nullTimer);
          try { unsub(); } catch (e) {}
          resolve(user || null);
        }

        var timer = setTimeout(function () {
          finish(_firebaseAuth.currentUser);
        }, timeoutMs);

        unsub = _firebaseAuth.onAuthStateChanged(function (user) {
          if (user) {
            finish(user);
            return;
          }
          /* null inicial: no esperar 500ms; basta un tick corto */
          if (!nullTimer) {
            nullTimer = setTimeout(function () {
              finish(_firebaseAuth.currentUser);
            }, 120);
          }
        });
      });
    });
  }

  /** Garantiza usuario Firebase Auth antes de escribir en Firestore. */
  function ensureFirebaseAuthForWrite() {
    if (!initFirebase()) return Promise.resolve(null);

    return waitForFirebaseAuth().then(function (user) {
      if (user) return user;
      var token = readGoogleIdToken();
      if (!token) {
        return Promise.reject(new Error(
          'Sesión Firebase no activa. Cerrá sesión y volvé a ingresar con Google.'
        ));
      }
      return signInFirebaseWithGoogleIdToken(token).then(function (cred) {
        return (cred && cred.user) || _firebaseAuth.currentUser;
      });
    }).then(function (user) {
      if (user) return user;
      return Promise.reject(new Error(
        'Sesión Firebase no activa. Cerrá sesión y volvé a ingresar con Google.'
      ));
    });
  }

  function userDocId(email) {
    return normalizeEmail(email);
  }

  function toFirestorePayload(u) {
    var roles = userRoles(u);
    return {
      email: normalizeEmail(u.email),
      dni: normalizeDni(u.dni),
      role: roles[0],
      roles: roles,
      active: !!u.active,
      nombre: u.nombre || '',
      apellido: u.apellido || '',
      fechaNacimiento: normalizeBirthDate(u.fechaNacimiento || ''),
      reparticion: u.reparticion || '',
      createdAt: u.createdAt || new Date().toISOString(),
      updatedAt: u.updatedAt || new Date().toISOString()
    };
  }

  function fromFirestoreDoc(doc) {
    var d = doc.data() || {};
    var u = {
      id: doc.id,
      email: normalizeEmail(d.email || doc.id),
      dni: normalizeDni(d.dni),
      role: d.role || ROLES.usuarios,
      roles: Array.isArray(d.roles) ? d.roles : (d.role ? [d.role] : [ROLES.usuarios]),
      active: d.active !== false,
      nombre: d.nombre || '',
      apellido: d.apellido || '',
      fechaNacimiento: d.fechaNacimiento || '',
      reparticion: d.reparticion || '',
      createdAt: d.createdAt || '',
      updatedAt: d.updatedAt || ''
    };
    migrateUserShape(u);
    return u;
  }

  function getSeedAdminUser() {
    var seedEmail = normalizeEmail(SEED_ADMIN.email);
    var pub = getPublishedUsers().find(function (u) {
      return normalizeEmail(u.email) === seedEmail;
    });
    var admin = pub ? Object.assign({}, pub) : hydratePublishedUser(SEED_ADMIN);
    admin.id = userDocId(seedEmail);
    admin.email = seedEmail;
    admin.role = ROLES.admin;
    admin.roles = [ROLES.admin];
    admin.active = true;
    migrateUserShape(admin);
    return admin;
  }

  /** Garantiza que el admin semilla esté en la lista (activo, rol admin). */
  function mergeUsersKeepingSeedAdmin(users) {
    var list = (users || []).slice();
    var seedEmail = normalizeEmail(SEED_ADMIN.email);
    var idx = list.findIndex(function (u) {
      return normalizeEmail(u.email) === seedEmail;
    });
    if (idx === -1) {
      list.push(getSeedAdminUser());
      return list;
    }
    if (list[idx].active === false) list[idx].active = true;
    var roles = userRoles(list[idx]);
    if (roles.indexOf(ROLES.admin) === -1) roles.unshift(ROLES.admin);
    applyRolesToUser(list[idx], roles);
    return list;
  }

  function firestoreHasSeedAdmin(snap) {
    if (!snap) return false;
    var seedEmail = normalizeEmail(SEED_ADMIN.email);
    var found = false;
    snap.forEach(function (doc) {
      var email = normalizeEmail((doc.data() && doc.data().email) || doc.id);
      if (email === seedEmail) found = true;
    });
    return found;
  }

  function ensureSeedAdminInFirestore() {
    if (!initFirebase() || !_firestore) return Promise.resolve();
    var seedEmail = normalizeEmail(SEED_ADMIN.email);
    var docRef = _firestore.collection('users').doc(userDocId(seedEmail));
    return docRef.get().then(function (snap) {
      if (snap.exists) {
        return docRef.set({
          email: seedEmail,
          role: ROLES.admin,
          roles: [ROLES.admin],
          active: true
        }, { merge: true });
      }
      var admin = getSeedAdminUser();
      return docRef.set(toFirestorePayload(admin), { merge: true });
    });
  }

  function mergeRemoteUsersIntoLocal(remoteUsers) {
    var local = ensureSeedLocal();
    var byEmail = {};
    local.forEach(function (u) {
      byEmail[normalizeEmail(u.email)] = u;
    });
    (remoteUsers || []).forEach(function (u) {
      if (!u || !u.email) return;
      byEmail[normalizeEmail(u.email)] = u;
    });
    var users = mergeUsersKeepingSeedAdmin(Object.keys(byEmail).map(function (k) {
      return byEmail[k];
    }));
    writeUsers(users);
    return getUsers();
  }

  function fetchOwnUserFromFirestore(email) {
    var id = userDocId(email);
    if (!id || !_firestore) return Promise.resolve(null);
    return _firestore.collection('users').doc(id).get().then(function (snap) {
      if (!snap.exists) return null;
      return fromFirestoreDoc(snap);
    });
  }

  function applyUsersSnapshot(snap) {
    var users = [];
    snap.forEach(function (doc) {
      users.push(fromFirestoreDoc(doc));
    });
    var hadSeed = firestoreHasSeedAdmin(snap);
    users = mergeUsersKeepingSeedAdmin(users);
    writeUsers(users);
    var actor = _firebaseAuth && _firebaseAuth.currentUser
      ? normalizeEmail(_firebaseAuth.currentUser.email)
      : '';
    if (!hadSeed && actor === normalizeEmail(SEED_ADMIN.email)) {
      return ensureSeedAdminInFirestore().then(function () {
        return getUsers();
      });
    }
    return Promise.resolve(getUsers());
  }

  function restoreFirebaseAuthIfPossible() {
    if (_firebaseAuth && _firebaseAuth.currentUser) {
      return Promise.resolve(_firebaseAuth.currentUser);
    }
    return waitForFirebaseAuth().then(function (user) {
      if (user) return user;
      var token = readGoogleIdToken();
      if (!token) return null;
      return signInFirebaseWithGoogleIdToken(token).then(function (cred) {
        return (cred && cred.user) || null;
      }).catch(function () {
        return null;
      });
    });
  }

  /** Solo el doc del usuario (rápido). Usado en login. */
  function syncOwnUserForLogin(email) {
    ensureSeedLocal();
    if (!initFirebase() || !_firestore) {
      return Promise.resolve(getUsers());
    }
    return fetchOwnUserFromFirestore(email).then(function (own) {
      if (own) mergeRemoteUsersIntoLocal([own]);
      return getUsers();
    }).catch(function (err) {
      if (!isPermissionDenied(err)) {
        console.warn('Firestore own-user login sync', err);
      }
      return getUsers();
    });
  }

  function syncFromFirestore() {
    if (!initFirebase()) {
      return Promise.resolve(ensureSeedLocal());
    }
    return restoreFirebaseAuthIfPossible().then(function (fbUser) {
      if (!fbUser || !fbUser.email) {
        return ensureSeedLocal();
      }
      var email = normalizeEmail(fbUser.email);
      /* Usuarios comunes (p. ej. lola.hurtado) no pueden listar /users:
         leer solo el propio documento. El listado queda para Admin. */
      return fetchOwnUserFromFirestore(email).then(function (own) {
        if (own) mergeRemoteUsersIntoLocal([own]);
        var local = own || findUserByEmail(email);
        if (!isAdminUser(local) && normalizeEmail(email) !== normalizeEmail(SEED_ADMIN.email)) {
          return getUsers();
        }
        return _firestore.collection('users').get().then(function (snap) {
          return applyUsersSnapshot(snap);
        }).catch(function (err) {
          if (!isPermissionDenied(err)) {
            console.warn('Firestore list users', err);
          }
          return getUsers();
        });
      }).catch(function (err) {
        if (!isPermissionDenied(err)) {
          console.warn('Firestore sync', err);
        }
        return ensureSeedLocal();
      });
    });
  }

  /** Asegura el admin seed en Firestore. Nunca borra otros usuarios. */
  function bootstrapFirestoreIfNeeded(actorEmail) {
    if (!initFirebase()) return Promise.resolve();
    if (normalizeEmail(actorEmail) !== normalizeEmail(SEED_ADMIN.email)) {
      return Promise.resolve();
    }
    return ensureSeedAdminInFirestore().catch(function (err) {
      console.error('Firestore bootstrap error', err);
    });
  }

  function signInFirebaseWithGoogleIdToken(idToken) {
    if (!initFirebase()) return Promise.resolve(null);
    var credential = firebase.auth.GoogleAuthProvider.credential(idToken);
    return ensureAuthPersistence().then(function () {
      return _firebaseAuth.signInWithCredential(credential);
    });
  }

  function extrasFromFirebaseUser(fbUser) {
    fbUser = fbUser || {};
    return {
      nombre: fbUser.displayName || '',
      picture: fbUser.photoURL || '',
      provider: 'google'
    };
  }

  function finishFirebaseUserLogin(fbUser, extrasOverride) {
    if (!fbUser || !fbUser.email) {
      return Promise.resolve({ ok: false, error: 'Google no devolvió el mail de la cuenta.' });
    }
    if (!isBueEmail(fbUser.email)) {
      try { _firebaseAuth.signOut(); } catch (e) {}
      return Promise.resolve({
        ok: false,
        error: 'Solo se permiten cuentas @' + ALLOWED_DOMAIN + '.'
      });
    }
    var extras = Object.assign(extrasFromFirebaseUser(fbUser), extrasOverride || {});
    var email = normalizeEmail(fbUser.email);
    /* Login rápido: solo el propio doc. El listado admin se sincroniza en background. */
    return Promise.all([
      bootstrapFirestoreIfNeeded(fbUser.email),
      syncOwnUserForLogin(email)
    ]).then(function () {
      var result = acceptPreloadedUser(fbUser.email, extras);
      if (result && result.ok && isAdminUser(result.user || findUserByEmail(email))) {
        setTimeout(function () {
          syncFromFirestore().catch(function () {});
        }, 0);
      }
      return result;
    });
  }

  function hydratePublishedUser(raw) {
    var email = normalizeEmail(raw && raw.email);
    if (!email) return null;
    var roles = normalizeRoles(
      (raw && raw.roles) || (raw && raw.role) || ROLES.usuarios
    );
    var active = true;
    if (raw && typeof raw.active === 'boolean') active = raw.active;
    return {
      id: (raw && raw.id) || uid(),
      email: email,
      dni: normalizeDni((raw && raw.dni) || ''),
      role: roles[0],
      roles: roles,
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
  function ensureSeedLocal() {
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
      var roles = userRoles(u);
      return {
        email: normalizeEmail(u.email),
        dni: normalizeDni(u.dni),
        role: roles[0],
        roles: roles,
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

  function ensureSeed() {
    if (_usersCache && _usersCache.length) return _usersCache;
    return ensureSeedLocal();
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

  function restoreSessionFromFirebaseUser(fbUser) {
    if (!fbUser || !fbUser.email) return null;
    ensureSeedLocal();
    var portalUser = findUserByEmail(fbUser.email);
    if (!portalUser || !portalUser.active) return null;
    return setSession(portalUser, {
      nombre: fbUser.displayName || displayName(portalUser),
      picture: fbUser.photoURL || '',
      provider: 'google'
    });
  }

  /** Carga local inmediata; Firebase/Firestore en background. */
  var _syncPromise = null;

  function startBackgroundSync() {
    if (_syncPromise) return _syncPromise;
    ensureSeedLocal();
    if (!isFirebaseEnabled()) {
      _syncPromise = Promise.resolve(getUsers());
      return _syncPromise;
    }
    if (!initFirebase()) {
      _syncPromise = Promise.resolve(getUsers());
      return _syncPromise;
    }
    _syncPromise = waitForFirebaseAuth(1200).then(function (fbUser) {
      return syncFromFirestore().then(function () {
        if (fbUser && fbUser.email && !currentUser()) {
          restoreSessionFromFirebaseUser(fbUser);
        }
        return getUsers();
      });
    }).catch(function (err) {
      console.warn('Background sync', err);
      return getUsers();
    });
    return _syncPromise;
  }

  /**
   * Listo para pintar la UI (sesión + usuarios locales).
   * No espera red: usá whenSynced() si necesitás datos frescos de Firestore.
   */
  function ready() {
    if (_readyPromise) return _readyPromise;
    _readyPromise = Promise.resolve().then(function () {
      ensureSeedLocal();
      getSession();
      startBackgroundSync();
      return getUsers();
    });
    return _readyPromise;
  }

  /** Resuelve cuando terminó el sync con Firebase (o si no hay Firebase). */
  function whenSynced() {
    return startBackgroundSync();
  }

  function readSessionRaw() {
    try {
      var raw = localStorage.getItem(STORAGE_SESSION);
      if (raw) return raw;
    } catch (e) {}
    try {
      return sessionStorage.getItem(STORAGE_SESSION) || '';
    } catch (e2) {
      return '';
    }
  }

  function getSession() {
    try {
      var raw = readSessionRaw();
      if (!raw) return null;
      var session = JSON.parse(raw);
      /* Escribir en ambos: localStorage (entre pestañas) + sessionStorage (fallback) */
      try { localStorage.setItem(STORAGE_SESSION, raw); } catch (e) {}
      try { sessionStorage.setItem(STORAGE_SESSION, raw); } catch (e2) {}
      return session;
    } catch (e) {
      return null;
    }
  }

  function setSession(user, extra) {
    extra = extra || {};
    var roles = userRoles(user);
    var session = {
      id: user.id,
      email: user.email,
      role: roles[0],
      roles: roles,
      nombre: extra.nombre || displayName(user),
      picture: extra.picture || '',
      provider: extra.provider || 'local',
      at: new Date().toISOString()
    };
    var raw = JSON.stringify(session);
    try { localStorage.setItem(STORAGE_SESSION, raw); } catch (e) {}
    try { sessionStorage.setItem(STORAGE_SESSION, raw); } catch (e2) {}
    return session;
  }

  function clearSession() {
    try { localStorage.removeItem(STORAGE_SESSION); } catch (e) {}
    try { sessionStorage.removeItem(STORAGE_SESSION); } catch (e) {}
  }

  function currentUser() {
    var session = getSession();
    if (!session || !session.email) return null;
    ensureSeedLocal();
    var user = findUserByEmail(session.email);
    if (!user) {
      var sessionRoles = normalizeRoles(session.roles || session.role);
      return {
        id: session.id || '',
        email: normalizeEmail(session.email),
        role: sessionRoles[0],
        roles: sessionRoles,
        nombre: session.nombre || session.email,
        apellido: '',
        fechaNacimiento: '',
        reparticion: '',
        dni: '',
        picture: session.picture || '',
        provider: session.provider || 'local'
      };
    }
    if (!user.active) {
      clearSession();
      return null;
    }
    var roles = userRoles(user);
    return {
      id: user.id,
      email: user.email,
      role: roles[0],
      roles: roles,
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

  function permissionsForUser(user) {
    var set = {};
    userRoles(user).forEach(function (role) {
      permissionsFor(role).forEach(function (mod) {
        set[mod] = true;
      });
    });
    return Object.keys(set);
  }

  function canAccess(moduleKey, user) {
    var u = user || currentUser();
    if (!u) return false;
    return permissionsForUser(u).indexOf(moduleKey) !== -1;
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

    var extras = {
      nombre: payload.name || '',
      picture: payload.picture || '',
      provider: 'google'
    };

    if (!isFirebaseEnabled()) {
      return Promise.resolve(acceptPreloadedUser(payload.email, extras));
    }

    saveGoogleIdToken(idToken);

    return signInFirebaseWithGoogleIdToken(idToken).then(function (cred) {
      var user = (cred && cred.user) || (_firebaseAuth && _firebaseAuth.currentUser);
      if (!user) {
        return Promise.reject(new Error('No se pudo iniciar sesión en Firebase Auth.'));
      }
      return finishFirebaseUserLogin(user, extras);
    }).catch(function (err) {
      console.error(err);
      clearGoogleIdToken();
      var msg = (err && err.message) ? err.message : 'Error de Firebase';
      var code = err && err.code ? ' (' + err.code + ')' : '';
      return {
        ok: false,
        error: 'No se pudo conectar con Firebase' + code + '. ' + msg +
          ' Revisá que Authentication → Google esté activo y el dominio autorizado.'
      };
    });
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
    clearGoogleIdToken();
    if (_firebaseAuth) {
      try { _firebaseAuth.signOut(); } catch (e) {}
    }
  }

  function revealProtectedPage() {
    if (global.PortalAuthGate && typeof global.PortalAuthGate.reveal === 'function') {
      global.PortalAuthGate.reveal();
    } else {
      try { document.documentElement.classList.remove('portal-auth-pending'); } catch (e) {}
    }
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
    revealProtectedPage();
    return user;
  }

  function upsertUser(payload, actor) {
    function fail(msg) { return Promise.resolve({ ok: false, error: msg }); }

    if (!isAdminUser(actor)) {
      return fail('Solo Admin puede gestionar usuarios.');
    }

    var email = normalizeEmail(payload.email);
    var dni = normalizeDni(payload.dni);
    var roles = normalizeRoles(
      payload.roles != null ? payload.roles : (payload.role || ROLES.usuarios)
    );
    var role = roles[0];
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

    if (!nombre) return fail('El nombre es obligatorio.');
    if (!apellido) return fail('El apellido es obligatorio.');
    if (!isBueEmail(email)) return fail('El mail debe ser @' + ALLOWED_DOMAIN + '.');
    if (dni.length < 7 || dni.length > 8) return fail('El DNI debe tener 7 u 8 dígitos.');
    if (payload.fechaNacimiento && !fechaNacimiento) {
      return fail('Fecha de nacimiento inválida. Usá DD/MM/AAAA o AAAA-MM-DD.');
    }
    if (payload.reparticion && String(payload.reparticion).trim() && !reparticion) {
      return fail('Repartición inválida. Opciones: ' + REPARTICIONES.join(', ') + '.');
    }
    if (!roles.length) return fail('Seleccioná al menos un rol.');

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
    if (dniOwner) return fail('Ese DNI ya está asignado a otro usuario.');

    if (existing && normalizeEmail(existing.email) !== email) {
      var emailOwner = users.find(function (u) {
        return normalizeEmail(u.email) === email && u.id !== existing.id;
      });
      if (emailOwner) return fail('Ese mail ya está asignado a otro usuario.');
    }

    var createdFlag = false;
    var saved;

    if (existing) {
      if (normalizeEmail(existing.email) === normalizeEmail(SEED_ADMIN.email)) {
        if (roles.indexOf(ROLES.admin) === -1) roles.unshift(ROLES.admin);
        roles = normalizeRoles(roles);
        role = roles[0];
        active = true;
      }
      if (userHasRole(existing, ROLES.admin) && roles.indexOf(ROLES.admin) === -1) {
        var otherAdmins = users.filter(function (u) {
          return u.id !== existing.id && userHasRole(u, ROLES.admin) && u.active;
        });
        if (!otherAdmins.length) return fail('Debe quedar al menos un Admin activo.');
      }
      if (userHasRole(existing, ROLES.admin) && active === false) {
        var otherAdmins2 = users.filter(function (u) {
          return u.id !== existing.id && userHasRole(u, ROLES.admin) && u.active;
        });
        if (!otherAdmins2.length) return fail('No podés desactivar el único Admin.');
      }

      var oldEmail = normalizeEmail(existing.email);
      existing.email = email;
      existing.dni = dni;
      applyRolesToUser(existing, roles);
      existing.nombre = nombre;
      existing.apellido = apellido;
      existing.fechaNacimiento = fechaNacimiento;
      existing.reparticion = reparticion;
      existing.active = active;
      existing.updatedAt = new Date().toISOString();
      if (oldEmail !== email) existing.id = userDocId(email);
      saved = existing;
      createdFlag = false;
    } else {
      saved = {
        id: userDocId(email),
        email: email,
        dni: dni,
        role: role,
        roles: roles,
        nombre: nombre,
        apellido: apellido,
        fechaNacimiento: fechaNacimiento,
        reparticion: reparticion,
        active: active,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      users.push(saved);
      createdFlag = true;
    }

    writeUsers(users);

    function okResult() {
      return { ok: true, user: Object.assign({}, findUserByEmail(email) || saved), created: createdFlag };
    }

    if (!initFirebase()) {
      return Promise.resolve(okResult());
    }

    return ensureFirebaseAuthForWrite().then(function () {
      var renameFrom = '';
      if (payloadId && String(payloadId).indexOf('@') !== -1 && userDocId(payloadId) !== userDocId(email)) {
        renameFrom = userDocId(payloadId);
      }

      var ref = _firestore.collection('users').doc(userDocId(email));
      var chain = Promise.resolve();
      if (renameFrom) {
        chain = _firestore.collection('users').doc(renameFrom).delete().catch(function () {});
      }

      return chain.then(function () {
        return ref.set(toFirestorePayload(saved), { merge: true });
      }).then(function () {
        if (normalizeEmail(saved.email) !== normalizeEmail(SEED_ADMIN.email)) {
          return ensureSeedAdminInFirestore();
        }
      }).then(function () {
        return syncFromFirestore();
      }).then(function () {
        return okResult();
      });
    }).catch(function (err) {
      console.error(err);
      return {
        ok: false,
        error: (err && err.message) || 'No se pudo guardar en Firebase.'
      };
    });
  }

  /**
   * Importa usuarios en lote. Cada fila: email, dni, nombre, apellido,
   * fechaNacimiento (opcional), reparticion (opcional), role (opcional), active (opcional).
   * Por defecto no sobrescribe existentes salvo overwrite=true.
   */
  function importUsers(rows, actor, options) {
    options = options || {};
    function fail(msg) { return Promise.resolve({ ok: false, error: msg, created: 0, updated: 0, skipped: 0, errors: [msg] }); }
    if (!isAdminUser(actor)) {
      return fail('Solo Admin puede importar usuarios.');
    }
    if (!Array.isArray(rows) || !rows.length) {
      return fail('No hay filas para importar.');
    }

    var created = 0;
    var updated = 0;
    var skipped = 0;
    var errors = [];
    var chain = Promise.resolve();

    rows.forEach(function (row, index) {
      chain = chain.then(function () {
        var line = index + 2;
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
        var rolesRaw = row.roles != null && String(row.roles).trim() !== ''
          ? row.roles
          : (row.role || row.rol || 'usuarios');
        var activeRaw = row.active !== undefined ? row.active : row.activo;
        var active = true;
        if (activeRaw !== undefined && activeRaw !== null && String(activeRaw).trim() !== '') {
          var s = String(activeRaw).trim().toLowerCase();
          active = !(s === '0' || s === 'false' || s === 'no' || s === 'inactivo');
        }
        return upsertUser({
          email: email,
          dni: row.dni || row.documento,
          nombre: row.nombre || row.name || row.firstname,
          apellido: row.apellido || row.lastname || row.surname,
          fechaNacimiento: row.fechaNacimiento || row.fecha_nacimiento || row.nacimiento || row.birthdate,
          reparticion: row.reparticion || row.repartición || row.area || row.dependencia,
          roles: rolesRaw,
          active: active
        }, actor).then(function (result) {
          if (!result.ok) {
            errors.push('Fila ' + line + ' (' + email + '): ' + result.error);
            return;
          }
          if (result.created) created += 1;
          else updated += 1;
        });
      });
    });

    return chain.then(function () {
      return {
        ok: errors.length === 0 || created + updated > 0,
        created: created,
        updated: updated,
        skipped: skipped,
        errors: errors
      };
    });
  }

  function removeUser(userId, actor) {
    function fail(msg) { return Promise.resolve({ ok: false, error: msg }); }
    if (!isAdminUser(actor)) {
      return fail('Solo Admin puede eliminar usuarios.');
    }
    var users = ensureSeed();
    var targetId = String(userId || '');
    var target = users.find(function (u) { return String(u.id) === targetId; });
    if (!target) {
      target = users.find(function (u) { return normalizeEmail(u.email) === normalizeEmail(targetId); }) || null;
    }
    if (!target) return fail('Usuario no encontrado.');
    if (target.email === normalizeEmail(SEED_ADMIN.email)) {
      return fail('No se puede eliminar el Admin inicial.');
    }
    if (userHasRole(target, ROLES.admin)) {
      var otherAdmins = users.filter(function (u) {
        return u.id !== target.id && userHasRole(u, ROLES.admin) && u.active;
      });
      if (!otherAdmins.length) {
        return fail('Debe quedar al menos un Admin activo.');
      }
    }
    users = users.filter(function (u) {
      return String(u.id) !== String(target.id) && normalizeEmail(u.email) !== normalizeEmail(target.email);
    });
    writeUsers(users);

    if (!initFirebase()) {
      return Promise.resolve({ ok: true });
    }
    return ensureFirebaseAuthForWrite().then(function () {
      return _firestore.collection('users').doc(userDocId(target.email)).delete();
    })
      .then(function () { return syncFromFirestore(); })
      .then(function () { return { ok: true }; })
      .catch(function (err) {
        console.error(err);
        return {
          ok: false,
          error: (err && err.message) || ('No se pudo eliminar en Firebase.')
        };
      });
  }

  function roleLabel(role) {
    return ROLE_LABELS[role] || role;
  }

  function rolesLabel(userOrRoles) {
    return userRoles(
      Array.isArray(userOrRoles) ? { roles: userOrRoles } : userOrRoles
    ).map(roleLabel).join(' · ');
  }

  /**
   * Registra en Firestore una ejecución de procesador (Eleves Acto / Concursos).
   * Solo los admin pueden leer la colección; cualquier usuario autenticado @bue puede crear.
   */
  function logProcessRun(details) {
    details = details || {};
    if (!initFirebase() || !_firestore) {
      return Promise.resolve(null);
    }
    var user = currentUser();
    if (!user || !user.email) return Promise.resolve(null);

    var extras = details.extras && typeof details.extras === 'object' ? details.extras : {};
    var safeExtras = {};
    Object.keys(extras).forEach(function (k) {
      var v = extras[k];
      if (v === undefined) return;
      if (v !== null && typeof v === 'object') {
        try { safeExtras[k] = JSON.parse(JSON.stringify(v)); } catch (e) {}
        return;
      }
      safeExtras[k] = v;
    });

    var payload = {
      ts: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString(),
      email: normalizeEmail(user.email),
      nombre: String(user.nombre || ''),
      apellido: String(user.apellido || ''),
      reparticion: String(user.reparticion || ''),
      module: String(details.module || ''),
      moduleLabel: String(details.moduleLabel || ''),
      procesador: String(details.procesador || ''),
      procesadorLabel: String(details.procesadorLabel || ''),
      archivoOrigen: String(details.archivoOrigen || ''),
      archivoSalida: String(details.archivoSalida || ''),
      filas: Number(details.filas) || 0,
      area: String(details.area || ''),
      detalle: String(details.detalle || ''),
      extras: safeExtras
    };

    return _firestore.collection('process_logs').add(payload).catch(function (err) {
      console.warn('No se pudo guardar el log del proceso', err);
      return null;
    });
  }

  /** Lista logs de procesos. Solo admin. */
  function listProcessLogs(options) {
    options = options || {};
    var actor = currentUser();
    if (!isAdminUser(actor)) {
      return Promise.reject(new Error('Solo administradores pueden ver el log de procesos.'));
    }
    if (!initFirebase() || !_firestore) {
      return Promise.reject(new Error('Firebase no está disponible.'));
    }
    var limit = Math.min(Math.max(Number(options.limit) || 200, 1), 500);
    return _firestore.collection('process_logs')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
      .then(function (snap) {
        return snap.docs.map(function (doc) {
          var d = doc.data() || {};
          return {
            id: doc.id,
            createdAt: d.createdAt || '',
            ts: d.ts || null,
            email: d.email || '',
            nombre: d.nombre || '',
            apellido: d.apellido || '',
            reparticion: d.reparticion || '',
            module: d.module || '',
            moduleLabel: d.moduleLabel || '',
            procesador: d.procesador || '',
            procesadorLabel: d.procesadorLabel || '',
            archivoOrigen: d.archivoOrigen || '',
            archivoSalida: d.archivoSalida || '',
            filas: d.filas || 0,
            area: d.area || '',
            detalle: d.detalle || '',
            extras: d.extras || {}
          };
        });
      });
  }

  var VACANTES_CARGAS_COL = 'vacantes_provisorias_cargas';
  var VACANTES_CHUNKS_COL = 'vacantes_provisorias_chunks';
  var VACANTES_IDB_NAME = 'coreap-vacantes-provisorias';
  var VACANTES_IDB_VERSION = 1;
  var VACANTES_CHUNK_SIZE = 80;

  function vacantesCargaId() {
    return 'vp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function openVacantesIdb() {
    return new Promise(function (resolve, reject) {
      if (!global.indexedDB) {
        reject(new Error('IndexedDB no está disponible en este navegador.'));
        return;
      }
      var req = indexedDB.open(VACANTES_IDB_NAME, VACANTES_IDB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('cargas')) {
          db.createObjectStore('cargas', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chunks')) {
          db.createObjectStore('chunks', { keyPath: 'id' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('No se pudo abrir IndexedDB.')); };
    });
  }

  function idbTxDone(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('Transacción abortada.')); };
    });
  }

  function idbGetAll(storeName) {
    return openVacantesIdb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, 'readonly');
        var req = tx.objectStore(storeName).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function chunkRows(rows, size) {
    var out = [];
    var i;
    for (i = 0; i < rows.length; i += size) {
      out.push(rows.slice(i, i + size));
    }
    if (!out.length) out.push([]);
    return out;
  }

  function saveVacantesCargaIdb(meta, rows) {
    var chunks = chunkRows(rows || [], VACANTES_CHUNK_SIZE);
    meta.chunkCount = chunks.length;
    meta.filas = (rows || []).length;
    return Promise.all([idbGetAll('cargas'), idbGetAll('chunks')]).then(function (pair) {
      var cargas = pair[0] || [];
      var allChunks = pair[1] || [];
      var toDelete = cargas.filter(function (c) {
        return c.periodo === meta.periodo && c.id !== meta.id;
      });
      var deleteIds = {};
      toDelete.forEach(function (c) { deleteIds[c.id] = true; });
      return openVacantesIdb().then(function (db) {
        var tx = db.transaction(['cargas', 'chunks'], 'readwrite');
        var cargasStore = tx.objectStore('cargas');
        var chunksStore = tx.objectStore('chunks');
        toDelete.forEach(function (c) { cargasStore.delete(c.id); });
        allChunks.forEach(function (ch) {
          if (deleteIds[ch.cargaId]) chunksStore.delete(ch.id);
        });
        cargasStore.put(meta);
        chunks.forEach(function (part, idx) {
          chunksStore.put({
            id: meta.id + '_' + idx,
            cargaId: meta.id,
            periodo: meta.periodo,
            index: idx,
            rows: part
          });
        });
        return idbTxDone(tx);
      });
    }).then(function () { return meta; });
  }

  function listVacantesCargasIdb() {
    return idbGetAll('cargas').then(function (list) {
      return list.sort(function (a, b) {
        return String(b.periodo || '').localeCompare(String(a.periodo || ''))
          || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
    });
  }

  function loadVacantesRowsIdb() {
    return Promise.all([idbGetAll('cargas'), idbGetAll('chunks')]).then(function (pair) {
      var cargas = pair[0] || [];
      var chunks = pair[1] || [];
      var cargaIds = {};
      cargas.forEach(function (c) { cargaIds[c.id] = true; });
      chunks.sort(function (a, b) {
        var cmp = String(a.cargaId || '').localeCompare(String(b.cargaId || ''));
        if (cmp) return cmp;
        return (a.index || 0) - (b.index || 0);
      });
      var rows = [];
      chunks.forEach(function (ch) {
        if (!cargaIds[ch.cargaId]) return;
        (ch.rows || []).forEach(function (r) { rows.push(r); });
      });
      return { cargas: cargas, rows: rows };
    });
  }

  function deleteVacantesCargaIdb(cargaId) {
    return openVacantesIdb().then(function (db) {
      return idbGetAll('chunks').then(function (chunks) {
        var tx = db.transaction(['cargas', 'chunks'], 'readwrite');
        tx.objectStore('cargas').delete(cargaId);
        chunks.forEach(function (ch) {
          if (ch.cargaId === cargaId) tx.objectStore('chunks').delete(ch.id);
        });
        return idbTxDone(tx);
      });
    });
  }

  function firestoreVacantesReady() {
    return !!(initFirebase() && _firestore);
  }

  function deleteFirestoreCargasForPeriodo(periodo, keepId) {
    if (!firestoreVacantesReady()) return Promise.resolve();
    return _firestore.collection(VACANTES_CARGAS_COL).where('periodo', '==', periodo).get()
      .then(function (snap) {
        var ids = [];
        snap.forEach(function (doc) {
          if (doc.id !== keepId) ids.push(doc.id);
        });
        if (!ids.length) return;
        return _firestore.collection(VACANTES_CHUNKS_COL).get().then(function (chunkSnap) {
          var batch = _firestore.batch();
          var ops = 0;
          var chain = Promise.resolve();
          function flush() {
            if (!ops) return Promise.resolve();
            var current = batch;
            batch = _firestore.batch();
            ops = 0;
            return current.commit();
          }
          chunkSnap.forEach(function (doc) {
            var d = doc.data() || {};
            if (ids.indexOf(d.cargaId) === -1) return;
            batch.delete(doc.ref);
            ops += 1;
            if (ops >= 400) {
              chain = chain.then(flush);
            }
          });
          ids.forEach(function (id) {
            batch.delete(_firestore.collection(VACANTES_CARGAS_COL).doc(id));
            ops += 1;
            if (ops >= 400) chain = chain.then(flush);
          });
          return chain.then(flush);
        });
      });
  }

  function saveVacantesCargaFirestore(meta, rows) {
    if (!firestoreVacantesReady()) return Promise.resolve(null);
    var chunks = chunkRows(rows || [], VACANTES_CHUNK_SIZE);
    meta.chunkCount = chunks.length;
    meta.filas = (rows || []).length;
    return ensureFirebaseAuthForWrite().then(function () {
      return deleteFirestoreCargasForPeriodo(meta.periodo, meta.id);
    }).then(function () {
      var batch = _firestore.batch();
      var ops = 0;
      var chain = Promise.resolve();
      function flush() {
        if (!ops) return Promise.resolve();
        var current = batch;
        batch = _firestore.batch();
        ops = 0;
        return current.commit();
      }
      batch.set(_firestore.collection(VACANTES_CARGAS_COL).doc(meta.id), meta);
      ops += 1;
      chunks.forEach(function (part, idx) {
        batch.set(_firestore.collection(VACANTES_CHUNKS_COL).doc(meta.id + '_' + idx), {
          cargaId: meta.id,
          periodo: meta.periodo,
          index: idx,
          rows: part
        });
        ops += 1;
        if (ops >= 400) chain = chain.then(flush);
      });
      return chain.then(flush);
    }).then(function () { return meta; });
  }

  function listVacantesCargasFirestore() {
    if (!firestoreVacantesReady()) return Promise.resolve(null);
    return _firestore.collection(VACANTES_CARGAS_COL).get().then(function (snap) {
      var list = [];
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        d.id = doc.id;
        list.push(d);
      });
      list.sort(function (a, b) {
        return String(b.periodo || '').localeCompare(String(a.periodo || ''))
          || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
      return list;
    });
  }

  function loadVacantesRowsFirestore() {
    if (!firestoreVacantesReady()) return Promise.resolve(null);
    return Promise.all([
      _firestore.collection(VACANTES_CARGAS_COL).get(),
      _firestore.collection(VACANTES_CHUNKS_COL).get()
    ]).then(function (pair) {
      var cargas = [];
      var cargaIds = {};
      pair[0].forEach(function (doc) {
        var d = doc.data() || {};
        d.id = doc.id;
        cargas.push(d);
        cargaIds[doc.id] = true;
      });
      var chunks = [];
      pair[1].forEach(function (doc) {
        var d = doc.data() || {};
        d.id = doc.id;
        chunks.push(d);
      });
      chunks.sort(function (a, b) {
        var cmp = String(a.cargaId || '').localeCompare(String(b.cargaId || ''));
        if (cmp) return cmp;
        return (a.index || 0) - (b.index || 0);
      });
      var rows = [];
      chunks.forEach(function (ch) {
        if (!cargaIds[ch.cargaId]) return;
        (ch.rows || []).forEach(function (r) { rows.push(r); });
      });
      return { cargas: cargas, rows: rows, source: 'firestore' };
    });
  }

  function deleteVacantesCargaFirestore(cargaId) {
    if (!firestoreVacantesReady()) return Promise.resolve();
    return ensureFirebaseAuthForWrite().then(function () {
      return _firestore.collection(VACANTES_CHUNKS_COL).where('cargaId', '==', cargaId).get();
    }).then(function (snap) {
      var batch = _firestore.batch();
      var ops = 0;
      var chain = Promise.resolve();
      function flush() {
        if (!ops) return Promise.resolve();
        var current = batch;
        batch = _firestore.batch();
        ops = 0;
        return current.commit();
      }
      snap.forEach(function (doc) {
        batch.delete(doc.ref);
        ops += 1;
        if (ops >= 400) chain = chain.then(flush);
      });
      batch.delete(_firestore.collection(VACANTES_CARGAS_COL).doc(cargaId));
      ops += 1;
      return chain.then(flush);
    });
  }

  function canAccessVacantes(user) {
    return canAccess(MODULES.vacantes_provisorias, user);
  }

  /**
   * Guarda una carga mensual de vacantes (reemplaza el período si ya existía).
   * Escribe IndexedDB siempre; Firestore si hay sesión Firebase.
   */
  function saveVacantesCarga(details) {
    details = details || {};
    var user = currentUser();
    if (!user || !canAccessVacantes(user)) {
      return Promise.reject(new Error('No tenés permiso para cargar vacantes provisorias.'));
    }
    var rows = Array.isArray(details.rows) ? details.rows : [];
    var meta = {
      id: details.id || vacantesCargaId(),
      periodo: String(details.periodo || '').trim(),
      archivo: String(details.archivo || ''),
      filas: rows.length,
      createdAt: new Date().toISOString(),
      email: normalizeEmail(user.email),
      nombre: displayName(user),
      detalle: String(details.detalle || '')
    };
    if (!meta.periodo) {
      return Promise.reject(new Error('Indicá el período (mes) de la carga.'));
    }
    return saveVacantesCargaIdb(meta, rows).then(function () {
      if (!firestoreVacantesReady()) {
        return { ok: true, meta: meta, source: 'local' };
      }
      return saveVacantesCargaFirestore(meta, rows).then(function () {
        return { ok: true, meta: meta, source: 'firestore' };
      }).catch(function (err) {
        console.warn('Vacantes: no se pudo guardar en Firestore', err);
        return { ok: true, meta: meta, source: 'local', warning: (err && err.message) || 'Sin sync en la nube' };
      });
    });
  }

  function listVacantesCargas() {
    var user = currentUser();
    if (!user || !canAccessVacantes(user)) {
      return Promise.reject(new Error('No tenés permiso para ver vacantes provisorias.'));
    }
    if (!firestoreVacantesReady()) return listVacantesCargasIdb();
    return listVacantesCargasFirestore().then(function (list) {
      if (list && list.length) return list;
      return listVacantesCargasIdb();
    }).catch(function (err) {
      console.warn('Vacantes: listado Firestore', err);
      return listVacantesCargasIdb();
    });
  }

  function loadVacantesRows() {
    var user = currentUser();
    if (!user || !canAccessVacantes(user)) {
      return Promise.reject(new Error('No tenés permiso para ver vacantes provisorias.'));
    }
    if (!firestoreVacantesReady()) {
      return loadVacantesRowsIdb().then(function (data) {
        data.source = 'local';
        return data;
      });
    }
    return loadVacantesRowsFirestore().then(function (data) {
      if (data && data.rows && data.rows.length) return data;
      return loadVacantesRowsIdb().then(function (local) {
        local.source = local.rows && local.rows.length ? 'local' : 'empty';
        return local;
      });
    }).catch(function (err) {
      console.warn('Vacantes: lectura Firestore', err);
      return loadVacantesRowsIdb().then(function (local) {
        local.source = 'local';
        local.warning = (err && err.message) || '';
        return local;
      });
    });
  }

  function deleteVacantesCarga(cargaId) {
    var user = currentUser();
    if (!user || !canAccessVacantes(user)) {
      return Promise.reject(new Error('No tenés permiso para borrar vacantes provisorias.'));
    }
    if (!cargaId) return Promise.reject(new Error('Falta el identificador de la carga.'));
    return deleteVacantesCargaIdb(cargaId).then(function () {
      if (!firestoreVacantesReady()) return { ok: true };
      return deleteVacantesCargaFirestore(cargaId).then(function () {
        return { ok: true };
      }).catch(function (err) {
        console.warn('Vacantes: no se pudo borrar en Firestore', err);
        return { ok: true, warning: (err && err.message) || '' };
      });
    });
  }

  function describePermissions(roleOrUser) {
    var map = {
      acto_publico: 'Acto Público',
      clasificacion: 'Clasificación',
      estatuto: 'Estatuto',
      cronograma: 'Cronograma',
      eleves_acto: 'Eleves Acto Público',
      eleves_concursos: 'Eleves Concursos',
      control_pof: 'Control POF',
      vacantes_provisorias: 'Vacantes Provisorias',
      admin_usuarios: 'Gestión de usuarios',
      admin_logs: 'Log de procesos'
    };
    var mods = roleOrUser && typeof roleOrUser === 'object'
      ? permissionsForUser(roleOrUser)
      : permissionsFor(roleOrUser);
    return mods.map(function (k) { return map[k] || k; });
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
    normalizeRoles: normalizeRoles,
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
    permissionsForUser: permissionsForUser,
    userRoles: userRoles,
    userHasRole: userHasRole,
    isAdminUser: isAdminUser,
    upsertUser: upsertUser,
    importUsers: importUsers,
    removeUser: removeUser,
    logProcessRun: logProcessRun,
    listProcessLogs: listProcessLogs,
    saveVacantesCarga: saveVacantesCarga,
    listVacantesCargas: listVacantesCargas,
    loadVacantesRows: loadVacantesRows,
    deleteVacantesCarga: deleteVacantesCarga,
    roleLabel: roleLabel,
    rolesLabel: rolesLabel,
    describePermissions: describePermissions,
    ensureSeed: ensureSeed,
    ready: ready,
    whenSynced: whenSynced,
    isFirebaseEnabled: isFirebaseEnabled,
    syncFromFirestore: syncFromFirestore
  };
})(window);
