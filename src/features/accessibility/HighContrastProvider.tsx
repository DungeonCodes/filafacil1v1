"use client";

import { createContext, useContext, useEffect, useState } from "react";

const HIGH_CONTRAST_STORAGE_KEY = "filafacil:high-contrast";

type HighContrastContextValue = {
  isHighContrast: boolean;
  toggleHighContrast: () => void;
};

const HighContrastContext = createContext<HighContrastContextValue>({
  isHighContrast: false,
  toggleHighContrast: () => {}
});

type HighContrastProviderProps = {
  readonly children: React.ReactNode;
};

function readStoredPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY) === "enabled";
  } catch {
    return false;
  }
}

function persistPreference(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, value ? "enabled" : "disabled");
  } catch {
    // Ignore storage errors to avoid blocking the interface.
  }
}

function applyDocumentPreference(value: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-high-contrast", value ? "true" : "false");
}

export function HighContrastProvider({ children }: HighContrastProviderProps) {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const storedValue = readStoredPreference();
    setIsHighContrast(storedValue);
    applyDocumentPreference(storedValue);
  }, []);

  useEffect(() => {
    applyDocumentPreference(isHighContrast);
    persistPreference(isHighContrast);
  }, [isHighContrast]);

  return (
    <HighContrastContext.Provider
      value={{
        isHighContrast,
        toggleHighContrast: () => setIsHighContrast((currentValue) => !currentValue)
      }}
    >
      {children}
    </HighContrastContext.Provider>
  );
}

export function useHighContrast() {
  return useContext(HighContrastContext);
}
