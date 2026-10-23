# Top Respuestas

Juego de encuestas para el aula, al estilo de "100 Mexicanos Dijeron". Una sola laptop maneja dos pantallas: el **panel del conductor** (`/juego/panel`) en la laptop y el **tablero** (`/tablero`) en el proyector. Funciona **sin internet**: es una PWA y guarda todo en el navegador (IndexedDB).

La especificación completa está en [`docs/SPEC.md`](docs/SPEC.md).

## Usarlo en tu computadora (sin deploy)

Necesitas [Node.js](https://nodejs.org) 22 o más reciente (una sola vez).

1. Haz doble clic en **`iniciar-top-respuestas.bat`**. La primera vez instala dependencias y compila la app; después abre directo.
2. Se abre `http://localhost:4173`. Deja la ventana negra abierta mientras juegas.
3. Usa **siempre esa dirección y el mismo navegador** (Chrome o Edge): tus preguntas y partidas se guardan por dirección, así que otra dirección o navegador empieza vacío.

Sin el `.bat`: `npm install`, luego `npm run local` (compila y sirve). Si ya compilaste, `npm run servir` basta.

Para actualizar la app tras cambiar código: `npm run local`.

### Antes de una clase

- Abre la app **una vez con la ventana negra corriendo** para que el navegador guarde todo para uso sin conexión (se instala sola; también puedes usar "Instalar app" en Chrome).
- Descarga un respaldo desde **Respaldos** y guárdalo en una memoria USB o en la nube.
- Proyector: conéctalo en modo **pantalla extendida**. En el panel pulsa "Abrir tablero en el proyector"; en Chrome o Edge te pedirá permiso para ver las pantallas y lo abrirá en el proyector. Haz un clic dentro del tablero para ponerlo en pantalla completa.

## Desarrollo

| Comando                             | Qué hace                                        |
| ----------------------------------- | ----------------------------------------------- |
| `npm run dev`                       | Servidor de desarrollo                          |
| `npm run build`                     | Compila (TypeScript + Vite) y genera el PWA     |
| `npm run servir`                    | Sirve lo compilado en `http://localhost:4173`   |
| `npm run local`                     | Compila y sirve                                 |
| `npm run typecheck`                 | Revisa tipos                                    |
| `npm run lint`                      | ESLint sin advertencias                         |
| `npm run format:check`              | Revisa el formato con Prettier                  |
| `npm run test`                      | Pruebas con Vitest                              |
| `npm run test:coverage`             | Cobertura del motor del juego                   |
| `npm run icons` / `npm run sonidos` | Regenera los iconos PWA / los efectos de sonido |

Antes de cada commit corre `typecheck`, `lint`, `format:check` y `test`. Las decisiones de arquitectura están en [`CLAUDE.md`](CLAUDE.md) y el avance por fases en `odd/tasks/`.

## Desplegar en Vercel

La app es un sitio estático: no necesita servidor ni variables de entorno.

1. Sube el repositorio a GitHub e impórtalo en [Vercel](https://vercel.com/new).
2. Vercel detecta Vite: comando `npm run build`, carpeta de salida `dist`.
3. `vercel.json` ya redirige todas las rutas a `index.html`, así que `/tablero` o `/juego/panel` funcionan al recargar.

Cada dirección (dominio) guarda sus propios datos. Si pasas de `localhost` a Vercel, lleva tus preguntas con un respaldo.

## Formato de importación

Una fila por pregunta, en un archivo `.xlsx` o `.csv`. Descarga las plantillas desde **Importar** (funcionan sin internet).

```
Tema | Pregunta | R1 | Pts1 | R2 | Pts2 | … | R8 | Pts8 | Sinónimos
```

- Obligatoria: `Pregunta` y al menos `R1`. Cada respuesta lleva sus puntos (`Pts1`, o `Puntos1`); hasta 8 respuestas.
- Las respuestas se ordenan por puntos automáticamente.
- **Sinónimos**: `R1: auto, coche; R3: celular` (la respuesta, dos puntos y los sinónimos separados por coma; varias respuestas separadas por punto y coma).
- Los encabezados no distinguen mayúsculas, acentos ni espacios; el orden de las columnas es libre y las columnas desconocidas se ignoran.
- En CSV se aceptan `,` o `;` como separador. Se lee UTF-8 y, si falla, Windows-1252 (Excel en Windows).
- La vista previa muestra qué filas son válidas y el motivo exacto de cada error. Las advertencias (por ejemplo, duplicados) no bloquean la importación.

## Respaldos

En **Respaldos** puedes descargar todos tus datos (sets, preguntas, juegos y partidas) en un archivo `.json` y restaurarlo después:

- **Combinar**: agrega lo que falta y, si un registro está en los dos lados, conserva la copia más reciente. No borra nada.
- **Reemplazar**: borra los datos de este navegador y deja lo que trae el archivo (pide confirmación).

Un archivo dañado, de otra app o de una versión más nueva se rechaza con un mensaje y no cambia nada.

## Tecnología

React, Vite, TypeScript (strict), Tailwind CSS, Dexie (IndexedDB), Zod, BroadcastChannel, vite-plugin-pwa, SheetJS, PapaParse, Howler, Motion y Vitest.
