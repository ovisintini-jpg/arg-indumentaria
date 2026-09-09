"use client";

import { useEffect } from "react";
import Link from "next/link";

/* La pantalla de error del lado del cliente. Dice qué pasó en criollo, ofrece
   reintentar (que es lo que arregla la mayoría de los casos: una consulta que
   se cortó) y deja la salida al inicio. Nada de "Error 500" ni de códigos: el
   que compra ropa no sabe ni le importa qué es un 500. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-6 py-20">
      <div className="w-full max-w-[520px] text-center">
        <p className="ag-eyebrow !text-sale">Algo salió mal</p>

        <h1 className="mt-4 font-display text-[clamp(1.6rem,5vw,2.6rem)] font-extrabold uppercase leading-tight tracking-[-0.03em]">
          Se nos rompió algo de este lado
        </h1>

        <p className="mx-auto mt-4 max-w-[44ch] text-[0.95rem] text-mute">
          Ya quedó registrado. Probá de nuevo: casi siempre es una consulta que se
          cortó y a la segunda anda. Si sigue pasando, escribinos.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={() => reset()} className="ag-btn ag-btn-solid">
            Reintentar
          </button>
          <Link href="/" className="ag-btn ag-btn-ghost">
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
