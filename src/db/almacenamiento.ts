/** The subset of `StorageManager` this module needs; every member may be missing. */
export interface AlmacenamientoNavegador {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

function almacenamientoDelNavegador(): AlmacenamientoNavegador | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  // `navigator.storage` is missing in insecure contexts and some older browsers.
  const almacenamiento: StorageManager | undefined = navigator.storage;
  return almacenamiento;
}

/**
 * Asks the browser not to evict IndexedDB data under storage pressure.
 * Resolves to whether storage is persistent; never throws.
 */
export async function solicitarAlmacenamientoPersistente(
  almacenamiento: AlmacenamientoNavegador | undefined = almacenamientoDelNavegador(),
): Promise<boolean> {
  try {
    if (!almacenamiento?.persist) {
      return false;
    }
    if (almacenamiento.persisted && (await almacenamiento.persisted())) {
      return true;
    }
    return await almacenamiento.persist();
  } catch {
    return false;
  }
}
