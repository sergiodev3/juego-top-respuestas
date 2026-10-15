/**
 * One portrait letter sheet, shared by the card sheets and the scoreboard sheet. On screen it
 * keeps the letter proportions with padding standing in for the 10 mm page margin; in print the
 * `@page` rule sets the margin and each sheet fills one page (`break-after: page`) unsplit.
 */
export const CLASE_HOJA =
  'aspect-[8.5/11] w-full max-w-[8.5in] bg-white p-[0.4in] text-slate-950 shadow-md ring-1 ring-slate-300 print:aspect-auto print:h-[257mm] print:max-w-none print:break-inside-avoid print:break-after-page print:p-0 print:text-black print:shadow-none print:ring-0 print:last:break-after-auto';
