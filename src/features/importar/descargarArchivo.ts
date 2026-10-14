/** Saves a generated file through a temporary object URL (works offline, no server needed). */
export function descargarArchivo(contenido: Blob, nombre: string): void {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.hidden = true;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  // Revoke on the next tick so the browser has started the download.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
