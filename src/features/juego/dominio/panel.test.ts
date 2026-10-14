import { describe, expect, it } from 'vitest';

import { reducir, type ConfigPartida, type Evento } from '@/engine';
import { configPrueba, preguntaSnapshotPrueba } from '@/test/fabricasPartida';

import {
  accionSiguienteRonda,
  confirmacionPara,
  evaluarAccion,
  eventoRevelar,
  ganadoresJuego,
  guiaPanel,
  respuestasOcultas,
} from './panel';

const TRES_EQUIPOS = configPrueba({
  equipos: [
    { id: 'e1', nombre: 'Rojos', color: '#b91c1c' },
    { id: 'e2', nombre: 'Azules', color: '#1d4ed8' },
    { id: 'e3', nombre: 'Verdes', color: '#15803d' },
  ],
});

const RONDA_FINAL = {
  preguntas: ['F1', 'F2', 'F3', 'F4', 'F5'].map((clave) => preguntaSnapshotPrueba(clave)),
  segundos: [20, 25] as const,
  meta: 200,
};

function estado(config: ConfigPartida, eventos: readonly Evento[]) {
  return reducir(config, eventos);
}

describe('evaluarAccion', () => {
  it('enables a valid event and carries the engine reason for an invalid one', () => {
    const config = configPrueba();
    const inicial = estado(config, []);

    expect(evaluarAccion(config, inicial, { tipo: 'ASIGNAR_TURNO', equipo: 1 })).toEqual({
      evento: { tipo: 'ASIGNAR_TURNO', equipo: 1 },
      habilitada: true,
      motivo: null,
      codigo: null,
    });
    expect(evaluarAccion(config, inicial, { tipo: 'TACHE' })).toEqual({
      evento: { tipo: 'TACHE' },
      habilitada: false,
      motivo: 'Primero indica qué equipo presionó el botón.',
      codigo: 'SIN_RESPONDEDOR',
    });
  });
});

describe('eventoRevelar', () => {
  it('reveals in face-off and play, and steals in robo', () => {
    expect(eventoRevelar('caraACara', 2)).toEqual({ tipo: 'REVELAR', indice: 2 });
    expect(eventoRevelar('enJuego', 0)).toEqual({ tipo: 'REVELAR', indice: 0 });
    expect(eventoRevelar('robo', 3)).toEqual({ tipo: 'ROBO_EXITOSO', indice: 3 });
  });
});

describe('guiaPanel', () => {
  const config = configPrueba();

  it('tells the host what to do next in the face-off', () => {
    expect(guiaPanel(config, estado(config, []))).toBe(
      'Cara a cara: asigne el turno al equipo que presionó primero el botón.',
    );
    expect(guiaPanel(config, estado(config, [{ tipo: 'ASIGNAR_TURNO', equipo: 1 }]))).toBe(
      'Responde Equipo B. Revele su respuesta o marque tache si no está en el tablero.',
    );
    expect(
      guiaPanel(
        config,
        estado(config, [
          { tipo: 'ASIGNAR_TURNO', equipo: 1 },
          { tipo: 'REVELAR', indice: 2 },
        ]),
      ),
    ).toBe('Asigne el turno al siguiente equipo que presionó el botón.');
    expect(
      guiaPanel(
        config,
        estado(config, [
          { tipo: 'ASIGNAR_TURNO', equipo: 0 },
          { tipo: 'REVELAR', indice: 0 },
        ]),
      ),
    ).toBe('Equipo A gana el cara a cara. Pregunte si juega o pasa.');
  });

  it('guides play, steal and the end of the round', () => {
    const jugando: Evento[] = [
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 0 },
      { tipo: 'JUGAR' },
    ];
    expect(guiaPanel(config, estado(config, jugando))).toBe(
      'Equipo A tiene el control. Revele cada acierto o marque tache.',
    );
    const robo: Evento[] = [...jugando, { tipo: 'TACHE' }, { tipo: 'TACHE' }, { tipo: 'TACHE' }];
    expect(guiaPanel(config, estado(config, robo))).toBe(
      'Equipo B intenta robar. Si acierta, revele esa respuesta; si no, marque «Robo fallido».',
    );
    expect(guiaPanel(config, estado(config, [...robo, { tipo: 'ROBO_FALLIDO' }]))).toBe(
      'Equipo A gana 40 puntos. Puede revelar las respuestas restantes y pasar a la siguiente ronda.',
    );
  });

  it('asks for the stealing team with 3 or more teams', () => {
    const eventos: Evento[] = [
      { tipo: 'ASIGNAR_TURNO', equipo: 0 },
      { tipo: 'REVELAR', indice: 0 },
      { tipo: 'JUGAR' },
      { tipo: 'TACHE' },
      { tipo: 'TACHE' },
      { tipo: 'TACHE' },
    ];
    expect(guiaPanel(TRES_EQUIPOS, estado(TRES_EQUIPOS, eventos))).toBe(
      'Robo: asigne el turno al equipo que intentará robar.',
    );
  });
});

describe('accionSiguienteRonda', () => {
  it('names where the next step goes', () => {
    const config = configPrueba();
    expect(accionSiguienteRonda(config, estado(config, []))).toBe('Siguiente ronda');
    const ultima = configPrueba({ rondas: configPrueba().rondas.slice(0, 1) });
    expect(accionSiguienteRonda(ultima, estado(ultima, []))).toBe('Terminar juego');
    const conFinal = configPrueba({ rondas: ultima.rondas, rondaFinal: RONDA_FINAL });
    expect(accionSiguienteRonda(conFinal, estado(conFinal, []))).toBe('Ir a la ronda final');
  });
});

describe('respuestasOcultas', () => {
  it('counts the hidden answers of the current round', () => {
    const config = configPrueba();
    expect(respuestasOcultas(estado(config, []))).toBe(5);
    expect(
      respuestasOcultas(
        estado(config, [
          { tipo: 'ASIGNAR_TURNO', equipo: 0 },
          { tipo: 'REVELAR', indice: 3 },
        ]),
      ),
    ).toBe(4);
  });
});

describe('ganadoresJuego', () => {
  it('returns the leading team, or every tied team', () => {
    const config = configPrueba();
    expect(
      ganadoresJuego(
        config,
        estado(config, [
          { tipo: 'AJUSTAR_PUNTOS', equipo: 1, delta: 30 },
          { tipo: 'TERMINAR_JUEGO' },
        ]),
      ),
    ).toEqual({ nombres: ['Equipo B'], puntaje: 30 });
    expect(ganadoresJuego(config, estado(config, [{ tipo: 'TERMINAR_JUEGO' }]))).toEqual({
      nombres: ['Equipo A', 'Equipo B'],
      puntaje: 0,
    });
  });
});

describe('confirmacionPara', () => {
  const config = configPrueba();
  const finDeRonda: Evento[] = [
    { tipo: 'ASIGNAR_TURNO', equipo: 0 },
    { tipo: 'REVELAR', indice: 0 },
    { tipo: 'JUGAR' },
    { tipo: 'TACHE' },
    { tipo: 'TACHE' },
    { tipo: 'TACHE' },
    { tipo: 'ROBO_FALLIDO' },
  ];

  it('asks before moving on with hidden answers, and not after revealing them all', () => {
    expect(
      confirmacionPara(config, estado(config, finDeRonda), { tipo: 'SIGUIENTE_RONDA' }),
    ).toMatchObject({
      titulo: 'Hay respuestas sin revelar. ¿Pasar a la siguiente ronda?',
      textoConfirmar: 'Siguiente ronda',
    });
    expect(
      confirmacionPara(config, estado(config, [...finDeRonda, { tipo: 'REVELAR_TODAS' }]), {
        tipo: 'SIGUIENTE_RONDA',
      }),
    ).toBeNull();
  });

  it('always asks before ending the game', () => {
    const ultima = configPrueba({ rondas: config.rondas.slice(0, 1) });
    const revelado = estado(ultima, [...finDeRonda, { tipo: 'REVELAR_TODAS' }]);
    expect(confirmacionPara(ultima, revelado, { tipo: 'SIGUIENTE_RONDA' })).toMatchObject({
      titulo: '¿Terminar el juego?',
      textoConfirmar: 'Terminar juego',
    });
    expect(confirmacionPara(config, estado(config, []), { tipo: 'TERMINAR_JUEGO' })).toMatchObject({
      titulo: '¿Terminar la partida?',
      textoConfirmar: 'Terminar partida',
    });
    expect(confirmacionPara(config, estado(config, []), { tipo: 'TACHE' })).toBeNull();
  });
});
