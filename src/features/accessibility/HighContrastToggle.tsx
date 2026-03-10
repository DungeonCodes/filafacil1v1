"use client";

import { useHighContrast } from "./HighContrastProvider";

export function HighContrastToggle() {
  const { isHighContrast, toggleHighContrast } = useHighContrast();

  return (
    <button
      type="button"
      aria-pressed={isHighContrast}
      aria-label={isHighContrast ? "Desativar modo de alto contraste" : "Ativar modo de alto contraste"}
      onClick={toggleHighContrast}
      className={`inline-flex min-h-12 items-center justify-center rounded-xl border-2 px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 ${
        isHighContrast
          ? "border-white bg-yellow-300 text-black hover:bg-yellow-200"
          : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
      }`}
    >
      Alto contraste: {isHighContrast ? "Ligado" : "Desligado"}
    </button>
  );
}
