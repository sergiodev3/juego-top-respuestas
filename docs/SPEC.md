# Proyecto: "Top Respuestas" — juego de encuestas para el aula

## Contexto

Soy docente de tecnología y programación (secundaria y bachillerato técnico, México). Quiero una app web tipo "100 Mexicanos Dijeron" / Family Feud para usarla como recurso didáctico en clase. Se usará así:

- Una sola laptop conectada a un proyector en **modo pantalla extendida**.
- **Pantalla 1 (laptop):** panel del conductor (yo). Ve todas las respuestas y controla el juego.
- **Pantalla 2 (proyector):** tablero que ven los alumnos. Solo muestra lo revelado.
- Los equipos usan **botones físicos con sonido** (no conectados a la computadora). El conductor indica en el panel qué equipo ganó el turno.
- El internet de la escuela es inestable: la app debe ser **local-first** y funcionar completamente sin conexión.
- Configurar un juego debe tomar muy poco tiempo: importar preguntas desde Excel/CSV es una función prioritaria.

**Importante:** Toda la interfaz en español (México).

## Stack (obligatorio)

- React + Vite + TypeScript (modo `strict`) + Tailwind CSS
- **Dexie.js** (IndexedDB) para toda la persistencia
- **BroadcastChannel API** para sincronizar panel y tablero
- **Window Management API** (`getScreenDetails`) para abrir el tablero en la segunda pantalla, con fallback a `window.open` + instrucciones para arrastrarla y poner pantalla completa
- **vite-plugin-pwa** para que se instale y funcione offline
- **Zustand** para estado de UI
- **Zod** para validación de datos importados y de mensajes entre ventanas
- **SheetJS** para .xlsx (instalar desde el CDN oficial de SheetJS, no la versión desactualizada de npm) y **PapaParse** para .csv
- **Framer Motion** para animaciones, **Howler.js** para sonidos
- **Vitest** para pruebas
- React Router para las vistas
- Sin backend en esta versión. Despliegue como sitio estático en Vercel. Diseña la capa de datos detrás de un repositorio/interfaz para poder agregar sincronización con un backend (Express + PostgreSQL en Railway) en el futuro sin reescribir la app.

## Arquitectura

### Motor del juego (pieza central)
- Lógica pura en TypeScript, **sin dependencias de React**, en `src/engine/`.
- Basado en eventos: `estado = reducir(estadoInicial, eventos[])`. Esto da "deshacer" gratis (quitar el último evento) y un historial.
- La partida en curso (configuración + lista de eventos) se guarda en Dexie después de cada acción. Si se recarga o cierra el navegador, la partida se recupera exactamente donde iba.
- Cobertura de pruebas alta con Vitest en todas las reglas.

### Estados de una ronda
`caraACara → enJuego → robo → finDeRonda`, más `rondaFinal` y `juegoTerminado`.

### Acciones (eventos)
- `ASIGNAR_TURNO(equipo)` — quién presionó primero el botón físico
- `REVELAR(indiceRespuesta)`
- `TACHE`
- `JUGAR` / `PASAR` (tras el cara a cara)
- `ROBO_EXITOSO(indice)` / `ROBO_FALLIDO`
- `REVELAR_TODAS` (al final de la ronda, sin sumar puntos)
- `AJUSTAR_PUNTOS(equipo, delta)` — corrección manual
- `SIGUIENTE_RONDA`
- `DESHACER`

### Reglas (todas configurables)
- 2 equipos por defecto (permitir hasta 4), con nombre y color.
- Cara a cara: un representante de cada equipo; quien da la respuesta con más puntos elige jugar o pasar.
- El equipo en turno responde hasta revelar todas o acumular 3 tachas.
- Con 3 tachas, el otro equipo tiene una oportunidad de robar: si acierta, se lleva todos los puntos acumulados de la ronda.
- Multiplicador por ronda (x1, x2, x3).
- Número de rondas configurable.
- Ronda final opcional ("Respuesta rápida"): 2 jugadores, 5 preguntas, temporizador (20 s y 25 s por defecto), meta de puntos (200 por defecto), aviso de respuesta repetida.

### Sincronización panel ↔ tablero
- El panel es la única fuente de verdad. El tablero es de solo lectura.
- Mensajes tipados y validados con Zod.
- Al abrirse, el tablero pide el estado completo. Si se cierra y se reabre, se recupera solo.

## Modelo de datos (Dexie)

- **Sets de preguntas:** id, nombre, materia, tema, grupo, fechas
- **Preguntas:** id, setId, texto, respuestas (texto, puntos, sinónimos aceptados opcionales), máximo 8 respuestas, ordenadas por puntos
- **Juegos (configuraciones guardadas):** equipos, reglas, rondas con preguntas asignadas y multiplicador
- **Partidas:** juegoId, eventos, estado (en curso / terminada), fechas
- Incluir migraciones/versionado de Dexie desde el inicio.
- Llamar a `navigator.storage.persist()` al iniciar.

## Vistas

1. **Inicio:** continuar partida en curso, nuevo juego rápido, banco de preguntas, respaldos.
2. **Banco de preguntas:** CRUD de sets y preguntas, búsqueda, filtros por tema, duplicar.
3. **Importar:**
   - Plantillas descargables .xlsx y .csv, una fila por pregunta:
     `Tema | Pregunta | R1 | Pts1 | R2 | Pts2 | … | R8 | Pts8 | Sinónimos`
     (sinónimos con formato `R1: auto, coche; R3: celular`)
   - Arrastrar y soltar archivo
   - Vista previa con filas válidas e inválidas, y el motivo exacto del error por fila
   - Ordenar respuestas por puntos automáticamente
   - Botón "Importar y jugar" que crea un juego con valores por defecto en un paso
4. **Configurar juego:** equipos, reglas, rondas, selección de preguntas (manual, por tema o aleatoria). Valores por defecto sensatos para que se pueda iniciar con 2 clics.
5. **Panel del conductor:**
   - Pregunta actual con todas las respuestas, sus puntos y sinónimos
   - Indicador de qué está visible en el tablero
   - Marcador, tachas, turno, multiplicador, estado de la ronda
   - Botón para abrir/reconectar el tablero en el proyector
   - **Atajos de teclado** (con hoja de ayuda visible con `?`): `1`–`8` revelar, `X` tache, `A`/`B`/`C`/`D` asignar turno a un equipo, `Z` deshacer, `Espacio` siguiente, `R` revelar todas, `M` silenciar sonido
   - Confirmación antes de acciones destructivas (terminar partida, siguiente ronda con respuestas sin revelar)
6. **Tablero (proyector):**
   - Diseñado para proyector: tipografía muy grande, alto contraste, legible desde el fondo del salón
   - Animación de volteo al revelar, X grandes al marcar tache, animación al sumar puntos
   - Sonidos: acierto, tache, revelar, ganador (efectos de licencia libre o generados; incluir créditos si aplica)
   - Pantalla completa con un clic; ocultar cursor tras inactividad
   - Pantalla de espera con el nombre del juego entre rondas
7. **Impresión de tarjetas del conductor:**
   - CSS `@media print`, tamaño carta, 2 tarjetas por hoja (opción de 4), con líneas de corte
   - Cada tarjeta: número/ID, tema, pregunta grande, respuestas ordenadas con puntos y sinónimos
   - Imprimir un set completo o solo las preguntas de un juego
   - Hoja de marcador en papel opcional como respaldo
8. **Respaldos:** exportar todo a JSON, importar/restaurar JSON (con opción de combinar o reemplazar).

## Calidad

- TypeScript estricto, sin `any`. ESLint + Prettier.
- Estructura por funcionalidades: `src/engine`, `src/db`, `src/features/{banco,importar,juego,tablero,impresion,respaldos}`, `src/shared`.
- Componentes accesibles (foco visible, contraste, etiquetas).
- Manejo de errores amable y en español; nunca perder datos del usuario.
- Incluir datos de ejemplo (un set con 10 preguntas de cultura general escolar) para probar de inmediato.
- README con instrucciones para correr, compilar, desplegar en Vercel y el formato de importación.

## Forma de trabajo

1. **Antes de escribir código**, revisa este documento y presenta un plan: estructura de carpetas, tipos principales del motor y del modelo de datos, y dudas o contradicciones que encuentres. Espera mi aprobación.
2. Trabaja **por fases**. Al terminar cada una: corre pruebas y lint, haz commit con un mensaje descriptivo, resume qué se hizo y cómo probarlo, y **espera mi visto bueno** antes de continuar.
   - **Fase 0:** scaffold del proyecto, herramientas, estructura de carpetas, Tailwind, PWA básica
   - **Fase 1:** modelo de datos con Dexie + banco de preguntas (CRUD) + datos de ejemplo
   - **Fase 2:** importación .xlsx/.csv con plantillas, vista previa y validación
   - **Fase 3:** motor del juego con pruebas completas (sin UI)
   - **Fase 4:** configuración de juego + panel del conductor + tablero sincronizado + segunda pantalla
   - **Fase 5:** animaciones, sonidos, atajos de teclado, pulido visual para proyector
   - **Fase 6:** impresión de tarjetas
   - **Fase 7:** respaldos JSON, PWA offline completa, README y despliegue
3. Si una decisión técnica no está cubierta aquí y tiene consecuencias importantes, pregúntame. Para detalles menores, elige la opción más simple y menciónala en el resumen de la fase.
4. Mantén actualizado un `CLAUDE.md` con decisiones de arquitectura, comandos y convenciones del proyecto.
