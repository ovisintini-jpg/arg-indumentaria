"use client";

import { createContext, useContext, useState, useRef, useEffect, ReactNode, useCallback } from "react";

/* El "cotizador" de la versión de autopartes era para pedir una pieza que no
   estaba en el catálogo. Acá cumple la misma función, pero con las preguntas
   de una tienda de ropa: qué prenda, de qué marca, en qué talle y color.
   Es la puerta de entrada de los pedidos por encargo, y también la salida del
   cliente que encontró la prenda pero no su talle. */

/** Lo que ya sabemos cuando el cliente abre el formulario. */
export interface QuotePrefill {
  producto?: string;
  marca?:    string;
  talle?:    string;
  color?:    string;
  referencia?: string;
}

interface QuoteContextValue {
  abierto: boolean;
  prefill: QuotePrefill;
  /** Lo último que el cliente estuvo mirando, para no hacérselo escribir. */
  ultimo: QuotePrefill;
  setUltimo: (v: QuotePrefill) => void;
  abrirCotizador: (prefill?: QuotePrefill) => void;
  cerrarCotizador: () => void;
}

const QuoteContext = createContext<QuoteContextValue | null>(null);

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const [prefill, setPrefill] = useState<QuotePrefill>({});
  const [ultimo, setUltimo]   = useState<QuotePrefill>({});

  // Ref para que abrirCotizador no cambie de identidad en cada búsqueda
  const ultimoRef = useRef<QuotePrefill>({});
  useEffect(() => { ultimoRef.current = ultimo; }, [ultimo]);

  // Lo que venga por parámetro pisa a lo guardado.
  const abrirCotizador = useCallback((p: QuotePrefill = {}) => {
    setPrefill({ ...ultimoRef.current, ...p });
    setAbierto(true);
  }, []);

  const cerrarCotizador = useCallback(() => setAbierto(false), []);

  return (
    <QuoteContext.Provider
      value={{ abierto, prefill, ultimo, setUltimo, abrirCotizador, cerrarCotizador }}
    >
      {children}
    </QuoteContext.Provider>
  );
}

export function useQuote(): QuoteContextValue {
  const ctx = useContext(QuoteContext);
  if (!ctx) throw new Error("useQuote debe usarse dentro de QuoteProvider");
  return ctx;
}
