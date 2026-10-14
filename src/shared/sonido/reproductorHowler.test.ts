import { describe, expect, it, vi } from 'vitest';

import { crearReproductorHowler } from './reproductorHowler';

describe('crearReproductorHowler', () => {
  it('creates one sound per name on first use, under the app base URL, and replays it', () => {
    const play = vi.fn();
    const crearHowl = vi.fn(() => ({ play }));
    const reproductor = crearReproductorHowler({ base: '/juego/', crearHowl });
    expect(crearHowl).not.toHaveBeenCalled();

    reproductor.reproducir('acierto');
    reproductor.reproducir('acierto');
    reproductor.reproducir('tache');

    expect(crearHowl.mock.calls).toEqual([
      ['/juego/sonidos/acierto.wav'],
      ['/juego/sonidos/tache.wav'],
    ]);
    expect(play).toHaveBeenCalledTimes(3);
  });

  it('never throws when audio fails', () => {
    const roto = crearReproductorHowler({
      base: '/',
      crearHowl: () => {
        throw new Error('No audio');
      },
    });
    expect(() => {
      roto.reproducir('ganador');
    }).not.toThrow();

    const sinReproducir = crearReproductorHowler({
      base: '/',
      crearHowl: () => ({
        play: () => {
          throw new Error('NotAllowedError');
        },
      }),
    });
    expect(() => {
      sinReproducir.reproducir('revelar');
    }).not.toThrow();
  });
});
