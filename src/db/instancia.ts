import { BaseDatosTopRespuestas } from './baseDatos';
import { crearRepositoriosDexie } from './repositoriosDexie';

/** The app's single database instance (opens lazily on first query). */
export const baseDatos = new BaseDatosTopRespuestas();

/** Production repositories backed by `baseDatos`. */
export const repositoriosApp = crearRepositoriosDexie(baseDatos);
