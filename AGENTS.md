# COREAP

Portal COREAP — a static web portal for the GCBA "Dirección de Carrera Docente" (teacher career management). It is a collection of self-contained HTML pages with no build step, no package manager, and no server-side code.

## Structure

- `index.html` — portal home; navigation hub linking to the module pages below.
- `login.html` — login (email `@bue.edu.ar` + DNI against preloaded users).
- `admin-usuarios.html` — admin panel to preload users and assign roles.
- `auth.js` — client-side auth, roles, and permissions.
- `actopublico_final.html` — "Acto Público" module (rules/priorities/escalafones).
- `seguimiento_final.html` — "Seguimiento" module (expediente tracking).
- `clasificacion_final.html` — "Clasificación" module (scoring/listados).
- `Elevador.html` — "Eleves Acto Publico".
- `Elevador-Control.html` — "Eleves Concursos" (client-side spreadsheet processor titled "Procesador de Vacantes").
- `Control-POF.html` — "Control POF": cruzá archivo POF (filtro CARACTER=TITULAR) con un segundo listado de docentes por documento, cargo y asignatura (sin ID PLAN / COD ESPECIALIDAD); Excel de coincidencias / no coincidencias en formato POF.

Each page is fully self-contained: CSS lives in inline `<style>` blocks and JS in inline `<script>` blocks (except shared `auth.js`). Third-party libraries (e.g. `xlsx`, Google Fonts) load from CDNs at runtime, so an internet connection is needed for full functionality of the processor pages.

## Auth & roles

- Login with Google (same pattern as https://actopublico.bue.edu.ar/login): button **Ingresá con tu cuenta @bue.edu.ar**.
- Only preloaded users with `@bue.edu.ar` email can enter after Google auth.
- Configure `googleClientId` in `auth-config.js` (Google Cloud OAuth Web Client ID; add the portal URL as authorized JavaScript origin).
- Roles: **Admin** (all + manage users), **APEL** (Eleves Acto Público + Manuales), **Concursos** (Eleves Concursos + Manuales), **Listados** (Control POF + Manuales), **Usuarios** (Manuales only).
- Control POF is visible only to **Admin** and **Listados**.
- Manuales = Acto Público, Clasificación, Estatuto.
- Seed admin: `jonathanalejandro.perez@bue.edu.ar` / DNI `00000000` (DNI is for the user registry; change from Usuarios panel).
- User store and session live in browser storage (`localStorage` / `sessionStorage`) — suitable for an internal static portal; not a hardened server-side auth system.

## Cursor Cloud specific instructions

- There are no dependencies to install and nothing to build — this is a pure static HTML site. There is no lint/test/build tooling in the repo.
- To run it, serve the repo root with any static file server and open `index.html`. Example: `python3 -m http.server 8000` (run from the repo root), then browse `http://localhost:8000/index.html`. Opening the files via `file://` also works, but a server is closer to the real deployment and avoids any path/CORS surprises.
- The `Elevador.html`, `Elevador-Control.html` and `Control-POF.html` processors load the `xlsx` library from a CDN and process user-uploaded `.csv`/`.xls`/`.xlsx` files entirely in the browser; testing their full flow requires uploading a spreadsheet.
