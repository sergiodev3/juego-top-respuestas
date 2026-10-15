import { describe, expect, it } from 'vitest';

import {
  aplicar,
  crearEstadoInicial,
  deshacer,
  proyectarTablero,
  puntosVisibles,
  reducir,
} from './index';
import type { ConfigPartida, EstadoJuego, Evento } from './index';
import { caraACaraGanado, crearConfig, definido, jugar, tachas } from './prueba/fabricas';
import {
  generarPartida,
  partidaDosEquipos,
  RONDA_FINAL_DOS_EQUIPOS,
  type Partida,
} from './prueba/partidas';

/** Every answer text and synonym the board must not show in `estado`. */
function textosProhibidos(config: ConfigPartida, estado: EstadoJuego): string[] {
  const prohibidos: string[] = [];
  config.rondas.forEach(({ pregunta }, indiceRonda) => {
    pregunta.respuestas.forEach((respuesta, indice) => {
      prohibidos.push(...respuesta.sinonimos);
      const visible =
        estado.ronda?.indice === indiceRonda && estado.ronda.respuestas[indice] !== 'oculta';
      if (!visible) {
        prohibidos.push(respuesta.texto);
      }
    });
  });
  // The final round shows what players said, never the configured answers or synonyms.
  for (const pregunta of config.rondaFinal?.preguntas ?? []) {
    for (const respuesta of pregunta.respuestas) {
      prohibidos.push(respuesta.texto, ...respuesta.sinonimos);
    }
  }
  const { rondaFinal } = estado;
  if (rondaFinal !== null) {
    const jugador1Oculto = estado.fase === 'rondaFinal' && rondaFinal.jugadorActual === 2;
    for (const respuesta of rondaFinal.jugador1) {
      if (respuesta !== null && (!respuesta.revelada || jugador1Oculto)) {
        prohibidos.push(respuesta.texto);
      }
    }
    for (const respuesta of rondaFinal.jugador2) {
      if (respuesta !== null && !respuesta.revelada) {
        prohibidos.push(respuesta.texto);
      }
    }
  }
  return prohibidos;
}

function verificarSinFugas(config: ConfigPartida, estado: EstadoJuego): void {
  const serializado = JSON.stringify(proyectarTablero(config, estado));
  for (const texto of textosProhibidos(config, estado)) {
    expect(serializado, `leaked "${texto}" in phase ${estado.fase}`).not.toContain(texto);
  }
}

describe('proyectarTablero: regular rounds', () => {
  const config = crearConfig({ multiplicadores: [2, 1] });

  it('shows the start of the game', () => {
    expect(proyectarTablero(config, crearEstadoInicial(config))).toEqual({
      nombreJuego: 'Juego de prueba',
      fase: 'caraACara',
      equipos: [
        { nombre: 'Equipo A', color: '#1d4ed8', puntaje: 0 },
        { nombre: 'Equipo B', color: '#b91c1c', puntaje: 0 },
      ],
      ronda: {
        numero: 1,
        total: 2,
        multiplicador: 2,
        pregunta: 'Pregunta R1',
        respuestas: [1, 2, 3, 4, 5].map((numero) => ({ numero, revelada: false })),
        tachas: 0,
        tachasMaximas: 3,
        bolsa: 0,
        equipoControl: null,
        equipoRobo: null,
        ganadorCaraACara: null,
        fallosCaraACara: 0,
        ganadorRonda: null,
        puntosOtorgados: null,
      },
      rondaFinal: null,
    });
  });

  it('shows text and points only for revealed answers', () => {
    const estado = jugar(config, [...caraACaraGanado(0), { tipo: 'JUGAR' }, ...tachas(3)]);
    const vista = proyectarTablero(config, estado);
    expect(vista.ronda?.respuestas[0]).toEqual({
      numero: 1,
      revelada: true,
      texto: 'TXT_R1_0',
      // Round 1 is x2: display points are already multiplied.
      puntos: 80,
    });
    expect(vista.ronda?.respuestas[1]).toEqual({ numero: 2, revelada: false });
    expect(vista.ronda).toMatchObject({
      tachas: 3,
      bolsa: 80,
      equipoControl: 0,
      equipoRobo: 1,
      ganadorCaraACara: 0,
    });
  });

  it('shows the round winner, awarded points and answers revealed without points', () => {
    const estado = jugar(config, [
      ...caraACaraGanado(0),
      { tipo: 'JUGAR' },
      ...tachas(3),
      { tipo: 'ROBO_EXITOSO', indice: 4 },
      { tipo: 'REVELAR_TODAS' },
    ]);
    const vista = proyectarTablero(config, estado);
    expect(vista.equipos.map(({ puntaje }) => puntaje)).toEqual([0, 96]);
    expect(vista.ronda).toMatchObject({ ganadorRonda: 1, puntosOtorgados: 96 });
    expect(vista.ronda?.respuestas.every(({ revelada }) => revelada)).toBe(true);
    expect(vista.ronda?.respuestas[2]).toEqual({
      numero: 3,
      revelada: true,
      texto: 'TXT_R1_2',
      puntos: 30,
    });
  });

  it('never includes synonyms, other rounds or engine warnings', () => {
    const estado = reducir(config, [...caraACaraGanado(0), { tipo: 'JUGAR' }, { tipo: 'JUGAR' }]);
    expect(estado.advertencias).toHaveLength(1);
    const serializado = JSON.stringify(proyectarTablero(config, estado));
    expect(serializado).not.toContain('SIN_');
    expect(serializado).not.toContain('R2');
    expect(serializado).not.toContain('advertencias');
  });
});

describe('proyectarTablero: points on display are already multiplied', () => {
  // Answers worth 40/25/15/12/8 in rounds x2, x1 and x3.
  const config = crearConfig({ multiplicadores: [2, 1, 3] });
  const rondaUno: Evento[] = [
    ...caraACaraGanado(0),
    { tipo: 'JUGAR' },
    { tipo: 'REVELAR', indice: 1 },
  ];

  it('shows doubled answer points and a doubled pot in an x2 round', () => {
    const vista = proyectarTablero(config, jugar(config, rondaUno));
    expect(vista.ronda?.respuestas.slice(0, 3)).toEqual([
      { numero: 1, revelada: true, texto: 'TXT_R1_0', puntos: 80 },
      { numero: 2, revelada: true, texto: 'TXT_R1_1', puntos: 50 },
      { numero: 3, revelada: false },
    ]);
    expect(vista.ronda?.bolsa).toBe(130);
  });

  it('keeps the base points in an x1 round', () => {
    const ganarRondaUno: Evento[] = [
      ...rondaUno,
      ...[2, 3, 4].map((indice): Evento => ({ tipo: 'REVELAR', indice })),
    ];
    const vista = proyectarTablero(
      config,
      jugar(config, [
        ...ganarRondaUno,
        { tipo: 'SIGUIENTE_RONDA' },
        { tipo: 'ASIGNAR_TURNO', equipo: 1 },
        { tipo: 'REVELAR', indice: 0 },
      ]),
    );
    expect(vista.ronda).toMatchObject({ numero: 2, multiplicador: 1, bolsa: 40 });
    expect(vista.ronda?.respuestas[0]).toMatchObject({ puntos: 40 });
  });

  it('awards exactly the pot on display, which is the base pot times the multiplier (steal in x3)', () => {
    const triple = crearConfig({ multiplicadores: [3] });
    const estado = jugar(triple, [
      ...caraACaraGanado(0),
      { tipo: 'JUGAR' },
      ...tachas(3),
      { tipo: 'ROBO_EXITOSO', indice: 4 },
      { tipo: 'REVELAR_TODAS' },
    ]);
    const vista = proyectarTablero(triple, estado);
    // Base pot 40 + 8 = 48; x3 = 144, the same score the rules awarded before this change.
    expect(estado.ronda?.bolsa).toBe(48);
    expect(vista.equipos.map(({ puntaje }) => puntaje)).toEqual([0, 144]);
    expect(vista.ronda).toMatchObject({ bolsa: 144, puntosOtorgados: 144 });
    expect(vista.ronda?.respuestas[4]).toMatchObject({ texto: 'TXT_R1_4', puntos: 24 });
    // Answers shown after the round (no points awarded) still show their display value.
    expect(vista.ronda?.respuestas[2]).toMatchObject({ texto: 'TXT_R1_2', puntos: 45 });
  });
});

describe('puntosVisibles', () => {
  it('gives the panel every answer (hidden ones too) and the pot, multiplied like the board', () => {
    const config = crearConfig({ multiplicadores: [3] });
    const estado = jugar(config, caraACaraGanado(1));
    expect(puntosVisibles(config, definido(estado.ronda))).toEqual({
      respuestas: [120, 75, 45, 36, 24],
      bolsa: 120,
    });
  });
});

describe('proyectarTablero: face-off misses', () => {
  const config = crearConfig();
  const fallo = (equipo: number): Evento[] => [
    { tipo: 'ASIGNAR_TURNO', equipo },
    { tipo: 'TACHE' },
  ];
  const dosFallos: Evento[] = [...fallo(0), ...fallo(1)];
  const fallosTras = (eventos: Evento[]) =>
    proyectarTablero(config, jugar(config, eventos)).ronda?.fallosCaraACara;

  it('counts each face-off miss without touching the round strikes', () => {
    expect(fallosTras(fallo(0))).toBe(1);
    const vista = proyectarTablero(config, jugar(config, dosFallos));
    expect(vista.ronda).toMatchObject({ fallosCaraACara: 2, tachas: 0 });
  });

  it('does not count a face-off hit', () => {
    expect(
      fallosTras([
        ...dosFallos,
        { tipo: 'ASIGNAR_TURNO', equipo: 0 },
        { tipo: 'REVELAR', indice: 1 },
      ]),
    ).toBe(2);
    expect(fallosTras(caraACaraGanado(0))).toBe(0);
  });

  it('keeps the count for the rest of the round, so undoing back into the face-off never raises it', () => {
    const resuelto: Evento[] = [...fallo(0), ...caraACaraGanado(1)];
    expect(fallosTras(resuelto)).toBe(1);
    expect(fallosTras([...resuelto, { tipo: 'JUGAR' }, { tipo: 'TACHE' }])).toBe(1);
  });

  it('goes down when a miss is undone', () => {
    expect(fallosTras(deshacer(dosFallos))).toBe(1);
  });

  it('starts again at zero in the next round', () => {
    const rondaGanada: Evento[] = [
      ...fallo(1),
      ...caraACaraGanado(0),
      { tipo: 'JUGAR' },
      ...[1, 2, 3, 4].map((indice): Evento => ({ tipo: 'REVELAR', indice })),
    ];
    expect(fallosTras(rondaGanada)).toBe(1);
    const siguiente = proyectarTablero(
      config,
      jugar(config, [...rondaGanada, { tipo: 'SIGUIENTE_RONDA' }]),
    );
    expect(siguiente.ronda).toMatchObject({ numero: 2, fallosCaraACara: 0 });
  });

  it('carries only the count, never which team missed or any answer data', () => {
    const vista = proyectarTablero(config, jugar(config, dosFallos));
    expect(vista.ronda?.respuestas.every(({ revelada }) => !revelada)).toBe(true);
    expect(JSON.stringify(vista)).not.toContain('intentos');
    verificarSinFugas(config, jugar(config, dosFallos));
  });
});

describe('proyectarTablero: final round', () => {
  const { config, eventos } = partidaDosEquipos(200);
  const inicioRf = eventos.length - RONDA_FINAL_DOS_EQUIPOS.length;
  const cambioJugador = eventos.findIndex(({ tipo }) => tipo === 'RF_SIGUIENTE_JUGADOR');

  it('shows revealed answers of player 1 and the running total', () => {
    const estado = jugar(config, eventos.slice(0, inicioRf + 3));
    const vista = proyectarTablero(config, estado);
    expect(vista.fase).toBe('rondaFinal');
    expect(vista.ronda).toBeNull();
    expect(vista.rondaFinal).toEqual({
      equipo: 0,
      jugadorActual: 1,
      jugadores: [
        {
          jugador: 1,
          oculto: false,
          respuestas: [
            { numero: 1, revelada: true, texto: 'DICHO_1_0_', puntos: 50 },
            { numero: 2, revelada: false },
            { numero: 3, revelada: false },
            { numero: 4, revelada: false },
            { numero: 5, revelada: false },
          ],
        },
        {
          jugador: 2,
          oculto: false,
          respuestas: [1, 2, 3, 4, 5].map((numero) => ({ numero, revelada: false })),
        },
      ],
      total: 50,
      meta: 200,
      resultado: null,
    });
  });

  it("hides player 1's answers while player 2 plays", () => {
    const estado = jugar(config, eventos.slice(0, cambioJugador + 3));
    const vista = proyectarTablero(config, estado);
    const [jugador1, jugador2] = vista.rondaFinal?.jugadores ?? [];
    expect(jugador1).toEqual({
      jugador: 1,
      oculto: true,
      respuestas: [1, 2, 3, 4, 5].map((numero) => ({ numero, revelada: false })),
    });
    expect(jugador2?.respuestas[0]).toEqual({
      numero: 1,
      revelada: true,
      texto: 'DICHO_2_0_',
      puntos: 30,
    });
    expect(vista.rondaFinal?.total).toBe(175);
  });

  it('shows both players and the result when the final round ends', () => {
    const vista = proyectarTablero(config, jugar(config, eventos));
    expect(vista.fase).toBe('juegoTerminado');
    expect(vista.rondaFinal?.jugadores.map(({ oculto }) => oculto)).toEqual([false, false]);
    expect(vista.rondaFinal?.jugadores[0]?.respuestas[2]).toEqual({
      numero: 3,
      revelada: true,
      texto: 'DICHO_1_2_',
      puntos: 0,
    });
    expect(vista.rondaFinal?.resultado).toEqual({ total: 260, meta: 200, superoMeta: true });
    expect(vista.equipos.map(({ puntaje }) => puntaje)).toEqual([652, 165]);
  });

  it('is JSON-serializable', () => {
    const vista = proyectarTablero(config, jugar(config, eventos.slice(0, cambioJugador + 2)));
    expect(JSON.parse(JSON.stringify(vista))).toEqual(vista);
  });
});

describe('proyectarTablero: never leaks hidden answers (property)', () => {
  const escenarios: Partida[] = [
    partidaDosEquipos(200),
    partidaDosEquipos(300),
    ...[2, 3, 4].flatMap((equipos) =>
      [11, 29, 47, 83, 101].map((semilla) => {
        const config = crearConfig({ equipos, rondaFinal: true });
        return { config, eventos: generarPartida(config, semilla * equipos, 220) };
      }),
    ),
  ];

  it('walks every prefix of every scenario log', () => {
    let estadosRevisados = 0;
    const fases = new Set<string>();
    for (const { config, eventos } of escenarios) {
      let estado = crearEstadoInicial(config);
      verificarSinFugas(config, estado);
      for (const evento of eventos) {
        estado = aplicar(config, estado, evento);
        verificarSinFugas(config, estado);
        fases.add(estado.fase);
        estadosRevisados += 1;
      }
    }
    expect(estadosRevisados).toBeGreaterThan(1000);
    expect([...fases].sort()).toEqual(
      ['caraACara', 'enJuego', 'finDeRonda', 'juegoTerminado', 'robo', 'rondaFinal'].sort(),
    );
  });

  it('generated logs replay to the same state', () => {
    for (const { config, eventos } of escenarios) {
      const pasoAPaso = eventos.reduce<EstadoJuego>(
        (estado, evento: Evento) => aplicar(config, estado, evento),
        crearEstadoInicial(config),
      );
      expect(reducir(config, eventos)).toEqual(pasoAPaso);
    }
  });
});
