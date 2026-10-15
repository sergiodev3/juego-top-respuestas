import { describe, expect, it } from 'vitest';

import { aplicar, crearEstadoInicial, deshacer, reducir, validar } from './index';
import type { EstadoJuego, Evento } from './index';
import { caraACaraGanado, congelar, crearConfig, definido, jugar, tachas } from './prueba/fabricas';

const config = crearConfig({ equipos: 3 });

/** Three full rounds with steals, a clean sweep, adjustments and one invalid event. */
const LOG_LARGO: readonly Evento[] = congelar<Evento[]>([
  { tipo: 'ASIGNAR_TURNO', equipo: 2 },
  { tipo: 'TACHE' },
  { tipo: 'ASIGNAR_TURNO', equipo: 0 },
  { tipo: 'REVELAR', indice: 2 },
  { tipo: 'PASAR', equipo: 1 },
  { tipo: 'REVELAR', indice: 1 },
  ...tachas(3),
  { tipo: 'ROBO_EXITOSO', indice: 0 },
  { tipo: 'ASIGNAR_TURNO', equipo: 2 },
  { tipo: 'ROBO_EXITOSO', indice: 0 },
  { tipo: 'REVELAR_TODAS' },
  { tipo: 'AJUSTAR_PUNTOS', equipo: 1, delta: 5 },
  { tipo: 'SIGUIENTE_RONDA' },
  ...caraACaraGanado(1),
  { tipo: 'JUGAR' },
  { tipo: 'REVELAR', indice: 1 },
  { tipo: 'REVELAR', indice: 2 },
  { tipo: 'REVELAR', indice: 3 },
  { tipo: 'REVELAR', indice: 4 },
  { tipo: 'SIGUIENTE_RONDA' },
  { tipo: 'ASIGNAR_TURNO', equipo: 0 },
  { tipo: 'REVELAR', indice: 1 },
  { tipo: 'ASIGNAR_TURNO', equipo: 2 },
  { tipo: 'REVELAR', indice: 3 },
  { tipo: 'JUGAR' },
  ...tachas(3),
  { tipo: 'ASIGNAR_TURNO', equipo: 1 },
  { tipo: 'ROBO_FALLIDO' },
  { tipo: 'AJUSTAR_PUNTOS', equipo: 2, delta: -10 },
  { tipo: 'SIGUIENTE_RONDA' },
]);

describe('reducir', () => {
  it('returns the initial state for an empty log', () => {
    expect(reducir(config, [])).toEqual(crearEstadoInicial(config));
  });

  it('matches applying the events one by one', () => {
    const valido = LOG_LARGO.filter((_, indice) => indice !== 9);
    const paso = valido.reduce<EstadoJuego>(
      (estado, evento) => aplicar(config, estado, evento),
      crearEstadoInicial(config),
    );
    expect(jugar(config, valido)).toEqual(paso);
  });

  it('skips invalid events and reports them with their log index', () => {
    const estado = reducir(config, LOG_LARGO);
    expect(estado.advertencias).toEqual([
      { indice: 9, codigo: 'SIN_EQUIPO_ROBO', motivo: 'Primero indica qué equipo intenta robar.' },
    ]);
    expect(estado.fase).toBe('juegoTerminado');
    expect(estado.puntajes).toEqual([111, 205, 70]);
  });

  it('never throws on a corrupted log and skips malformed shapes before the rules', () => {
    const corrupto = congelar([
      null,
      { tipo: 'NO_EXISTE' },
      { tipo: 'ASIGNAR_TURNO' },
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: '0' },
      { tipo: 'REVELAR', indice: 0 },
      { tipo: 'PASAR', equipo: null },
      { tipo: 'AJUSTAR_PUNTOS', equipo: 1, delta: 0 },
    ]) as unknown as Evento[];
    const estado = reducir(config, corrupto);
    expect(estado.advertencias.map(({ indice, codigo }) => [indice, codigo])).toEqual([
      [0, 'EVENTO_MALFORMADO'],
      [1, 'EVENTO_MALFORMADO'],
      [2, 'EVENTO_MALFORMADO'],
      [4, 'EVENTO_MALFORMADO'],
      [6, 'EVENTO_MALFORMADO'],
      [7, 'EVENTO_MALFORMADO'],
    ]);
    expect(estado.advertencias[0]?.motivo).toBe('El evento guardado no tiene un formato válido.');
    expect(estado.ronda?.caraACara.ganador).toBe(0);
  });

  it('is deterministic and never mutates its inputs', () => {
    const primero = reducir(config, LOG_LARGO);
    const segundo = reducir(config, LOG_LARGO);
    expect(segundo).toEqual(primero);
    expect(segundo).not.toBe(primero);
    expect(JSON.parse(JSON.stringify(primero))).toEqual(primero);
  });

  it('does not mutate a frozen state passed to aplicar', () => {
    const estado = congelar(jugar(config, caraACaraGanado(0)));
    const siguiente = aplicar(config, estado, { tipo: 'JUGAR' });
    expect(estado.fase).toBe('caraACara');
    expect(siguiente.fase).toBe('enJuego');
  });
});

describe('deshacer', () => {
  it('drops only the last event and keeps the input intact', () => {
    const eventos = congelar<Evento[]>([{ tipo: 'ASIGNAR_TURNO', equipo: 0 }, { tipo: 'TACHE' }]);
    expect(deshacer(eventos)).toEqual([{ tipo: 'ASIGNAR_TURNO', equipo: 0 }]);
    expect(eventos).toHaveLength(2);
    expect(deshacer([])).toEqual([]);
  });

  it('replaying the undone log equals the state before the last event, at every step', () => {
    // Forward pass: the states the panel showed, one per applied event.
    const vistos: EstadoJuego[] = [];
    let actual = crearEstadoInicial(config);
    for (const evento of LOG_LARGO) {
      vistos.push(actual);
      actual = validar(config, actual, evento).ok ? aplicar(config, actual, evento) : actual;
    }
    let eventos = [...LOG_LARGO];
    for (let paso = LOG_LARGO.length - 1; paso >= 0; paso -= 1) {
      eventos = deshacer(eventos);
      // The forward pass never records warnings, so compare them separately.
      const estado = reducir(config, eventos);
      expect({ ...estado, advertencias: [] }).toEqual(definido(vistos[paso]));
      expect(estado.advertencias.map(({ indice }) => indice)).toEqual(paso > 9 ? [9] : []);
    }
    expect(eventos).toEqual([]);
  });
});
