import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { registerSW } from 'virtual:pwa-register';

import { solicitarAlmacenamientoPersistente } from '@/db/almacenamiento';
import { baseDatos } from '@/db/instancia';
import { RepositoriosProvider } from '@/db/RepositoriosProvider';
import { aplicarSemillaSiHaceFalta } from '@/db/semilla';

import './index.css';
import { router } from './router';

registerSW({ immediate: true });

void solicitarAlmacenamientoPersistente();
// Live queries pick up the sample data as soon as the seed transaction commits.
aplicarSemillaSiHaceFalta(baseDatos).catch((error: unknown) => {
  console.error('No se pudieron cargar los datos de ejemplo.', error);
});

const contenedor = document.getElementById('root');
if (!contenedor) {
  throw new Error('No se encontró el elemento #root en index.html.');
}

createRoot(contenedor).render(
  <StrictMode>
    <RepositoriosProvider>
      <RouterProvider router={router} />
    </RepositoriosProvider>
  </StrictMode>,
);
