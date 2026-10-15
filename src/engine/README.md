# engine

Pure TypeScript game engine (Fase 3). Event-sourced: `estado = reducir(config, eventos)`.

No React, React DOM, Dexie, or imports from `@/features`, `@/app`, or `@/db` (enforced by ESLint `no-restricted-imports`). No `Date`, `Math.random`, or I/O: the same config and log always produce the same state. The full rules live in [`odd/tasks/fase-3-motor.md`](../../odd/tasks/fase-3-motor.md) ("Rules specification").

## Public API (`@/engine`)

| Export                             | Purpose                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| `crearEstadoInicial(config)`       | Round 1 face-off, scores at 0. Throws if `validarConfig` finds problems.                    |
| `validarConfig(config): string[]`  | Spanish messages for a malformed snapshot (2-4 teams, >= 1 round, 5 final questions, ...).  |
| `validar(config, estado, evento)`  | `{ ok: true }` or `{ ok: false, codigo, motivo }`; the panel uses it to enable actions.     |
| `aplicar(config, estado, evento)`  | Next state for a valid event; throws `EventoRechazadoError` (with `codigo`) otherwise.      |
| `reducir(config, eventos)`         | Replays a typed log. Expects a valid config (throws otherwise, like `crearEstadoInicial`).  |
| `reconstruir(config, eventos)`     | Persistence-boundary rebuild from `unknown` data; never throws (see "Undo and replay").     |
| `esquemaConfigPartida`             | Zod schema for the shape of a stored config snapshot (rules stay in `validarConfig`).       |
| `esquemaEvento`                    | Zod discriminated union for the shape of every stored event, tied to the `Evento` type.     |
| `deshacer(eventos)`                | The log without its last event (undo).                                                      |
| `proyectarTablero(config, estado)` | `VistaTablero`: what the projector may show. JSON-serializable, never leaks hidden answers. |
| Types                              | `ConfigPartida`, `PreguntaSnapshot`, `Evento`, `EstadoJuego`, `Fase`, `CodigoRechazo`, ...  |

Teams are addressed by index (0-3, keys A-D). `ConfigPartida` is a snapshot (teams, rounds with their questions and multipliers, strike limit, optional final round), so replay never depends on the question bank. Answers in a `PreguntaSnapshot` are sorted by points, desc.

The board's round view carries `fallosCaraACara`, the number of face-off misses this round (separate from `tachas`). It is only a count, stays after the face-off ends (so undoing back into it never raises it) and restarts at 0 each round; the board shows one big X each time it goes up.

## Phases

```
              ASIGNAR_TURNO / REVELAR / TACHE
                   (attempts until resolved)
                            |
  +------------------> caraACara --JUGAR / PASAR--> enJuego --all revealed--> finDeRonda
  |                                                    |                      ^   |
  |                                         tachasMaximas strikes             |   |
  |                                                    v                      |   |
  |                                                  robo --ROBO_EXITOSO------+   |
  |                                                         ROBO_FALLIDO          |
  +------------------------- SIGUIENTE_RONDA (more rounds) -----------------------+
                                                                                  |
                     SIGUIENTE_RONDA after the last round                         |
          rondaFinal (if configured) <-------------------------------------------+
               |                      or juegoTerminado (no final round)
          RF_TERMINAR
               v
         juegoTerminado   <-- TERMINAR_JUEGO from any phase
```

## Events

| Event                                               | Valid in                    | Effect                                                                                                                                                                                     |
| --------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ASIGNAR_TURNO(equipo)`                             | caraACara, robo, rondaFinal | Face-off responder (or winner correction once resolved); stealing team; final-round team.                                                                                                  |
| `REVELAR(indice)`                                   | caraACara, enJuego          | Reveal an answer and add its points to the pot (`bolsa`).                                                                                                                                  |
| `TACHE`                                             | caraACara, enJuego          | Face-off miss (not a strike) or a strike; the last strike opens `robo`.                                                                                                                    |
| `JUGAR` / `PASAR(equipo?)`                          | caraACara (resolved)        | Control to the winner / another team (`equipo` required with 3-4 teams). If the face-off already revealed every answer, that team wins pot x multiplier and the round ends (`finDeRonda`). |
| `ROBO_EXITOSO(indice)` / `ROBO_FALLIDO`             | robo                        | Pot x multiplier to the stealing team / the control team.                                                                                                                                  |
| `REVELAR_TODAS`                                     | finDeRonda                  | Show remaining answers without points.                                                                                                                                                     |
| `SIGUIENTE_RONDA`                                   | finDeRonda                  | Next face-off, the final round, or the end of the game.                                                                                                                                    |
| `AJUSTAR_PUNTOS(equipo, delta)`                     | any but juegoTerminado      | Manual correction, non-zero integer, scores may go negative.                                                                                                                               |
| `TERMINAR_JUEGO`                                    | any but juegoTerminado      | End the game.                                                                                                                                                                              |
| `RF_RESPUESTA { jugador, pregunta, indice, texto }` | rondaFinal                  | Record (or correct) an answer; player 2 repeating player 1 is `RESPUESTA_REPETIDA`.                                                                                                        |
| `RF_REVELAR { jugador, pregunta }`                  | rondaFinal                  | Reveal a recorded answer and its points.                                                                                                                                                   |
| `RF_SIGUIENTE_JUGADOR` / `RF_TERMINAR`              | rondaFinal                  | Switch to player 2 / end with `{ total, meta, superoMeta }` and add `total` to the playing team's score.                                                                                   |

Rejections carry a stable `codigo` (`FASE_INVALIDA`, `EQUIPO_INVALIDO`, `RESPUESTA_YA_REVELADA`, `SIN_EQUIPO_ROBO`, `RESPUESTA_REPETIDA`, `JUEGO_TERMINADO`, ...) and a user-facing Spanish `motivo`. Replay also reports `EVENTO_MALFORMADO` for a stored event whose shape fails `esquemaEvento`.

Final-round scoring: `RF_TERMINAR` adds the final-round total (the revealed answers of both players, the same value as `resultado.total`) to the playing team's score. `TERMINAR_JUEGO` during the final round leaves `resultado: null` and adds nothing.

## Undo and replay

The panel stores the config snapshot plus the event log and persists both after every action. `DESHACER` is not an event: undo is `reducir(config, deshacer(eventos))`, which equals the state before the last event. Replay never throws for a bad event (for example a log written by an older version): each event is checked against `esquemaEvento` and then the rules, and a malformed or invalid one is skipped and reported in `estado.advertencias` as `{ indice, codigo, motivo }`.

`reducir` keeps a typed contract: it expects a config that `validarConfig` accepts and throws otherwise. Data read back from storage goes through `reconstruir(config: unknown, eventos: unknown)` instead, which never throws and returns either `{ ok: true, config, estado, advertencias }` or `{ ok: false, errores }` (Spanish messages for a malformed or invalid config, a log that is not a list, or unreadable data). Use the returned `config` (validated, unknown keys dropped) for every later call. Every event `validar` accepts passes `esquemaEvento`, so a log written by the panel always replays in full.

## Layout

- `tipos.ts` engine-owned types; `rechazos.ts` rejection codes and Spanish messages.
- `estadoInicial.ts` config validation and initial state; `motor.ts` dispatch, `validar`, `aplicar`, `reducir`, `deshacer`.
- `esquemas.ts` Zod shape schemas for stored data; `reconstruccion.ts` `reconstruir` (persistence boundary).
- `reglas/` one module per phase (`caraACara`, `enJuego`, `robo`, `finDeRonda`, `rondaFinal`) plus shared helpers (`comun`).
- `proyeccion.ts` board projection; `prueba/` test-only builders and game logs.

Coverage: `npm run test:coverage` enforces lines/statements/functions >= 95% and branches >= 90% on `src/engine/**`.
