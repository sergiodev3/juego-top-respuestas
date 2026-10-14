// Synthesizes the game's sound effects into public/sonidos/ as mono 16-bit PCM WAV files.
// Run with `npm run sonidos` after changing a sound; the WAV outputs are committed.
// Generated (not downloaded), so there is no third-party license and it works offline.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const FRECUENCIA_MUESTREO = 22050;
const sonidosDir = fileURLToPath(new URL('../public/sonidos/', import.meta.url));

/** Equal-tempered note frequency; `semitonos` from A4 (440 Hz). */
const nota = (semitonos) => 440 * 2 ** (semitonos / 12);
const C5 = nota(3);
const E5 = nota(7);
const G5 = nota(10);
const C6 = nota(15);
const E6 = nota(19);
const G6 = nota(22);
const G4 = nota(-2);

const ondas = {
  seno: (fase) => Math.sin(2 * Math.PI * fase),
  cuadrada: (fase) => (fase % 1 < 0.5 ? 1 : -1),
  sierra: (fase) => 2 * (fase % 1) - 1,
};

/**
 * One note added into `muestras`. Linear attack and release avoid clicks; `decaimiento`
 * (per second) gives bells their exponential fade. `armonicos` are relative amplitudes of
 * the 1st, 2nd, 3rd... partials. `deslizar` glides the pitch up by that ratio during the note.
 */
function agregarNota(muestras, opciones) {
  const {
    inicio,
    duracion,
    frecuencia,
    volumen = 0.5,
    onda = 'seno',
    armonicos = [1],
    ataque = 0.005,
    liberacion = 0.05,
    decaimiento = 0,
    deslizar = 1,
  } = opciones;
  const primera = Math.round(inicio * FRECUENCIA_MUESTREO);
  const total = Math.round(duracion * FRECUENCIA_MUESTREO);
  const generar = ondas[onda];
  let fase = 0;
  for (let i = 0; i < total && primera + i < muestras.length; i++) {
    const t = i / FRECUENCIA_MUESTREO;
    const progreso = i / total;
    const f = frecuencia * (1 + (deslizar - 1) * Math.min(1, progreso * 4));
    fase += f / FRECUENCIA_MUESTREO;
    let valor = 0;
    armonicos.forEach((amplitud, n) => {
      valor += amplitud * generar(fase * (n + 1));
    });
    const envolvente =
      Math.min(1, t / ataque) *
      Math.min(1, (duracion - t) / liberacion) *
      Math.exp(-decaimiento * t);
    muestras[primera + i] += valor * envolvente * volumen;
  }
}

/** Normalizes to a safe peak and encodes a mono 16-bit PCM WAV file. */
function codificarWav(muestras, pico = 0.85) {
  const maximo = muestras.reduce((max, valor) => Math.max(max, Math.abs(valor)), 0) || 1;
  const escala = pico / maximo;
  const bytesDatos = muestras.length * 2;
  const buffer = Buffer.alloc(44 + bytesDatos);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + bytesDatos, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(FRECUENCIA_MUESTREO, 24);
  buffer.writeUInt32LE(FRECUENCIA_MUESTREO * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(bytesDatos, 40);
  muestras.forEach((valor, i) => {
    const limitado = Math.max(-1, Math.min(1, valor * escala));
    buffer.writeInt16LE(Math.round(limitado * 32767), 44 + i * 2);
  });
  return buffer;
}

function crearMuestras(segundos) {
  return new Float64Array(Math.round(segundos * FRECUENCIA_MUESTREO));
}

const CAMPANA = { armonicos: [1, 0.35, 0.12], decaimiento: 5, liberacion: 0.08 };

/** Correct answer: bright rising three-note chime (~0.6 s). */
function acierto() {
  const muestras = crearMuestras(0.6);
  [C6, E6, G6].forEach((frecuencia, i) => {
    agregarNota(muestras, { ...CAMPANA, inicio: i * 0.09, duracion: 0.6 - i * 0.09, frecuencia });
  });
  return muestras;
}

/** Strike: harsh low buzzer, two detuned square waves (~0.7 s). */
function tache() {
  const muestras = crearMuestras(0.7);
  for (const frecuencia of [98, 104]) {
    agregarNota(muestras, {
      inicio: 0,
      duracion: 0.7,
      frecuencia,
      onda: 'cuadrada',
      armonicos: [1, 0.3],
      ataque: 0.01,
      liberacion: 0.08,
    });
  }
  return muestras;
}

/** Reveal without points: soft ding with a short upward glide (~0.4 s). */
function revelar() {
  const muestras = crearMuestras(0.4);
  agregarNota(muestras, {
    inicio: 0,
    duracion: 0.4,
    frecuencia: 660,
    armonicos: [1, 0.2],
    deslizar: 1.5,
    ataque: 0.01,
    liberacion: 0.1,
    decaimiento: 6,
  });
  return muestras;
}

/** Winner: short brass-like fanfare ending on a held major chord (~1.5 s). */
function ganador() {
  const muestras = crearMuestras(1.5);
  const metal = { onda: 'sierra', armonicos: [1, 0.25], ataque: 0.02, liberacion: 0.06 };
  [G4, C5, E5].forEach((frecuencia, i) => {
    agregarNota(muestras, { ...metal, inicio: i * 0.14, duracion: 0.13, frecuencia, volumen: 0.4 });
  });
  for (const frecuencia of [C5, E5, G5]) {
    agregarNota(muestras, {
      ...metal,
      inicio: 0.42,
      duracion: 1.08,
      frecuencia,
      volumen: 0.3,
      liberacion: 0.4,
      decaimiento: 0.8,
    });
  }
  return muestras;
}

await mkdir(sonidosDir, { recursive: true });
for (const [nombre, generar] of Object.entries({ acierto, tache, revelar, ganador })) {
  await writeFile(`${sonidosDir}${nombre}.wav`, codificarWav(generar()));
}
console.log('Sonidos generados en public/sonidos/.');
