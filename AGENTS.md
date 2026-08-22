# COREAP

Portal COREAP — a static web portal for the GCBA "Dirección de Carrera Docente" (teacher career management). It is a collection of self-contained HTML pages with no build step, no package manager, and no server-side code.

## Structure

- `index.html` — portal home; navigation hub linking to the module pages below.
- `actopublico_final.html` — "Acto Público" module (rules/priorities/escalafones).
- `seguimiento_final.html` — "Seguimiento" module (expediente tracking).
- `clasificacion_final.html` — "Clasificación" module (scoring/listados).
- `Elevador.html` — "Eleves Acto Publico".
- `Elevador-Control.html` — "Eleves Concursos" (client-side spreadsheet processor titled "Procesador de Vacantes").

Each page is fully self-contained: CSS lives in inline `<style>` blocks and JS in inline `<script>` blocks. Third-party libraries (e.g. `xlsx`, Google Fonts) load from CDNs at runtime, so an internet connection is needed for full functionality of the processor pages.

## Cursor Cloud specific instructions

- There are no dependencies to install and nothing to build — this is a pure static HTML site. There is no lint/test/build tooling in the repo.
- To run it, serve the repo root with any static file server and open `index.html`. Example: `python3 -m http.server 8000` (run from the repo root), then browse `http://localhost:8000/index.html`. Opening the files via `file://` also works, but a server is closer to the real deployment and avoids any path/CORS surprises.
- The `Elevador.html` and `Elevador-Control.html` processors load the `xlsx` library from a CDN and process user-uploaded `.csv`/`.xls`/`.xlsx` files entirely in the browser; testing their full flow requires uploading a spreadsheet.
