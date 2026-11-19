# contaclub-web

Sitio de **ContaClub** (`contaclub.online`): cuentas de negocio propias,
sin pasar por la membresía de El Club de la Gente.

## Arquitectura

Mismo proyecto de Supabase que `el-club-de-la-gente`, mismas tablas
(`aliados`, `perfiles`, `negocio_*`). Un negocio de ContaClub es, por
debajo, una fila de `aliados` con `contaclub_standalone = true` -- nunca
aparece en el Directorio ni el landing del Club (ver el filtro en
`app-cms.js`/`directorio.js` de ese repo).

Este repo **no duplica** `dashboard.js`/`carta.js`/`carta.css`/
`supabase.js`/`styles.css`: los carga cruzado directo desde
`https://elclubdelagente.com/...` con `<script type="module" src="...">`
y `<link rel="stylesheet" href="...">`. Funciona entre dominios porque:

- El navegador solo bloquea `fetch()` cruzado por CORS, no la carga de un
  `<script src="...">` ni de un `<link rel="stylesheet">`.
- Los `import` relativos DENTRO de esos módulos (ej. `dashboard.js`
  importando `./supabase.js`) se resuelven contra la URL del módulo, no
  contra la página que lo cargó -- así que siempre apuntan a
  `elclubdelagente.com`, sin importar desde qué dominio se haya cargado
  `dashboard.js`.
- `localStorage`/cookies sí son por dominio del DOCUMENTO (no del script),
  así que la sesión de alguien en `contaclub.online` queda aislada de su
  sesión en `elclubdelagente.com`, aunque ambas usen el mismo backend.

Cambio en el único archivo compartido que se toca,
[`dashboard.js`](https://github.com/clubdelagente-blip/el-club-de-la-gente/blob/main/dashboard.js):
su bootstrap reconoce esta página por el id `#contaclub-root` (que
`Perfil.html` nunca tiene) y llama a `iniciarContaClubDashboard()` en vez
de todo el bootstrap del dashboard de miembro del Club.

## Páginas

- `index.html` — landing simple.
- `registro.html` / `registro.js` — alta de un negocio nuevo (sin
  membresía). Crea su fila en `perfiles` (`rol: 'aliado'`) y `aliados`
  (`contaclub_standalone: true, activo: false`).
- `login.html` / `login.js` — inicio de sesión genérico
  (`signInWithPassword`). Si venía de un registro con confirmación de
  correo pendiente, termina de crear las filas acá (en el primer login real,
  cuando ya hay sesión y `auth.uid()` existe).
- `dashboard.html` — copia del bloque `#negtab-contabilidad` de
  `Perfil.html` (mismos ids -- `dashboard.js` los referencia tal cual),
  envuelta en `#contaclub-root`.
- `Carta.html` — la carta pública (idéntica a la del repo principal,
  cargando `carta.css`/`carta.js` cruzado), para que el QR de un negocio
  de ContaClub apunte a su propio dominio.

## Al tocar algo del repo principal que esto usa

Si cambia `dashboard.js`, `carta.js`, `carta.css` o `styles.css` en
`el-club-de-la-gente` y se sube un `?v=` nuevo, hay que actualizar esa
misma versión acá (`dashboard.html`, `Carta.html`) en un commit aparte.
