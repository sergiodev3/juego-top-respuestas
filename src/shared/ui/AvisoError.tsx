import type { ReactNode } from 'react';

interface AvisoErrorProps {
  children: ReactNode;
}

/** Announced error banner (role="alert"). Render it only while there is an error. */
export function AvisoError({ children }: AvisoErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-md border border-red-300 bg-red-50 px-4 py-3 font-medium text-red-900"
    >
      {children}
    </div>
  );
}
