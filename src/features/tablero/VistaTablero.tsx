/**
 * Projector board. Rendered outside the app shell: full screen, dark, high contrast.
 * It will only display the `proyectarTablero` projection received from the panel.
 */
export function VistaTablero() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-black p-8 text-center text-white">
      <h1 className="text-6xl font-extrabold tracking-tight text-amber-300 md:text-8xl">
        Top Respuestas
      </h1>
      <p className="text-3xl font-semibold md:text-5xl">Esperando al conductor…</p>
    </main>
  );
}
